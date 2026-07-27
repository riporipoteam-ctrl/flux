"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeMode } from "@/types";

interface ThemeContextValue {
  theme: ThemeMode;
  resolved: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  toggleDark: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// v2 resets the old release that forced every existing browser into dark mode.
const STORAGE_KEY = "flux-theme-v2";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    } else {
      setThemeState("light");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const apply = (mode: ThemeMode) => {
      let next: "light" | "dark" = "light";
      if (mode === "dark") next = "dark";
      else if (mode === "system") {
        next = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      } else {
        next = "light";
      }

      setResolved(next);
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(next);
      // Prevent OS dark preference from fighting us
      root.style.colorScheme = next;
    };

    apply(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme, mounted]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggleDark = useCallback((enabled: boolean) => {
    setThemeState(enabled ? "dark" : "light");
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggleDark }),
    [theme, resolved, setTheme, toggleDark]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
