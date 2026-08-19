from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

import recroom_nameserver_fix as nameserver_fix
import recroom_wine_runtime_fix as runtime_fix
from recroom_wine_pool import RecRoomWinePool, WineInstance


_PATCH_REVISION = "black-viewport-v2-real-frame-graphics-probe"
_TRACE_NAME = "recnet-proxy.jsonl"
_ORIGINAL_CAPABILITY = RecRoomWinePool.capability
_FATAL_WINDOW_MARKERS = (
    "error",
    "failed to initialize player",
    "unity crash handler",
    "recroom has encountered an error",
)


def _trace_path(instance: WineInstance) -> Path:
    return instance.work_dir / _TRACE_NAME


def _trace(instance: WineInstance, event: str, **fields: Any) -> None:
    payload = {"ts": round(time.time(), 3), "event": event, **fields}
    try:
        instance.work_dir.mkdir(parents=True, exist_ok=True)
        with _trace_path(instance).open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, separators=(",", ":"), default=str) + "\n")
    except Exception:
        pass


def _trace_tail(instance: WineInstance, limit: int = 5200) -> str:
    try:
        text = _trace_path(instance).read_text(errors="replace")
        rows = [line.strip() for line in text.splitlines() if line.strip()]
        return " | ".join(rows[-24:])[-limit:]
    except Exception:
        return ""


