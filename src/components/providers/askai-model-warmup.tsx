"use client";

import { useEffect } from "react";
import { shouldWarmLocalAskAI, warmLocalAskAI } from "@/lib/ai/local-web-llm";

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function AskAIModelWarmup() {
  useEffect(() => {
    if (!shouldWarmLocalAskAI()) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const begin = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void warmLocalAskAI();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") begin();
    };

    const browser = window as WindowWithIdleCallback;
    if (browser.requestIdleCallback) {
      idleId = browser.requestIdleCallback(begin, { timeout: 7000 });
    } else {
      timeoutId = window.setTimeout(begin, 3500);
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (idleId !== null) browser.cancelIdleCallback?.(idleId);
    };
  }, []);

  return null;
}
