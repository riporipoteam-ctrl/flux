"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  CloudSun,
  Droplets,
  Expand,
  Hammer,
  Map,
  Shovel,
  Sprout,
  Users,
  Volume2,
  VolumeX,
  Wheat,
  X,
} from "lucide-react";
import {
  farmReducer,
  createFarmState,
  loadFarmState,
  REGIONS,
  SEEDS,
  type FarmAction,
  type FarmAnimal,
  type FarmTool,
  type SeedId,
} from "@/lib/games/flux-farming-state";
import styles from "./flux-farming.module.css";
import { assetUrl } from "@/lib/asset-url";

type Panel = "map" | "journal" | "upgrades" | "animals" | "friends" | "leaderboard" | null;

const ANIMALS: Array<FarmAnimal & { icon: string; cost: number; barn: number; description: string }> = [
  { id: "chicken", name: "Pip", icon: "🐔", cost: 40, barn: 1, description: "Fresh eggs and a cheerful morning call." },
  { id: "cow", name: "Clover", icon: "🐄", cost: 90, barn: 2, description: "Milk, friendship and three coins each morning." },
  { id: "sheep", name: "Juniper", icon: "🐑", cost: 120, barn: 3, description: "Soft wool from the high Brightvale meadow." },
];

const QUESTS = [
  { title: "Mara's first request", text: "Harvest 3 crops and help reopen Pinebrook Market.", target: 3 },
  { title: "A roof for winter", text: "Upgrade the farmhouse to level 2 before the rain arrives.", target: 1 },
  { title: "A home for Clover", text: "Welcome your first animal to the restored meadow.", target: 1 },
  { title: "The orchard letters", text: "Reach level 8 and discover why Misty Orchard went silent.", target: 8 },
] as const;

function tone(kind: "tap" | "reward" | "morning") {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const notes = kind === "reward" ? [523, 659, 784] : kind === "morning" ? [392, 494, 587] : [520];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "tap" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, context.currentTime + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + index * 0.08 + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.08);
      oscillator.stop(context.currentTime + index * 0.08 + 0.2);
    });
  } catch {
    // Audio is optional; the entire game remains playable without Web Audio.
  }
}

