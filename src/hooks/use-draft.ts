"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "flux-compose-draft";

export function useDraft(enabled = true) {
  const [text, setTextState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setTextState(raw);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [enabled]);

  const setText = useCallback(
    (value: string | ((prev: string) => string)) => {
      setTextState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (enabled) {
          try {
            if (next.trim()) localStorage.setItem(KEY, next);
            else localStorage.removeItem(KEY);
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [enabled]
  );

  const clearDraft = useCallback(() => {
    setTextState("");
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { text, setText, clearDraft, ready };
}
