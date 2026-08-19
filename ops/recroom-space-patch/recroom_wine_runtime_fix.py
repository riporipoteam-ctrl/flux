from __future__ import annotations

import io
import mmap
import os
import shutil
import signal
import subprocess
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageStat

from recroom_wine_pool import RecRoomWinePool, SUFFIX_BY_HOST, WineInstance


_RUNTIME_REVISION = "render-audio-v4-touch-safe-steam-diagnostic"
_ORIGINAL_START_AUDIO = RecRoomWinePool._start_audio
_ORIGINAL_DESTROY = RecRoomWinePool.destroy
_ORIGINAL_PROGRESS = RecRoomWinePool.progress
_ORIGINAL_CAPABILITY = RecRoomWinePool.capability
_ORIGINAL_PATCH_CLIENT = RecRoomWinePool._patch_client
_ORIGINAL_ENSURE_BASE_PREFIX = RecRoomWinePool._ensure_base_prefix
_PATCH_SCAN_LOCK = threading.Lock()
_PATCH_CANDIDATES: dict[tuple[str, int], tuple[str, ...]] = {}
_STEAM_INSTALL_LOCK = threading.Lock()
_STEAM_SETUP_URL = "https://cdn.fastly.steamstatic.com/client/installer/SteamSetup.exe"
_STEAM_APP_ID = "471710"


def _steam_exe(prefix: Path) -> Path:
    return prefix / "drive_c" / "Program Files (x86)" / "Steam" / "Steam.exe"


def _steam_setup_path(self: RecRoomWinePool) -> Path:
    root = self.data_dir / "_steam-runtime"
    root.mkdir(parents=True, exist_ok=True)
    return root / "SteamSetup.exe"


def _download_steam_setup(self: RecRoomWinePool) -> Path:
    target = _steam_setup_path(self)
    if target.is_file() and target.stat().st_size > 1_000_000:
        return target
    temporary = target.with_suffix(".download")
    temporary.unlink(missing_ok=True)
    request = urllib.request.Request(
        _STEAM_SETUP_URL,
        headers={"User-Agent": "RipoTeamServer-SteamBootstrap/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as handle:
        shutil.copyfileobj(response, handle, length=1024 * 1024)
    if temporary.stat().st_size <= 1_000_000 or temporary.read_bytes()[:2] != b"MZ":
        temporary.unlink(missing_ok=True)
        raise RuntimeError("The official Steam installer download was invalid.")
    temporary.replace(target)
    return target


def _base_wine_env(self: RecRoomWinePool, display: int) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "DISPLAY": f":{display}",
            "WINEPREFIX": str(self.base_prefix),
            "WINEARCH": "win64",
            "WINEDEBUG": "-all",
        }
    )
    return env


