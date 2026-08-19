from __future__ import annotations

import argparse
import io
import json
import os
import secrets
import subprocess
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from PIL import Image
from mss import mss


KEY_MAP = {
    " ": "space",
    "Space": "space",
    "Enter": "Return",
    "Escape": "Escape",
    "Backspace": "BackSpace",
    "Tab": "Tab",
    "Shift": "Shift_L",
    "Control": "Control_L",
    "Alt": "Alt_L",
    "Delete": "Delete",
    "ArrowLeft": "Left",
    "ArrowRight": "Right",
    "ArrowUp": "Up",
    "ArrowDown": "Down",
}


def html_page(token: str) -> bytes:
    safe = json.dumps(token)
    return f"""<!doctype html>
<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover\">
<title>Rec Room · Flux</title>
<style>
html,body{{margin:0;width:100%;height:100%;overflow:hidden;background:#000;color:#fff;font-family:system-ui,sans-serif;touch-action:none;-webkit-user-select:none;user-select:none}}
#wrap{{position:fixed;inset:0;display:grid;place-items:center;background:#000}}
#frame{{width:100%;height:100%;object-fit:contain;outline:none;cursor:crosshair;user-select:none;-webkit-user-drag:none;touch-action:none}}
#status{{position:fixed;left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));padding:6px 9px;border-radius:999px;background:#000b;font-size:11px;pointer-events:none;z-index:30}}
#sound{{position:fixed;right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));padding:7px 10px;border:1px solid #ffffff2b;border-radius:999px;background:#000b;color:#fff;font:700 11px system-ui;z-index:35}}
#touchControls{{display:none}}
@media (pointer:coarse){{
  #touchControls{{display:block;position:fixed;inset:0;z-index:20;pointer-events:none}}
  #movePad{{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(48px,calc(env(safe-area-inset-bottom) + 20px));width:138px;height:138px;border-radius:50%;border:1px solid #ffffff32;background:#0007;box-shadow:inset 0 0 0 22px #ffffff08;pointer-events:auto;touch-action:none}}
  #moveStick{{position:absolute;left:43px;top:43px;width:52px;height:52px;border-radius:50%;background:#ffffff38;border:1px solid #ffffff66;transform:translate(0,0);pointer-events:none}}
  #lookPad{{position:absolute;right:0;top:0;width:58%;height:100%;pointer-events:auto;touch-action:none}}
  .action{{position:absolute;display:grid;place-items:center;border-radius:50%;border:1px solid #ffffff45;background:#0009;color:#fff;font:800 11px system-ui;letter-spacing:.03em;pointer-events:auto;touch-action:none;box-shadow:0 4px 22px #0008}}
  #jumpBtn{{right:max(20px,env(safe-area-inset-right));bottom:max(46px,calc(env(safe-area-inset-bottom) + 18px));width:76px;height:76px}}
  #actBtn{{right:max(102px,calc(env(safe-area-inset-right) + 84px));bottom:max(94px,calc(env(safe-area-inset-bottom) + 66px));width:62px;height:62px}}
  #runBtn{{left:max(120px,calc(env(safe-area-inset-left) + 102px));bottom:max(178px,calc(env(safe-area-inset-bottom) + 150px));width:50px;height:50px;font-size:9px}}
}}
</style></head><body>
<div id=\"wrap\"><img id=\"frame\" tabindex=\"0\" alt=\"Rec Room streamed from RipoTeamServer\"></div>
<div id=\"status\">Connecting Rec Room…</div><button id=\"sound\" type=\"button\">🔊 Sound</button>
<audio id=\"audio\" playsinline preload=\"auto\"></audio>
<div id=\"touchControls\"><div id=\"lookPad\"></div><div id=\"movePad\"><div id=\"moveStick\"></div></div><button id=\"jumpBtn\" class=\"action\">JUMP</button><button id=\"actBtn\" class=\"action\">ACT</button><button id=\"runBtn\" class=\"action\">RUN</button></div>
<script>
const token={safe};const frame=document.getElementById('frame'),status=document.getElementById('status'),audio=document.getElementById('audio'),sound=document.getElementById('sound');
const coarse=matchMedia('(pointer:coarse)').matches;let stopped=false,framePending=false,retryAt=0,pendingDx=0,pendingDy=0,moveScheduled=false;const fps=12;
audio.src=`audio.mp3?token=${{encodeURIComponent(token)}}&t=${{Date.now()}}`;
async function enableSound(){{try{{await audio.play();sound.textContent='🔊 Sound on';}}catch{{sound.textContent='🔇 Tap to enable sound';}}}}
sound.addEventListener('click',enableSound);
function refresh(){{if(stopped)return;const now=Date.now();if(!framePending&&now>=retryAt){{framePending=true;frame.src=`frame.jpg?token=${{encodeURIComponent(token)}}&t=${{now}}`;}}requestAnimationFrame(refresh);}}
frame.onload=()=>{{framePending=false;retryAt=0;status.textContent=coarse?'Connected · touch controls ready':(document.pointerLockElement===frame?'Connected · mouse captured':'Connected · click game to control');}};
frame.onerror=()=>{{framePending=false;retryAt=Date.now()+250;status.textContent='Waiting for the first game frame…';}};
async function input(payload){{try{{await fetch(`input?token=${{encodeURIComponent(token)}}`,{{method:'POST',headers:{{'content-type':'application/json'}},body:JSON.stringify(payload),cache:'no-store'}});}}catch{{}}}}
function buttonName(button){{return button===2?'right':button===1?'middle':'left';}}
function flushMove(){{moveScheduled=false;const dx=Math.round(pendingDx),dy=Math.round(pendingDy);pendingDx=0;pendingDy=0;if(dx||dy)input({{type:'move',dx,dy}});}}
function queueMove(dx,dy){{pendingDx+=dx;pendingDy+=dy;if(!moveScheduled){{moveScheduled=true;requestAnimationFrame(flushMove);}}}}
if(!coarse){{
 frame.addEventListener('pointerdown',ev=>{{ev.preventDefault();enableSound();frame.focus();input({{type:'button',button:buttonName(ev.button),down:true}});if(ev.button===0&&document.pointerLockElement!==frame&&frame.requestPointerLock){{try{{frame.requestPointerLock();}}catch{{}}}}}});
 frame.addEventListener('pointerup',ev=>{{ev.preventDefault();input({{type:'button',button:buttonName(ev.button),down:false}});}});
 frame.addEventListener('mousemove',ev=>{{if(document.pointerLockElement===frame)queueMove(ev.movementX||0,ev.movementY||0);}});
 frame.addEventListener('wheel',ev=>{{ev.preventDefault();input({{type:'wheel',delta:ev.deltaY<0?1:-1}});}},{{passive:false}});
 frame.addEventListener('contextmenu',ev=>ev.preventDefault());
 document.addEventListener('pointerlockchange',()=>{{if(document.pointerLockElement!==frame)input({{type:'release'}});}});
 window.addEventListener('keydown',ev=>{{if(['F5','F11','F12'].includes(ev.key))return;ev.preventDefault();input({{type:'key',key:ev.key,down:true}});}});
 window.addEventListener('keyup',ev=>{{if(['F5','F11','F12'].includes(ev.key))return;ev.preventDefault();input({{type:'key',key:ev.key,down:false}});}});
}}
const movePad=document.getElementById('movePad'),moveStick=document.getElementById('moveStick'),lookPad=document.getElementById('lookPad');let movePointer=null,moveCx=0,moveCy=0,activeMove=new Set(),lookPointer=null,lookX=0,lookY=0;
function setMove(next){{const desired=new Set(next);for(const key of activeMove)if(!desired.has(key))input({{type:'key',key,down:false}});for(const key of desired)if(!activeMove.has(key))input({{type:'key',key,down:true}});activeMove=desired;}}
function stopMove(){{setMove([]);moveStick.style.transform='translate(0,0)';movePointer=null;}}
movePad.addEventListener('pointerdown',ev=>{{if(!coarse)return;ev.preventDefault();enableSound();movePointer=ev.pointerId;movePad.setPointerCapture(ev.pointerId);const r=movePad.getBoundingClientRect();moveCx=r.left+r.width/2;moveCy=r.top+r.height/2;}});
movePad.addEventListener('pointermove',ev=>{{if(ev.pointerId!==movePointer)return;ev.preventDefault();let dx=ev.clientX-moveCx,dy=ev.clientY-moveCy;const mag=Math.hypot(dx,dy)||1,max=42,scale=Math.min(1,max/mag);dx*=scale;dy*=scale;moveStick.style.transform=`translate(${{dx}}px,${{dy}}px)`;const keys=[];if(dy<-13)keys.push('w');if(dy>13)keys.push('s');if(dx<-13)keys.push('a');if(dx>13)keys.push('d');setMove(keys);}});
movePad.addEventListener('pointerup',stopMove);movePad.addEventListener('pointercancel',stopMove);
lookPad.addEventListener('pointerdown',ev=>{{if(!coarse)return;ev.preventDefault();enableSound();lookPointer=ev.pointerId;lookX=ev.clientX;lookY=ev.clientY;lookPad.setPointerCapture(ev.pointerId);}});
lookPad.addEventListener('pointermove',ev=>{{if(ev.pointerId!==lookPointer)return;ev.preventDefault();const dx=(ev.clientX-lookX)*1.45,dy=(ev.clientY-lookY)*1.45;lookX=ev.clientX;lookY=ev.clientY;queueMove(dx,dy);}});
lookPad.addEventListener('pointerup',ev=>{{if(ev.pointerId===lookPointer)lookPointer=null;}});lookPad.addEventListener('pointercancel',ev=>{{if(ev.pointerId===lookPointer)lookPointer=null;}});
function bindKeyButton(id,key){{const el=document.getElementById(id);const down=ev=>{{ev.preventDefault();enableSound();input({{type:'key',key,down:true}});}};const up=ev=>{{ev.preventDefault();input({{type:'key',key,down:false}});}};el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);}}
bindKeyButton('jumpBtn','Space');bindKeyButton('actBtn','e');bindKeyButton('runBtn','Shift');
window.addEventListener('blur',()=>{{setMove([]);input({{type:'release'}});}});window.addEventListener('beforeunload',()=>{{stopped=true;input({{type:'release'}});}});frame.focus();enableSound();refresh();
</script></body></html>""".encode("utf-8")


class StreamServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, *, display: str, token: str, pulse_source: str, width: int, height: int, quality: int):
        super().__init__(address, handler)
        self.display = display
        self.token = token
        self.pulse_source = pulse_source
        self.width = width
        self.height = height
        self.quality = quality
        self.capture_lock = threading.Lock()
        self.input_lock = threading.Lock()
        self.frame_lock = threading.Lock()
        self.latest_frame: bytes | None = None
        self.frame_error = ""
        self.stop_capture = threading.Event()
        self.capture_thread: threading.Thread | None = None
        self.xenv = os.environ.copy()
        self.xenv["DISPLAY"] = display

    def capture(self) -> bytes:
        with self.frame_lock:
            frame = self.latest_frame
            error = self.frame_error
        if frame:
            return frame
        raise RuntimeError(error or "The game frame buffer is still warming up.")

    def _capture_loop(self) -> None:
        try:
            with mss(display=self.display) as grabber:
                monitors = grabber.monitors
                monitor = monitors[1] if len(monitors) > 1 else monitors[0]
                while not self.stop_capture.is_set():
                    try:
                        with self.capture_lock:
                            shot = grabber.grab(monitor)
                            image = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
                            if image.width != self.width or image.height != self.height:
                                image.thumbnail((self.width, self.height), Image.Resampling.BILINEAR)
                            output = io.BytesIO()
                            image.save(output, format="JPEG", quality=self.quality, optimize=True)
                            frame = output.getvalue()
                        with self.frame_lock:
                            self.latest_frame = frame
                            self.frame_error = ""
                    except Exception as exc:
                        with self.frame_lock:
                            self.frame_error = str(exc)
                    self.stop_capture.wait(1 / 12)
        except Exception as exc:
            with self.frame_lock:
                self.frame_error = str(exc)

    def start_capture(self) -> None:
        self.capture_thread = threading.Thread(
            target=self._capture_loop,
            name="recroom-frame-buffer",
            daemon=True,
        )
        self.capture_thread.start()

    def close_capture(self) -> None:
        self.stop_capture.set()
        if self.capture_thread and self.capture_thread.is_alive():
            self.capture_thread.join(timeout=2)

    def xdotool(self, *parts: str) -> None:
        subprocess.run(["xdotool", *parts], env=self.xenv, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=4, check=False)


