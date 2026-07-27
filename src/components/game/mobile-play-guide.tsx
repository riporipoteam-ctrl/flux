"use client";

import { useEffect, useState } from "react";
import {
  Smartphone,
  Monitor,
  ExternalLink,
  Gamepad2,
  Wifi,
  AppWindow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MOONLIGHT_IOS =
  "https://apps.apple.com/app/moonlight-game-streaming/id1000551566";
const MOONLIGHT_ANDROID =
  "https://play.google.com/store/apps/details?id=com.limelight";
const MOONLIGHT_SITE = "https://moonlight-stream.org/";
const WINLATOR = "https://winlator.org/";

function detectMobile(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * Research-backed mobile play paths for Flux / 2019 Rec Room.
 * Real 2019 client on phone = stream (Moonlight) or Android Winlator experimental.
 * Always-online on phone = Hangout in browser.
 */
export function MobilePlayGuide({
  onPlayHangout,
  liveStreamUrl,
  onJoinStream,
  className,
}: {
  onPlayHangout?: () => void;
  liveStreamUrl?: string | null;
  onJoinStream?: (url: string) => void;
  className?: string;
}) {
  const [device, setDevice] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    setDevice(detectMobile());
  }, []);

  const isPhone = device === "ios" || device === "android";

  return (
    <div
      className={cn(
        "rounded-3xl border border-[#1d9bf0]/40 bg-gradient-to-br from-[#1d9bf0]/15 via-card to-violet-600/10 p-5 sm:p-6",
        className
      )}
    >
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1d9bf0]/20 text-[#1d9bf0]">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[#1d9bf0]">
            Research · mobile paths that exist
          </p>
          <h2 className="text-xl font-extrabold tracking-tight">
            Play on phone (iPhone / Android)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <strong>Install Flux on your phone</strong> (PWA / APK / IPA shell) —
            Firebase social + Hangout, <strong>no PC online</strong>. The Windows
            2019 EXE cannot live inside the APK; full 3D RR stays on PC. See{" "}
            <code className="rounded bg-black/30 px-1 text-[11px]">
              game/MOBILE-APP.md
            </code>
            .
          </p>
        </div>
      </div>

      {isPhone && (
        <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Detected:{" "}
          <strong>{device === "ios" ? "iPhone / iPad" : "Android"}</strong>.
          Use the buttons below on this device.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {/* Hangout */}
        <div className="flex flex-col rounded-2xl border border-border bg-background/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <AppWindow className="h-4 w-4 text-[#ff6b35]" />
            1 · Install &amp; play (no PC)
          </div>
          <p className="mb-3 flex-1 text-xs text-muted-foreground">
            <strong>iPhone:</strong> Safari → Share → Add to Home Screen → open
            icon → Hangout. <strong>Android:</strong> same, or build APK via
            Capacitor. Firebase = backend. Works when your PC is off.
          </p>
          <Button
            className="w-full bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90"
            onClick={onPlayHangout}
          >
            <Gamepad2 className="h-4 w-4" />
            Launch Hangout now
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Installed app auto-opens Hangout after sign-in
          </p>
        </div>

        {/* Stream / Moonlight */}
        <div className="flex flex-col rounded-2xl border border-border bg-background/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Wifi className="h-4 w-4 text-[#1d9bf0]" />
            2 · Real 2019 via stream
          </div>
          <p className="mb-3 flex-1 text-xs text-muted-foreground">
            PC runs 2019 + Flux RecNet + Sunshine. Phone uses{" "}
            <strong>Moonlight</strong> (free, App Store / Play). Same Wi‑Fi or
            VPN.
          </p>
          <div className="flex flex-col gap-2">
            {liveStreamUrl && onJoinStream ? (
              <Button
                className="w-full"
                variant="default"
                onClick={() => onJoinStream(liveStreamUrl)}
              >
                Join live browser stream
              </Button>
            ) : null}
            <Button
              className="w-full"
              variant="outline"
              onClick={() =>
                window.open(
                  device === "android" ? MOONLIGHT_ANDROID : MOONLIGHT_IOS,
                  "_blank",
                  "noopener"
                )
              }
            >
              <ExternalLink className="h-4 w-4" />
              {device === "android"
                ? "Moonlight on Play Store"
                : "Moonlight on App Store"}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              size="sm"
              onClick={() => window.open(MOONLIGHT_SITE, "_blank", "noopener")}
            >
              moonlight-stream.org
            </Button>
          </div>
        </div>

        {/* Android Winlator / desktop note */}
        <div className="flex flex-col rounded-2xl border border-border bg-background/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Monitor className="h-4 w-4 text-violet-400" />
            3 · On-device Windows
          </div>
          {device === "ios" ? (
            <p className="mb-3 flex-1 text-xs text-muted-foreground">
              <strong>iPhone cannot run the Windows EXE</strong> (no Winlator).
              Use Moonlight stream or Hangout. Sideload = Flux shell / Moonlight,
              not a converted Rec Room binary.
            </p>
          ) : (
            <p className="mb-3 flex-1 text-xs text-muted-foreground">
              <strong>Android only:</strong>{" "}
              <a
                className="text-[#1d9bf0] underline"
                href={WINLATOR}
                target="_blank"
                rel="noreferrer"
              >
                Winlator
              </a>{" "}
              can run some Windows Unity games via Wine+Box64. Experimental —
              needs a strong phone; Unity is picky. Do not redistribute game
              files inside an APK.
            </p>
          )}
          {device === "android" || device === "desktop" ? (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => window.open(WINLATOR, "_blank", "noopener")}
            >
              <ExternalLink className="h-4 w-4" />
              Winlator (Android experimental)
            </Button>
          ) : (
            <Button className="w-full" variant="outline" disabled>
              Winlator not available on iOS
            </Button>
          )}
        </div>
      </div>

      <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          Host PC: install Flux 2019 path, start RecNet, install Sunshine, run{" "}
          <code className="rounded bg-black/30 px-1">
            game/flux-stream/ONE-CLICK-FREE-HOST.bat
          </code>
        </li>
        <li>Phone: Moonlight → pair PIN from Sunshine → launch Rec Room</li>
        <li>No host PC online? Hangout still works for all phones</li>
      </ol>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Full write-up:{" "}
        <code className="rounded bg-black/30 px-1">game/MOBILE-PLAY.md</code>
      </p>
    </div>
  );
}
