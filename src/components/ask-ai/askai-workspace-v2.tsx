"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Circle, Home, Search, Sparkles } from "lucide-react";
import AskAIWorkspace from "@/components/ask-ai/askai-workspace";
import {
  getLocalAskAIStatus,
  subscribeLocalAskAIStatus,
  type LocalAskAIStatus,
} from "@/lib/ai/local-web-llm";
import { cn } from "@/lib/utils";

export default function AskAIWorkspaceV2() {
  const [model, setModel] = useState<LocalAskAIStatus>(() => getLocalAskAIStatus());

  useEffect(() => subscribeLocalAskAIStatus(setModel), []);

  return (
    <div className="askai-v2-frame">
      <header className="askai-v2-productbar">
        <Link href="/home" className="askai-v2-back" aria-label="Return to Flux">
          <ArrowLeft className="h-4 w-4" />
          <span className="askai-v2-logo">F</span>
          <strong>Flux</strong>
        </Link>

        <div className="askai-v2-workspace-title">
          <Sparkles className="h-4 w-4" />
          <div>
            <strong>AskAI Workspace</strong>
            <span>Agents, threads, jobs and miniapps</span>
          </div>
        </div>

        <div className="askai-v2-actions">
          <Link href="/explore" className="askai-v2-action" aria-label="Search Flux">
            <Search className="h-4 w-4" />
            <span>Search Flux</span>
          </Link>
          <Link href="/home" className="askai-v2-action" aria-label="Flux home">
            <Home className="h-4 w-4" />
            <span>Social</span>
          </Link>
          <div className={cn("askai-v2-model", `is-${model.phase}`)} title={model.error || model.label}>
            <Circle className="h-2.5 w-2.5 fill-current" />
            <span>{modelLabel(model)}</span>
            {model.phase === "downloading" && model.progress !== null ? <b>{model.progress}%</b> : null}
          </div>
        </div>
      </header>

      <div className="askai-v2-progress" aria-hidden="true">
        <i style={{ width: model.phase === "downloading" ? `${model.progress || 3}%` : model.phase === "ready" ? "100%" : "0%" }} />
      </div>

      <AskAIWorkspace />
    </div>
  );
}

function modelLabel(status: LocalAskAIStatus): string {
  if (status.phase === "ready") return status.modelId?.includes("1.5B") ? "Local 1.5B ready" : "Local Lite ready";
  if (status.phase === "downloading") return "Preparing local AI";
  if (status.phase === "generating") return "Local AI working";
  if (status.phase === "checking") return "Checking local AI";
  if (status.phase === "error") return "Instant fallback";
  return "Local AI queued";
}