def _visible_window_titles(self: RecRoomWinePool, instance: WineInstance) -> list[str]:
    if not self.xdotool:
        return []
    env = self._wine_env(instance)
    try:
        result = subprocess.run(
            [self.xdotool, "search", "--onlyvisible", "--name", ".*"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=4,
            check=False,
        )
    except Exception:
        return []
    titles: list[str] = []
    for window_id in result.stdout.splitlines()[:64]:
        window_id = window_id.strip()
        if not window_id:
            continue
        try:
            title = subprocess.run(
                [self.xdotool, "getwindowname", window_id],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=2,
                check=False,
            ).stdout.strip()
        except Exception:
            continue
        if title and title not in titles:
            titles.append(title[:300])
    return titles


def _fatal_window(self: RecRoomWinePool, instance: WineInstance) -> str:
    for title in _visible_window_titles(self, instance):
        lowered = title.casefold().strip()
        if any(marker in lowered for marker in _FATAL_WINDOW_MARKERS):
            return title
    return ""


def _graphics_probe(self: RecRoomWinePool, instance: WineInstance) -> dict[str, Any]:
    env = self._wine_env(instance)
    env["LIBGL_ALWAYS_SOFTWARE"] = "1"
    env["GALLIUM_DRIVER"] = "llvmpipe"
    payload: dict[str, Any] = {
        "display": env.get("DISPLAY", ""),
        "glxinfo": shutil.which("glxinfo") or "",
        "vulkanIcd": "",
    }
    icd_dir = Path("/usr/share/vulkan/icd.d")
    if icd_dir.is_dir():
        candidates = sorted(icd_dir.glob("*lvp*.json"))
        if candidates:
            payload["vulkanIcd"] = str(candidates[0])
    glxinfo = str(payload["glxinfo"] or "")
    if glxinfo:
        try:
            result = subprocess.run(
                [glxinfo, "-B"],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=12,
                check=False,
            )
            compact = " ".join(result.stdout.split())
            payload["glxExit"] = result.returncode
            payload["glx"] = compact[-3500:]
        except Exception as exc:
            payload["glxError"] = f"{type(exc).__name__}:{exc}"
    _trace(instance, "graphics-probe", **payload)
    return payload


def _start_proxy_traced(self: RecRoomWinePool, instance: WineInstance, session_token: str) -> None:
    gateway = self.gateway_url
    normalize = self._normalize_path
    local_base = f"http://{instance.loopback_ip}:81"
    nameserver_body = json.dumps(
        nameserver_fix._nameserver_payload(local_base), separators=(",", ":")
    ).encode("utf-8")

    _trace(
        instance,
        "proxy-start",
        listen=f"{instance.loopback_ip}:81",
        gateway=gateway,
        nameserverPath=nameserver_fix.LOCAL_NAMESERVER_PATH,
        nameserverBytes=len(nameserver_body),
    )

    class ProxyHandler(BaseHTTPRequestHandler):
        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def _json(self, status: int, payload: bytes) -> None:
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(payload)))
            self.send_header("cache-control", "no-store")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)

        def _proxy(self) -> None:
            raw = self.path or "/"
            path_only = raw.split("?", 1)[0]

            if path_only == nameserver_fix.LOCAL_NAMESERVER_PATH:
                body = nameserver_fix._nameserver_payload(local_base)
                _trace(instance, "nameserver", method=self.command, raw=raw, status=200, body=body)
                self._json(200, nameserver_body)
                return

            if raw == "/flux/local-health":
                payload = json.dumps(
                    {
                        "ok": True,
                        "provider": "wine",
                        "targetBuild": "recroom-2022-05-19",
                        "nameserver": True,
                        "redirectPatch": nameserver_fix._PATCH_REVISION,
                        "blackViewportPatch": _PATCH_REVISION,
                    },
                    separators=(",", ":"),
                ).encode()
                _trace(instance, "local-health", method=self.command, raw=raw, status=200)
                self._json(200, payload)
                return

            normalized = normalize(raw)
            target_url = urllib.parse.urljoin(gateway.rstrip("/") + "/", normalized.lstrip("/"))
            length = int(self.headers.get("content-length", "0") or "0")
            body = self.rfile.read(min(length, 32 * 1024 * 1024)) if length else None
            blocked = {
                "authorization",
                "connection",
                "content-length",
                "host",
                "transfer-encoding",
                "upgrade",
            }
            headers = {k: v for k, v in self.headers.items() if k.lower() not in blocked}
            headers["Authorization"] = f"Bearer {session_token}"
            headers["X-Flux-RecRoom-Host-Proxy"] = "wine"
            request = urllib.request.Request(target_url, data=body, method=self.command, headers=headers)

            error_text = ""
            try:
                response = urllib.request.urlopen(request, timeout=30)
                status = response.status
                payload = response.read()
                response_headers = response.headers
            except urllib.error.HTTPError as exc:
                status = exc.code
                payload = exc.read()
                response_headers = exc.headers
                error_text = f"HTTPError:{exc.code}"
            except Exception as exc:
                status = 502
                error_text = f"{type(exc).__name__}:{exc}"
                payload = json.dumps({"ok": False, "error": str(exc)}).encode()
                response_headers = {"content-type": "application/json"}

            _trace(
                instance,
                "request",
                method=self.command,
                raw=raw[:1000],
                normalized=normalized[:1000],
                target=target_url[:1200],
                status=status,
                responseBytes=len(payload),
                error=error_text[:800],
            )

            self.send_response(status)
            content_type = response_headers.get("content-type") if hasattr(response_headers, "get") else None
            if content_type:
                self.send_header("content-type", content_type)
            self.send_header("content-length", str(len(payload)))
            self.send_header("cache-control", "no-store")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)

        do_GET = _proxy
        do_HEAD = _proxy
        do_POST = _proxy
        do_PUT = _proxy
        do_PATCH = _proxy
        do_DELETE = _proxy

    server = ThreadingHTTPServer((instance.loopback_ip, 81), ProxyHandler)
    server.daemon_threads = True
    thread = threading.Thread(
        target=server.serve_forever,
        name=f"recroom-wine-proxy-{instance.host_id[-6:]}",
        daemon=True,
    )
    thread.start()
    instance.proxy_server = server
    instance.proxy_thread = thread


