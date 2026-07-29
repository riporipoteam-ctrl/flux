"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  Box,
  Eraser,
  Gamepad2,
  Hammer,
  Maximize2,
  Minimize2,
  RotateCcw,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  joinFluxWorld,
  leaveFluxWorld,
  placeFluxWorldBlock,
  registerFluxPlay,
  removeFluxWorldBlock,
  subscribeFluxWorldBlocks,
  subscribeFluxWorldPlayers,
  updateFluxWorldPlayer,
  type FluxPlayGame,
  type FluxWorldBlock,
  type FluxWorldPlayer,
} from "@/services/flux-plays";
import { endGameSession, startGameSession } from "@/services/game";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.179.1/three.module.min.js";
const COLORS = ["#6d5dfc", "#0ea5e9", "#ec4899", "#22c55e", "#f59e0b", "#f8fafc"];
type BuildMode = "move" | "place" | "remove";
type MoveState = { forward: boolean; back: boolean; left: boolean; right: boolean };

type SceneBridge = {
  setPlayers(players: FluxWorldPlayer[]): void;
  setBlocks(blocks: FluxWorldBlock[]): void;
  setMode(mode: BuildMode): void;
  setColor(color: string): void;
  jump(): void;
  reset(): void;
  dispose(): void;
};

export function FluxPlaysWorld({ game }: { game: FluxPlayGame }) {
  const router = useRouter();
  const { profile } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<SceneBridge | null>(null);
  const moveRef = useRef<MoveState>({ forward: false, back: false, left: false, right: false });
  const [mode, setMode] = useState<BuildMode>("move");
  const [color, setColor] = useState(COLORS[0]);
  const [players, setPlayers] = useState(1);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => bridgeRef.current?.setMode(mode), [mode]);
  useEffect(() => bridgeRef.current?.setColor(color), [color]);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      joinFluxWorld(game.id, profile),
      registerFluxPlay(game.id),
      startGameSession(profile, {
        gameId: `flux-plays:${game.id}`,
        gameName: game.title,
        roomCode: game.id.slice(0, 12).toUpperCase(),
      }),
    ]).then(() => setConnected(true)).catch(() => setConnected(false));

    const stopPlayers = subscribeFluxWorldPlayers(game.id, (items) => {
      setPlayers(Math.max(items.length, 1));
      bridgeRef.current?.setPlayers(items);
    });
    const stopBlocks = subscribeFluxWorldBlocks(game.id, (items) => bridgeRef.current?.setBlocks(items));

    return () => {
      stopPlayers();
      stopBlocks();
      void leaveFluxWorld(game.id, profile.uid);
      void endGameSession(profile.uid);
    };
  }, [game.id, game.title, profile]);

  useEffect(() => {
    if (!hostRef.current || !profile) return;
    let cancelled = false;
    void createScene({
      host: hostRef.current,
      game,
      localUid: profile.uid,
      moveRef,
      onMove: (position) => void updateFluxWorldPlayer(game.id, profile.uid, position).catch(() => undefined),
      onPlace: (block) => void placeFluxWorldBlock(game.id, { ...block, creatorUid: profile.uid }).catch(() => toast.error("Could not place block")),
      onRemove: (id) => void removeFluxWorldBlock(game.id, id).catch(() => toast.error("Could not remove block")),
    }).then((bridge) => {
      if (cancelled) return bridge.dispose();
      bridgeRef.current = bridge;
      bridge.setMode(mode);
      bridge.setColor(color);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      toast.error("Flux Plays could not load the 3D engine");
    });
    return () => {
      cancelled = true;
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    };
  }, [game, profile]);

  useEffect(() => {
    const listener = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await hostRef.current?.parentElement?.requestFullscreen();
    } catch {
      toast.error("Fullscreen is unavailable in this browser");
    }
  };

  const setMove = (key: keyof MoveState, active: boolean) => {
    moveRef.current[key] = active;
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#050816] text-white">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(109,93,252,.2),transparent_42%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-[max(12px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-2">
          <HudButton label="Back to Games" onClick={() => router.push("/games")}><ArrowLeft className="h-5 w-5" /></HudButton>
          <div className="hidden rounded-2xl border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-xl sm:block">
            <p className="text-sm font-black">{game.title}</p>
            <p className="text-[10px] font-semibold text-white/55">Flux Plays · by {game.creatorName}</p>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-black backdrop-blur-xl sm:flex">
            {connected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-amber-400" />}
            <Users className="h-4 w-4 text-cyan-300" /> {players}
          </div>
          <HudButton label="Toggle fullscreen" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}</HudButton>
        </div>
      </div>

      {game.allowBuild ? (
        <div className="pointer-events-none absolute left-1/2 top-[max(76px,calc(env(safe-area-inset-top)+72px))] z-20 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-2xl">
            <ModeButton active={mode === "move"} onClick={() => setMode("move")} label="Move"><Gamepad2 className="h-4 w-4" /></ModeButton>
            <ModeButton active={mode === "place"} onClick={() => setMode("place")} label="Build"><Hammer className="h-4 w-4" /></ModeButton>
            <ModeButton active={mode === "remove"} onClick={() => setMode("remove")} label="Remove"><Eraser className="h-4 w-4" /></ModeButton>
          </div>
          {mode === "place" ? (
            <div className="pointer-events-auto mx-auto mt-2 flex w-max gap-1 rounded-full border border-white/10 bg-black/50 p-1.5 backdrop-blur-xl">
              {COLORS.map((item) => <button key={item} type="button" onClick={() => setColor(item)} className={cn("h-7 w-7 rounded-full border-2 transition", item === color ? "scale-110 border-white" : "border-white/15")} style={{ backgroundColor: item }} aria-label={`Select ${item}`} />)}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-[max(18px,env(safe-area-inset-bottom))] left-4 z-20 sm:bottom-6 sm:left-6">
        <div className="pointer-events-auto grid grid-cols-3 gap-2 sm:hidden">
          <span /><TouchButton label="Forward" onPress={(active) => setMove("forward", active)}>▲</TouchButton><span />
          <TouchButton label="Left" onPress={(active) => setMove("left", active)}>◀</TouchButton>
          <TouchButton label="Back" onPress={(active) => setMove("back", active)}>▼</TouchButton>
          <TouchButton label="Right" onPress={(active) => setMove("right", active)}>▶</TouchButton>
        </div>
        <div className="hidden rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/65 backdrop-blur-xl sm:block">WASD / arrows to move · Space to jump · drag to rotate</div>
      </div>

      <div className="pointer-events-none absolute bottom-[max(18px,env(safe-area-inset-bottom))] right-4 z-20 flex flex-col gap-2 sm:bottom-6 sm:right-6">
        <button type="button" onClick={() => bridgeRef.current?.jump()} className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_15px_40px_rgba(67,56,202,.45)] active:scale-95" aria-label="Jump"><ArrowUp className="h-7 w-7" /></button>
        <HudButton label="Reset position" onClick={() => bridgeRef.current?.reset()}><RotateCcw className="h-4 w-4" /></HudButton>
      </div>

      {loading ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#050816]">
          <div className="text-center"><div className="mx-auto grid h-20 w-20 animate-pulse place-items-center rounded-[26px] bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_80px_rgba(109,93,252,.5)]"><Box className="h-9 w-9" /></div><h1 className="mt-6 text-2xl font-black">Entering {game.title}</h1><p className="mt-2 text-sm text-white/55">Syncing your Flux identity and world…</p></div>
        </div>
      ) : null}
    </div>
  );
}

function HudButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="game-hud-button pointer-events-auto" aria-label={label}>{children}</button>;
}

