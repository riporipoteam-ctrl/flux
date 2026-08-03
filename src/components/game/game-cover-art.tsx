"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrowserGame } from "@/data/browser-games";
import { assetUrl } from "@/lib/asset-url";

const embeddedCoverCache = new Map<string, Promise<string>>();

async function resolveCoverSource(url: string): Promise<string> {
  if (!url.toLowerCase().endsWith(".svg")) return url;
  const cached = embeddedCoverCache.get(url);
  if (cached) return cached;

  const request = fetch(url, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Cover returned ${response.status}`);
      const svg = await response.text();
      const match = svg.match(/(?:href|xlink:href)=["'](data:image\/(?:webp|png|jpeg);base64,[^"']+)["']/i);
      return match?.[1] || url;
    })
    .catch(() => url);

  embeddedCoverCache.set(url, request);
  return request;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random(seed: number, step: number): number {
  const value = Math.sin(seed * 0.001 + step * 91.731) * 10000;
  return value - Math.floor(value);
}

function ArcadeCover({ game, compact }: { game: BrowserGame; compact: boolean }) {
  const seed = useMemo(() => hashText(game.slug), [game.slug]);
  const genre = game.categories[0] || "Arcade";
  const titleParts = game.title.split(" ");
  const titleA = titleParts.slice(0, Math.max(1, Math.ceil(titleParts.length / 2))).join(" ");
  const titleB = titleParts.slice(Math.max(1, Math.ceil(titleParts.length / 2))).join(" ");
  const sceneProps = { game, seed };

  return (
    <div
      className="absolute inset-0 isolate overflow-hidden"
      style={{ background: `linear-gradient(145deg, ${game.palette[0]}, ${game.palette[1]} 62%, ${game.palette[2]})` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1200 750" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`sky-${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={game.palette[0]} />
            <stop offset=".58" stopColor={game.palette[1]} />
            <stop offset="1" stopColor={game.palette[2]} />
          </linearGradient>
          <radialGradient id={`glow-${seed}`} cx="70%" cy="18%" r="65%">
            <stop offset="0" stopColor="#fff" stopOpacity=".38" />
            <stop offset=".36" stopColor={game.palette[2]} stopOpacity=".2" />
            <stop offset="1" stopColor={game.palette[0]} stopOpacity="0" />
          </radialGradient>
          <pattern id={`grid-${seed}`} width="70" height="70" patternUnits="userSpaceOnUse">
            <path d="M70 0H0V70" fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth="2" />
          </pattern>
          <filter id={`shadow-${seed}`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000" floodOpacity=".42" />
          </filter>
        </defs>
        <rect width="1200" height="750" fill={`url(#sky-${seed})`} />
        <rect width="1200" height="750" fill={`url(#glow-${seed})`} />
        <rect width="1200" height="750" fill={`url(#grid-${seed})`} opacity=".42" />

        {genre === "Horror" ? <HorrorScene {...sceneProps} /> : null}
        {genre === "Racing" ? <RacingScene {...sceneProps} /> : null}
        {genre === "Simulator" || genre === "Tycoon" ? <TycoonScene {...sceneProps} /> : null}
        {genre === "Quest" || genre === "Story" ? <QuestScene {...sceneProps} story={genre === "Story"} /> : null}
        {genre === "Platformer" ? <PlatformScene {...sceneProps} /> : null}
        {genre === "Puzzle" ? <PuzzleScene {...sceneProps} /> : null}
        {genre === "Survival" ? <SurvivalScene {...sceneProps} /> : null}
        {genre === "Farming" ? <FarmingScene {...sceneProps} /> : null}
        {!["Horror", "Racing", "Simulator", "Tycoon", "Quest", "Story", "Platformer", "Puzzle", "Survival", "Farming"].includes(genre) ? <ArcadeScene {...sceneProps} /> : null}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/6 to-black/5" />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/20 bg-black/38 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.16em] text-white backdrop-blur-md sm:left-4 sm:top-4 sm:text-[9px]">
        <span>{game.symbol}</span>
        <span>{genre}</span>
      </div>

      {compact ? (
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/55">Flux Arcade</p>
          <p className="mt-1 max-w-[92%] text-xl font-black leading-[.94] tracking-[-.045em] drop-shadow-lg sm:text-2xl">
            <span className="block">{titleA}</span>
            {titleB ? <span className="block text-white/82">{titleB}</span> : null}
          </p>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/52 to-transparent" />
          <span className="absolute right-5 top-5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur-md">Play on Flux</span>
        </>
      )}
    </div>
  );
}

type SceneProps = { game: BrowserGame; seed: number };

function HorrorScene({ seed }: SceneProps) {
  const trees = Array.from({ length: 12 }, (_, index) => ({
    x: 30 + index * 105 + random(seed, index) * 45,
    h: 180 + random(seed, index + 20) * 260,
    w: 42 + random(seed, index + 40) * 42,
  }));
  return (
    <g>
      <circle cx="925" cy="145" r="104" fill="#fff" fillOpacity=".72" />
      <circle cx="890" cy="120" r="104" fill="#0a0d13" fillOpacity=".42" />
      <path d="M0 565C190 500 310 600 480 530S790 480 1200 565V750H0Z" fill="#050709" fillOpacity=".92" />
      {trees.map((tree, index) => (
        <g key={index} transform={`translate(${tree.x} ${605 - tree.h})`} opacity={index % 3 === 0 ? .95 : .72}>
          <rect x={-tree.w * .08} y={tree.h * .54} width={tree.w * .16} height={tree.h * .46} fill="#030506" />
          <path d={`M0 0L${-tree.w / 2} ${tree.h * .72}H${tree.w / 2}Z`} fill="#030506" />
          <path d={`M0 ${tree.h * .18}L${-tree.w * .62} ${tree.h * .82}H${tree.w * .62}Z`} fill="#030506" />
        </g>
      ))}
      <g transform="translate(590 300)" filter={`url(#shadow-${seed})`}>
        <rect x="0" y="75" width="250" height="235" rx="8" fill="#0b0c10" />
        <path d="M-35 105L125 0L285 105Z" fill="#08090d" />
        <rect x="48" y="155" width="48" height="68" fill="#ff334f" fillOpacity=".62" />
        <rect x="154" y="155" width="48" height="68" fill="#ff334f" fillOpacity=".62" />
        <rect x="105" y="223" width="48" height="87" fill="#030405" />
      </g>
      <path d="M0 610C240 560 490 645 730 585S1010 570 1200 615" fill="none" stroke="#fff" strokeOpacity=".13" strokeWidth="36" />
      <ellipse cx="610" cy="650" rx="560" ry="70" fill="#fff" fillOpacity=".07" />
    </g>
  );
}

function RacingScene({ seed }: SceneProps) {
  const lights = Array.from({ length: 18 }, (_, index) => ({
    x: random(seed, index) * 1200,
    y: 70 + random(seed, index + 30) * 270,
    r: 3 + random(seed, index + 60) * 8,
  }));
  return (
    <g>
      {lights.map((light, index) => <circle key={index} cx={light.x} cy={light.y} r={light.r} fill="#fff" fillOpacity={.25 + random(seed, index + 90) * .55} />)}
      <path d="M395 750L545 300H655L835 750Z" fill="#090b10" fillOpacity=".92" />
      <path d="M454 750L570 310" stroke="#fff" strokeOpacity=".14" strokeWidth="10" />
      <path d="M776 750L630 310" stroke="#fff" strokeOpacity=".14" strokeWidth="10" />
      {[0, 1, 2, 3, 4].map((index) => {
        const y = 365 + index * 78;
        const width = 10 + index * 12;
        return <rect key={index} x={600 - width / 2} y={y} width={width} height={36 + index * 9} rx="8" fill="#fff" fillOpacity=".78" />;
      })}
      <g transform={`translate(${470 + random(seed, 120) * 230} 495)`} filter={`url(#shadow-${seed})`}>
        <path d="M25 105L58 32Q70 10 103 8H205Q238 10 250 32L284 105L260 168H48Z" fill="#0c1119" stroke="#fff" strokeOpacity=".35" strokeWidth="4" />
        <path d="M75 42H222L242 97H56Z" fill="#67e8f9" fillOpacity=".68" />
        <rect x="55" y="120" width="60" height="18" rx="9" fill="#fff" fillOpacity=".84" />
        <rect x="198" y="120" width="60" height="18" rx="9" fill="#fff" fillOpacity=".84" />
        <circle cx="75" cy="164" r="25" fill="#020305" />
        <circle cx="238" cy="164" r="25" fill="#020305" />
      </g>
      <path d="M0 560L360 420V750H0Z" fill="#071018" fillOpacity=".72" />
      <path d="M1200 560L850 420V750H1200Z" fill="#071018" fillOpacity=".72" />
    </g>
  );
}

function TycoonScene({ game, seed }: SceneProps) {
  const buildings = Array.from({ length: 9 }, (_, index) => ({
    x: 70 + index * 118,
    y: 280 + random(seed, index) * 120,
    h: 170 + random(seed, index + 30) * 240,
    w: 72 + random(seed, index + 60) * 52,
  }));
  return (
    <g>
      <path d="M0 630L600 340L1200 630L600 750Z" fill="#071018" fillOpacity=".54" />
      {buildings.map((building, index) => (
        <g key={index} transform={`translate(${building.x} ${building.y})`} filter={`url(#shadow-${seed})`}>
          <rect width={building.w} height={building.h} rx="5" fill={index % 2 ? game.palette[1] : "#111827"} stroke="#fff" strokeOpacity=".18" strokeWidth="3" />
          {Array.from({ length: Math.max(2, Math.floor(building.h / 52)) }, (_, row) => (
            <g key={row}>
              <rect x="14" y={18 + row * 44} width={building.w * .24} height="17" rx="3" fill="#fff" fillOpacity=".62" />
              <rect x={building.w * .58} y={18 + row * 44} width={building.w * .24} height="17" rx="3" fill="#fff" fillOpacity=".34" />
            </g>
          ))}
        </g>
      ))}
      <g transform="translate(805 95)">
        <rect width="300" height="170" rx="28" fill="#06080c" fillOpacity=".7" stroke="#fff" strokeOpacity=".14" />
        <path d="M40 127L92 82L142 104L205 48L260 72" fill="none" stroke="#fff" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="260" cy="72" r="16" fill="#fff" />
      </g>
      <circle cx="230" cy="155" r="82" fill="#fff" fillOpacity=".12" />
      <text x="230" y="182" textAnchor="middle" fill="#fff" fontSize="96" fontWeight="900">{game.symbol}</text>
    </g>
  );
}

function QuestScene({ game, seed, story }: SceneProps & { story: boolean }) {
  return (
    <g>
      <circle cx="930" cy="135" r="98" fill="#fff" fillOpacity=".34" />
      <path d="M0 590L245 290L480 590Z" fill="#101827" fillOpacity=".72" />
      <path d="M250 590L600 170L910 590Z" fill="#0d1420" fillOpacity=".86" />
      <path d="M610 590L930 280L1200 590Z" fill="#101827" fillOpacity=".7" />
      <path d="M0 590C255 520 380 635 595 575S895 535 1200 610V750H0Z" fill="#07100c" fillOpacity=".86" />
      <path d="M560 750C520 620 580 560 660 500S720 360 690 300" fill="none" stroke="#f8d7a0" strokeOpacity=".55" strokeWidth="42" strokeLinecap="round" />
      <g transform={`translate(${story ? 250 : 760} ${story ? 390 : 280})`} filter={`url(#shadow-${seed})`}>
        {story ? (
          <>
            <path d="M0 45Q95 0 190 42V230Q95 188 0 232Z" fill="#f4e7c8" />
            <path d="M190 42Q285 0 380 45V232Q285 188 190 230Z" fill="#fff3d8" />
            <path d="M190 42V230" stroke="#7c5b33" strokeOpacity=".5" strokeWidth="5" />
            <path d="M40 83H150M40 115H160M228 83H340M222 115H330" stroke="#7c5b33" strokeOpacity=".42" strokeWidth="8" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="80" y="100" width="220" height="210" fill="#121827" />
            <path d="M35 115L190 5L345 115Z" fill="#1d2638" />
            <rect x="158" y="195" width="64" height="115" fill="#02040a" />
            <rect x="110" y="145" width="40" height="58" fill="#fff" fillOpacity=".45" />
            <rect x="230" y="145" width="40" height="58" fill="#fff" fillOpacity=".45" />
            <path d="M70 310H330" stroke="#fff" strokeOpacity=".24" strokeWidth="14" />
          </>
        )}
      </g>
      <text x="940" y="610" textAnchor="middle" fill="#fff" fillOpacity=".82" fontSize="112" fontWeight="900">{game.symbol}</text>
    </g>
  );
}

function PlatformScene({ game, seed }: SceneProps) {
  const platforms = Array.from({ length: 7 }, (_, index) => ({
    x: 80 + index * 155,
    y: 590 - (index % 3) * 115 - random(seed, index) * 42,
    w: 110 + random(seed, index + 20) * 85,
  }));
  return (
    <g>
      {[0, 1, 2, 3].map((index) => <ellipse key={index} cx={180 + index * 310} cy={150 + (index % 2) * 75} rx="120" ry="34" fill="#fff" fillOpacity=".12" />)}
      {platforms.map((platform, index) => (
        <g key={index}>
          <rect x={platform.x} y={platform.y} width={platform.w} height="34" rx="17" fill="#fff" fillOpacity={.34 + (index % 2) * .2} />
          <rect x={platform.x + 14} y={platform.y + 34} width={platform.w - 28} height="22" rx="7" fill="#05090d" fillOpacity=".5" />
        </g>
      ))}
      <g transform={`translate(${platforms[2].x + 30} ${platforms[2].y - 95})`} filter={`url(#shadow-${seed})`}>
        <circle cx="45" cy="45" r="45" fill="#fff" fillOpacity=".92" />
        <text x="45" y="65" textAnchor="middle" fill="#10131a" fontSize="56">{game.symbol}</text>
      </g>
      <circle cx="1040" cy="160" r="70" fill="#ffd84d" fillOpacity=".72" />
    </g>
  );
}

function PuzzleScene({ game, seed }: SceneProps) {
  const tiles = Array.from({ length: 16 }, (_, index) => ({
    x: 270 + (index % 4) * 155,
    y: 75 + Math.floor(index / 4) * 155,
    rotate: -8 + random(seed, index) * 16,
    opacity: .22 + random(seed, index + 30) * .5,
  }));
  const glyphs = ["◆", "●", "▲", "■"];
  return (
    <g>
      {tiles.map((tile, index) => (
        <g key={index} transform={`translate(${tile.x} ${tile.y}) rotate(${tile.rotate} 62 62)`} filter={index === seed % 16 ? `url(#shadow-${seed})` : undefined}>
          <rect width="124" height="124" rx="28" fill="#fff" fillOpacity={tile.opacity} stroke="#fff" strokeOpacity=".28" strokeWidth="3" />
          <text x="62" y="82" textAnchor="middle" fill="#fff" fontSize="64" fontWeight="900">{index === seed % 16 ? game.symbol : glyphs[index % glyphs.length]}</text>
        </g>
      ))}
      <circle cx="1050" cy="650" r="220" fill="#fff" fillOpacity=".07" />
    </g>
  );
}

function SurvivalScene({ game, seed }: SceneProps) {
  const hazards = Array.from({ length: 14 }, (_, index) => ({
    x: 80 + random(seed, index) * 1040,
    y: 75 + random(seed, index + 20) * 600,
    r: 8 + random(seed, index + 40) * 24,
  }));
  return (
    <g>
      <circle cx="600" cy="380" r="285" fill="#05080d" fillOpacity=".38" stroke="#fff" strokeOpacity=".11" strokeWidth="4" />
      <circle cx="600" cy="380" r="200" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="4" />
      <circle cx="600" cy="380" r="110" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="4" />
      <path d="M600 95V665M315 380H885" stroke="#fff" strokeOpacity=".14" strokeWidth="3" />
      <path d="M600 380L810 230" stroke="#fff" strokeOpacity=".5" strokeWidth="12" strokeLinecap="round" />
      {hazards.map((hazard, index) => <circle key={index} cx={hazard.x} cy={hazard.y} r={hazard.r} fill={index % 2 ? "#ff385c" : "#fff"} fillOpacity={.25 + random(seed, index + 70) * .45} />)}
      <g transform="translate(515 295)" filter={`url(#shadow-${seed})`}>
        <circle cx="85" cy="85" r="82" fill="#fff" fillOpacity=".9" />
        <text x="85" y="116" textAnchor="middle" fontSize="88">{game.symbol}</text>
      </g>
    </g>
  );
}

function FarmingScene({ game, seed }: SceneProps) {
  return (
    <g>
      <circle cx="1000" cy="120" r="105" fill="#ffe77a" fillOpacity=".85" />
      <path d="M0 430C260 350 420 475 650 405S940 350 1200 430V750H0Z" fill="#2f7d42" fillOpacity=".78" />
      <path d="M0 520C260 445 440 560 680 500S950 455 1200 520V750H0Z" fill="#173f27" fillOpacity=".88" />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <path key={index} d={`M${40 + index * 220} 750L${220 + index * 175} 480`} stroke={index % 2 ? "#f1c27d" : "#d89a52"} strokeOpacity=".68" strokeWidth="54" strokeLinecap="round" />
      ))}
      <g transform={`translate(${250 + random(seed, 20) * 170} 300)`} filter={`url(#shadow-${seed})`}>
        <rect x="45" y="100" width="260" height="220" fill="#a43f33" />
        <path d="M0 120L175 0L350 120Z" fill="#53251f" />
        <rect x="135" y="205" width="82" height="115" fill="#44231c" />
        <rect x="78" y="160" width="48" height="52" fill="#fff" fillOpacity=".65" />
        <rect x="225" y="160" width="48" height="52" fill="#fff" fillOpacity=".65" />
      </g>
      <text x="890" y="335" textAnchor="middle" fill="#fff" fontSize="132" fontWeight="900">{game.symbol}</text>
    </g>
  );
}

