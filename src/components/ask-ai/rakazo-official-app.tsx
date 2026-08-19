const RAKAZO_APP_URL = "https://app.rakazo.com/app";

/**
 * Rakazo's real web client, published from https://github.com/elie222/rakazo.
 *
 * Flux Pages is a static frontend deployment and cannot host Rakazo's API,
 * database, worker, or sandbox runtime. Loading the official deployment keeps
 * this route honest and preserves Rakazo's own functionality and auth.
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
