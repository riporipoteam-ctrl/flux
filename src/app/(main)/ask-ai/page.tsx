import RakazoAskAIWorkspace from "@/components/ask-ai/rakazo-askai-workspace";
import { AskAIWorkspaceSync } from "@/components/ask-ai/askai-workspace-sync";

// Legacy AskAIGroqWorkspace surface retired. RakazoAskAIWorkspace is the production AskAI route.

export default function AskAIPage() {
  return (
    <>
    <AskAIWorkspaceSync />
    <RakazoAskAIWorkspace />
    </>
  );
}
