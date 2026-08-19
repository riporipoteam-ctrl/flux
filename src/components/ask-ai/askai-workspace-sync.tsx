"use client";

import { useEffect } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";

const STORAGE_FIELDS = {
  agents: "flux-askai-agents-v3",
  jobs: "flux-askai-jobs-v2",
  miniapps: "flux-askai-miniapps-v2",
  memory: "flux-askai-memory-v2",
  files: "flux-askai-files-v2",
  settings: "flux-askai-settings-v2",
} as const;

type WorkspaceField = keyof typeof STORAGE_FIELDS;

function readStorage(field: WorkspaceField): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_FIELDS[field]);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(field: WorkspaceField, value: unknown): void {
  if (typeof window === "undefined" || value === undefined) return;
  try {
    window.localStorage.setItem(STORAGE_FIELDS[field], JSON.stringify(value));
  } catch {
    // Private browsing or storage quota errors should not block AskAI.
  }
}

function localWorkspace(): Record<WorkspaceField, unknown> {
  return {
    agents: readStorage("agents"),
    jobs: readStorage("jobs"),
    miniapps: readStorage("miniapps"),
    memory: readStorage("memory"),
    files: readStorage("files"),
    settings: readStorage("settings"),
  };
}

/**
 * Keeps the existing fast local AskAI workspace responsive while mirroring
 * user-owned state to Firestore for signed-in web/iOS devices.
 */
export function AskAIWorkspaceSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const workspaceRef = doc(db, "askAIWorkspaces", user.uid);
    let hydrated = false;
    let applyingRemote = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const upload = () => {
      if (!hydrated) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void setDoc(
          workspaceRef,
          {
            ownerId: user.uid,
            ...localWorkspace(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => undefined);
      }, 350);
    };

    const onLocalChange = () => {
      if (!applyingRemote) upload();
    };

    window.addEventListener("flux-askai-workspace-updated", onLocalChange);

    const unsubscribe = onSnapshot(
      workspaceRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          hydrated = true;
          upload();
          return;
        }

        const data = snapshot.data() as Partial<Record<WorkspaceField, unknown>>;
        applyingRemote = true;
        (Object.keys(STORAGE_FIELDS) as WorkspaceField[]).forEach((field) => {
          if (data[field] !== undefined) writeStorage(field, data[field]);
        });
        window.dispatchEvent(new CustomEvent("flux-askai-workspace-updated"));
        applyingRemote = false;
        hydrated = true;
      },
      () => {
        // Workspace sync is additive. AskAI remains usable if rules/network are unavailable.
        hydrated = true;
      }
    );

    return () => {
      window.removeEventListener("flux-askai-workspace-updated", onLocalChange);
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  return null;
}
