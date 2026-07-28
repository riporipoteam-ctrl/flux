"use client";

import { motion } from "framer-motion";
import { Camera, Check } from "lucide-react";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/asset-url";

export function AvatarPicker({
  value,
  onChange,
  onUpload,
  className,
}: {
  value: string | null;
  onChange: (url: string) => void;
  onUpload?: (file: File) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Choose a look</p>
          <p className="text-xs text-muted-foreground">
            Pick a Flux character or upload your own photo
          </p>
        </div>
        {onUpload ? (
          <label className="pressable inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-soft transition hover:border-primary/40 hover:bg-accent">
            <Camera className="h-3.5 w-3.5" />
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {DEFAULT_AVATARS.map((avatar, i) => {
          const selected = value === avatar.src;
          return (
            <motion.button
              key={avatar.id}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: i * 0.03,
                type: "spring",
                stiffness: 380,
                damping: 22,
              }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange(avatar.src)}
              className={cn(
                "group relative flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-colors",
                selected
                  ? "border-primary bg-accent shadow-glow"
                  : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-card transition",
                  selected ? "ring-primary" : "ring-transparent"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(avatar.src)}
                  alt={avatar.name}
                  className="h-full w-full object-cover"
                />
                {selected ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-primary/25">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {avatar.name.split(" ").slice(-1)[0]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
