import path from "path";
import fs from "fs";

/** Relative folder of the Rec Room March 19 2019 build inside /game */
export const GAME_FOLDER_NAME = "March 19th,2019";
export const GAME_EXE_NAME = "Recroom_Release.exe";
export const GAME_DISPLAY_NAME = "Rec Room (March 19, 2019)";
export const GAME_ID = "recroom-2019";

export function getGameRoot(): string {
  // Prefer env override so install can live outside the repo
  if (process.env.FLUX_GAME_PATH) {
    return process.env.FLUX_GAME_PATH;
  }
  return path.join(process.cwd(), "game", GAME_FOLDER_NAME);
}

export function getGameExePath(): string {
  return path.join(getGameRoot(), GAME_EXE_NAME);
}

export function isGameInstalled(): boolean {
  try {
    return fs.existsSync(getGameExePath());
  } catch {
    return false;
  }
}

export function getGameInstallInfo() {
  const root = getGameRoot();
  const exe = getGameExePath();
  const installed = fs.existsSync(exe);
  let sizeBytes = 0;
  let fileCount = 0;
  if (installed && fs.existsSync(root)) {
    try {
      const dataDir = path.join(root, "Recroom_Release_Data");
      if (fs.existsSync(dataDir)) {
        // quick sample — don't walk millions of GI files deeply for status
        const top = fs.readdirSync(root);
        fileCount = top.length;
        const st = fs.statSync(exe);
        sizeBytes = st.size;
      }
    } catch {
      /* ignore */
    }
  }
  return {
    id: GAME_ID,
    name: GAME_DISPLAY_NAME,
    root,
    exe,
    installed,
    sizeBytes,
    fileCount,
  };
}
