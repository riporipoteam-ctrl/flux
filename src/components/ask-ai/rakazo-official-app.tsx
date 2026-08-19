const RAKAZO_APP_URL = "https://app.rakazo.com/app";

/**
 * AskAI uses the real Rakazo web client published from
 * https://github.com/elie222/rakazo. Flux does not recreate Rakazo's UI here.
 */
export default function RakazoOfficialApp() {
  return (
    <main className="h-full w-full overflow-hidden bg-black">
      <iframe
        title="Rakazo"
        src={RAKAZO_APP_URL}
        className="block h-full w-full border-0"
        allow="clipboard-read; clipboard-write; microphone; camera; display-capture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </main>
  );
}
