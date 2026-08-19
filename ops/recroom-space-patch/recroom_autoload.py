from __future__ import annotations

import hashlib
import hmac
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any


_MOUNT_LOCK = threading.Lock()
_MOUNTED = False
_DEFAULT_RECROOM_ARCHIVE = "https://archive.recagain.site/download/2021-08-25T06-50-15Z"


def _derived_key(root_secret: str, purpose: bytes) -> str:
    return hmac.new(root_secret.encode("utf-8"), purpose, hashlib.sha256).hexdigest()


def install_into_live_app(application: Any, data_dir: Path | None = None) -> dict[str, Any]:
    """Mount the Rec Room stack once onto whichever Gradio/FastAPI app is live."""
    global _MOUNTED
    with _MOUNT_LOCK:
        existing = {getattr(route, "path", None) for route in getattr(application, "routes", [])}
        if _MOUNTED or "/api/recroom-public/status" in existing:
            _MOUNTED = True
            return {"ok": True, "alreadyMounted": True}

        root = data_dir or Path(os.environ.get("RIPO_DATA_DIR", str(Path.home() / ".ripo-cloud-pc")))
        root.mkdir(parents=True, exist_ok=True)
        public_url = os.environ.get("RECROOM_PUBLIC_BASE_URL", "https://echoxr-ripoteam-cloud-pc.hf.space").rstrip("/")
        os.environ.setdefault("RECROOM_GATEWAY_URL", public_url)
        os.environ.setdefault("RECROOM_WINE_CLIENT_ARCHIVE_URL", _DEFAULT_RECROOM_ARCHIVE)
        os.environ.setdefault("RECROOM_STARTING_TTL_SECONDS", "900")
        os.environ.setdefault("RECROOM_CLIENT_WAIT_SECONDS", "720")
        os.environ.setdefault("RECROOM_PHOTON_APP_VERSION", "20210827_prod")

        admin_token = os.environ.get("ADMIN_TOKEN", "").strip()
        if admin_token:
            os.environ.setdefault("RECROOM_BROKER_KEY", _derived_key(admin_token, b"ripo-recroom-broker-v1"))
            os.environ.setdefault("RECROOM_HOST_KEY", _derived_key(admin_token, b"ripo-recroom-host-v1"))

        from recroom_gateway import RecRoomGateway, install_recroom_gateway_routes
        import recroom_2021_gateway_config  # noqa: F401
        from recroom_compat import install_recroom_compat_routes
        from recroom_compat_extra import install_recroom_extra_routes
        from recroom_room_compat import install_recroom_room_compat_routes
        from recroom_match_compat import install_recroom_match_compat_routes
        from recroom_photon_compat import install_recroom_photon_compat_routes
        from recroom_service_aliases import install_recroom_service_alias_routes
        from recroom_service_extra_aliases import install_recroom_service_extra_alias_routes
        from recroom_leaderboard_compat import install_recroom_leaderboard_compat_routes
        from recroom_route_order import stabilize_recroom_route_order
        from recroom_broker import install_recroom_broker_routes
        import recroom_2021_broker_alias  # noqa: F401

        # Free ZeroGPU/Gradio Spaces do not expose Debian i386 multilib. Use the
        # SHA256-pinned Wine amd64-wow64 build so the archived 64-bit Rec Room
        # client launches directly with the official Steamworks runtime hidden from the streamed desktop.
        import recroom_portable_wow64  # noqa: F401
        import recroom_wine_prefix_fix  # noqa: F401
        import recroom_wine_runtime_fix  # noqa: F401
        import recroom_nameserver_fix  # noqa: F401
        import recroom_2021_nameserver_contract  # noqa: F401
        import recroom_black_viewport_fix  # noqa: F401
        import recroom_https_recnet_fix as recroom_recnet_transport
        import recroom_2021_metadata_locator  # noqa: F401
        import recroom_live_failure_diagnostics  # noqa: F401
        from recroom_vm_bridge import attach_recroom_vm_pool
        from recroom_build_fingerprint import guard_wine_pool
        from recroom_client_installer import install_recroom_client_installer_routes
        import recroom_2021_archive_attestation  # noqa: F401
        from recroom_launch_wait_fix import install_launch_wait_fix
        from recroom_capture import install_recroom_capture_routes
        from recroom_public import install_recroom_public_routes

        gateway = RecRoomGateway(root / "recroom-gateway")
        install_recroom_gateway_routes(application, gateway)
        recroom_recnet_transport.install_public_bootstrap_route(application)
        install_recroom_compat_routes(application, gateway)
        install_recroom_extra_routes(application, gateway)
        install_recroom_room_compat_routes(application, gateway)
        install_recroom_match_compat_routes(application, gateway)
        install_recroom_photon_compat_routes(application, gateway)
        install_recroom_service_alias_routes(application, gateway)
        install_recroom_service_extra_alias_routes(application, gateway)
        install_recroom_leaderboard_compat_routes(application, gateway)
        stabilize_recroom_route_order(application)

        broker = install_recroom_broker_routes(application, root / "recroom-broker")
        vm_pool = attach_recroom_vm_pool(application, broker, root)
        wine_pool = getattr(broker, "wine_pool", None)
        client_installer = None
        if wine_pool is not None:
            guard_wine_pool(wine_pool)
            client_installer = install_recroom_client_installer_routes(
                application,
                broker,
                wine_pool,
                root / "recroom-client-installer",
            )
            install_launch_wait_fix(broker, wine_pool, client_installer)
        capture = install_recroom_capture_routes(application, broker, root / "recroom-captures")
        install_recroom_public_routes(application, broker, capture)

        _MOUNTED = True
        return {
            "ok": True,
            "alreadyMounted": False,
            "gateway": gateway,
            "broker": broker,
            "vmPool": vm_pool,
            "winePool": wine_pool,
            "clientInstaller": client_installer,
            "capture": capture,
        }


def _mount_when_app_exists() -> None:
    for _ in range(320):
        module = sys.modules.get("app") or sys.modules.get("__main__")
        application = getattr(module, "app", None) if module is not None else None
        if application is None:
            time.sleep(0.25)
            continue
        time.sleep(0.75)
        try:
            data_dir = getattr(module, "DATA_DIR", None)
            result = install_into_live_app(application, data_dir if isinstance(data_dir, Path) else None)
            if module is not None and result.get("gateway") is not None:
                module.RIPO_RECROOM_GATEWAY = result["gateway"]
                module.RIPO_RECROOM_BROKER = result["broker"]
                module.RIPO_RECROOM_VM_POOL = result["vmPool"]
                module.RIPO_RECROOM_WINE_POOL = result.get("winePool")
                module.RIPO_RECROOM_CLIENT_INSTALLER = result.get("clientInstaller")
                module.RIPO_RECROOM_CAPTURE = result["capture"]
            print(f"Rec Room server-stream routes mounted: {result.get('ok')}")
            return
        except Exception as exc:
            print(f"Rec Room runtime route mount failed: {exc}")
            return
    print("Rec Room runtime route mount timed out waiting for app.py.")


def start_recroom_autoload() -> None:
    threading.Thread(
        target=_mount_when_app_exists,
        name="ripo-recroom-route-mount",
        daemon=True,
    ).start()
