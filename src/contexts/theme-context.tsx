"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AccentColor, ThemeMode } from "@/types";

interface ThemeContextValue {
  theme: ThemeMode;
  /** `system` collapsed to the background actually on screen. */
  resolved: "light" | "dim" | "dark";
  accent: AccentColor;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  toggleDark: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// v2 resets the old release that forced every existing browser into dark mode.
export const THEME_KEY = "flux-theme-v2";
export const ACCENT_KEY = "flux-accent-v1";

export const THEMES: ThemeMode[] = ["light", "dim", "dark", "system"];
export const ACCENTS: AccentColor[] = ["blue", "yellow", "pink", "purple", "orange", "green"];

function isTheme(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEMES as string[]).includes(value);
}

function isAccent(value: unknown): value is AccentColor {
  return typeof value === "string" && (ACCENTS as string[]).includes(value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [accent, setAccentState] = useState<AccentColor>("blue");
  const [resolved, setResolved] = useState<"light" | "dim" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (isTheme(storedTheme)) setThemeState(storedTheme);
    const storedAccent = localStorage.getItem(ACCENT_KEY);
    if (isAccent(storedAccent)) setAccentState(storedAccent);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const apply = (mode: ThemeMode) => {
      const next: "light" | "dim" | "dark" =
        mode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : mode;

      setResolved(next);
      const root = document.documentElement;
      root.classList.remove("light", "dim", "dark");
      root.classList.add(next);
      // Prevent the OS preference from fighting an explicit choice.
      root.style.colorScheme = next === "light" ? "light" : "dark";
    };

    apply(theme);
    localStorage.setItem(THEME_KEY, theme);

    if (theme === "system") {
      const query = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      query.addEventListener("change", handler);
      return () => query.removeEventListener("change", handler);
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent, mounted]);

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);
  const setAccent = useCallback((next: AccentColor) => setAccentState(next), []);
  const toggleDark = useCallback((enabled: boolean) => {
    setThemeState(enabled ? "dark" : "light");
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, accent, setTheme, setAccent, toggleDark }),
    [theme, resolved, accent, setTheme, setAccent, toggleDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
