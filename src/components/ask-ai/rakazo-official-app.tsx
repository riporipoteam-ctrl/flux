const RAKAZO_GUEST_PATH = "/flux/rakazo/";

/**
 * AskAI renders the actual Rakazo web client from https://github.com/elie222/rakazo.
 * The Pages workflow builds that source at a pinned commit with Rakazo's own
 * guest adapter and publishes it at /flux/rakazo/. Flux owns only this route
 * bridge; the workspace UI remains Rakazo's source UI.
 */
export default function RakazoOfficialApp() {
  return (
    <main className="h-full w-full overflow-hidden bg-[#050506]">
      <iframe
        title="Rakazo"
        src={RAKAZO_GUEST_PATH}
        className="block h-full w-full border-0"
        allow="clipboard-read; clipboard-write; microphone; camera; display-capture; fullscreen"
      />
    </main>
  );
}
