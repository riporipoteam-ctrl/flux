import path from "path";
import fs from "fs";

export type FluxRecRoomBuild = {
  id: string;
  displayName: string;
  buildDate: string;
  steamBuildId: string;
  manifestId: string;
  defaultFolderName: string;
  executableNames: string[];
  dataDirectoryNames: string[];
};

export const RECROOM_BUILDS = {
  "recroom-2022-05-19": {
    id: "recroom-2022-05-19",
    displayName: "Rec Room (May 19, 2022)",
    buildDate: "2022-05-19",
    steamBuildId: "8751857",
    manifestId: "6337851004861751095",
    defaultFolderName: "May 19 2022",
    executableNames: ["RecRoom.exe", "Recroom_Release.exe"],
    dataDirectoryNames: ["RecRoom_Data", "Recroom_Release_Data"],
  },
  "recroom-2019-03-19": {
    id: "recroom-2019-03-19",
    displayName: "Rec Room (March 19, 2019)",
    buildDate: "2019-03-19",
    steamBuildId: "legacy-2019-03-19",
    manifestId: "legacy-2019-03-19",
    defaultFolderName: "March 19th,2019",
    executableNames: ["Recroom_Release.exe", "RecRoom.exe"],
    dataDirectoryNames: ["Recroom_Release_Data", "RecRoom_Data"],
  },
} as const satisfies Record<string, FluxRecRoomBuild>;

export type FluxRecRoomBuildId = keyof typeof RECROOM_BUILDS;

export const DEFAULT_GAME_BUILD_ID: FluxRecRoomBuildId = "recroom-2022-05-19";

function isBuildId(value: string): value is FluxRecRoomBuildId {
  return Object.prototype.hasOwnProperty.call(RECROOM_BUILDS, value);
}

export function getActiveGameBuild(): FluxRecRoomBuild {
  const requested = process.env.FLUX_RECROOM_BUILD?.trim();
  const id = requested && isBuildId(requested) ? requested : DEFAULT_GAME_BUILD_ID;
  return RECROOM_BUILDS[id];
}

// Backward-compatible exports used by existing launcher/status code.
export const GAME_FOLDER_NAME = RECROOM_BUILDS[DEFAULT_GAME_BUILD_ID].defaultFolderName;
export const GAME_EXE_NAME = RECROOM_BUILDS[DEFAULT_GAME_BUILD_ID].executableNames[0];
export const GAME_DISPLAY_NAME = RECROOM_BUILDS[DEFAULT_GAME_BUILD_ID].displayName;
export const GAME_ID = RECROOM_BUILDS[DEFAULT_GAME_BUILD_ID].id;

export function getGameRoot(): string {
  // The client is intentionally kept outside Git. Point this at the folder that
  // contains the user-supplied archived build on the Windows game host.
  if (process.env.FLUX_GAME_PATH) return path.resolve(process.env.FLUX_GAME_PATH);
  return path.join(process.cwd(), "game", getActiveGameBuild().defaultFolderName);
}

export function getGameExePath(): string {
  const root = getGameRoot();
  const build = getActiveGameBuild();
  for (const name of build.executableNames) {
    const candidate = path.join(root, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Stable expected path for status/error messages before the build is installed.
  return path.join(root, build.executableNames[0]);
}

function getGameDataDir(root = getGameRoot()) {
  const build = getActiveGameBuild();
  for (const name of build.dataDirectoryNames) {
    const candidate = path.join(root, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(root, build.dataDirectoryNames[0]);
}

export function isGameInstalled(): boolean {
  try {
    const exe = getGameExePath();
    const dataDir = getGameDataDir();
    return fs.existsSync(exe) && fs.existsSync(dataDir);
  } catch {
    return false;
  }
}

export function getGameInstallInfo() {
  const build = getActiveGameBuild();
  const root = getGameRoot();
  const exe = getGameExePath();
  const dataDir = getGameDataDir(root);
  const installed = fs.existsSync(exe) && fs.existsSync(dataDir);
  let sizeBytes = 0;
  let fileCount = 0;

  if (installed && fs.existsSync(root)) {
    try {
      const top = fs.readdirSync(root);
      fileCount = top.length;
      sizeBytes = fs.statSync(exe).size;
    } catch {
      /* status remains usable even when the host filesystem is momentarily busy */
    }
  }

  return {
    id: build.id,
    name: build.displayName,
    buildDate: build.buildDate,
    steamBuildId: build.steamBuildId,
    manifestId: build.manifestId,
    root,
    exe,
    dataDir,
    installed,
    sizeBytes,
    fileCount,
  };
}
