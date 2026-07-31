"use client";

import Link from "next/link";
import { ImagePlus, Music2, Type, Wand2 } from "lucide-react";
import { StoryRail } from "@/components/stories/story-rail";

export default function StoriesPage() {
  return (
    <div className="social-feed pb-20">
      <header className="social-page-header">
        <h1 className="text-xl font-bold">Stories</h1>
        <Link href="/stories/create" className="ml-auto rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">Create</Link>
      </header>

      <StoryRail />

      <section className="p-5 sm:p-7">
        <h2 className="text-2xl font-bold tracking-tight">Share a moment</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Stories stay visible for 24 hours. Add a photo or video, style your text, choose a design and use original music made for Flux.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { icon: ImagePlus, title: "Photo and video", text: "Upload media up to 40 MB." },
            { icon: Type, title: "Text tools", text: "Fonts, colors and flexible placement." },
            { icon: Wand2, title: "Story designs", text: "Clean visual backgrounds and overlays." },
            { icon: Music2, title: "Original music", text: "Royalty-free loops generated inside Flux." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border p-4">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
