from __future__ import annotations

import json
import os
import secrets
import shutil
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import Response, StreamingResponse


TARGET_BUILD_ID = "recroom-2022-05-19"
TARGET_MANIFEST = "6337851004861751095"
TARGET_DEPOT = "471711"
LOCAL_SERVICE_PREFIXES = [
    "/psettingsx", "/leaderb", "/disco", "/acct", "/shop", "/no", "/r", "/m", "/l", "/c",
]
LOCAL_SERVICE_PREFIXES.sort(key=len, reverse=True)

SUFFIX_BY_HOST = {
    "api": "",
    "auth": "/",
    "accounts": "/acct",
    "rooms": "/r",
    "match": "/m",
    "apim": "/",
    "econ": "/",
    "commerce": "/shop",
    "chat": "/",
    "lists": "/l",
    "discovery": "/disco",
    "playersettings": "/psettingsx",
    "notify": "/no",
    "cards": "/c",
    "leaderboard": "/leaderb",
    "clubs": "/c",
}


@dataclass
class WineInstance:
    host_id: str
    session_id: str
    work_dir: Path
    client_dir: Path
    prefix_dir: Path
    display_number: int
    stream_port: int
    loopback_ip: str
    stream_token: str
    sink_name: str
    pulse_module_id: str = ""
    phase: str = "queued"
    progress: int = 0
    created_at: float = field(default_factory=time.time)
    destroying: bool = False
    proxy_server: ThreadingHTTPServer | None = None
    proxy_thread: threading.Thread | None = None
    xvfb_process: subprocess.Popen[Any] | None = None
    wm_process: subprocess.Popen[Any] | None = None
    stream_process: subprocess.Popen[Any] | None = None
    steam_process: subprocess.Popen[Any] | None = None
    game_process: subprocess.Popen[Any] | None = None


