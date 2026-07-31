import type { GeneratedProject, GeneratedProjectKind } from "@/services/studio-projects";

const THEMES = [
  { background: "#07111f", accent: "#67e8f9", secondary: "#a78bfa" },
  { background: "#160b21", accent: "#fb7185", secondary: "#fbbf24" },
  { background: "#071a12", accent: "#4ade80", secondary: "#38bdf8" },
  { background: "#17120a", accent: "#f59e0b", secondary: "#f97316" },
];

function titleFromPrompt(prompt: string, fallback: string): string {
  const cleaned = prompt
    .replace(/\b(make|build|create|generate|me|a|an|game|website|site|please)\b/gi, " ")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const title = cleaned.split(" ").slice(0, 5).join(" ");
  return (title || fallback).replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 60);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char] || char));
}

function seedFromPrompt(prompt: string): number {
  return [...prompt].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

export function generateProject(input: {
  ownerId: string;
  kind: GeneratedProjectKind;
  prompt: string;
}): GeneratedProject {
  return input.kind === "website"
    ? generateWebsiteProject(input.ownerId, input.prompt)
    : generateGameProject(input.ownerId, input.prompt);
}

export function generateGameProject(ownerId: string, prompt: string): GeneratedProject {
  const seed = seedFromPrompt(prompt);
  const theme = THEMES[seed % THEMES.length];
  const title = titleFromPrompt(prompt, "Neon Runner");
  const lower = prompt.toLowerCase();
  const multiplayer = /multiplayer|friends|co-op|versus|pvp/.test(lower);
  const style = /space|rocket|planet|alien/.test(lower)
    ? "space"
    : /farm|garden|crop|animal/.test(lower)
      ? "farm"
      : /car|race|speed/.test(lower)
        ? "race"
        : /city|missile|tower|defend/.test(lower)
          ? "defense"
          : "arcade";
  const safeTitle = escapeHtml(title);
  const emoji = style === "space" ? "🚀" : style === "farm" ? "🌱" : style === "race" ? "🏎️" : style === "defense" ? "🛡️" : "⚡";
  const code = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<title>${safeTitle}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${theme.background};font-family:Inter,ui-sans-serif,system-ui;color:white;touch-action:none}canvas{display:block;width:100%;height:100%}.hud{position:fixed;inset:0;pointer-events:none;padding:max(14px,env(safe-area-inset-top)) 16px 18px;display:flex;flex-direction:column;justify-content:space-between}.top{display:flex;justify-content:space-between;gap:12px}.pill{background:rgba(3,7,18,.62);border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(16px);border-radius:999px;padding:10px 14px;font-weight:850;font-size:13px}.title{letter-spacing:-.03em}.controls{align-self:center;text-align:center;color:rgba(255,255,255,.64);font-size:12px;background:rgba(3,7,18,.48);border-radius:16px;padding:9px 13px}.start{position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 38%,${theme.secondary}33,transparent 45%),${theme.background};z-index:3}.card{width:min(460px,100%);padding:28px;border-radius:30px;border:1px solid rgba(255,255,255,.14);background:rgba(10,14,26,.78);backdrop-filter:blur(22px);text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.4)}h1{font-size:clamp(34px,9vw,62px);line-height:.9;letter-spacing:-.065em;margin:14px 0}p{color:rgba(255,255,255,.65);line-height:1.6}button{pointer-events:auto;border:0;border-radius:999px;background:${theme.accent};color:#07111f;font-weight:900;padding:14px 22px;font-size:15px;cursor:pointer}.hidden{display:none}
</style>
</head>
<body>
<canvas id="game"></canvas>
<div class="hud"><div class="top"><div class="pill title">${emoji} ${safeTitle}</div><div class="pill">Score <span id="score">0</span></div></div><div class="controls">Move: WASD / arrows · mobile: drag anywhere · collect the glowing orbs</div></div>
<div class="start" id="start"><div class="card"><div style="font-size:56px">${emoji}</div><h1>${safeTitle}</h1><p>A responsive Flux Studio game generated from your idea. Dodge hazards, collect energy, and beat your best score.${multiplayer ? " Multiplayer-ready metadata is enabled for this project." : ""}</p><button id="play">Play now</button></div></div>
<script>
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),scoreEl=document.querySelector('#score');
let w=0,h=0,dpr=1,running=false,score=0,last=0,spawn=0,pointer=null;
const player={x:0,y:0,r:18,vx:0,vy:0};const keys=new Set();const orbs=[];const hazards=[];
function resize(){dpr=Math.min(2,devicePixelRatio||1);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(!player.x){player.x=w/2;player.y=h*.7}}
addEventListener('resize',resize);resize();
addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown',e=>pointer={x:e.clientX,y:e.clientY});canvas.addEventListener('pointermove',e=>{if(pointer)pointer={x:e.clientX,y:e.clientY}});addEventListener('pointerup',()=>pointer=null);
function addOrb(){orbs.push({x:30+Math.random()*(w-60),y:-24,r:9+Math.random()*7,vy:90+Math.random()*80,p:Math.random()*6})}
function addHazard(){hazards.push({x:30+Math.random()*(w-60),y:-35,r:15+Math.random()*16,vy:120+Math.random()*150,spin:Math.random()*6})}
function hit(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r}
function reset(){score=0;scoreEl.textContent='0';orbs.length=0;hazards.length=0;player.x=w/2;player.y=h*.72;running=true;last=performance.now();requestAnimationFrame(loop)}
function loop(now){if(!running)return;const dt=Math.min(.032,(now-last)/1000||0);last=now;spawn+=dt;
let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(pointer){dx=(pointer.x-player.x)/80;dy=(pointer.y-player.y)/80}player.vx+=(dx*650-player.vx)*Math.min(1,dt*8);player.vy+=(dy*650-player.vy)*Math.min(1,dt*8);player.x=Math.max(player.r,Math.min(w-player.r,player.x+player.vx*dt));player.y=Math.max(player.r,Math.min(h-player.r,player.y+player.vy*dt));
if(spawn>.38){spawn=0;Math.random()<.68?addOrb():addHazard()}
for(const o of orbs)o.y+=o.vy*dt,o.p+=dt*4;for(const z of hazards)z.y+=z.vy*dt,z.spin+=dt*3;
for(let i=orbs.length-1;i>=0;i--){if(hit(player,orbs[i])){orbs.splice(i,1);score+=10;scoreEl.textContent=String(score)}else if(orbs[i].y>h+40)orbs.splice(i,1)}
for(let i=hazards.length-1;i>=0;i--){if(hit(player,hazards[i])){running=false;document.querySelector('#start').classList.remove('hidden');document.querySelector('.card p').textContent='Final score: '+score+'. Jump back in and try to beat it.';document.querySelector('#play').textContent='Play again';return}else if(hazards[i].y>h+50)hazards.splice(i,1)}
draw(now);requestAnimationFrame(loop)}
function draw(t){ctx.clearRect(0,0,w,h);const g=ctx.createRadialGradient(w*.5,h*.35,10,w*.5,h*.35,Math.max(w,h));g.addColorStop(0,'${theme.secondary}33');g.addColorStop(1,'${theme.background}');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.globalAlpha=.45;for(let i=0;i<60;i++){const x=(i*79+t*.008)%w,y=(i*131+t*.013)%h;ctx.fillStyle='white';ctx.fillRect(x,y,1.5,1.5)}ctx.globalAlpha=1;
for(const o of orbs){ctx.shadowBlur=24;ctx.shadowColor='${theme.accent}';ctx.fillStyle='${theme.accent}';ctx.beginPath();ctx.arc(o.x,o.y,o.r+Math.sin(o.p)*2,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
for(const z of hazards){ctx.save();ctx.translate(z.x,z.y);ctx.rotate(z.spin);ctx.fillStyle='#fb7185';ctx.fillRect(-z.r,-z.r,z.r*2,z.r*2);ctx.restore()}
ctx.shadowBlur=32;ctx.shadowColor='${theme.secondary}';ctx.fillStyle='${theme.secondary}';ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='white';ctx.beginPath();ctx.arc(player.x-5,player.y-5,4,0,Math.PI*2);ctx.fill()}
document.querySelector('#play').onclick=()=>{document.querySelector('#start').classList.add('hidden');reset()};draw(0);
</script>
</body></html>`;

  return {
    id: `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ownerId,
    kind: "game",
    title,
    description: `A ${style} game generated in Flux Studio from: ${prompt.trim().slice(0, 220)}`,
    hashtags: [style, "fluxstudio", multiplayer ? "multiplayer" : "singleplayer"],
    code,
    thumbnail: `linear-gradient(135deg, ${theme.secondary}, ${theme.background} 58%, ${theme.accent})`,
    multiplayer,
    maxPlayers: multiplayer ? 8 : 1,
    selectedAssetIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    publishedId: null,
  };
}