def _provision_visible(
    self: RecRoomWinePool,
    host_id: str,
    session_id: str,
    session_token: str,
    on_progress: Callable[[str, int], None],
    on_ready: Callable[[str], None],
    on_failed: Callable[[str], None],
) -> tuple[bool, str | None]:
    can_start, reason = self.can_provision()
    if not can_start:
        return False, reason
    try:
        display, port, loopback = self._slot()
    except Exception as exc:
        return False, str(exc)

    work_dir = self.data_dir / host_id
    instance = WineInstance(
        host_id=host_id,
        session_id=session_id,
        work_dir=work_dir,
        client_dir=work_dir / "client",
        prefix_dir=work_dir / "prefix",
        display_number=display,
        stream_port=port,
        loopback_ip=loopback,
        stream_token=__import__("secrets").token_urlsafe(32),
        sink_name=("rr_" + host_id.replace("-", "_")[-18:])[:28],
    )
    setattr(instance, "render_profile", "starting")
    setattr(instance, "render_metrics", "")
    setattr(instance, "fatal_window", "")
    with self.lock:
        self.instances[host_id] = instance

    def progress(phase: str, value: int) -> None:
        instance.phase = phase
        instance.progress = value
        on_progress(phase, value)

    def fail(message: str) -> None:
        trace = _trace_tail(instance)
        detail = message
        if trace:
            detail += " | Runtime trace: " + trace
        on_failed(detail[:9000])

    def worker() -> None:
        try:
            work_dir.mkdir(parents=True, exist_ok=True)
            _trace(instance, "session-start", hostId=host_id, sessionId=session_id)
            progress("creating-sandbox", 8)
            self._start_x(instance)
            graphics = _graphics_probe(self, instance)
            progress("preparing-audio", 15)
            self._start_audio(instance)
            progress("preparing-windows-runtime", 24)
            self._ensure_base_prefix(instance.display_number)
            self._clone_prefix(instance.prefix_dir)
            progress("linking-game-image", 34)
            self._clone_tree_hardlinks(self.client_dir, instance.client_dir)
            progress("connecting-flux-account", 46)

            redirects = nameserver_fix._patch_client(
                self, instance.client_dir, f"http://{instance.loopback_ip}:81"
            )
            if redirects <= 0:
                raise RuntimeError("Rec Room service redirect preparation failed.")

            self._start_proxy(instance, session_token)
            progress("starting-browser-stream", 56)
            self._start_stream(instance)

            layout = self._client_layout()
            source_exe = Path(str(layout["exePath"]))
            exe = instance.client_dir / source_exe.relative_to(self.client_dir)
            if not exe.is_file():
                raise RuntimeError("Rec Room executable was not cloned into the Wine sandbox.")

            # The archived Windows build reads its app id from this file when
            # started outside a desktop launcher. The official Steam client is
            # started separately in the background; its UI is never streamed.
            (instance.client_dir / "steam_appid.txt").write_text("471710\n", encoding="ascii")

            profiles: list[tuple[str, list[str], dict[str, str], int]] = [
                (
                    "d3d11-bitblt-llvmpipe",
                    ["-force-d3d11", "-force-d3d11-bitblt-model", "-force-d3d11-singlethreaded", "-force-gfx-direct"],
                    {"LIBGL_ALWAYS_SOFTWARE": "1", "GALLIUM_DRIVER": "llvmpipe"},
                    36,
                ),
                (
                    "d3d11-bitblt-native",
                    ["-force-d3d11", "-force-d3d11-bitblt-model", "-force-d3d11-singlethreaded", "-force-gfx-direct"],
                    {},
                    34,
                ),
                (
                    "d3d11-bitblt-no-singlethreaded-llvmpipe",
                    ["-force-d3d11", "-force-d3d11-bitblt-model", "-force-d3d11-no-singlethreaded"],
                    {"LIBGL_ALWAYS_SOFTWARE": "1", "GALLIUM_DRIVER": "llvmpipe"},
                    34,
                ),
            ]
            vulkan_icd = str(graphics.get("vulkanIcd") or "")
            if vulkan_icd:
                profiles.append(
                    (
                        "vulkan-lavapipe",
                        ["-force-vulkan"],
                        {
                            "VK_ICD_FILENAMES": vulkan_icd,
                            "LIBGL_ALWAYS_SOFTWARE": "1",
                            "GALLIUM_DRIVER": "llvmpipe",
                        },
                        38,
                    )
                )
            profiles.append(
                (
                    "glcore-llvmpipe-diagnostic",
                    ["-force-glcore", "-force-clamped"],
                    {"LIBGL_ALWAYS_SOFTWARE": "1", "GALLIUM_DRIVER": "llvmpipe"},
                    20,
                )
            )

            diagnostics: list[str] = []
            base_env = self._wine_env(instance)
            base_env.setdefault("SteamAppId", "471710")
            base_env.setdefault("SteamGameId", "471710")
            progress("starting-game-platform", 62)
            runtime_fix._start_headless_steam(self, instance)
            progress("launching-game", 68)
            selected = False

            for profile_name, render_args, env_overrides, render_seconds in profiles:
                if instance.destroying:
                    return
                setattr(instance, "render_profile", profile_name)
                setattr(instance, "fatal_window", "")
                _trace(instance, "render-attempt", profile=profile_name, env=env_overrides)

                attempt_env = dict(base_env)
                attempt_env.update(env_overrides)
                glog_path = work_dir / f"wine-game-{profile_name}.log"
                glog = glog_path.open("ab", buffering=0)
                command = [
                    str(self.wine),
                    str(exe),
                    "-screen-fullscreen",
                    "0",
                    "-screen-width",
                    str(self.width),
                    "-screen-height",
                    str(self.height),
                    "-logFile",
                    "-",
                    *render_args,
                ]
                glog.write((f"\n[ripo] graphics-patch={_PATCH_REVISION} profile={profile_name} command={' '.join(command)}\n").encode())
                instance.game_process = subprocess.Popen(
                    command,
                    cwd=instance.client_dir,
                    env=attempt_env,
                    stdout=glog,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )

                window_deadline = time.time() + 45
                visible = False
                fatal = ""
                while time.time() < window_deadline:
                    if instance.destroying:
                        return
                    if instance.game_process.poll() is not None:
                        break
                    fatal = _fatal_window(self, instance)
                    if fatal:
                        break
                    if self._window_visible(instance):
                        visible = True
                        break
                    time.sleep(0.6)

                if fatal:
                    setattr(instance, "fatal_window", fatal)
                    log_tail = runtime_fix._log_tail(glog_path, 1800)
                    diagnostics.append(f"{profile_name}: fatal startup window {fatal!r}; log={log_tail}")
                    _trace(instance, "render-fatal-window", profile=profile_name, title=fatal, log=log_tail[-1200:])
                    runtime_fix._stop_wine_attempt(self, instance)
                    continue

                if not visible:
                    code = instance.game_process.poll()
                    diagnostics.append(
                        f"{profile_name}: no visible Rec Room window (exit={code}); log={runtime_fix._log_tail(glog_path, 1300)}"
                    )
                    _trace(instance, "render-no-window", profile=profile_name, exit=code)
                    runtime_fix._stop_wine_attempt(self, instance)
                    continue

                render_deadline = time.time() + render_seconds
                last_metrics = "no frame"
                while time.time() < render_deadline:
                    if instance.destroying:
                        return
                    if instance.game_process.poll() is not None:
                        break
                    fatal = _fatal_window(self, instance)
                    if fatal:
                        setattr(instance, "fatal_window", fatal)
                        break
                    rendered, last_metrics = runtime_fix._has_rendered_content(instance)
                    setattr(instance, "render_metrics", last_metrics)
                    if last_metrics == "steam-platform-initialization-failed":
                        raise RuntimeError(
                            "Rec Room requires an authenticated official Steam client. "
                            "The hidden Steam runtime started, but SteamAPI_Init still failed; "
                            "no Steam UI was exposed to the browser."
                        )
                    if rendered:
                        stable = True
                        stable_metrics = [last_metrics]
                        for _ in range(3):
                            time.sleep(0.8)
                            fatal = _fatal_window(self, instance)
                            if fatal or instance.game_process.poll() is not None:
                                stable = False
                                break
                            ok, metric = runtime_fix._has_rendered_content(instance)
                            stable_metrics.append(metric)
                            if not ok:
                                stable = False
                                break
                        if stable:
                            selected = True
                            setattr(instance, "render_metrics", "; ".join(stable_metrics[-2:]))
                            _trace(instance, "render-ready", profile=profile_name, metrics=stable_metrics)
                            runtime_fix._start_silence_feeder(self, instance)
                            progress("ready", 100)
                            on_ready(self.public_stream_url(instance))
                            break
                    time.sleep(1.1)

                if selected:
                    break

                if fatal:
                    log_tail = runtime_fix._log_tail(glog_path, 1800)
                    diagnostics.append(f"{profile_name}: fatal window {fatal!r}; log={log_tail}")
                    _trace(instance, "render-fatal-window", profile=profile_name, title=fatal, log=log_tail[-1200:])
                else:
                    diagnostics.append(
                        f"{profile_name}: no stable game viewport ({last_metrics}); log={runtime_fix._log_tail(glog_path, 1800)}"
                    )
                    _trace(
                        instance,
                        "render-no-stable-frame",
                        profile=profile_name,
                        metrics=last_metrics,
                        titles=_visible_window_titles(self, instance),
                        exit=instance.game_process.poll() if instance.game_process else None,
                    )
                runtime_fix._stop_wine_attempt(self, instance)

            if not selected or not instance.game_process:
                trace = _trace_tail(instance, 4200)
                detail = " | ".join(diagnostics[-5:])
                if trace:
                    detail += " | Runtime trace: " + trace
                raise RuntimeError(
                    "Rec Room could not initialize a stable playable graphics viewport. " + detail
                )

            code = instance.game_process.wait()
            if not instance.destroying:
                fail(f"Rec Room exited under Wine with code {code}.")
        except Exception as exc:
            if not instance.destroying:
                fail(str(exc))
            self.destroy(host_id)

    threading.Thread(
        target=worker,
        name=f"recroom-visible-{host_id[-8:]}",
        daemon=True,
    ).start()
    return True, None