function ArcadeScene({ game, seed }: SceneProps) {
  return (
    <g>
      {Array.from({ length: 18 }, (_, index) => (
        <circle key={index} cx={random(seed, index) * 1200} cy={random(seed, index + 20) * 750} r={8 + random(seed, index + 40) * 40} fill="#fff" fillOpacity={.08 + random(seed, index + 60) * .24} />
      ))}
      <g transform="translate(420 175)" filter={`url(#shadow-${seed})`}>
        <rect width="360" height="360" rx="96" fill="#fff" fillOpacity=".18" stroke="#fff" strokeOpacity=".32" strokeWidth="5" />
        <text x="180" y="235" textAnchor="middle" fill="#fff" fontSize="190">{game.symbol}</text>
      </g>
    </g>
  );
}

export function GameCoverArt({ game, compact = false }: { game: BrowserGame; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const originalSource = assetUrl(game.thumbnail);
  const [source, setSource] = useState(originalSource);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (game.arcade) return;
    let cancelled = false;
    setSource(originalSource);
    setFailed(false);
    void resolveCoverSource(originalSource).then((resolved) => {
      if (!cancelled) setSource(resolved);
    });
    return () => { cancelled = true; };
  }, [game.arcade, originalSource]);

  if (game.arcade) return <ArcadeCover game={game} compact={compact} />;

  return (
    <div
      className="absolute inset-0 isolate overflow-hidden bg-[#0f1419]"
      style={{ background: `linear-gradient(135deg, ${game.palette[0]}, ${game.palette[1]} 58%, ${game.palette[2]})` }}
      aria-hidden="true"
    >
      {!failed ? (
        <motion.img
          key={source}
          src={source}
          alt=""
          loading={compact ? "lazy" : "eager"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.01, opacity: 0 }}
          animate={reduceMotion ? { scale: 1, opacity: 1 } : { scale: 1.025, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
          onError={() => {
            if (source !== originalSource) setSource(originalSource);
            else setFailed(true);
          }}
        />
      ) : (
        <ArcadeCover game={game} compact={compact} />
      )}
      {!failed ? <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/14 to-black/5" /> : null}
      {!compact && !failed ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/55 to-transparent" />
          <span className="absolute right-5 top-5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur-md">Play on Flux</span>
        </>
      ) : null}
    </div>
  );
}
