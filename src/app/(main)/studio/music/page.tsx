"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FolderOpen, Gamepad2, Headphones, Music2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { FluxMusicLibrary } from "@/components/music/flux-music-library";
import { type StoryMusicTrack } from "@/lib/story-music";
import {
  listLocalProjects,
  saveLocalProject,
  type GeneratedProject,
} from "@/services/studio-projects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StudioMusicPage() {
  const [projects, setProjects] = useState<GeneratedProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<StoryMusicTrack | null>(null);

  useEffect(() => {
    const stored = listLocalProjects();
    setProjects(stored);
    setProjectId(stored[0]?.id || null);
  }, []);

  const project = useMemo(() => projects.find((item) => item.id === projectId) || null, [projectId, projects]);

  const attach = () => {
    if (!project || !selectedTrack) return;
    const assetId = `freepd-${selectedTrack.id}`;
    const next: GeneratedProject = {
      ...project,
      selectedAssetIds: [...new Set([...project.selectedAssetIds, assetId])].slice(0, 100),
      updatedAt: Date.now(),
    };
    saveLocalProject(next);
    setProjects(listLocalProjects());
    toast.success(`${selectedTrack.title} added to ${project.title}`);
  };

  return (
    <main className="min-h-screen bg-[#000000] pb-24 text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#08090d]/90 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-3 sm:px-5">
          <Link href="/studio" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/[.035] hover:bg-white/8" aria-label="Back to Studio"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500 shadow-lg shadow-violet-500/20"><Headphones className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><h1 className="font-black tracking-tight">Studio Audio Library</h1><p className="truncate text-[11px] text-white/38">Preview and attach public-domain music to creator projects</p></div>
          <Link href="/studio" className="hidden rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-black hover:bg-white/7 sm:block">Open editor</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-3 py-5 sm:px-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section className="overflow-hidden rounded-[28px] border border-white/9 bg-[#0d0f14]">
            <div className="border-b border-white/8 bg-[linear-gradient(145deg,rgba(124,92,255,.22),transparent_58%)] p-5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8"><FolderOpen className="h-5 w-5 text-violet-300" /></span>
              <h2 className="mt-5 text-2xl font-black tracking-[-.04em]">Add to project</h2>
              <p className="mt-2 text-xs leading-5 text-white/40">Choose one of your local Studio projects, preview music, then attach the selected track as a licensed project asset.</p>
            </div>

            <div className="p-3">
              <p className="px-2 pb-2 text-[9px] font-black uppercase tracking-[.15em] text-white/28">Your projects</p>
              {projects.length ? <div className="space-y-1.5">{projects.map((item) => <button key={item.id} type="button" onClick={() => setProjectId(item.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition", item.id === projectId ? "border-violet-400/55 bg-violet-500/10" : "border-transparent hover:bg-white/5")}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: item.thumbnail }}><Gamepad2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.title}</strong><span className="block truncate text-[9px] text-white/32">{item.kind} · {item.selectedAssetIds.length} assets</span></span>{item.id === projectId ? <Check className="h-4 w-4 text-violet-300" /> : null}</button>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center"><Sparkles className="mx-auto h-6 w-6 text-white/25" /><p className="mt-3 text-sm font-black">No Studio projects yet</p><p className="mt-1 text-[10px] leading-4 text-white/30">Generate a game or website in Studio first.</p><Link href="/studio" className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-[10px] font-black text-black">Create project</Link></div>}
            </div>

            <div className="border-t border-white/8 p-4">
              <div className="rounded-2xl bg-black/24 p-3">
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/28">Selected track</p>
                <p className="mt-2 truncate text-sm font-black">{selectedTrack?.title || "Choose a track"}</p>
                <p className="mt-1 text-[9px] text-emerald-300/70">{selectedTrack ? "CC0 / Public Domain" : "130 tracks available"}</p>
              </div>
              <Button onClick={attach} disabled={!project || !selectedTrack} className="mt-3 h-12 w-full rounded-2xl bg-white font-black text-black hover:bg-white/90"><Save className="h-4 w-4" />Add to project</Button>
            </div>
          </section>
        </aside>

        <FluxMusicLibrary selectedId={selectedTrack?.id || null} onSelect={setSelectedTrack} title="Studio music" description="130 full MP3 tracks for game menus, worlds, trailers, cutscenes and websites. Every listed track is CC0/public domain." />
      </div>
    </main>
  );
}