class RecRoomWinePool:
    """Disposable per-player Wine sandboxes for Rec Room on a Linux Space.

    This is not presented as a Windows VM. It is the KVM-free fallback for
    managed Linux platforms such as Hugging Face Spaces: one isolated Wine
    prefix, X display, PulseAudio sink, local RecNet proxy and browser stream per
    player. The immutable client is hard-link cloned so concurrent sessions only
    consume storage for files that are actually modified.
    """

    def __init__(self, data_dir: Path, public_base_url: str, gateway_url: str) -> None:
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.public_base_url = public_base_url.rstrip("/")
        self.gateway_url = gateway_url.rstrip("/")
        self.enabled = os.environ.get("RECROOM_WINE_ENABLED", "1").strip().lower() not in {"0", "false", "no"}
        self.wine = shutil.which("wine64") or shutil.which("wine") or ("/usr/lib/wine/wine64" if Path("/usr/lib/wine/wine64").exists() else None)
        self.wineboot = shutil.which("wineboot") or ("/usr/lib/wine/wineboot" if Path("/usr/lib/wine/wineboot").exists() else None)
        self.wineserver = shutil.which("wineserver") or ("/usr/lib/wine/wineserver" if Path("/usr/lib/wine/wineserver").exists() else None)
        self.xvfb = shutil.which("Xvfb")
        self.openbox = shutil.which("openbox")
        self.xdotool = shutil.which("xdotool")
        self.ffmpeg = shutil.which("ffmpeg")
        self.pactl = shutil.which("pactl")
        self.pulseaudio = shutil.which("pulseaudio")
        self.python = shutil.which("python3") or shutil.which("python")
        self.client_dir = Path(os.environ.get("RECROOM_WINE_CLIENT_DIR", str(self.data_dir.parent / "recroom-client-2022"))).expanduser()
        self.base_prefix = Path(os.environ.get("RECROOM_WINE_BASE_PREFIX", str(self.data_dir / "base-prefix"))).expanduser()
        self.stream_worker = Path(__file__).with_name("recroom_wine_stream.py")
        self.max_sessions = max(1, min(8, int(os.environ.get("RECROOM_WINE_MAX", "2"))))
        self.display_start = max(20, int(os.environ.get("RECROOM_WINE_DISPLAY_START", "90")))
        self.stream_port_start = max(1024, int(os.environ.get("RECROOM_WINE_STREAM_PORT_START", "6500")))
        self.width = max(640, int(os.environ.get("RECROOM_WINE_WIDTH", "1280")))
        self.height = max(360, int(os.environ.get("RECROOM_WINE_HEIGHT", "720")))
        self.strict_manifest = os.environ.get("RECROOM_WINE_ALLOW_UNVERIFIED_CLIENT", "0") != "1"
        self.lock = threading.RLock()
        self.prefix_lock = threading.Lock()
        self.instances: dict[str, WineInstance] = {}

    def _client_layout(self) -> dict[str, Any]:
        root = self.client_dir
        # RecRoom.exe is the small bootstrapper; launch the real screen-mode game executable when available.\n        exe = next((root / name for name in ("Recroom_Release.exe", "RecRoom.exe") if (root / name).is_file()), None)
        assembly = root / "GameAssembly.dll"
        data = next((root / name for name in ("RecRoom_Data", "Recroom_Release_Data") if (root / name).is_dir()), None)
        metadata = data / "il2cpp_data" / "Metadata" / "global-metadata.dat" if data else None
        manifest = root / ".DepotDownloader" / f"{TARGET_DEPOT}_{TARGET_MANIFEST}.manifest"
        return {
            "root": root.is_dir(),
            "exe": bool(exe),
            "assembly": assembly.is_file(),
            "metadata": bool(metadata and metadata.is_file()),
            "manifest": manifest.is_file(),
            "exePath": str(exe) if exe else "",
        }

    def capability(self) -> dict[str, Any]:
        client = self._client_layout()
        tools = {
            "wine": bool(self.wine),
            "wineboot": bool(self.wineboot or self.wine),
            "xvfb": bool(self.xvfb),
            "xdotool": bool(self.xdotool),
            "ffmpeg": bool(self.ffmpeg),
            "pulse": bool(self.pactl and self.pulseaudio),
            "python": bool(self.python),
            "streamWorker": self.stream_worker.is_file(),
        }
        client_ready = bool(client["root"] and client["exe"] and client["assembly"] and client["metadata"])
        if self.strict_manifest:
            client_ready = bool(client_ready and client["manifest"])
        supported = bool(self.enabled and all(tools.values()) and client_ready and self.gateway_url)
        reasons: list[str] = []
        if not self.enabled:
            reasons.append("Wine runtime is disabled")
        missing_tools = [name for name, ok in tools.items() if not ok]
        if missing_tools:
            reasons.append("missing Linux runtime tools: " + ", ".join(missing_tools))
        if not client["root"]:
            reasons.append(f"server Rec Room client is not installed at {self.client_dir}")
        elif not client_ready:
            missing = [key for key in ("exe", "assembly", "metadata") if not client[key]]
            if self.strict_manifest and not client["manifest"]:
                missing.append(f"DepotDownloader manifest {TARGET_MANIFEST}")
            reasons.append("server Rec Room client is incomplete/unverified: " + ", ".join(missing))
        if not self.gateway_url:
            reasons.append("Rec Room gateway URL is not configured")
        with self.lock:
            running = sum(1 for instance in self.instances.values() if not instance.destroying)
        return {
            "provider": "wine",
            "supported": supported,
            "readyForGame": supported,
            "checks": {**tools, "client": client_ready, "manifest": bool(client["manifest"])},
            "reason": "; ".join(reasons) if reasons else None,
            "warning": None if supported else "Players never install anything; the server needs one legally obtained May 19 2022 client image before it can launch Rec Room.",
            "runningVms": running,
            "runningSandboxes": running,
            "maxVms": self.max_sessions,
            "maxSandboxes": self.max_sessions,
            "clientDir": str(self.client_dir),
            "targetBuild": "8751857",
            "targetManifest": TARGET_MANIFEST,
            "graphics": "Wine/WineD3D on the Space Linux renderer",
        }

    def can_provision(self) -> tuple[bool, str | None]:
        capability = self.capability()
        if not capability["supported"]:
            return False, str(capability.get("reason") or "Wine runtime is unavailable.")
        with self.lock:
            alive = [item for item in self.instances.values() if not item.destroying]
            if len(alive) >= self.max_sessions:
                return False, f"All {self.max_sessions} RipoTeamServer game sandbox slot(s) are busy."
        return True, None

    def _slot(self) -> tuple[int, int, str]:
        with self.lock:
            used_displays = {item.display_number for item in self.instances.values() if not item.destroying}
            used_ports = {item.stream_port for item in self.instances.values() if not item.destroying}
            used_ips = {item.loopback_ip for item in self.instances.values() if not item.destroying}
        for offset in range(self.max_sessions * 4 + 16):
            display = self.display_start + offset
            port = self.stream_port_start + offset
            third = (offset // 9) % 10
            fourth = (offset % 9) + 1
            ip = f"127.0.{third}.{fourth}"
            if display not in used_displays and port not in used_ports and ip not in used_ips:
                return display, port, ip
        raise RuntimeError("No free Wine sandbox slot is available.")

    def _run(self, args: list[str], *, env: dict[str, str] | None = None, timeout: int = 90, check: bool = True) -> subprocess.CompletedProcess[str]:
        return subprocess.run(args, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=check)

    def _ensure_pulse(self) -> None:
        if not self.pactl or not self.pulseaudio:
            raise RuntimeError("PulseAudio tools are unavailable.")
        probe = subprocess.run([self.pactl, "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
        if probe.returncode != 0:
            subprocess.run([self.pulseaudio, "--start", "--exit-idle-time=-1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=12, check=False)
            time.sleep(0.5)
        probe = subprocess.run([self.pactl, "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
        if probe.returncode != 0:
            raise RuntimeError("PulseAudio could not start for the Rec Room sandbox.")

    def _wine_env(self, instance: WineInstance) -> dict[str, str]:
        env = os.environ.copy()
        env["DISPLAY"] = f":{instance.display_number}"
        env["WINEPREFIX"] = str(instance.prefix_dir)
        env["WINEARCH"] = "win64"
        env["WINEDEBUG"] = "-all"
        env["PULSE_SINK"] = instance.sink_name
        env["PULSE_SOURCE"] = f"{instance.sink_name}.monitor"
        env.setdefault("WINEDLLOVERRIDES", "winemenubuilder.exe=d")
        # Hugging Face ZeroGPU does not expose a persistent gaming GPU. WineD3D
        # can still use Mesa/llvmpipe so the session can launch without KVM.
        env.setdefault("LIBGL_ALWAYS_SOFTWARE", os.environ.get("RECROOM_WINE_FORCE_SOFTWARE_GL", "1"))
        runtime = Path(f"/tmp/ripo-recroom-runtime-{os.getuid()}")
        runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
        env.setdefault("XDG_RUNTIME_DIR", str(runtime))
        return env

    def _ensure_base_prefix(self, display: int) -> None:
        if (self.base_prefix / "system.reg").is_file():
            return
        with self.prefix_lock:
            if (self.base_prefix / "system.reg").is_file():
                return
            if not self.wine:
                raise RuntimeError("Wine is unavailable.")
            building = self.base_prefix.with_name(self.base_prefix.name + ".building")
            shutil.rmtree(building, ignore_errors=True)
            building.mkdir(parents=True, exist_ok=True)
            env = os.environ.copy()
            env.update({"DISPLAY": f":{display}", "WINEPREFIX": str(building), "WINEARCH": "win64", "WINEDEBUG": "-all"})
            command = [self.wineboot, "-u"] if self.wineboot else [self.wine, "wineboot", "-u"]
            subprocess.run(command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120, check=False)
            if not (building / "system.reg").is_file():
                raise RuntimeError("Wine could not initialize the shared 64-bit prefix.")
            if self.wineserver:
                subprocess.run([self.wineserver, "-k"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10, check=False)
            shutil.rmtree(self.base_prefix, ignore_errors=True)
            building.replace(self.base_prefix)

    def _clone_tree_hardlinks(self, source: Path, destination: Path) -> None:
        destination.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(["cp", "-al", f"{source}/.", str(destination)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Could not create storage-efficient Rec Room sandbox: {result.stderr[-500:]}")

    def _clone_prefix(self, destination: Path) -> None:
        destination.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(["cp", "-a", "--reflink=auto", f"{self.base_prefix}/.", str(destination)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Could not clone Wine prefix: {result.stderr[-500:]}")

    def _patch_client(self, root: Path, local_base: str) -> int:
        if len(local_base.encode("ascii")) != len("http://127.0.0.1:81"):
            raise RuntimeError("Wine sandbox loopback address is not patch-length safe.")
        allowed_ext = {".exe", ".dll", ".dat", ".bytes", ".json", ".txt", ".config", ".xml", ".assets", ".resource", ".ress", ".bin", ".manifest"}
        allowed_names = {"globalgamemanagers", "globalgamemanagers.assets"}
        max_size = 768 * 1024 * 1024
        changed_total = 0
        prepared_total = 0
        for dirpath, dirs, files in os.walk(root):
            dirs[:] = [name for name in dirs if name not in {".git", "Logs", "Crashes"}]
            for name in files:
                path = Path(dirpath) / name
                if name.endswith((".flux-backup", ".update-backup", ".update-new")):
                    continue
                try:
                    stat = path.stat()
                except OSError:
                    continue
                if stat.st_size <= 0 or stat.st_size > max_size:
                    continue
                if path.suffix.lower() not in allowed_ext and name.lower() not in allowed_names:
                    continue
                try:
                    data = path.read_bytes()
                except OSError:
                    continue
                patched = bytearray(data)
                changed = False
                for host, suffix in SUFFIX_BY_HOST.items():
                    source = f"https://{host}.rec.net"
                    default = f"http://127.0.0.1:81{suffix}"
                    target = f"{local_base}{suffix}"
                    for encoding in ("ascii", "utf-16le"):
                        target_bytes = target.encode(encoding)
                        if len(source.encode(encoding)) != len(target_bytes):
                            raise RuntimeError(f"Unsafe Wine redirect length for {host}.")
                        for candidate in (source.encode(encoding), default.encode(encoding)):
                            start = 0
                            while True:
                                index = bytes(patched).find(candidate, start)
                                if index < 0:
                                    break
                                patched[index:index + len(candidate)] = target_bytes
                                start = index + len(candidate)
                                changed = True
                                changed_total += 1
                        prepared_total += bytes(patched).count(target_bytes)
                if changed:
                    temp = path.with_name(path.name + f".{os.getpid()}.winepatch")
                    temp.write_bytes(patched)
                    os.chmod(temp, stat.st_mode)
                    temp.replace(path)
        if changed_total <= 0 and prepared_total <= 0:
            raise RuntimeError("The Rec Room client did not contain any known rec.net service URLs to redirect.")
        return max(changed_total, prepared_total)

    def _normalize_path(self, raw: str) -> str:
        value = raw or "/"
        while value.startswith("//"):
            value = value[1:]
        query_index = value.find("?")
        path_only = value[:query_index] if query_index >= 0 else value
        suffix = value[query_index:] if query_index >= 0 else ""
        for prefix in LOCAL_SERVICE_PREFIXES:
            if path_only == prefix or path_only.startswith(prefix + "/"):
                stripped = path_only[len(prefix):] or "/"
                return (stripped if stripped.startswith("/") else "/" + stripped) + suffix
        return (path_only if path_only.startswith("/") else "/" + path_only) + suffix

    def _start_proxy(self, instance: WineInstance, session_token: str) -> None:
        gateway = self.gateway_url
        normalize = self._normalize_path

        class ProxyHandler(BaseHTTPRequestHandler):
            def log_message(self, _format: str, *_args) -> None:
                return

            def _proxy(self) -> None:
                raw = self.path or "/"
                if raw == "/flux/local-health":
                    body = json.dumps({"ok": True, "provider": "wine", "targetBuild": TARGET_BUILD_ID}).encode()
                    self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body); return
                normalized = normalize(raw)
                target = urllib.parse.urljoin(gateway.rstrip("/") + "/", normalized.lstrip("/"))
                length = int(self.headers.get("content-length", "0") or "0")
                body = self.rfile.read(min(length, 32 * 1024 * 1024)) if length else None
                blocked = {"authorization", "connection", "content-length", "host", "transfer-encoding", "upgrade"}
                headers = {k: v for k, v in self.headers.items() if k.lower() not in blocked}
                headers["Authorization"] = f"Bearer {session_token}"
                headers["X-Flux-RecRoom-Host-Proxy"] = "wine"
                request = urllib.request.Request(target, data=body, method=self.command, headers=headers)
                try:
                    response = urllib.request.urlopen(request, timeout=30)
                    status = response.status
                    payload = response.read()
                    response_headers = response.headers
                except urllib.error.HTTPError as exc:
                    status = exc.code
                    payload = exc.read()
                    response_headers = exc.headers
                except Exception as exc:
                    status = 502
                    payload = json.dumps({"ok": False, "error": str(exc)}).encode()
                    response_headers = {"content-type": "application/json"}
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
        thread = threading.Thread(target=server.serve_forever, name=f"recroom-wine-proxy-{instance.host_id[-6:]}", daemon=True)
        thread.start()
        instance.proxy_server = server
        instance.proxy_thread = thread

    def _start_x(self, instance: WineInstance) -> None:
        assert self.xvfb
        display = f":{instance.display_number}"
        xlog = (instance.work_dir / "xvfb.log").open("ab", buffering=0)
        instance.xvfb_process = subprocess.Popen(
            [self.xvfb, display, "-screen", "0", f"{self.width}x{self.height}x24", "-nolisten", "tcp", "-ac"],
            stdout=xlog, stderr=subprocess.STDOUT, start_new_session=True,
        )
        time.sleep(0.5)
        if instance.xvfb_process.poll() is not None:
            raise RuntimeError("Xvfb exited before the Wine sandbox was ready.")
        if self.openbox:
            env = os.environ.copy(); env["DISPLAY"] = display
            instance.wm_process = subprocess.Popen([self.openbox], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)

    def _start_audio(self, instance: WineInstance) -> None:
        self._ensure_pulse()
        assert self.pactl
        output = subprocess.check_output(
            [self.pactl, "load-module", "module-null-sink", f"sink_name={instance.sink_name}", f"sink_properties=device.description={instance.sink_name}"],
            text=True, timeout=10,
        ).strip()
        instance.pulse_module_id = output

    def _start_stream(self, instance: WineInstance) -> None:
        assert self.python
        log = (instance.work_dir / "stream.log").open("ab", buffering=0)
        instance.stream_process = subprocess.Popen(
            [
                self.python, str(self.stream_worker),
                "--display", f":{instance.display_number}",
                "--port", str(instance.stream_port),
                "--token", instance.stream_token,
                "--pulse-source", f"{instance.sink_name}.monitor",
                "--width", str(self.width), "--height", str(self.height),
            ],
            stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
        )
        for _ in range(80):
            if instance.stream_process.poll() is not None:
                raise RuntimeError("Wine browser stream process exited during startup.")
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{instance.stream_port}/health", timeout=1) as response:
                    if response.status == 200:
                        return
            except Exception:
                pass
            time.sleep(0.15)
        raise RuntimeError("Wine browser stream did not become healthy.")

    def _window_visible(self, instance: WineInstance) -> bool:
        if not self.xdotool:
            return False
        env = os.environ.copy(); env["DISPLAY"] = f":{instance.display_number}"
        for query in (("--name", "Rec Room"), ("--class", "RecRoom"), ("--name", "RecRoom")):
            try:
                result = subprocess.run([self.xdotool, "search", "--onlyvisible", *query], env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=3)
                if result.returncode == 0 and result.stdout.strip():
                    window = result.stdout.splitlines()[-1].strip()
                    subprocess.run([self.xdotool, "windowactivate", "--sync", window], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3, check=False)
                    return True
            except Exception:
                pass
        return False

    def public_stream_url(self, instance: WineInstance) -> str:
        host = urllib.parse.quote(instance.host_id, safe="")
        token = urllib.parse.quote(instance.stream_token, safe="")
        return f"{self.public_base_url}/api/recroom-wine/stream/{host}/?token={token}"

    def provision(
        self,
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
            stream_token=secrets.token_urlsafe(32),
            sink_name=("rr_" + host_id.replace("-", "_")[-18:])[:28],
        )
        with self.lock:
            self.instances[host_id] = instance

        def progress(phase: str, value: int) -> None:
            instance.phase = phase; instance.progress = value; on_progress(phase, value)

        def worker() -> None:
            try:
                work_dir.mkdir(parents=True, exist_ok=True)
                progress("creating-sandbox", 8)
                self._start_x(instance)
                progress("preparing-audio", 15)
                self._start_audio(instance)
                progress("preparing-windows-runtime", 24)
                self._ensure_base_prefix(instance.display_number)
                self._clone_prefix(instance.prefix_dir)
                progress("linking-game-image", 34)
                self._clone_tree_hardlinks(self.client_dir, instance.client_dir)
                progress("connecting-flux-account", 46)
                redirects = self._patch_client(instance.client_dir, f"http://{instance.loopback_ip}:81")
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
                # The archived Windows build reads its app id from this file
                # when started outside a desktop launcher. It is metadata only;
                # writing it does not start Steam or expose a launcher window.
                (instance.client_dir / "steam_appid.txt").write_text("471710\n", encoding="ascii")
                env = self._wine_env(instance)
                env.setdefault("SteamAppId", "471710")
                env.setdefault("SteamGameId", "471710")
                progress("launching-game", 68)
                glog = (work_dir / "wine-game.log").open("ab", buffering=0)
                instance.game_process = subprocess.Popen(
                    [
                        str(self.wine), str(exe),
                        "+forcemode:screen",\n                        "-screen-fullscreen", "0",
                        "-screen-width", str(self.width),
                        "-screen-height", str(self.height),
                        "-force-d3d11",
                    ],
                    cwd=instance.client_dir,
                    env=env,
                    stdout=glog,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
                deadline = time.time() + int(os.environ.get("RECROOM_WINE_WINDOW_TIMEOUT", "150"))
                while time.time() < deadline:
                    if instance.destroying:
                        return
                    if instance.game_process.poll() is not None:
                        raise RuntimeError(f"Rec Room exited under Wine with code {instance.game_process.returncode} before opening a game window.")
                    if self._window_visible(instance):
                        progress("ready", 100)
                        on_ready(self.public_stream_url(instance))
                        break
                    time.sleep(1)
                else:
                    raise RuntimeError("Rec Room did not open a visible Wine game window before the startup timeout.")

                code = instance.game_process.wait()
                if not instance.destroying:
                    on_failed(f"Rec Room exited under Wine with code {code}.")
            except Exception as exc:
                if not instance.destroying:
                    on_failed(str(exc)[:700])
                self.destroy(host_id)

        threading.Thread(target=worker, name=f"recroom-wine-{host_id[-8:]}", daemon=True).start()
        return True, None

    def progress(self, host_id: str) -> dict[str, Any] | None:
        with self.lock:
            item = self.instances.get(host_id)
            if not item:
                return None
            return {
                "phase": item.phase,
                "progress": item.progress,
                "streamPort": item.stream_port,
                "display": item.display_number,
                "createdAt": item.created_at,
                "running": bool(item.game_process and item.game_process.poll() is None),
                "destroying": item.destroying,
            }

    def proxy_target(self, host_id: str, path: str, query: str = "") -> str:
        with self.lock:
            instance = self.instances.get(host_id)
            if not instance or instance.destroying:
                raise HTTPException(status_code=404, detail="Rec Room Wine stream is not available.")
            port = instance.stream_port
        suffix = "/" + path.lstrip("/") if path else "/"
        url = f"http://127.0.0.1:{port}{suffix}"
        return f"{url}?{query}" if query else url

    def destroy(self, host_id: str) -> None:
        with self.lock:
            instance = self.instances.get(host_id)
            if not instance or instance.destroying:
                return
            instance.destroying = True
            instance.phase = "destroying"

        def kill_process(process: subprocess.Popen[Any] | None) -> None:
            if not process or process.poll() is not None:
                return
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=5)
            except Exception:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except Exception:
                    pass

        def worker() -> None:
            kill_process(instance.steam_process)
            kill_process(instance.game_process)
            if self.wineserver:
                try:
                    env = self._wine_env(instance)
                    subprocess.run([self.wineserver, "-k"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8, check=False)
                except Exception:
                    pass
            kill_process(instance.stream_process)
            kill_process(instance.wm_process)
            kill_process(instance.xvfb_process)
            if instance.proxy_server:
                try:
                    instance.proxy_server.shutdown(); instance.proxy_server.server_close()
                except Exception:
                    pass
            if instance.pulse_module_id and self.pactl:
                subprocess.run([self.pactl, "unload-module", instance.pulse_module_id], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8, check=False)
            shutil.rmtree(instance.work_dir, ignore_errors=True)
            with self.lock:
                self.instances.pop(host_id, None)

        threading.Thread(target=worker, name=f"recroom-wine-destroy-{host_id[-8:]}", daemon=True).start()


def install_recroom_wine_routes(app: Any, pool: RecRoomWinePool) -> None:
    @app.get("/api/recroom-wine/capabilities")
    async def recroom_wine_capabilities() -> dict[str, Any]:
        return {"ok": True, **pool.capability()}

    async def proxy(request: Request, host_id: str, path: str) -> Response:
        target = pool.proxy_target(host_id, path, request.url.query)
        method = request.method.upper()
        body = await request.body() if method in {"POST", "PUT", "PATCH"} else None
        headers: dict[str, str] = {}
        content_type = request.headers.get("content-type")
        if content_type:
            headers["content-type"] = content_type
        client = httpx.AsyncClient(timeout=httpx.Timeout(connect=3.0, read=None, write=10.0, pool=3.0))
        upstream = await client.send(client.build_request(method, target, headers=headers, content=body), stream=True)
        response_headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
        for name in ("content-length", "content-disposition"):
            if upstream.headers.get(name):
                response_headers[name] = upstream.headers[name]
        media_type = upstream.headers.get("content-type")

        async def iterator():
            try:
                async for chunk in upstream.aiter_raw():
                    yield chunk
            finally:
                await upstream.aclose(); await client.aclose()

        return StreamingResponse(iterator(), status_code=upstream.status_code, media_type=media_type, headers=response_headers)

    @app.api_route("/api/recroom-wine/stream/{host_id}/", methods=["GET", "POST"])
    async def recroom_wine_stream_root(request: Request, host_id: str) -> Response:
        return await proxy(request, host_id, "")

    @app.api_route("/api/recroom-wine/stream/{host_id}/{path:path}", methods=["GET", "POST"])
    async def recroom_wine_stream_path(request: Request, host_id: str, path: str) -> Response:
        return await proxy(request, host_id, path)
