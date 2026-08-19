from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path
from typing import Any, Callable

import recroom_https_recnet_fix  # noqa: F401
from recroom_wine_pool import RecRoomWinePool


_DIAGNOSTIC_REVISION = "graphics-failure-diagnostics-v2-tls-uri"
_ORIGINAL_PROVISION = RecRoomWinePool.provision
_ORIGINAL_CAPABILITY = RecRoomWinePool.capability
_LAST_LOCK = threading.Lock()
_LAST_GRAPHICS_FAILURE: dict[str, Any] = {}
_KEYWORDS = (
    "graphics",
    "renderer",
    "direct3d",
    "d3d",
    "opengl",
    "vulkan",
    "eac",
    "easyanti",
    "anti-cheat",
    "anticheat",
    "openvr",
    "initializeenginegraphics",
    "failed to initialize player",
    "gfxdevice",
    "recnet",
    "uri",
    "besthttp",
    "http",
    "https",
    "tls",
    "ssl",
    "certificate",
    "handshake",
    "exception",
    "crash report",
)
_PRIORITY_KEYWORDS = (
    "recnet",
    "invalid uri",
    "uri scheme",
    "besthttp",
    "certificate",
    "tls",
    "ssl",
    "handshake",
    "exception",
    "crash report",
)


def _trim(value: Any, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)] + "..."


def _glx_summary(raw: str) -> str:
    text = " ".join((raw or "").split())
    if not text:
        return ""
    bits: list[str] = []
    patterns = (
        r"OpenGL vendor string:\s*(.*?)(?=OpenGL renderer string:|OpenGL core profile version string:|$)",
        r"OpenGL renderer string:\s*(.*?)(?=OpenGL core profile version string:|OpenGL version string:|$)",
        r"OpenGL core profile version string:\s*(.*?)(?=OpenGL core profile shading language version string:|OpenGL version string:|$)",
        r"OpenGL version string:\s*(.*?)(?=OpenGL shading language version string:|OpenGL extensions:|$)",
    )
    labels = ("vendor", "renderer", "core", "version")
    for label, pattern in zip(labels, patterns):
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            bits.append(f"{label}={_trim(match.group(1), 180)}")
    return "; ".join(bits) or _trim(text, 600)


def _read_trace(work_dir: Path) -> tuple[dict[str, Any], list[str], list[str]]:
    path = work_dir / "recnet-proxy.jsonl"
    graphics: dict[str, Any] = {}
    render_events: list[str] = []
    network_events: list[str] = []
    try:
        rows = path.read_text(errors="replace").splitlines()
    except Exception:
        return graphics, render_events, network_events

    for raw in rows[-500:]:
        try:
            event = json.loads(raw)
        except Exception:
            continue
        name = str(event.get("event") or "")
        if name == "graphics-probe":
            graphics = {
                "display": _trim(event.get("display"), 80),
                "glxExit": event.get("glxExit"),
                "glx": _glx_summary(str(event.get("glx") or "")),
                "glxError": _trim(event.get("glxError"), 240),
                "vulkanIcd": _trim(event.get("vulkanIcd"), 240),
            }
        elif name.startswith("render-"):
            profile = _trim(event.get("profile"), 90)
            detail = ""
            if event.get("title"):
                detail = f" title={_trim(event.get('title'), 140)}"
            elif event.get("metrics"):
                detail = f" metrics={_trim(event.get('metrics'), 180)}"
            elif event.get("exit") is not None:
                detail = f" exit={event.get('exit')}"
            render_events.append(f"{name}:{profile}{detail}")
        elif name == "proxy-start":
            network_events.append(
                "proxy-start "
                + _trim(
                    f"{event.get('scheme') or ''} {event.get('listen') or ''} {event.get('tls') or ''} path={event.get('nameserverPath') or ''}",
                    260,
                )
            )
        elif name == "tls-handshake":
            network_events.append(
                "tls-ok "
                + _trim(
                    f"{event.get('protocol') or ''} {event.get('cipher') or ''} peer={event.get('peer') or ''}",
                    260,
                )
            )
        elif name == "tls-handshake-error":
            network_events.append(
                "tls-error "
                + _trim(
                    f"peer={event.get('peer') or ''} {event.get('error') or ''}",
                    500,
                )
            )
        elif name == "nameserver":
            network_events.append(
                f"nameserver {str(event.get('method') or 'GET')} {str(event.get('status') or 200)} {str(event.get('scheme') or '')}".strip()
            )
        elif name == "request":
            target = str(event.get("normalized") or event.get("raw") or "")
            network_events.append(
                f"{str(event.get('method') or '')} {_trim(target, 180)} -> {event.get('status')}"
                + (f" ({_trim(event.get('error'), 160)})" if event.get("error") else "")
            )
    return graphics, render_events[-16:], network_events[-24:]


