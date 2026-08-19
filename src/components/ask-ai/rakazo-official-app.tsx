"use client";

import RakazoAskAIWorkspace from "./rakazo-askai-workspace";
import { AskAIWorkspaceSync } from "./askai-workspace-sync";

const RAKAZO_APP_URL = "https://app.rakazo.com/app";

/**
 * AskAI is the Flux-hosted Rakazo workspace inspired by the public Rakazo
 * project at https://github.com/elie222/rakazo. Guests can use the local
 * runtime without being redirected to an account screen. Signed-in users
 * additionally get Flux workspace sync, while the official Rakazo deployment
 * remains available as a separate link for users who already have a Rakazo account.
 */
export default function RakazoOfficialApp() {
  return (
    <main className="relative h-full w-full overflow-hidden bg-black" data-testid="rakazo-official-app-bridge">
      <AskAIWorkspaceSync />
      <RakazoAskAIWorkspace />
      <a
        className="absolute right-4 top-4 z-30 rounded-full border border-white/15 bg-black/70 px-3 py-2 text-xs font-medium text-white/80 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white"
        href={RAKAZO_APP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Open official Rakazo app"
      >
        Open official Rakazo ↗
      </a>
    </main>
  );
}
