import AskAIGroqWorkspace from "@/components/ask-ai/askai-groq-workspace";
import { AskAIConnectionStatus } from "@/components/ask-ai/askai-connection-status";

export default function AskAIPage() {
  return <><AskAIGroqWorkspace /><AskAIConnectionStatus /></>;
}