def _key_log_lines(path: Path) -> list[str]:
    try:
        text = path.read_text(errors="replace")
    except Exception:
        return []
    normal: list[str] = []
    priority: list[str] = []
    for line in text.splitlines():
        lowered = line.casefold()
        if not any(keyword in lowered for keyword in _KEYWORDS):
            continue
        compact = _trim(line, 340)
        if not compact:
            continue
        if any(keyword in lowered for keyword in _PRIORITY_KEYWORDS):
            if compact not in priority:
                priority.append(compact)
        elif compact not in normal:
            normal.append(compact)
    selected = normal[-8:] + priority[-12:]
    if selected:
        return selected[-20:]
    tail = _trim(text[-1600:], 720)
    return [tail] if tail else []


def _collect_failure(pool: RecRoomWinePool, host_id: str, error: str) -> dict[str, Any]:
    instance = None
    try:
        with pool.lock:
            instance = pool.instances.get(host_id)
    except Exception:
        instance = None

    result: dict[str, Any] = {
        "revision": _DIAGNOSTIC_REVISION,
        "timestamp": round(time.time(), 3),
        "hostId": host_id,
        "error": _trim(error, 1200),
    }
    if instance is None:
        return result

    work_dir = Path(instance.work_dir)
    result["renderProfile"] = _trim(getattr(instance, "render_profile", ""), 100)
    result["renderMetrics"] = _trim(getattr(instance, "render_metrics", ""), 240)
    result["fatalWindow"] = _trim(getattr(instance, "fatal_window", ""), 180)

    graphics, render_events, network_events = _read_trace(work_dir)
    result["graphics"] = graphics
    result["renderEvents"] = render_events
    result["recNet"] = network_events

    profiles: list[dict[str, Any]] = []
    try:
        logs = sorted(work_dir.glob("wine-game-*.log"), key=lambda p: p.stat().st_mtime_ns)
    except Exception:
        logs = []
    for path in logs[-8:]:
        profiles.append(
            {
                "profile": path.name.removeprefix("wine-game-").removesuffix(".log"),
                "keyLines": _key_log_lines(path),
            }
        )
    result["profiles"] = profiles
    return result


def _public_summary(diag: dict[str, Any]) -> str:
    graphics = diag.get("graphics") if isinstance(diag.get("graphics"), dict) else {}
    parts = ["Rec Room could not produce a stable playable frame."]
    original_error = str(diag.get("error") or "")
    if "steam" in original_error.casefold():
        # Keep the actionable platform dependency visible to the browser instead
        # of burying it behind the generic graphics summary.
        parts.append("Platform dependency: " + _trim(original_error.split(" | Runtime trace:", 1)[0], 900))
    if graphics:
        parts.append(
            "GLX: "
            + _trim(
                graphics.get("glx")
                or graphics.get("glxError")
                or f"exit={graphics.get('glxExit')}",
                520,
            )
        )
        if graphics.get("vulkanIcd"):
            parts.append("Vulkan ICD: " + _trim(graphics.get("vulkanIcd"), 180))
    events = diag.get("renderEvents") if isinstance(diag.get("renderEvents"), list) else []
    if events:
        parts.append("Renderer trials: " + _trim("; ".join(map(str, events[-10:])), 900))
    network = diag.get("recNet") if isinstance(diag.get("recNet"), list) else []
    if network:
        parts.append("RecNet/TLS: " + _trim("; ".join(map(str, network[-12:])), 1000))
    profile_rows = diag.get("profiles") if isinstance(diag.get("profiles"), list) else []
    key: list[str] = []
    for row in profile_rows[-5:]:
        if not isinstance(row, dict):
            continue
        lines = row.get("keyLines") if isinstance(row.get("keyLines"), list) else []
        if lines:
            key.append(f"{row.get('profile')}: {_trim(' / '.join(map(str, lines[-5:])), 700)}")
    if key:
        parts.append("Key game logs: " + _trim(" | ".join(key), 1400))
    return _trim(" | ".join(parts), 4200)


def _provision_with_preserved_diagnostics(
    self: RecRoomWinePool,
    host_id: str,
    session_id: str,
    session_token: str,
    on_progress: Callable[[str, int], None],
    on_ready: Callable[[str], None],
    on_failed: Callable[[str], None],
) -> tuple[bool, str | None]:
    def failed(error: str) -> None:
        global _LAST_GRAPHICS_FAILURE
        diag = _collect_failure(self, host_id, error)
        with _LAST_LOCK:
            _LAST_GRAPHICS_FAILURE = diag
        on_failed(_public_summary(diag))

    return _ORIGINAL_PROVISION(
        self,
        host_id,
        session_id,
        session_token,
        on_progress,
        on_ready,
        failed,
    )


def _capability_with_last_failure(self: RecRoomWinePool) -> dict[str, Any]:
    payload = dict(_ORIGINAL_CAPABILITY(self))
    with _LAST_LOCK:
        last = dict(_LAST_GRAPHICS_FAILURE)
    payload["failureDiagnosticsPatch"] = _DIAGNOSTIC_REVISION
    payload["lastGraphicsFailure"] = last or None
    return payload


RecRoomWinePool.provision = _provision_with_preserved_diagnostics  # type: ignore[method-assign]
RecRoomWinePool.capability = _capability_with_last_failure  # type: ignore[method-assign]
print(f"Rec Room live failure diagnostics loaded: {_DIAGNOSTIC_REVISION}")

