"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Volume2, VolumeX } from "lucide-react";

type InputPayload = {
  type: "key" | "move" | "button" | "wheel" | "release";
  key?: string;
  down?: boolean;
  dx?: number;
  dy?: number;
  button?: "left" | "middle" | "right";
  delta?: number;
};

type StreamEndpoints = {
  frameUrl: () => string;
  audioUrl: string;
  audioFallbackUrl: string;
  inputUrl: string;
};

function getEndpoints(streamUrl: string): StreamEndpoints {
  const parsed = new URL(streamUrl, "https://flux.invalid");
  const token = parsed.searchParams.get("token") || "";
  parsed.search = "";
  const base = parsed.toString().endsWith("/") ? parsed.toString() : `${parsed}/`;
  const endpoint = (path: string) => {
    const next = new URL(path, base);
    if (token) next.searchParams.set("token", token);
    return next;
  };

  return {
    frameUrl: () => {
      const next = endpoint("frame.jpg");
      next.searchParams.set("t", String(Date.now()));
      return next.toString();
    },
    audioUrl: endpoint("audio.mp3").toString(),
    audioFallbackUrl: endpoint("audio.ogg").toString(),
    inputUrl: endpoint("input").toString(),
  };
}

function pointerButton(button: number): "left" | "middle" | "right" {
  if (button === 2) return "right";
  if (button === 1) return "middle";
  return "left";
}

