"use client";

import { Check, Heart, MessageCircle, Palette, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { ACCENTS, useTheme } from "@/contexts/theme-context";
import { updateUserProfile } from "@/services/users";
import { XCard, XHeader, XPage, XSectionTitle } from "@/components/x/x-ui";
import { cn } from "@/lib/utils";
import type { AccentColor, ThemeMode } from "@/types";

const ACCENT_SWATCH: Record<AccentColor, string> = {
  blue: "#1d9bf0",
  yellow: "#ffd400",
  pink: "#f91880",
  purple: "#7856ff",
  orange: "#ff7a00",
  green: "#00ba7c",
};

const BACKGROUNDS: Array<{
  id: Extract<ThemeMode, "light" | "dim" | "dark">;
  label: string;
  surface: string;
  ink: string;
  line: string;
}> = [
  { id: "light", label: "Light", surface: "#ffffff", ink: "#0f1419", line: "#cfd9de" },
  { id: "dim", label: "Dim", surface: "#15202b", ink: "#f7f9f9", line: "#38444d" },
  { id: "dark", label: "Lights out", surface: "#000000", ink: "#e7e9ea", line: "#2f3336" },
];

export default function DisplaySettingsPage() {
  const { theme, resolved, accent, setTheme, setAccent } = useTheme();
  const { user, refreshProfile } = useAuth();

  // The theme applies locally the instant it is picked; syncing it to the
  // profile is best effort so a dropped connection never blocks the change.
  const persist = async (next: ThemeMode) => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, { settings: { theme: next } });
      await refreshProfile();
    } catch {
      /* the local choice still stands */
    }
  };

  const pickBackground = (next: ThemeMode) => {
    setTheme(next);
    void persist(next);
    toast.success(`Background: ${BACKGROUNDS.find((b) => b.id === next)?.label ?? next}`);
  };

  return (
    <XPage>
      <XHeader title="Display" subtitle="Colour and background" icon={Palette} back />

      <div className="px-4 pt-4">
        <p className="text-[15px] leading-6 text-[var(--v8-muted)]">
          Manage your font colour and background. These settings affect Flux on this browser.
        </p>
      </div>

      {/* A real post is the only honest preview of a colour choice. */}
      <div className="px-4 pt-4">
        <XCard className="p-4">
          <div className="flex gap-3">
            <span
              className="h-10 w-10 flex-none rounded-full"
              style={{ background: "linear-gradient(135deg, var(--v8-accent), var(--v8-purple))" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">
                Flux{" "}
                <span className="font-normal text-[var(--v8-muted)]">@flux · 2h</span>
              </p>
              <p className="mt-1 text-[15px] leading-6">
                At the heart of Flux are short posts called posts.{" "}
                <span className="text-[var(--v8-accent)]">#FluxDisplay</span>
              </p>
              <div className="mt-3 flex max-w-[280px] items-center justify-between text-[13px] text-[var(--v8-muted)]">
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="h-[18px] w-[18px]" /> 24
                </span>
                <span className="flex items-center gap-1.5">
                  <Repeat2 className="h-[18px] w-[18px]" /> 12
                </span>
                <span className="flex items-center gap-1.5 text-[var(--v8-pink)]">
                  <Heart className="h-[18px] w-[18px] fill-current" /> 310
                </span>
              </div>
            </div>
          </div>
        </XCard>
      </div>

      <XSectionTitle>Colour</XSectionTitle>
      <div className="px-4">
        <XCard className="flex flex-wrap justify-between gap-3 p-4">
          {ACCENTS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAccent(id)}
              aria-label={`${id} highlight colour`}
              aria-pressed={accent === id}
              className="grid h-11 w-11 place-items-center rounded-full text-white transition active:scale-95"
              style={{ background: ACCENT_SWATCH[id], color: id === "yellow" ? "#0f1419" : "#fff" }}
            >
              {accent === id ? <Check className="h-5 w-5" strokeWidth={3} /> : null}
            </button>
          ))}
        </XCard>
      </div>

      <XSectionTitle>Background</XSectionTitle>
      <div className="px-4 pb-6">
        <XCard className="grid gap-2 p-3 sm:grid-cols-3">
          {BACKGROUNDS.map((background) => {
            const selected = theme === background.id || (theme === "system" && resolved === background.id);
            return (
              <button
                key={background.id}
                type="button"
                onClick={() => pickBackground(background.id)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--v8-radius-xs)] px-4 py-3 text-left transition",
                  selected
                    ? "ring-2 ring-[var(--v8-accent)]"
                    : "ring-1 ring-[var(--v8-line-strong)] hover:ring-[var(--v8-accent-ring)]"
                )}
                style={{ background: background.surface, color: background.ink }}
              >
                <span
                  className="grid h-5 w-5 flex-none place-items-center rounded-full"
                  style={{
                    background: selected ? "var(--v8-accent)" : "transparent",
                    boxShadow: selected ? "none" : `inset 0 0 0 2px ${background.line}`,
                  }}
                >
                  {selected ? <Check className="h-3 w-3 text-[var(--v8-on-accent,#fff)]" strokeWidth={4} /> : null}
                </span>
                <strong className="text-[15px]">{background.label}</strong>
              </button>
            );
          })}
        </XCard>

        <button
          type="button"
          onClick={() => pickBackground("system")}
          className={cn(
            "x-btn x-btn-hollow x-btn-block mt-3",
            theme === "system" && "!border-[var(--v8-accent)] !text-[var(--v8-accent)]"
          )}
        >
          Match my device
        </button>
      </div>
    </XPage>
  );
}
