import Link from "next/link";
import { Users } from "lucide-react";
import AskAIGroqWorkspace from "@/components/ask-ai/askai-groq-workspace";
import { AskAIConnectionStatus } from "@/components/ask-ai/askai-connection-status";

export default function AskAIPage() {
  return <>
    <AskAIGroqWorkspace />
    <Link href="/ask-ai/agents" className="askx-maus-entry" aria-label="Open Maus Agents">
      <Users className="h-4 w-4" />
      <span>Maus Agents</span>
    </Link>
    <AskAIConnectionStatus />
  </>;
}