def _progress(self: RecRoomWinePool, host_id: str) -> dict[str, Any] | None:
    payload = runtime_fix._ORIGINAL_PROGRESS(self, host_id)
    if not payload:
        return payload
    with self.lock:
        instance = self.instances.get(host_id)
        if instance:
            payload["renderProfile"] = str(getattr(instance, "render_profile", ""))
            payload["renderMetrics"] = str(getattr(instance, "render_metrics", ""))
            payload["fatalWindow"] = str(getattr(instance, "fatal_window", ""))
    return payload


def _capability(self: RecRoomWinePool) -> dict[str, Any]:
    payload = dict(_ORIGINAL_CAPABILITY(self))
    payload["blackViewportPatch"] = _PATCH_REVISION
    payload["rendererOrder"] = [
        "d3d11-bitblt-llvmpipe",
        "d3d11-bitblt-native",
        "d3d11-bitblt-no-singlethreaded-llvmpipe",
        "vulkan-lavapipe-if-available",
        "glcore-llvmpipe-diagnostic",
    ]
    payload["fatalDialogRejected"] = True
    payload["stableFrameSamples"] = 4
    payload["graphicsProbe"] = "glxinfo-B-per-sandbox"
    payload["recNetProxyTrace"] = True
    payload["recNetTraceFile"] = _TRACE_NAME
    payload["recNetRedirectPatch"] = nameserver_fix._PATCH_REVISION
    payload["recNetDirectUrlScan"] = False
    payload["steamRuntime"] = "disabled-by-default-direct-launch"
    payload["steamUiStreamed"] = False
    payload["steamRequiredByArchivedClient"] = True
    return payload


RecRoomWinePool._patch_client = nameserver_fix._patch_client  # type: ignore[method-assign]
RecRoomWinePool._start_proxy = _start_proxy_traced  # type: ignore[method-assign]
RecRoomWinePool.provision = _provision_visible  # type: ignore[method-assign]
RecRoomWinePool.progress = _progress  # type: ignore[method-assign]
RecRoomWinePool.capability = _capability  # type: ignore[method-assign]
print(f"Rec Room black viewport fix loaded: {_PATCH_REVISION}")
