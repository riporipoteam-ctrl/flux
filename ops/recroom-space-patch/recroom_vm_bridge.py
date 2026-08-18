from __future__ import annotations

import os
import secrets
import threading
import time
import types
import uuid
from typing import Any

from fastapi import HTTPException

from recroom_broker import HostRecord, SessionRecord, TARGET_BUILD_ID, _hash_token
from recroom_vm_pool import RecRoomVmPool, install_recroom_vm_routes
from recroom_wine_pool import RecRoomWinePool, install_recroom_wine_routes


def attach_recroom_vm_pool(app: Any, broker: Any, data_dir: Any) -> RecRoomVmPool:
    """Attach RipoTeamServer-owned disposable game runtimes.

    Prefer a real KVM Windows VM when the host supports it. Managed Linux
    platforms such as Hugging Face Spaces usually do not expose /dev/kvm, so the
    production fallback is an isolated per-player Wine sandbox. In both cases
    the browser contract is the same: Play allocates a private server runtime,
    Rec Room is streamed into Flux, and leaving destroys the disposable runtime.
    """

    public_base = os.environ.get("RECROOM_PUBLIC_BASE_URL", "https://echoxr-ripoteam-cloud-pc.hf.space").rstrip("/")
    kvm_pool = RecRoomVmPool(data_dir / "recroom-vms", public_base, broker.host_key)
    wine_pool = RecRoomWinePool(data_dir / "recroom-wine", public_base, broker.gateway_url)
    broker.vm_pool = kvm_pool
    broker.wine_pool = wine_pool

    server_only = os.environ.get("RECROOM_VM_ONLY", "1").strip() not in {"0", "false", "False"}
    runtime_preference = os.environ.get("RECROOM_RUNTIME_PROVIDER", "auto").strip().lower() or "auto"
    browser_idle_seconds = max(30, int(os.environ.get("RECROOM_VM_BROWSER_IDLE_SECONDS", "75")))
    browser_seen: dict[str, float] = {}

    original_allocate = broker.allocate
    original_release_locked = broker._release_locked
    original_status = broker.status
    original_heartbeat = broker.heartbeat
    original_mark_ready = broker.mark_ready
    original_public_session = broker.public_session
    original_kvm_proxy_target = kvm_pool.proxy_target
    original_wine_proxy_target = wine_pool.proxy_target

    def touch_runtime_browser(host_id: str) -> None:
        now = time.time()
        browser_seen[host_id] = now
        # Server-owned runtimes do not have a separate host agent sending
        # heartbeats while the player is waiting for the game window. Treat
        # actual browser stream traffic as a heartbeat so the 35-second
        # host-stale guard cannot falsely mark an active Wine session offline.
        with broker.lock:
            host = broker.hosts.get(host_id)
            if host and host.metadata.get("runtimePool"):
                host.last_heartbeat = now

    def tracked_kvm_proxy_target(host_id: str, path: str, query: str = "") -> str:
        touch_runtime_browser(host_id)
        return original_kvm_proxy_target(host_id, path, query)

    def tracked_wine_proxy_target(host_id: str, path: str, query: str = "") -> str:
        touch_runtime_browser(host_id)
        return original_wine_proxy_target(host_id, path, query)

    kvm_pool.proxy_target = tracked_kvm_proxy_target  # type: ignore[method-assign]
    wine_pool.proxy_target = tracked_wine_proxy_target  # type: ignore[method-assign]

    def runtime_for_host(host_id: str) -> tuple[str, Any] | tuple[None, None]:
        with broker.lock:
            host = broker.hosts.get(host_id)
            provider = str((host.metadata if host else {}).get("provider") or "")
        if provider == "wine":
            return "wine", wine_pool
        if provider == "kvm":
            return "kvm", kvm_pool
        if wine_pool.progress(host_id):
            return "wine", wine_pool
        if kvm_pool.progress(host_id):
            return "kvm", kvm_pool
        return None, None

    def choose_runtime() -> tuple[str | None, Any | None, str | None]:
        choices: list[tuple[str, Any]]
        if runtime_preference == "wine":
            choices = [("wine", wine_pool)]
        elif runtime_preference == "kvm":
            choices = [("kvm", kvm_pool)]
        else:
            # Prefer a true VM only when it is game-ready. Otherwise Wine is the
            # KVM-free path that can run inside a normal Linux Space.
            choices = [("kvm", kvm_pool), ("wine", wine_pool)]

        reasons: list[str] = []
        for provider, pool in choices:
            capability = pool.capability()
            if not capability.get("readyForGame"):
                reason = str(capability.get("reason") or "runtime is not game-ready")
                reasons.append(f"{provider}: {reason}")
                continue
            can_start, reason = pool.can_provision()
            if can_start:
                return provider, pool, None
            reasons.append(f"{provider}: {reason or 'no free capacity'}")
        return None, None, "; ".join(reasons)

    def friendly_runtime_error() -> str:
        wine = wine_pool.capability()
        if not wine.get("checks", {}).get("client"):
            return "RipoTeamServer is ready to stream browser sessions, but the May 19 2022 Rec Room server game image has not been installed on the server yet."
        if runtime_preference == "kvm":
            return "The configured Windows VM runtime is unavailable on this server."
        return "RipoTeamServer does not currently have a game-ready Rec Room runtime slot."

    def allocate(self: Any, identity_payload: dict[str, Any], build_id: str):
        if not server_only:
            try:
                return original_allocate(identity_payload, build_id)
            except HTTPException as exc:
                if exc.status_code != 503:
                    raise

        self.cleanup()
        if build_id != TARGET_BUILD_ID:
            raise HTTPException(status_code=400, detail=f"Unsupported build {build_id!r}.")

        provider, pool, _runtime_reason = choose_runtime()
        if not provider or pool is None:
            raise HTTPException(status_code=503, detail=friendly_runtime_error())

        account = identity_payload["account"]
        recnet_session_token = str(identity_payload["sessionToken"])
        uid = str(account.get("uid") or identity_payload.get("uid") or "")
        if not uid:
            uid = f"account:{account.get('accountId', 'unknown')}"

        prefix = "ripo-wine" if provider == "wine" else "ripo-vm"
        host_id = f"{prefix}-{uuid.uuid4().hex[:16]}"
        session_id = str(uuid.uuid4())
        access_token = secrets.token_urlsafe(32)
        now = time.time()
        host = HostRecord(
            host_id=host_id,
            name=f"RipoTeamServer {provider.upper()} {host_id[-8:]}",
            builds={build_id},
            capacity=1,
            metadata={
                "runtimePool": True,
                "vmPool": provider == "kvm",
                "winePool": provider == "wine",
                "provider": provider,
                "phase": "queued",
                "progress": 1,
            },
        )
        session = SessionRecord(
            session_id=session_id,
            access_token_hash=_hash_token(access_token),
            uid=uid,
            account=account,
            host_id=host_id,
            build_id=build_id,
            created_at=now,
            expires_at=now + int(os.environ.get("RECROOM_SESSION_TTL_SECONDS", "7200")),
            state="starting",
            host_details={
                "provider": f"ripoteam-{provider}",
                "phase": "queued",
                "progress": 1,
            },
        )
        host.active_sessions.add(session_id)
        if provider == "kvm":
            # The Windows guest agent consumes this after the KVM VM boots.
            host.jobs.append(
                {
                    "type": "start-session",
                    "sessionId": session_id,
                    "buildId": build_id,
                    "gatewayUrl": self.gateway_url,
                    "recnetSessionToken": recnet_session_token,
                    "account": {
                        "accountId": account.get("accountId"),
                        "username": account.get("username"),
                        "displayName": account.get("displayName"),
                        "isAdmin": bool(account.get("isAdmin")),
                    },
                }
            )
        with self.lock:
            self.hosts[host_id] = host
            self.sessions[session_id] = session
        browser_seen[host_id] = now

        def on_progress(phase: str, progress: int) -> None:
            with self.lock:
                current = self.sessions.get(session_id)
                current_host = self.hosts.get(host_id)
                if current:
                    current.host_details.update({"provider": f"ripoteam-{provider}", "phase": phase, "progress": progress})
                if current_host:
                    current_host.last_heartbeat = time.time()
                    current_host.metadata.update({"phase": phase, "progress": progress})

        def on_failed(error: str) -> None:
            try:
                self.mark_failed(host_id, session_id, error)
            except Exception:
                pass

        def on_ready(stream_url: str) -> None:
            try:
                self.mark_ready(
                    host_id,
                    session_id,
                    {
                        "streamUrl": stream_url,
                        "resolution": "1280x720",
                        "streamer": "ripo-wine-browser" if provider == "wine" else "ripo-vm-browser",
                    },
                )
            except Exception as exc:
                on_failed(f"Could not publish the browser stream: {exc}")

        if provider == "wine":
            started, start_error = wine_pool.provision(
                host_id,
                session_id,
                recnet_session_token,
                on_progress,
                on_ready,
                on_failed,
            )
        else:
            started, start_error = kvm_pool.provision(host_id, on_progress, on_failed)

        if not started:
            with self.lock:
                self.sessions.pop(session_id, None)
                self.hosts.pop(host_id, None)
            browser_seen.pop(host_id, None)
            raise HTTPException(status_code=503, detail=start_error or "RipoTeamServer could not start the game runtime.")

        self._audit(
            "session.runtime.allocate",
            session_id=session_id,
            host_id=host_id,
            build_id=build_id,
            provider=provider,
        )
        return session, access_token

    def release_locked(self: Any, session_id: str, reason: str) -> None:
        session = self.sessions.get(session_id)
        host_id = session.host_id if session else ""
        host = self.hosts.get(host_id) if host_id else None
        server_runtime = bool(host and host.metadata.get("runtimePool"))
        provider = str((host.metadata if host else {}).get("provider") or "")
        original_release_locked(session_id, reason)
        if server_runtime and host_id:
            self.hosts.pop(host_id, None)
            browser_seen.pop(host_id, None)
            if provider == "wine":
                wine_pool.destroy(host_id)
            else:
                kvm_pool.destroy(host_id)
            self._audit("session.runtime.destroy", session_id=session_id, host_id=host_id, provider=provider, reason=reason)

    def heartbeat(self: Any, host_id: str, payload: dict[str, Any]):
        host = original_heartbeat(host_id, payload)
        if host.metadata.get("runtimePool"):
            provider = str(host.metadata.get("provider") or "kvm")
            host.metadata.update({"phase": "launching-game", "progress": max(70, int(host.metadata.get("progress") or 0))})
            with self.lock:
                for session_id in list(host.active_sessions):
                    session = self.sessions.get(session_id)
                    if session and session.state == "starting":
                        session.host_details.update({"provider": f"ripoteam-{provider}", "phase": "launching-game", "progress": 70})
        return host

    def mark_ready(self: Any, host_id: str, session_id: str, payload: dict[str, Any]):
        provider, pool = runtime_for_host(host_id)
        rewritten = dict(payload)
        stream_url = str(rewritten.get("streamUrl") or "")
        if provider == "kvm" and stream_url:
            rewritten["streamUrl"] = kvm_pool.rewrite_stream_url(host_id, stream_url)
        session = original_mark_ready(host_id, session_id, rewritten)
        session.host_details.update({"provider": f"ripoteam-{provider or 'server'}", "phase": "ready", "progress": 100})
        browser_seen[host_id] = time.time()
        return session

    def public_session(self: Any, session: Any, access_token: str | None = None) -> dict[str, Any]:
        payload = original_public_session(session, access_token)
        details = session.host_details if isinstance(session.host_details, dict) else {}
        provider_name, pool = runtime_for_host(session.host_id)
        runtime_progress = pool.progress(session.host_id) if pool else None
        payload["provider"] = details.get("provider") or (f"ripoteam-{provider_name}" if provider_name else "remote")
        payload["phase"] = "ready" if session.state == "ready" else details.get("phase") or (runtime_progress or {}).get("phase") or session.state
        payload["progress"] = 100 if session.state == "ready" else int(details.get("progress") or (runtime_progress or {}).get("progress") or 0)
        # Flux must not mount the browser player until the Wine/KVM runtime has
        # produced the real Rec Room window. The old Steam phase adapter used
        # to provide this flag; direct launch owns it here instead.
        payload["streamReady"] = bool(session.state == "ready" and session.stream_url)
        payload["gameReady"] = bool(session.state == "ready" and session.stream_url)
        return payload

    def status(self: Any) -> dict[str, Any]:
        payload = original_status()
        kvm = kvm_pool.capability()
        wine = wine_pool.capability()
        if runtime_preference == "kvm":
            selected = kvm
        elif runtime_preference == "wine":
            selected = wine
        else:
            selected = kvm if kvm.get("readyForGame") else wine
        payload["vmRuntime"] = selected  # retained for older Flux clients
        payload["serverRuntime"] = selected
        payload["kvmRuntime"] = kvm
        payload["wineRuntime"] = wine
        payload["mode"] = "server-stream"
        payload["configured"] = bool(payload.get("configured") and selected.get("supported"))
        payload["vmReadyForGame"] = bool(selected.get("readyForGame"))
        payload["runtimeReadyForGame"] = bool(selected.get("readyForGame"))
        return payload

    broker.allocate = types.MethodType(allocate, broker)
    broker._release_locked = types.MethodType(release_locked, broker)
    broker.heartbeat = types.MethodType(heartbeat, broker)
    broker.mark_ready = types.MethodType(mark_ready, broker)
    broker.public_session = types.MethodType(public_session, broker)
    broker.status = types.MethodType(status, broker)

    def reap_disconnected_browsers() -> None:
        while True:
            time.sleep(15)
            now = time.time()
            stale: list[str] = []
            with broker.lock:
                for session_id, session in list(broker.sessions.items()):
                    host = broker.hosts.get(session.host_id)
                    if not host or not host.metadata.get("runtimePool") or session.state != "ready":
                        continue
                    last_seen = browser_seen.get(session.host_id, session.created_at)
                    if now - last_seen > browser_idle_seconds:
                        stale.append(session_id)
                for session_id in stale:
                    broker._release_locked(session_id, "browser-disconnected")
            for session_id in stale:
                broker._audit("session.runtime.browser-timeout", session_id=session_id, idle_seconds=browser_idle_seconds)

    threading.Thread(
        target=reap_disconnected_browsers,
        name="recroom-runtime-browser-reaper",
        daemon=True,
    ).start()

    install_recroom_vm_routes(app, kvm_pool)
    install_recroom_wine_routes(app, wine_pool)
    return kvm_pool