class Handler(BaseHTTPRequestHandler):
    server_version = "RipoRecRoomWineStream/1.0"

    def log_message(self, _format: str, *_args) -> None:
        return

    def parsed(self):
        return urlparse(self.path)

    def authorized(self, parsed) -> bool:
        return secrets.compare_digest(parse_qs(parsed.query).get("token", [""])[0], self.server.token)

    def send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, payload: dict) -> None:
        self.send_bytes(status, "application/json; charset=utf-8", json.dumps(payload).encode("utf-8"))

    def do_GET(self) -> None:
        parsed = self.parsed()
        if parsed.path == "/health":
            with self.server.frame_lock:
                frame_ready = bool(self.server.latest_frame)
                frame_error = self.server.frame_error
            return self.send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "display": self.server.display,
                    "audio": bool(self.server.pulse_source),
                    "audioFormat": "mp3",
                    "frameReady": frame_ready,
                    "frameError": frame_error or None,
                    "inputSerialized": True,
                    "fps": 12,
                },
            )
        if not self.authorized(parsed):
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "invalid token"})
        if parsed.path in {"/", "/index.html"}:
            return self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", html_page(self.server.token))
        if parsed.path == "/frame.jpg":
            try:
                return self.send_bytes(HTTPStatus.OK, "image/jpeg", self.server.capture())
            except Exception as exc:
                return self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False, "error": str(exc)})
        if parsed.path in {"/audio.mp3", "/audio.ogg"}:
            if not self.server.pulse_source:
                return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "audio source unavailable"})
            is_mp3 = parsed.path == "/audio.mp3"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "audio/mpeg" if is_mp3 else "audio/ogg")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            codec_args = (
                [
                    "-ac", "2", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "128k",
                    "-write_xing", "0", "-id3v2_version", "0", "-flush_packets", "1",
                    "-f", "mp3",
                ]
                if is_mp3
                else [
                    "-ac", "2", "-ar", "48000", "-c:a", "libopus", "-b:a", "96k",
                    "-application", "lowdelay", "-flush_packets", "1", "-f", "ogg",
                ]
            )
            process = subprocess.Popen(
                [
                    "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                    "-f", "pulse", "-thread_queue_size", "256", "-i", self.server.pulse_source,
                    *codec_args, "pipe:1",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            try:
                assert process.stdout
                while True:
                    chunk = process.stdout.read(4096)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                try:
                    process.terminate()
                    process.wait(timeout=2)
                except Exception:
                    try:
                        process.kill()
                    except Exception:
                        pass
            return
        return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        parsed = self.parsed()
        if parsed.path != "/input":
            return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
        if not self.authorized(parsed):
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "invalid token"})
        try:
            length = min(8192, int(self.headers.get("content-length", "0") or "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
            kind = str(data.get("type") or "")
            with self.server.input_lock:
                if kind == "key":
                    key = str(data.get("key") or "")
                    keysym = KEY_MAP.get(key, key if len(key) <= 24 else "")
                    if keysym:
                        self.server.xdotool("keydown" if bool(data.get("down")) else "keyup", "--clearmodifiers", keysym)
                elif kind == "move":
                    dx = max(-4000, min(4000, int(data.get("dx") or 0)))
                    dy = max(-4000, min(4000, int(data.get("dy") or 0)))
                    if dx or dy:
                        self.server.xdotool("mousemove_relative", "--", str(dx), str(dy))
                elif kind == "position":
                    x = max(0, min(self.server.width - 1, int(data.get("x") or 0)))
                    y = max(0, min(self.server.height - 1, int(data.get("y") or 0)))
                    self.server.xdotool("mousemove", "--sync", str(x), str(y))
                elif kind == "button":
                    button = str(data.get("button") or "left")
                    number = {"left": "1", "middle": "2", "right": "3"}.get(button, "1")
                    self.server.xdotool("mousedown" if bool(data.get("down")) else "mouseup", number)
                elif kind == "wheel":
                    delta = int(data.get("delta") or 0)
                    if delta:
                        self.server.xdotool("click", "4" if delta > 0 else "5")
                elif kind == "release":
                    for key in ("w", "a", "s", "d", "Shift_L", "space", "e"):
                        self.server.xdotool("keyup", key)
                    for button in ("1", "2", "3"):
                        self.server.xdotool("mouseup", button)
                else:
                    return self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "unsupported input"})
            return self.send_json(HTTPStatus.OK, {"ok": True})
        except Exception as exc:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})


def main() -> int:
    parser = argparse.ArgumentParser(description="Browser stream for a server-side Wine Rec Room session")
    parser.add_argument("--display", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--token", default="")
    parser.add_argument("--pulse-source", default="")
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--quality", type=int, default=70)
    args = parser.parse_args()
    token = args.token or secrets.token_urlsafe(32)
    server = StreamServer(
        (args.host, args.port),
        Handler,
        display=args.display,
        token=token,
        pulse_source=args.pulse_source,
        width=max(640, args.width),
        height=max(360, args.height),
        quality=max(35, min(90, args.quality)),
    )
    server.start_capture()
    print(json.dumps({"ok": True, "display": args.display, "port": args.port, "audio": bool(args.pulse_source)}), flush=True)
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.close_capture()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