export function RecRoomDirectStream({
  url,
  onReady,
}: {
  url: string;
  onReady?: () => void;
}) {
  const endpoints = useMemo(() => getEndpoints(url), [url]);
  const frameRef = useRef<HTMLImageElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const onReadyRef = useRef(onReady);
  const coarseRef = useRef(false);
  const readyRef = useRef(false);
  const movePointerRef = useRef<number | null>(null);
  const moveCenterRef = useRef({ x: 0, y: 0 });
  const lookPointerRef = useRef<number | null>(null);
  const lookPositionRef = useRef({ x: 0, y: 0 });
  const touchFramePointerRef = useRef<number | null>(null);
  const touchFramePositionRef = useRef({ x: 0, y: 0 });
  const touchFrameMovedRef = useRef(false);
  const activeMoveKeysRef = useRef(new Set<string>());
  const pendingMoveRef = useRef({ dx: 0, dy: 0 });
  const moveFrameRef = useRef<number | null>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const inputQueueRef = useRef<InputPayload[]>([]);
  const inputBusyRef = useRef(false);
  const audioSourceRef = useRef<"mp3" | "ogg">("mp3");
  const [coarse, setCoarse] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState("Connecting Rec Room…");
  const [soundBlocked, setSoundBlocked] = useState(true);
  const [soundError, setSoundError] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    coarseRef.current = isCoarse;
    setCoarse(isCoarse);
  }, []);

  const pumpInput = useCallback(async () => {
    if (inputBusyRef.current) return;
    inputBusyRef.current = true;
    try {
      while (inputQueueRef.current.length > 0) {
        const payload = inputQueueRef.current.shift();
        if (!payload) continue;
        try {
          await fetch(endpoints.inputUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
          });
        } catch {
          // A dropped input packet should not block the rest of the queue.
        }
      }
    } finally {
      inputBusyRef.current = false;
      if (inputQueueRef.current.length > 0) void pumpInput();
    }
  }, [endpoints.inputUrl]);

  const sendInput = useCallback(
    (payload: InputPayload) => {
      const queue = inputQueueRef.current;
      const previous = queue[queue.length - 1];
      if (payload.type === "move" && previous?.type === "move") {
        previous.dx = Math.max(-4000, Math.min(4000, (previous.dx || 0) + (payload.dx || 0)));
        previous.dy = Math.max(-4000, Math.min(4000, (previous.dy || 0) + (payload.dy || 0)));
      } else {
        queue.push(payload);
      }
      if (queue.length > 64) queue.splice(0, queue.length - 64);
      void pumpInput();
    },
    [pumpInput],
  );

  const enableSound = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.currentSrc) {
      audioSourceRef.current = "mp3";
      audio.src = endpoints.audioUrl;
      audio.load();
    }
    try {
      await audio.play();
      setSoundBlocked(false);
      setSoundError(false);
    } catch {
      if (audioSourceRef.current === "mp3") {
        audioSourceRef.current = "ogg";
        audio.src = endpoints.audioFallbackUrl;
        audio.load();
        try {
          await audio.play();
          setSoundBlocked(false);
          setSoundError(false);
          return;
        } catch {
          // Keep the visible retry button enabled.
        }
      }
      setSoundBlocked(true);
      setSoundError(true);
    }
  }, [endpoints.audioFallbackUrl, endpoints.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audioSourceRef.current = "mp3";
    audio.preload = "auto";
    audio.src = endpoints.audioUrl;
    audio.load();
    setSoundBlocked(true);
    setSoundError(false);
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [endpoints.audioUrl]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;

    const waitForFrame = (frame: HTMLImageElement, source: string) =>
      new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          frame.removeEventListener("load", loaded);
          frame.removeEventListener("error", failed);
        };
        const loaded = () => {
          cleanup();
          resolve();
        };
        const failed = () => {
          cleanup();
          reject(new Error("The Rec Room frame relay returned no image."));
        };
        frame.addEventListener("load", loaded, { once: true });
        frame.addEventListener("error", failed, { once: true });
        frame.src = source;
      });

    const pump = async () => {
      if (cancelled) return;
      const frame = frameRef.current;
      if (!frame) return;
      try {
        await waitForFrame(frame, endpoints.frameUrl());
        if (cancelled) return;
        if (!readyRef.current) {
          readyRef.current = true;
          setStatus(coarseRef.current ? "Connected · touch controls ready" : "Connected · click game to control");
          onReadyRef.current?.();
        }
        retryTimer = window.setTimeout(() => void pump(), 70);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Waiting for the first game frame…");
        retryTimer = window.setTimeout(() => void pump(), 350);
      }
    };

    void pump();
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [endpoints, url]);

  const releaseMove = useCallback(() => {
    for (const key of activeMoveKeysRef.current) sendInput({ type: "key", key, down: false });
    activeMoveKeysRef.current.clear();
    movePointerRef.current = null;
    setStick({ x: 0, y: 0 });
  }, [sendInput]);

  const setMoveKeys = useCallback(
    (keys: string[]) => {
      const desired = new Set(keys);
      for (const key of activeMoveKeysRef.current) {
        if (!desired.has(key)) sendInput({ type: "key", key, down: false });
      }
      for (const key of desired) {
        if (!activeMoveKeysRef.current.has(key)) sendInput({ type: "key", key, down: true });
      }
      activeMoveKeysRef.current = desired;
    },
    [sendInput],
  );

  const flushMove = useCallback(() => {
    moveFrameRef.current = null;
    const { dx, dy } = pendingMoveRef.current;
    pendingMoveRef.current = { dx: 0, dy: 0 };
    if (dx || dy) sendInput({ type: "move", dx: Math.round(dx), dy: Math.round(dy) });
  }, [sendInput]);

  const queueMove = useCallback(
    (dx: number, dy: number) => {
      pendingMoveRef.current.dx += dx;
      pendingMoveRef.current.dy += dy;
      if (moveFrameRef.current === null) moveFrameRef.current = window.requestAnimationFrame(flushMove);
    },
    [flushMove],
  );

  useEffect(() => {
    if (coarse) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (["F5", "F11", "F12"].includes(event.key) || pressedKeysRef.current.has(event.key)) return;
      event.preventDefault();
      pressedKeysRef.current.add(event.key);
      sendInput({ type: "key", key: event.key, down: true });
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!pressedKeysRef.current.has(event.key)) return;
      event.preventDefault();
      pressedKeysRef.current.delete(event.key);
      sendInput({ type: "key", key: event.key, down: false });
    };
    const release = () => {
      for (const key of pressedKeysRef.current) sendInput({ type: "key", key, down: false });
      pressedKeysRef.current.clear();
      sendInput({ type: "release" });
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, [coarse, sendInput]);

  useEffect(() => () => {
    releaseMove();
    sendInput({ type: "release" });
    if (moveFrameRef.current !== null) window.cancelAnimationFrame(moveFrameRef.current);
  }, [releaseMove, sendInput]);

  useEffect(() => {
    const releaseTouchState = () => {
      releaseMove();
      touchFramePointerRef.current = null;
      lookPointerRef.current = null;
      sendInput({ type: "release" });
    };
    window.addEventListener("blur", releaseTouchState);
    window.addEventListener("pagehide", releaseTouchState);
    return () => {
      window.removeEventListener("blur", releaseTouchState);
      window.removeEventListener("pagehide", releaseTouchState);
    };
  }, [releaseMove, sendInput]);

  const onFramePointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    event.preventDefault();
    void enableSound();
    frameRef.current?.focus();
    if (coarseRef.current && event.pointerType === "touch") {
      touchFramePointerRef.current = event.pointerId;
      touchFramePositionRef.current = { x: event.clientX, y: event.clientY };
      touchFrameMovedRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    sendInput({ type: "button", button: pointerButton(event.button), down: true });
    if (event.button === 0 && document.pointerLockElement !== frameRef.current) {
      try {
        void frameRef.current?.requestPointerLock?.();
      } catch {
        // Pointer lock is unavailable on some mobile browsers.
      }
    }
  };

  const onFramePointerUp = (event: ReactPointerEvent<HTMLImageElement>) => {
    event.preventDefault();
    if (touchFramePointerRef.current === event.pointerId) {
      if (!touchFrameMovedRef.current) {
        sendInput({ type: "button", button: "left", down: true });
        sendInput({ type: "button", button: "left", down: false });
      }
      touchFramePointerRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    sendInput({ type: "button", button: pointerButton(event.button), down: false });
  };

  const onFramePointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (touchFramePointerRef.current === event.pointerId) {
      event.preventDefault();
      const previous = touchFramePositionRef.current;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) touchFrameMovedRef.current = true;
      queueMove(dx * 1.45, dy * 1.45);
      touchFramePositionRef.current = { x: event.clientX, y: event.clientY };
      return;
    }
    if (document.pointerLockElement === frameRef.current) queueMove(event.movementX, event.movementY);
  };

  const onFramePointerCancel = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (touchFramePointerRef.current !== event.pointerId) return;
    touchFramePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    sendInput({ type: "release" });
  };

  const onMovePadDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    void enableSound();
    movePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    moveCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const onMovePadMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== movePointerRef.current) return;
    event.preventDefault();
    const dx = event.clientX - moveCenterRef.current.x;
    const dy = event.clientY - moveCenterRef.current.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, 42 / magnitude);
    const x = dx * scale;
    const y = dy * scale;
    setStick({ x, y });
    setMoveKeys([...(y < -13 ? ["w"] : []), ...(y > 13 ? ["s"] : []), ...(x < -13 ? ["a"] : []), ...(x > 13 ? ["d"] : [])]);
  };

  const onLookDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    void enableSound();
    lookPointerRef.current = event.pointerId;
    lookPositionRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onLookMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== lookPointerRef.current) return;
    event.preventDefault();
    const previous = lookPositionRef.current;
    queueMove((event.clientX - previous.x) * 1.45, (event.clientY - previous.y) * 1.45);
    lookPositionRef.current = { x: event.clientX, y: event.clientY };
  };

  const releaseLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    lookPointerRef.current = null;
  };

  const actionButton = (label: string, key: string, className: string) => (
    <button
      type="button"
      className={`absolute grid place-items-center rounded-full border border-white/30 bg-black/60 text-[10px] font-black tracking-wide text-white shadow-lg backdrop-blur-sm ${className}`}
      onPointerDown={(event) => {
        event.preventDefault();
        void enableSound();
        event.currentTarget.setPointerCapture(event.pointerId);
        sendInput({ type: "key", key, down: true });
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        sendInput({ type: "key", key, down: false });
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => sendInput({ type: "key", key, down: false })}
    >
      {label}
    </button>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-black select-none touch-none">
      <img
        ref={frameRef}
        tabIndex={0}
        alt="Rec Room streamed from RipoTeamServer"
        draggable={false}
        className="h-full w-full object-contain outline-none"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={onFramePointerDown}
        onPointerUp={onFramePointerUp}
        onPointerCancel={onFramePointerCancel}
        onPointerMove={onFramePointerMove}
        onWheel={(event) => {
          event.preventDefault();
          sendInput({ type: "wheel", delta: event.deltaY < 0 ? 1 : -1 });
        }}
      />
      <div className="pointer-events-none absolute left-3 top-3 z-40 rounded-full bg-black/65 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur-sm">
        {status}
      </div>
      <button
        type="button"
        onClick={() => void enableSound()}
        className="absolute right-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"
        aria-label={soundBlocked ? "Enable Rec Room sound" : "Rec Room sound is on"}
      >
        {soundBlocked ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        {soundError ? "Retry sound" : soundBlocked ? "Tap to enable sound" : "Sound on"}
      </button>
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        className="hidden"
        onCanPlay={() => setSoundError(false)}
        onPlaying={() => {
          setSoundBlocked(false);
          setSoundError(false);
        }}
        onError={() => {
          const audio = audioRef.current;
          if (!audio) return;
          if (audioSourceRef.current === "mp3") {
            audioSourceRef.current = "ogg";
            audio.src = endpoints.audioFallbackUrl;
            audio.load();
            return;
          }
          setSoundBlocked(true);
          setSoundError(true);
        }}
      />

      {coarse ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="pointer-events-auto absolute bottom-5 left-5 h-32 w-32 rounded-full border border-white/25 bg-black/45 shadow-xl backdrop-blur-sm touch-none"
            onPointerDown={onMovePadDown}
            onPointerMove={onMovePadMove}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              releaseMove();
            }}
            onPointerCancel={releaseMove}
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/25"
              style={{ transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))` }}
            />
          </div>
          <div className="pointer-events-auto absolute inset-y-0 right-0 w-[58%] touch-none" onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={releaseLook} onPointerCancel={releaseLook} />
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/75 backdrop-blur-sm">
            Drag right side to look
          </div>
          {actionButton("JUMP", "Space", "bottom-5 right-5 h-[76px] w-[76px]")}
          {actionButton("ACT", "e", "bottom-[94px] right-[102px] h-[62px] w-[62px]")}
          {actionButton("RUN", "Shift", "bottom-[178px] left-[120px] h-[50px] w-[50px] text-[9px]")}
        </div>
      ) : null}
    </div>
  );
}