function ModeButton({ children, label, active, onClick }: { children: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition", active ? "bg-white text-black" : "text-white/65 hover:bg-white/10 hover:text-white")}>{children}<span className="hidden sm:inline">{label}</span></button>;
}

function TouchButton({ children, label, onPress }: { children: ReactNode; label: string; onPress: (active: boolean) => void }) {
  return <button type="button" aria-label={label} onPointerDown={(event) => { event.preventDefault(); onPress(true); }} onPointerUp={() => onPress(false)} onPointerLeave={() => onPress(false)} onPointerCancel={() => onPress(false)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-black/50 text-lg font-black backdrop-blur-xl active:scale-95">{children}</button>;
}

async function createScene({ host, game, localUid, moveRef, onMove, onPlace, onRemove }: {
  host: HTMLDivElement;
  game: FluxPlayGame;
  localUid: string;
  moveRef: MutableRefObject<MoveState>;
  onMove(position: Pick<FluxWorldPlayer, "x" | "y" | "z" | "yaw">): void;
  onPlace(block: Omit<FluxWorldBlock, "id" | "creatorUid" | "createdAt">): void;
  onRemove(id: string): void;
}): Promise<SceneBridge> {
  // eslint-disable-next-line no-new-func
  const importModule = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, any>>;
  const THREE = await importModule(THREE_URL);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(game.mode === "obby" ? 0x07051c : 0x071322);
  scene.fog = new THREE.FogExp2(scene.background, 0.022);
  const camera = new THREE.PerspectiveCamera(64, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 220);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  host.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0x9ad9ff, 0x18204a, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 3.4);
  sun.position.set(14, 22, 10);
  sun.castShadow = true;
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: game.mode === "obby" ? 0x171047 : 0x102d35, roughness: 0.84 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);
  const grid = new THREE.GridHelper(120, 120, game.mode === "obby" ? 0x7c3aed : 0x1d6a72, 0x143a49);
  grid.position.y = 0.015;
  grid.material.opacity = 0.28;
  grid.material.transparent = true;
  world.add(grid);

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const radius = 22 + (i % 4) * 6;
    const height = 2 + (i % 4) * 1.25;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.5 + (i % 3), height, 2.5), new THREE.MeshStandardMaterial({ color: [0x163f48, 0x1f5f58, 0x1d4ed8, 0x6d28d9][i % 4], roughness: 0.55 }));
    mesh.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    mesh.rotation.y = angle;
    mesh.castShadow = true;
    world.add(mesh);
  }

  const local = makeAvatar(THREE, "#6d5dfc");
  local.position.set(0, 1.1, 4);
  scene.add(local);
  const remotes = new Map<string, any>();
  const blocks = new Map<string, any>();
  const keys = new Set<string>();
  let mode: BuildMode = "move";
  let blockColor = COLORS[0];
  let yaw = 0;
  let pitch = 0.34;
  let jumpVelocity = 0;
  let drag: { x: number; y: number; moved: boolean } | null = null;
  let lastFrame = performance.now();
  let lastNetwork = 0;
  let raf = 0;
  let disposed = false;

  const keyDown = (event: KeyboardEvent) => { keys.add(event.key.toLowerCase()); if (event.key === " " && local.position.y <= 1.11) { event.preventDefault(); jumpVelocity = 7.2; } };
  const keyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerDown = (event: PointerEvent) => { drag = { x: event.clientX, y: event.clientY, moved: false }; };
  const pointerMove = (event: PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (mode === "move" && (event.buttons === 1 || event.pointerType === "touch")) {
      yaw -= dx * 0.0045;
      pitch = Math.max(0.12, Math.min(0.78, pitch + dy * 0.003));
      drag.x = event.clientX;
      drag.y = event.clientY;
    }
  };
  const pointerUp = (event: PointerEvent) => {
    const start = drag;
    drag = null;
    if (!start || start.moved || mode === "move") return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects([ground, ...blocks.values()], false)[0];
    if (!hit) return;
    if (mode === "remove") {
      const id = hit.object.userData.blockId as string | undefined;
      if (id) onRemove(id);
      return;
    }
    const point = hit.point.clone();
    if (hit.face && hit.object !== ground) point.add(hit.face.normal.multiplyScalar(0.55));
    onPlace({ x: Math.round(point.x), y: Math.max(0.5, Math.round(point.y - 0.01) + 0.5), z: Math.round(point.z), color: blockColor, material: "glass" });
  };
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);

  const resize = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
  });
  resize.observe(host);

  const bridge: SceneBridge = {
    setPlayers(items) {
      const active = new Set<string>();
      for (const player of items) {
        if (player.uid === localUid) continue;
        active.add(player.uid);
        let avatar = remotes.get(player.uid);
        if (!avatar) { avatar = makeAvatar(THREE, player.color); remotes.set(player.uid, avatar); scene.add(avatar); }
        avatar.userData.target = new THREE.Vector3(player.x, player.y, player.z);
        avatar.userData.yaw = player.yaw;
      }
      for (const [uid, avatar] of remotes) if (!active.has(uid)) { scene.remove(avatar); remotes.delete(uid); }
    },
    setBlocks(items) {
      const active = new Set<string>();
      for (const block of items) {
        active.add(block.id);
        let mesh = blocks.get(block.id);
        if (!mesh) {
          mesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.96, 0.96), new THREE.MeshStandardMaterial({ color: block.color, roughness: 0.42, metalness: 0.12, transparent: true, opacity: 0.84 }));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.blockId = block.id;
          blocks.set(block.id, mesh);
          world.add(mesh);
        }
        mesh.position.set(block.x, block.y, block.z);
      }
      for (const [id, mesh] of blocks) if (!active.has(id)) { world.remove(mesh); blocks.delete(id); }
    },
    setMode(value) { mode = value; renderer.domElement.style.cursor = value === "move" ? "grab" : value === "place" ? "crosshair" : "not-allowed"; },
    setColor(value) { blockColor = value; },
    jump() { if (local.position.y <= 1.11) jumpVelocity = 7.2; },
    reset() { local.position.set(0, 1.1, 4); jumpVelocity = 0; },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  const animate = (now: number) => {
    if (disposed) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    const move = moveRef.current;
    const forward = keys.has("w") || keys.has("arrowup") || move.forward;
    const back = keys.has("s") || keys.has("arrowdown") || move.back;
    const left = keys.has("a") || keys.has("arrowleft") || move.left;
    const right = keys.has("d") || keys.has("arrowright") || move.right;
    const xInput = (right ? 1 : 0) - (left ? 1 : 0);
    const zInput = (back ? 1 : 0) - (forward ? 1 : 0);
    const length = Math.hypot(xInput, zInput) || 1;
    if (xInput || zInput) {
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const x = (xInput * cos - zInput * sin) / length;
      const z = (xInput * sin + zInput * cos) / length;
      local.position.x += x * 6.8 * dt;
      local.position.z += z * 6.8 * dt;
      local.rotation.y = Math.atan2(x, z);
    }
    jumpVelocity -= 18 * dt;
    local.position.y += jumpVelocity * dt;
    if (local.position.y <= 1.1) { local.position.y = 1.1; jumpVelocity = 0; }
    local.position.x = Math.max(-52, Math.min(52, local.position.x));
    local.position.z = Math.max(-52, Math.min(52, local.position.z));

    const distance = 9.5;
    const horizontal = Math.cos(pitch) * distance;
    camera.position.lerp(new THREE.Vector3(local.position.x + Math.sin(yaw) * horizontal, local.position.y + 2.2 + Math.sin(pitch) * distance, local.position.z + Math.cos(yaw) * horizontal), 1 - Math.pow(0.001, dt));
    camera.lookAt(local.position.x, local.position.y + 1.2, local.position.z);
    for (const avatar of remotes.values()) {
      if (avatar.userData.target) avatar.position.lerp(avatar.userData.target, 1 - Math.pow(0.002, dt));
      if (typeof avatar.userData.yaw === "number") avatar.rotation.y = avatar.userData.yaw;
    }
    if (now - lastNetwork > 150 && (xInput || zInput || jumpVelocity !== 0)) {
      lastNetwork = now;
      onMove({ x: Number(local.position.x.toFixed(2)), y: Number(local.position.y.toFixed(2)), z: Number(local.position.z.toFixed(2)), yaw: Number(local.rotation.y.toFixed(3)) });
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };
  camera.position.set(8, 8, 14);
  raf = requestAnimationFrame(animate);
  return bridge;
}

function makeAvatar(THREE: Record<string, any>, color: string) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 5, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.18 }));
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), new THREE.MeshStandardMaterial({ color: 0x111827 }));
  head.position.y = 1.65;
  head.castShadow = true;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0ea5e9, emissiveIntensity: 2 }));
  visor.position.set(0, 1.68, 0.29);
  group.add(visor);
  return group;
}