def _ensure_base_prefix_with_steam(self: RecRoomWinePool, display: int) -> None:
    """Prepare the exact game prefix plus the official Steam client in the base copy.

    Rec Room's archived Windows client calls SteamAPI_Init at startup. The app id
    file alone cannot satisfy that dependency, so the supported fallback is to
    run the official Steam client in the background. Its windows are never part
    of the browser controls or stream, and no Steam UI is shown to the player.
    """
    _ORIGINAL_ENSURE_BASE_PREFIX(self, display)
    if os.environ.get("RECROOM_HEADLESS_STEAM", "1").strip().lower() in {"0", "false", "no"}:
        return

    installed = _steam_exe(self.base_prefix)
    if installed.is_file():
        return

    with _STEAM_INSTALL_LOCK:
        if installed.is_file():
            return
        if not self.wine:
            raise RuntimeError("Wine is unavailable for the official Steam runtime.")
        setup = _download_steam_setup(self)
        env = _base_wine_env(self, display)
        result = subprocess.run(
            [str(self.wine), str(setup), "/S"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=240,
            check=False,
        )
        deadline = time.time() + 120
        while time.time() < deadline and not installed.is_file():
            time.sleep(1)
        if not installed.is_file():
            compact = " ".join((result.stdout or "").split())[-1200:]
            raise RuntimeError(f"The official Steam client did not install into the Wine prefix. {compact}")
        if self.wineserver:
            subprocess.run(
                [str(self.wineserver), "-k"],
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=12,
                check=False,
            )


def _hide_steam_windows(self: RecRoomWinePool, instance: WineInstance) -> None:
    if not self.xdotool:
        return
    env = os.environ.copy()
    env["DISPLAY"] = f":{instance.display_number}"
    try:
        result = subprocess.run(
            [self.xdotool, "search", "--onlyvisible", "--name", "Steam"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=3,
            check=False,
        )
        for window in result.stdout.splitlines():
            window = window.strip()
            if window:
                subprocess.run(
                    [self.xdotool, "windowunmap", window],
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=3,
                    check=False,
                )
    except Exception:
        pass


def _start_headless_steam(self: RecRoomWinePool, instance: WineInstance) -> None:
    if os.environ.get("RECROOM_HEADLESS_STEAM", "1").strip().lower() in {"0", "false", "no"}:
        return
    steam = _steam_exe(instance.prefix_dir)
    if not steam.is_file():
        raise RuntimeError("The official Steam runtime is missing from the cloned Wine sandbox.")
    if not self.wine:
        raise RuntimeError("Wine is unavailable for the official Steam runtime.")
    (instance.client_dir / "steam_appid.txt").write_text(_STEAM_APP_ID + "\n", encoding="ascii")
    env = self._wine_env(instance)
    log = (instance.work_dir / "wine-steam.log").open("ab", buffering=0)
    process = subprocess.Popen(
        [
            str(self.wine),
            str(steam),
            "-silent",
            "-nochatui",
            "-nofriendsui",
            "-noreactlogin",
            "-no-cef-sandbox",
        ],
        cwd=steam.parent,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    setattr(instance, "steam_process", process)
    time.sleep(max(4, min(20, int(os.environ.get("RECROOM_STEAM_BOOT_WAIT_SECONDS", "10")))))
    _hide_steam_windows(self, instance)


def _terminate_process(process: subprocess.Popen[Any] | None, timeout: float = 4.0) -> None:
    if not process or process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=timeout)
    except Exception:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except Exception:
            try:
                process.kill()
            except Exception:
                pass


def _start_audio_with_clock(self: RecRoomWinePool, instance: WineInstance) -> None:
    """Create and unsuspend the per-session Pulse sink without extra startup load."""
    _ORIGINAL_START_AUDIO(self, instance)
    if not self.pactl:
        return

    source = f"{instance.sink_name}.monitor"
    for command in (
        [self.pactl, "suspend-sink", instance.sink_name, "0"],
        [self.pactl, "suspend-source", source, "0"],
        [self.pactl, "set-sink-mute", instance.sink_name, "0"],
        [self.pactl, "set-source-mute", source, "0"],
    ):
        try:
            subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, check=False)
        except Exception:
            pass
    setattr(instance, "silence_process", None)


def _start_silence_feeder(self: RecRoomWinePool, instance: WineInstance) -> None:
    """Clock the monitor only after the game has produced a real frame."""
    existing = getattr(instance, "silence_process", None)
    if existing and existing.poll() is None:
        return

    log = (instance.work_dir / "audio-silence.log").open("ab", buffering=0)
    pacat = shutil.which("pacat")
    process: subprocess.Popen[Any] | None = None
    if pacat:
        process = subprocess.Popen(
            [
                pacat,
                "--playback",
                f"--device={instance.sink_name}",
                "--format=s16le",
                "--rate=48000",
                "--channels=2",
                "/dev/zero",
            ],
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        time.sleep(0.35)
        if process.poll() is not None:
            process = None

    if process is None and self.ffmpeg:
        process = subprocess.Popen(
            [
                self.ffmpeg,
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-re",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=48000:cl=stereo",
                "-ac",
                "2",
                "-ar",
                "48000",
                "-f",
                "pulse",
                "-device",
                instance.sink_name,
                f"ripo-silence-{instance.host_id[-8:]}",
            ],
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        time.sleep(0.5)

    setattr(instance, "silence_process", process)


def _patch_cache_key(self: RecRoomWinePool) -> tuple[str, int]:
    manifest = self.client_dir / ".DepotDownloader" / "471711_6337851004861751095.manifest"
    try:
        stamp = manifest.stat().st_mtime_ns
    except OSError:
        stamp = 0
    return str(self.client_dir.resolve()), stamp


def _redirect_candidate_paths(self: RecRoomWinePool) -> tuple[str, ...]:
    """Find RecNet-bearing files once on the immutable exact-build client.

    The old code read every eligible file into RAM and repeatedly copied each
    full buffer for every hostname/encoding pair. Build 8751857 is ~6.3 GB, so
    that made the 46% redirect phase take minutes per sandbox. Memory-map the
    immutable source once, cache only matching relative paths, then each sandbox
    patches just those files.
    """
    key = _patch_cache_key(self)
    with _PATCH_SCAN_LOCK:
        cached = _PATCH_CANDIDATES.get(key)
        if cached is not None:
            return cached

        allowed_ext = {
            ".exe", ".dll", ".dat", ".bytes", ".json", ".txt", ".config", ".xml",
            ".assets", ".resource", ".ress", ".bin", ".manifest",
        }
        allowed_names = {"globalgamemanagers", "globalgamemanagers.assets"}
        max_size = 768 * 1024 * 1024
        ascii_marker = b".rec.net"
        wide_marker = ".rec.net".encode("utf-16le")
        matches: list[str] = []
        root = self.client_dir

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
                    with path.open("rb") as handle:
                        with mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as mapped:
                            if mapped.find(ascii_marker) < 0 and mapped.find(wide_marker) < 0:
                                continue
                except (OSError, ValueError):
                    continue
                matches.append(path.relative_to(root).as_posix())

        result = tuple(matches)
        _PATCH_CANDIDATES[key] = result
        print(f"Rec Room fast redirect scan found {len(result)} RecNet-bearing file(s).", flush=True)
        return result


def _patch_client_fast(self: RecRoomWinePool, root: Path, local_base: str) -> int:
    if len(local_base.encode("ascii")) != len("http://127.0.0.1:81"):
        raise RuntimeError("Wine sandbox loopback address is not patch-length safe.")

    candidates = _redirect_candidate_paths(self)
    if not candidates:
        # Keep a correctness fallback if a future client layout somehow stores
        # service URLs in an unexpected form.
        return _ORIGINAL_PATCH_CLIENT(self, root, local_base)

    changed_total = 0
    prepared_total = 0
    for relative in candidates:
        path = root / relative
        try:
            stat = path.stat()
            patched = bytearray(path.read_bytes())
        except OSError:
            continue

        changed = False
        for host, suffix in SUFFIX_BY_HOST.items():
            source = f"https://{host}.rec.net"
            default = f"http://127.0.0.1:81{suffix}"
            target = f"{local_base}{suffix}"
            for encoding in ("ascii", "utf-16le"):
                source_bytes = source.encode(encoding)
                target_bytes = target.encode(encoding)
                if len(source_bytes) != len(target_bytes):
                    raise RuntimeError(f"Unsafe Wine redirect length for {host}.")

                for candidate in (source_bytes, default.encode(encoding)):
                    start = 0
                    while True:
                        index = patched.find(candidate, start)
                        if index < 0:
                            break
                        patched[index:index + len(candidate)] = target_bytes
                        start = index + len(candidate)
                        changed = True
                        changed_total += 1

                if patched.find(target_bytes) >= 0:
                    prepared_total += 1

        if changed:
            temp = path.with_name(path.name + f".{os.getpid()}.winepatch")
            temp.write_bytes(patched)
            os.chmod(temp, stat.st_mode)
            temp.replace(path)

    if changed_total <= 0 and prepared_total <= 0:
        raise RuntimeError("The Rec Room client did not contain any known rec.net service URLs to redirect.")
    return max(changed_total, prepared_total)


def _frame_metrics(instance: WineInstance) -> tuple[float, int, float]:
    token = urllib.parse.quote(instance.stream_token, safe="")
    url = f"http://127.0.0.1:{instance.stream_port}/frame.jpg?token={token}&t={time.time_ns()}"
    request = urllib.request.Request(url, headers={"Cache-Control": "no-store"})
    with urllib.request.urlopen(request, timeout=5) as response:
        image = Image.open(io.BytesIO(response.read())).convert("RGB")
    width, height = image.size
    inner = image.crop(
        (
            max(80, int(width * 0.08)),
            max(70, int(height * 0.10)),
            min(width - 80, int(width * 0.92)),
            min(height - 60, int(height * 0.90)),
        )
    )
    stat = ImageStat.Stat(inner)
    mean = float(sum(stat.mean) / 3.0)
    extrema = inner.getextrema()
    spread = int(max(high - low for low, high in extrema))
    small = inner.resize((160, 90))
    nonblack = sum(1 for pixel in small.getdata() if max(pixel) > 12)
    ratio = float(nonblack / (160 * 90))
    return mean, spread, ratio


def _has_rendered_content(instance: WineInstance) -> tuple[bool, str]:
    steam_failure = _steam_failure_reason(instance)
    if steam_failure:
        return False, steam_failure
    try:
        mean, spread, ratio = _frame_metrics(instance)
    except Exception as exc:
        return False, f"frame-error={type(exc).__name__}:{exc}"
    ok = bool(mean > 2.0 and spread > 12 and ratio > 0.005)
    return ok, f"mean={mean:.3f} spread={spread} nonblack={ratio:.6f}"


def _log_tail(path: Path, limit: int = 2600) -> str:
    try:
        text = path.read_text(errors="replace")
        return " ".join(text[-limit:].split())
    except Exception:
        return ""


def _steam_failure_reason(instance: WineInstance) -> str:
    markers = (
        "failed to initialize steam platform",
        "steamapi_init() failed",
        "steam api init failed",
        "couldn't initialize steam",
    )
    try:
        paths = sorted(instance.work_dir.glob("wine-game*.log"), key=lambda path: path.stat().st_mtime_ns)
    except OSError:
        paths = []
    for path in paths[-4:]:
        try:
            tail = path.read_bytes()[-128_000:].decode("utf-8", "replace").casefold()
        except OSError:
            continue
        if any(marker in tail for marker in markers):
            return "steam-platform-initialization-failed"
    return ""


def _stop_wine_attempt(self: RecRoomWinePool, instance: WineInstance) -> None:
    _terminate_process(instance.game_process)
    instance.game_process = None
    _terminate_process(getattr(instance, "steam_process", None))
    setattr(instance, "steam_process", None)
    if self.wineserver:
        try:
            env = self._wine_env(instance)
            subprocess.run(
                [self.wineserver, "-k"],
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
                check=False,
            )
        except Exception:
            pass
    time.sleep(1.0)


def _provision_render_checked(
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
    with self.lock:
        self.instances[host_id] = instance

    def progress(phase: str, value: int) -> None:
        instance.phase = phase
        instance.progress = value
        on_progress(phase, value)

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
            # The archived Windows build reads its app id from this file when
            # started outside a desktop launcher. This is metadata only and
            # does not start Steam or expose a launcher window.
            (instance.client_dir / "steam_appid.txt").write_text("471710\n", encoding="ascii")

            profiles: list[tuple[str, list[str]]] = [
                (
                    "d3d11-bitblt-singlethreaded",
                    [
                        "-force-d3d11",
                        "-force-d3d11-bitblt-model",
                        "-force-d3d11-singlethreaded",
                        "-force-gfx-direct",
                    ],
                ),
                (
                    "d3d11-bitblt-no-singlethreaded",
                    [
                        "-force-d3d11",
                        "-force-d3d11-bitblt-model",
                        "-force-d3d11-no-singlethreaded",
                    ],
                ),
                (
                    "d3d11-bitblt",
                    ["-force-d3d11", "-force-d3d11-bitblt-model"],
                ),
                (
                    "d3d11-singlethreaded",
                    ["-force-d3d11", "-force-d3d11-singlethreaded"],
                ),
            ]
            if os.environ.get("RECROOM_ENABLE_GLCORE_FALLBACK", "0") == "1":
                profiles.append(("glcore", ["-force-glcore", "-force-clamped"]))

            diagnostics: list[str] = []
            env = self._wine_env(instance)
            env.setdefault("SteamAppId", "471710")
            env.setdefault("SteamGameId", "471710")
            progress("starting-game-platform", 62)
            _start_headless_steam(self, instance)
            progress("launching-game", 68)

            selected = False
            for profile_name, render_args in profiles:
                if instance.destroying:
                    return
                setattr(instance, "render_profile", profile_name)
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
                glog.write((f"\n[ripo] render-profile={profile_name} command={' '.join(command)}\n").encode())
                instance.game_process = subprocess.Popen(
                    command,
                    cwd=instance.client_dir,
                    env=env,
                    stdout=glog,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )

                window_deadline = time.time() + 40
                visible = False
                while time.time() < window_deadline:
                    if instance.destroying:
                        return
                    if instance.game_process.poll() is not None:
                        break
                    if self._window_visible(instance):
                        visible = True
                        break
                    time.sleep(0.75)

                if not visible:
                    code = instance.game_process.poll()
                    diagnostics.append(f"{profile_name}: no visible window (exit={code}); log={_log_tail(glog_path, 900)}")
                    _stop_wine_attempt(self, instance)
                    continue

                render_deadline = time.time() + 28
                last_metrics = "no frame"
                while time.time() < render_deadline:
                    if instance.destroying:
                        return
                    if instance.game_process.poll() is not None:
                        break
                    rendered, last_metrics = _has_rendered_content(instance)
                    if last_metrics == "steam-platform-initialization-failed":
                        raise RuntimeError(
                            "Rec Room requires an authenticated official Steam client. "
                            "The hidden Steam runtime started, but SteamAPI_Init still failed; "
                            "no Steam UI was exposed to the browser."
                        )
                    if rendered:
                        selected = True
                        setattr(instance, "render_metrics", last_metrics)
                        _start_silence_feeder(self, instance)
                        progress("ready", 100)
                        on_ready(self.public_stream_url(instance))
                        break
                    time.sleep(1.5)

                if selected:
                    break

                diagnostics.append(f"{profile_name}: viewport stayed black ({last_metrics}); log={_log_tail(glog_path, 1200)}")
                _stop_wine_attempt(self, instance)

            if not selected or not instance.game_process:
                detail = " | ".join(diagnostics[-4:])
                raise RuntimeError("Rec Room opened but no renderer produced a visible game viewport. " + detail)

            code = instance.game_process.wait()
            if not instance.destroying:
                on_failed(f"Rec Room exited under Wine with code {code}.")
        except Exception as exc:
            if not instance.destroying:
                on_failed(str(exc)[:3500])
            self.destroy(host_id)

    threading.Thread(target=worker, name=f"recroom-wine-{host_id[-8:]}", daemon=True).start()
    return True, None


def _progress_with_runtime(self: RecRoomWinePool, host_id: str) -> dict[str, Any] | None:
    payload = _ORIGINAL_PROGRESS(self, host_id)
    if not payload:
        return payload
    with self.lock:
        instance = self.instances.get(host_id)
        if instance:
            payload["renderProfile"] = str(getattr(instance, "render_profile", ""))
            payload["renderMetrics"] = str(getattr(instance, "render_metrics", ""))
            silence = getattr(instance, "silence_process", None)
            payload["audioClockRunning"] = bool(silence and silence.poll() is None)
    return payload


def _capability_with_runtime_marker(self: RecRoomWinePool) -> dict[str, Any]:
    payload = dict(_ORIGINAL_CAPABILITY(self))
    payload["runtimePatch"] = _RUNTIME_REVISION
    payload["renderReadyCheck"] = True
    payload["audioClock"] = "pulse-null-sink-silence-after-visible-frame"
    payload["glcoreFallbackDefault"] = False
    payload["fastRedirectPatch"] = True
    payload["steamRuntime"] = "official-headless-required-by-client"
    payload["steamUiStreamed"] = False
    return payload


def _destroy_with_audio_clock(self: RecRoomWinePool, host_id: str) -> None:
    with self.lock:
        instance = self.instances.get(host_id)
        silence = getattr(instance, "silence_process", None) if instance else None
        steam = getattr(instance, "steam_process", None) if instance else None
    _terminate_process(silence)
    _terminate_process(steam)
    _ORIGINAL_DESTROY(self, host_id)


RecRoomWinePool._start_audio = _start_audio_with_clock  # type: ignore[method-assign]
RecRoomWinePool._ensure_base_prefix = _ensure_base_prefix_with_steam  # type: ignore[method-assign]
RecRoomWinePool._patch_client = _patch_client_fast  # type: ignore[method-assign]
RecRoomWinePool.provision = _provision_render_checked  # type: ignore[method-assign]
RecRoomWinePool.progress = _progress_with_runtime  # type: ignore[method-assign]
RecRoomWinePool.capability = _capability_with_runtime_marker  # type: ignore[method-assign]
RecRoomWinePool.destroy = _destroy_with_audio_clock  # type: ignore[method-assign]
print(f"Rec Room Wine runtime patch loaded: {_RUNTIME_REVISION}")
