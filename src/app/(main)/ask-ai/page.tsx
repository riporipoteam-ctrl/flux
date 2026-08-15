import Link from "next/link";
import { Users } from "lucide-react";
import AskAIGroqWorkspace from "@/components/ask-ai/askai-groq-workspace";
import { AskAIConnectionStatus } from "@/components/ask-ai/askai-connection-status";

export default function AskAIPage() {
  return <>
    <AskAIGroqWorkspace />
    <Link
      href="/ask-ai/agents"
      className="fixed bottom-24 right-4 z-[55] inline-flex h-11 items-center gap-2 rounded-full border border-border bg-foreground px-4 text-xs font-black text-background shadow-2xl transition hover:-translate-y-0.5 sm:bottom-5 sm:right-5"
      aria-label="Open Maus Agents"
    >
      <Users className="h-4 w-4" />
      <span>Maus Agents</span>
    </Link>
    <AskAIConnectionStatus />
  </>;
}
