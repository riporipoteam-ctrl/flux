declare global {
  interface Window {
    BABYLON?: any;
    CANNON?: any;
  }
}

const SCRIPT_URLS = [
  "https://cdn.babylonjs.com/babylon.js",
  "https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js",
  "https://cdn.babylonjs.com/materialsLibrary/babylonjs.materials.min.js",
  "https://cdn.babylonjs.com/cannon.js",
] as const;

const pending = new Map<string, Promise<void>>();

function loadScript(url: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Babylon can only load in the browser."));
  const existing = [...document.scripts].find((script) => script.src === url);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  const current = pending.get(url);
  if (current) return current;

  const task = new Promise<void>((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = url;
    script.async = false;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Could not load ${url}`)), { once: true });
    if (!existing) document.head.appendChild(script);
  }).finally(() => pending.delete(url));

  pending.set(url, task);
  return task;
}

export async function loadBabylonRuntime(): Promise<any> {
  if (typeof window === "undefined") throw new Error("Flux Engine requires a browser.");
  for (const url of SCRIPT_URLS) await loadScript(url);
  if (!window.BABYLON) throw new Error("Babylon loaded without exposing its runtime.");
  return window.BABYLON;
}

export function babylonRuntimeReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.BABYLON);
}

export function disposeBabylonObject(value: any): void {
  try {
    value?.dispose?.();
  } catch {
    // Babylon disposal should never take down the editor shell.
  }
}

export {};