export function FluxFarming({ farmOwner, onExit }: { farmOwner: string; onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const storageKey = `flux-farming:${farmOwner.toLowerCase()}`;
  const [state, dispatch] = useReducer(farmReducer, farmOwner, createFarmState);
  const [panel, setPanel] = useState<Panel>(null);
  const [sound, setSound] = useState(true);
  const [booting, setBooting] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    dispatch({ type: "hydrate", state: loadFarmState(storageKey, farmOwner) });
    setHydrated(true);
  }, [storageKey, farmOwner]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // A blocked storage API should never prevent gameplay.
    }
  }, [hydrated, state, storageKey]);

  const xpTarget = state.level * 24;
  const readyCount = useMemo(
    () => state.plots.filter((plot) => plot.crop && plot.stage >= SEEDS[plot.crop].days).length,
    [state.plots],
  );
  const region = REGIONS.find((item) => item.id === state.region) ?? REGIONS[0];
  const questIndex = state.harvested < 3 ? 0 : state.houseLevel < 2 ? 1 : state.animals.length < 1 ? 2 : 3;
  const quest = QUESTS[questIndex];
  const questProgress = questIndex === 0
    ? Math.min(state.harvested, 3)
    : questIndex === 1
      ? Math.min(Math.max(state.houseLevel - 1, 0), 1)
      : questIndex === 2
        ? Math.min(state.animals.length, 1)
        : Math.min(state.level, 8);
  const score = state.level * 100 + state.harvested * 25 + state.houseLevel * 40 + state.animals.length * 60;
  const inviteCode = `${farmOwner.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "FARM"}-${String(score).padStart(4, "0")}`;

  function act(action: FarmAction, soundKind: "tap" | "reward" | "morning" = "tap") {
    dispatch(action);
    if (sound) tone(soundKind);
  }

  function plotStatus(index: number) {
    const plot = state.plots[index];
    if (!plot.crop) return `Farm plot ${index + 1}: empty`;
    const seed = SEEDS[plot.crop];
    if (plot.stage >= seed.days) return `Farm plot ${index + 1}: ${seed.name} ready to harvest`;
    return `Farm plot ${index + 1}: ${seed.name}, day ${plot.stage} of ${seed.days}${plot.watered ? ", watered" : ", needs water"}`;
  }

  async function enterFullscreen() {
    try {
      await rootRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen can be blocked by browser or embedded-view policy.
    }
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={{
        "--flux-farm-hero": `url("${assetUrl("/game-thumbs/flux-farming-hero.png")}")`,
      } as CSSProperties}
    >
      <div className={styles.backdrop} />
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <button type="button" className={styles.exitButton} onClick={onExit} aria-label="Return to games library">
            <ArrowLeft size={17} /> <span>Games</span>
          </button>
          <div className={styles.farmIdentity}>
            <p className={styles.gameLabel}>Flux Farming · Day {state.day}</p>
            <input
              className={styles.farmName}
              value={state.farmName}
              onChange={(event) => dispatch({ type: "rename", name: event.target.value })}
              aria-label="Farm name"
            />
          </div>
          <div className={styles.topActions}>
            <button type="button" className={styles.roundButton} onClick={() => setPanel("map")} aria-label="Open world map"><Map size={17} /></button>
            <button type="button" className={styles.roundButton} onClick={enterFullscreen} aria-label="Enter fullscreen"><Expand size={17} /></button>
            <button type="button" className={styles.roundButton} onClick={() => setSound((value) => !value)} aria-label={sound ? "Mute sound" : "Enable sound"}>
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
          </div>
        </header>

        <section className={styles.hud} aria-label="Farm status">
          <div className={styles.resourceRow}>
            <Resource icon="⭐" label="Level" value={String(state.level)} />
            <Resource icon="◆" label="Coins" value={String(state.coins)} />
            <div className={styles.resource}>
              <span className={styles.resourceIcon}>✨</span>
              <span className={styles.resourceCopy}><small>Experience</small><strong>{state.xp} / {xpTarget}</strong><span className={styles.xpTrack}><span className={styles.xpFill} style={{ width: `${Math.min(100, state.xp / xpTarget * 100)}%` }} /></span></span>
            </div>
          </div>
          <button type="button" className={styles.dayButton} onClick={() => act({ type: "nextDay" }, "morning")}>
            <CloudSun size={18} /> Next morning
          </button>
        </section>

        <main className={styles.content}>
          <aside className={`${styles.panel} ${styles.leftPanel}`}>
            <h2 className={styles.panelTitle}><BookOpen size={17} /> Story journal</h2>
            <p className={styles.panelHint}>Chapter {questIndex + 1} of 4 · The Sleeping Valley</p>
            <div className={styles.questCard}>
              <p className={styles.questChapter}>Current quest</p>
              <h3 className={styles.questTitle}>{quest.title}</h3>
              <p className={styles.questText}>{quest.text}</p>
              <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${questProgress / quest.target * 100}%` }} /></div>
              <span className={styles.progressLabel}>{questProgress} / {quest.target}</span>
            </div>
            <div className={styles.npcCard}>
              <div className={styles.npcAvatar}>👩🏽‍🌾</div>
              <div><p className={styles.npcName}>Mara Bell</p><p className={styles.npcText}>“The valley remembers every kindness. Start with the soil and it will answer.”</p></div>
            </div>
            <div className={styles.quickMenu}>
              <button className={styles.smallButton} onClick={() => setPanel("journal")}><span>📖</span>All quests</button>
              <button className={styles.smallButton} onClick={() => setPanel("map")}><span>🗺️</span>World map</button>
              <button className={styles.smallButton} onClick={() => setPanel("friends")}><span>🤝</span>Farm friends</button>
              <button className={styles.smallButton} onClick={() => setPanel("leaderboard")}><span>🏆</span>Leaderboard</button>
            </div>
          </aside>

          <section className={styles.world} aria-label="Playable farm">
            <div className={styles.worldHeader}>
              <div><strong>{region.name}</strong><span>{readyCount ? `${readyCount} crop${readyCount === 1 ? "" : "s"} ready` : `${state.harvested} crops harvested`}</span></div>
              <div className={styles.weather}><CloudSun size={14} /> 21°C · Clear</div>
            </div>
            <div className={styles.worldBody}>
              <div className={styles.fieldFrame}>
                <div className={styles.plotGrid}>
                  {state.plots.map((plot, index) => {
                    const ready = Boolean(plot.crop && plot.stage >= SEEDS[plot.crop].days);
                    return (
                      <button
                        type="button"
                        key={index}
                        className={`${styles.plot} ${plot.watered ? styles.plotWatered : ""} ${ready ? styles.plotReady : ""}`}
                        onClick={() => act({ type: "interact", index }, ready && state.tool === "harvest" ? "reward" : "tap")}
                        aria-label={plotStatus(index)}
                      >
                        {plot.crop ? <span className={styles.plotIcon}>{ready ? SEEDS[plot.crop].icon : "🌱"}</span> : <Shovel className={styles.emptyPlot} />}
                        <span className={styles.plotLabel}>{!plot.crop ? "Empty" : ready ? "Ready" : plot.watered ? `${plot.stage + 1}/${SEEDS[plot.crop].days} growing` : "Needs water"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={styles.buildings}>
                <button className={styles.building} onClick={() => setPanel("upgrades")}>
                  <span className={styles.buildingIcon}>🏡</span><strong>Farmhouse · Lv {state.houseLevel}</strong><span>Home, kitchen & story</span>
                </button>
                <button className={styles.building} onClick={() => setPanel("animals")}>
                  <span className={styles.buildingIcon}>🏚️</span><strong>Barn · Lv {state.barnLevel}</strong><span>Animals & daily produce</span>
                </button>
                <div className={styles.animalStrip} aria-label="Farm animals">
                  {state.animals.length ? state.animals.map((animal) => <span key={animal.id} title={animal.name}>{ANIMALS.find((item) => item.id === animal.id)?.icon}</span>) : <span className={styles.animalEmpty}>Animal meadow<br />is waiting</span>}
                </div>
              </div>
            </div>
          </section>

          <aside className={`${styles.panel} ${styles.rightPanel}`}>
            <h2 className={styles.panelTitle}>🎒 Field kit</h2>
            <p className={styles.panelHint}>Choose a tool, then tap a field.</p>
            <div className={styles.toolRow}>
              {(["plant", "water", "harvest"] as FarmTool[]).map((tool) => (
                <button key={tool} className={`${styles.toolButton} ${state.tool === tool ? styles.toolActive : ""}`} onClick={() => act({ type: "selectTool", tool })}>
                  {tool === "plant" ? <Sprout size={18} /> : tool === "water" ? <Droplets size={18} /> : <Wheat size={18} />}{tool}
                </button>
              ))}
            </div>
            <div className={styles.seedRow}>
              {(Object.entries(SEEDS) as Array<[SeedId, (typeof SEEDS)[SeedId]]>).map(([id, seed]) => (
                <button
                  key={id}
                  disabled={state.level < seed.level}
                  className={`${styles.seedButton} ${state.seed === id ? styles.seedActive : ""} ${state.level < seed.level ? styles.seedLocked : ""}`}
                  onClick={() => act({ type: "selectSeed", seed: id })}
                  title={state.level < seed.level ? `Unlocks at level ${seed.level}` : `${seed.name}: ${seed.days} growing days`}
                >
                  <span className={styles.seedIcon}>{seed.icon}</span><span className={styles.seedPrice}>{state.level < seed.level ? `Lv ${seed.level}` : `${seed.cost} ◆`}</span>
                </button>
              ))}
            </div>
            <div className={styles.quickMenu}>
              <button className={styles.smallButton} onClick={() => setPanel("upgrades")}><span>🔨</span>Upgrades</button>
              <button className={styles.smallButton} onClick={() => setPanel("animals")}><span>🐾</span>Animals</button>
              <button className={styles.smallButton} onClick={() => setPanel("friends")}><span>👥</span>Invite</button>
              <button className={styles.smallButton} onClick={() => setPanel("leaderboard")}><span>🏅</span>Ranks</button>
            </div>
          </aside>
        </main>

        <footer className={styles.noticeBar}>
          <div className={styles.notice}><span className={styles.noticeAvatar}>👩🏽‍🌾</span><span className={styles.noticeText}>{state.notice}</span></div>
          <div className={styles.panelActions}>
            <button className={styles.secondaryButton} onClick={() => setPanel("map")}><Map size={14} /> Explore</button>
            <button className={styles.primaryButton} onClick={() => setPanel("journal")}><BookOpen size={14} /> Quests</button>
          </div>
        </footer>
      </div>

      {!state.introSeen && !booting ? (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHero}>
              <p className={styles.modalEyebrow}>Chapter one · A new beginning</p>
              <h1 className={styles.modalTitle}>The Sleeping Valley</h1>
              <p className={styles.modalStory}>Mara left you the keys to a weathered farm and a letter: “Brightvale remembers every kindness.” Restore the fields, reopen the market and uncover the secret hidden in the silent orchard.</p>
            </div>
            <div className={styles.modalBody}>
              <button className={styles.primaryButton} onClick={() => act({ type: "dismissIntro" }, "morning")}>Begin your farm</button>
            </div>
          </div>
        </div>
      ) : null}

      {panel ? <GamePanel panel={panel} close={() => setPanel(null)} state={state} act={act} score={score} inviteCode={inviteCode} farmOwner={farmOwner} /> : null}

      {booting ? (
        <div className={styles.boot} aria-label="Loading Flux Farming">
          <div className={styles.bootContent}><div className={styles.bootLogo}>🌾</div><h1 className={styles.bootTitle}>Flux Farming</h1><p className={styles.bootText}>Waking Brightvale and preparing your fields…</p><div className={styles.bootTrack}><div className={styles.bootFill} /></div></div>
        </div>
      ) : null}
    </div>
  );
}

function Resource({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className={styles.resource}><span className={styles.resourceIcon}>{icon}</span><span className={styles.resourceCopy}><small>{label}</small><strong>{value}</strong></span></div>;
}

function GamePanel({ panel, close, state, act, score, inviteCode, farmOwner }: {
  panel: Exclude<Panel, null>;
  close: () => void;
  state: ReturnType<typeof loadFarmState>;
  act: (action: FarmAction, soundKind?: "tap" | "reward" | "morning") => void;
  score: number;
  inviteCode: string;
  farmOwner: string;
}) {
  const titles: Record<Exclude<Panel, null>, string> = {
    map: "Brightvale world map", journal: "Story & quests", upgrades: "Farmstead upgrades", animals: "Animal meadow", friends: "Farm friends", leaderboard: "Valley leaderboard",
  };
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalBody}>
          <div className={styles.modalHeader}><div><p className={styles.modalEyebrow}>Flux Farming</p><h2>{titles[panel]}</h2></div><button className={styles.closeButton} onClick={close} aria-label="Close panel"><X size={17} /></button></div>
          {panel === "map" ? <MapPanel state={state} act={act} /> : null}
          {panel === "journal" ? <Journal state={state} /> : null}
          {panel === "upgrades" ? <UpgradePanel state={state} act={act} /> : null}
          {panel === "animals" ? <AnimalPanel state={state} act={act} /> : null}
          {panel === "leaderboard" ? <Leaderboard farmOwner={farmOwner} score={score} /> : null}
          {panel === "friends" ? <Friends inviteCode={inviteCode} /> : null}
        </div>
      </div>
    </div>
  );
}

function MapPanel({ state, act }: { state: ReturnType<typeof loadFarmState>; act: (action: FarmAction) => void }) {
  return <div className={styles.regionGrid}>{REGIONS.map((region) => {
    const locked = state.level < region.level;
    return <button key={region.id} className={`${styles.regionCard} ${locked ? styles.regionLocked : ""} ${state.region === region.id ? styles.regionSelected : ""}`} onClick={() => act({ type: "visitRegion", region: region.id })}>
      <span className={styles.regionIcon}>{region.icon}</span><strong>{region.name}</strong><p>{region.description}</p><span className={styles.regionMeta}>{locked ? `Unlocks at level ${region.level}` : state.region === region.id ? "Current region" : "Travel here"}</span>
    </button>;
  })}</div>;
}

function Journal({ state }: { state: ReturnType<typeof loadFarmState> }) {
  const values = [Math.min(state.harvested, 3), Math.min(Math.max(state.houseLevel - 1, 0), 1), Math.min(state.animals.length, 1), Math.min(state.level, 8)];
  return <div className={styles.leaderGrid}>{QUESTS.map((quest, index) => <div className={styles.leaderRow} key={quest.title}><span className={styles.leaderRank}>{values[index] >= quest.target ? "✓" : index + 1}</span><span><span className={styles.leaderName}>{quest.title}</span><span className={styles.questText}>{quest.text}</span></span><span className={styles.leaderScore}>{values[index]}/{quest.target}</span></div>)}</div>;
}

function UpgradePanel({ state, act }: { state: ReturnType<typeof loadFarmState>; act: (action: FarmAction, soundKind?: "tap" | "reward") => void }) {
  return <div className={styles.upgradeGrid}>{(["house", "barn"] as const).map((building) => {
    const level = building === "house" ? state.houseLevel : state.barnLevel;
    return <div className={styles.upgradeCard} key={building}><Hammer size={22} /><strong>{building === "house" ? "Farmhouse" : "Barn"} · Level {level}</strong><p>{building === "house" ? "Unlock story scenes, a kitchen and larger storage." : "Make room for cows, sheep and better daily produce."}</p><button disabled={level >= 5} className={styles.primaryButton} onClick={() => act({ type: "upgrade", building }, "reward")}>{level >= 5 ? "Fully upgraded" : `Upgrade · ${level * 60} coins`}</button></div>;
  })}</div>;
}

function AnimalPanel({ state, act }: { state: ReturnType<typeof loadFarmState>; act: (action: FarmAction, soundKind?: "tap" | "reward") => void }) {
  return <div className={styles.animalGrid}>{ANIMALS.map((animal) => {
    const owned = state.animals.some((item) => item.id === animal.id);
    return <div className={styles.animalCard} key={animal.id}><span className={styles.regionIcon}>{animal.icon}</span><strong>{animal.name}</strong><p>{animal.description} Requires barn level {animal.barn}.</p><button disabled={owned} className={styles.primaryButton} onClick={() => act({ type: "buyAnimal", animal: { id: animal.id, name: animal.name } }, "reward")}>{owned ? "Lives here" : `Welcome · ${animal.cost} coins`}</button></div>;
  })}</div>;
}

function Leaderboard({ farmOwner, score }: { farmOwner: string; score: number }) {
  const rows = [{ name: "Mara's Orchard", score: 1840 }, { name: "Juniper Fields", score: 1325 }, { name: `${farmOwner}'s Farm`, score }, { name: "Moonlake Acres", score: 720 }].sort((a, b) => b.score - a.score);
  return <div className={styles.leaderGrid}>{rows.map((row, index) => <div className={styles.leaderRow} key={row.name}><span className={styles.leaderRank}>#{index + 1}</span><span className={styles.leaderName}>{row.name}</span><span className={styles.leaderScore}>{row.score.toLocaleString()} pts</span></div>)}</div>;
}

function Friends({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(inviteCode); setCopied(true); } catch { setCopied(false); }
  }
  return <div className={styles.friendCard}><Users size={34} /><h3>Grow together</h3><p className={styles.questText}>Share this farm-visit code with mutual Flux friends. Visitors can help water crops while farm spending and upgrades stay owner-only.</p><div className={styles.inviteCode}>{inviteCode}</div><button className={styles.primaryButton} onClick={copy}>{copied ? "Code copied" : "Copy invite code"}</button><p className={styles.panelHint}>Farm visits are prepared for Flux friend syncing; solo play and local saves work now.</p></div>;
}