export function generateWebsiteProject(ownerId: string, prompt: string): GeneratedProject {
  const seed = seedFromPrompt(prompt);
  const theme = THEMES[seed % THEMES.length];
  const title = titleFromPrompt(prompt, "New Website");
  const safeTitle = escapeHtml(title);
  const safePrompt = escapeHtml(prompt.trim().slice(0, 260));
  const code = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui;background:${theme.background};color:white}nav{height:72px;display:flex;align-items:center;justify-content:space-between;max-width:1120px;margin:auto;padding:0 24px}.brand{font-weight:950;letter-spacing:-.05em;font-size:22px}.cta{border:0;border-radius:999px;padding:12px 18px;background:${theme.accent};font-weight:900;color:#07111f}.hero{min-height:calc(100vh - 72px);display:grid;place-items:center;padding:60px 24px;background:radial-gradient(circle at 60% 28%,${theme.secondary}38,transparent 32%)}.wrap{max-width:920px;text-align:center}h1{font-size:clamp(48px,10vw,104px);letter-spacing:-.075em;line-height:.88;margin:0}p{font-size:clamp(17px,2.2vw,22px);line-height:1.6;color:rgba(255,255,255,.68);max-width:700px;margin:28px auto}.actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px}.secondary{background:rgba(255,255,255,.08);color:white;border:1px solid rgba(255,255,255,.15)}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1120px;margin:0 auto;padding:0 24px 80px}.feature{padding:28px;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:rgba(255,255,255,.045)}.feature b{font-size:20px}.feature p{font-size:14px;margin:10px 0 0;text-align:left}@media(max-width:720px){.features{grid-template-columns:1fr}.hero{min-height:75vh}}</style></head><body><nav><div class="brand">${safeTitle}</div><button class="cta">Get started</button></nav><main><section class="hero"><div class="wrap"><h1>${safeTitle}</h1><p>${safePrompt || "A modern experience designed and generated inside Flux."}</p><div class="actions"><button class="cta">Explore now</button><button class="cta secondary">Learn more</button></div></div></section><section class="features"><article class="feature"><b>Fast by design</b><p>Responsive on phones, tablets and desktop screens.</p></article><article class="feature"><b>Easy to edit</b><p>Open the Code panel in Flux Studio and change every detail.</p></article><article class="feature"><b>Ready to share</b><p>Preview the complete page before copying or publishing it.</p></article></section></main></body></html>`;
  return {
    id: `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ownerId,
    kind: "website",
    title,
    description: `A responsive website generated from: ${prompt.trim().slice(0, 220)}`,
    hashtags: ["website", "fluxstudio", "responsive"],
    code,
    thumbnail: `linear-gradient(135deg, ${theme.background}, ${theme.secondary}, ${theme.accent})`,
    multiplayer: false,
    maxPlayers: 1,
    selectedAssetIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    publishedId: null,
  };
}