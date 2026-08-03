"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import FluxEngineStudio from "@/components/studio/engine/flux-engine-studio";
import { useAuth } from "@/contexts/auth-context";
import { generateStudioProjectWithAskAI } from "@/lib/ai/studio-askai";
import type { AskAIGroqMode } from "@/lib/ai/askai-groq";
import { getActiveEngineProject, saveEngineProject } from "@/services/flux-engine-projects";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Build a colorful obstacle course with moving platforms, checkpoints and a finish tower.",
  "Create a night survival arena with cover, glowing lights and physics obstacles.",
  "Make a peaceful low-poly island with trees, rocks, a dock and a player spawn.",
  "Add a compact racing track with barriers, ramps and neon checkpoint gates.",
];

export default function FluxStudioShell() {
  const { user } = useAuth();
  const [studioKey, setStudioKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(QUICK_PROMPTS[0]);
  const [mode, setMode] = useState<AskAIGroqMode>("pro");
  const [replaceWorld, setReplaceWorld] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready to build");
  const [lastResult, setLastResult] = useState<{ summary: string; objects: number; model: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (!user) return toast.error("Sign in to use AskAI in Studio.");
    if (!prompt.trim() || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setLastResult(null);
    setStatus(mode === "pro" ? "AskAI Pro is designing the world…" : "AskAI Instant is building objects…");

    try {
      const currentProject = getActiveEngineProject(user.uid);
      const result = await generateStudioProjectWithAskAI({
        prompt,
        currentProject,
        mode,
        replaceWorld,
        signal: controller.signal,
      });
      setStatus("Saving generated world…");
      saveEngineProject(result.project);
      setStudioKey((value) => value + 1);
      setLastResult({ summary: result.summary, objects: result.objectsCreated, model: result.model });
      setStatus("World applied to Studio");
      toast.success(`AskAI created ${result.objectsCreated} Studio objects`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AskAI could not build this world.";
      setStatus(message);
      toast.error(message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
    setStatus("Generation stopped");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090d]">
      <FluxEngineStudio key={studioKey} />

      <button type="button" className="flux-studio-ai-trigger" onClick={() => setOpen(true)}>
        <WandSparkles className="h-5 w-5" />
        <span>Build with AskAI</span>
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close AskAI Studio"
              className="fixed inset-0 z-[85] bg-black/45 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="flux-studio-ai-panel flux-glass-panel flex flex-col bg-[#0b0e15]/95 text-white"
              initial={{ opacity: 0, x: 28, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 28, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-blue-500/20">
                  <Bot className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-black tracking-tight">AskAI World Builder</h2>
                  <p className="mt-0.5 truncate text-xs text-white/45">Real project objects, settings and scripts</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/7 hover:bg-white/12" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <section>
                  <label htmlFor="studio-ai-prompt" className="text-xs font-bold uppercase tracking-[.16em] text-white/45">Describe your game</label>
                  <textarea
                    id="studio-ai-prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={6}
                    maxLength={2_500}
                    placeholder="Build a multiplayer obstacle world with…"
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-blue-400/60 focus:bg-white/8"
                  />
                  <div className="mt-2 flex justify-between text-[11px] text-white/35"><span>Be specific about layout, colors and gameplay.</span><span>{prompt.length}/2500</span></div>
                </section>

                <section className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-white/45">Quick builds</p>
                  <div className="mt-2 grid gap-2">
                    {QUICK_PROMPTS.map((item) => (
                      <button key={item} type="button" onClick={() => setPrompt(item)} className="rounded-xl border border-white/8 bg-white/[.035] px-3 py-2.5 text-left text-xs leading-5 text-white/65 hover:border-blue-400/30 hover:bg-white/7 hover:text-white">
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMode("instant")} className={cn("rounded-2xl border p-3 text-left", mode === "instant" ? "border-sky-400/60 bg-sky-400/12" : "border-white/8 bg-white/[.035]")}>
                    <Sparkles className="h-4 w-4" /><strong className="mt-2 block text-sm">Instant</strong><span className="mt-1 block text-[11px] text-white/40">Faster, simpler scenes</span>
                  </button>
                  <button type="button" onClick={() => setMode("pro")} className={cn("rounded-2xl border p-3 text-left", mode === "pro" ? "border-violet-400/60 bg-violet-400/12" : "border-white/8 bg-white/[.035]")}>
                    <WandSparkles className="h-4 w-4" /><strong className="mt-2 block text-sm">Pro</strong><span className="mt-1 block text-[11px] text-white/40">Better planning and detail</span>
                  </button>
                </section>

                <section className="mt-4 rounded-2xl border border-white/8 bg-white/[.035] p-3">
                  <button type="button" onClick={() => setReplaceWorld(true)} className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left", replaceWorld && "bg-white/8")}>
                    <RefreshCw className="h-4 w-4" /><div><strong className="text-sm">Replace scene</strong><p className="text-[11px] text-white/40">Build a fresh world from the prompt.</p></div>{replaceWorld ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" /> : null}
                  </button>
                  <button type="button" onClick={() => setReplaceWorld(false)} className={cn("mt-1 flex w-full items-center gap-3 rounded-xl p-2 text-left", !replaceWorld && "bg-white/8")}>
                    <Plus className="h-4 w-4" /><div><strong className="text-sm">Add to scene</strong><p className="text-[11px] text-white/40">Keep current objects and add new ones.</p></div>{!replaceWorld ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" /> : null}
                  </button>
                </section>

                <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-white/65">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> : lastResult ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Layers3 className="h-4 w-4 text-white/40" />}
                    {status}
                  </div>
                  {lastResult ? <div className="mt-3 border-t border-white/8 pt-3"><p className="text-sm leading-6 text-white/75">{lastResult.summary}</p><p className="mt-2 text-[11px] text-white/35">{lastResult.objects} objects · {lastResult.model}</p></div> : null}
                </div>
              </div>

              <footer className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  disabled={!prompt.trim() && !busy}
                  onClick={() => busy ? stop() : void generate()}
                  className={cn("flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black shadow-xl", busy ? "bg-white text-black" : "bg-gradient-to-r from-violet-500 via-blue-500 to-sky-500 text-white shadow-blue-500/20", !prompt.trim() && !busy && "opacity-40")}
                >
                  {busy ? <><X className="h-4 w-4" />Stop generation</> : <><WandSparkles className="h-5 w-5" />Build this world</>}
                </button>
              </footer>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
