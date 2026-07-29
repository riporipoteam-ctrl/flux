"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import {
  claimUsername,
  isUsernameAvailable,
  updateUserProfile,
} from "@/services/users";
import { uploadAvatar, uploadBanner } from "@/services/media";
import { MAX_BIO_LENGTH } from "@/lib/constants";
import { MOOD_OPTIONS, PROFILE_ACCENTS } from "@/lib/default-avatars";
import { cn, formatUsername } from "@/lib/utils";
import { PageTransition } from "@/components/shared/page-transition";
import { assetUrl } from "@/lib/asset-url";
import { profilePath } from "@/lib/routes";

export default function EditProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [xLink, setXLink] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [accent, setAccent] = useState("#0f1419");
  const [accountType, setAccountType] = useState<"personal" | "business">(
    "personal"
  );
  const [businessName, setBusinessName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "");
    setUsername(profile.username || "");
    setBio(profile.bio || "");
    setLocation(profile.location || "");
    setWebsite(profile.website || profile.socialLinks?.website || "");
    setInstagram(profile.socialLinks?.instagram || "");
    setTiktok(profile.socialLinks?.tiktok || "");
    setYoutube(profile.socialLinks?.youtube || "");
    setXLink(profile.socialLinks?.x || "");
    setMood(profile.mood);
    setAccent(profile.profileAccent || "#0f1419");
    setAccountType(profile.accountType === "business" ? "business" : "personal");
    setBusinessName(profile.businessName || "");
    setIsPrivate(profile.isPrivate ?? false);
    setAvatarPreview(profile.avatarUrl);
    setBannerPreview(profile.bannerUrl);
  }, [profile]);

  const save = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      let avatarUrl =
        avatarPreview && !avatarPreview.startsWith("blob:")
          ? avatarPreview
          : profile.avatarUrl;
      let bannerUrl =
        bannerPreview && !bannerPreview.startsWith("blob:")
          ? bannerPreview
          : profile.bannerUrl;
      if (avatarFile) avatarUrl = await uploadAvatar(user.uid, avatarFile);
      if (bannerFile) bannerUrl = await uploadBanner(user.uid, bannerFile);

      const nextUsername = formatUsername(username);
      if (nextUsername !== profile.username) {
        const available = await isUsernameAvailable(nextUsername);
        if (!available) {
          toast.error("Username is taken");
          setSaving(false);
          return;
        }
        await claimUsername(user.uid, nextUsername);
      }

      await updateUserProfile(user.uid, {
        displayName: displayName.trim() || profile.displayName || "Flux User",
        bio: bio.trim().slice(0, MAX_BIO_LENGTH),
        location: location.trim() || null,
        website: website.trim() || null,
        avatarUrl: avatarUrl || profile.avatarUrl || "/avatars/fox.png",
        bannerUrl: bannerUrl ?? null,
        mood: mood === "none" || !mood ? null : mood,
        profileAccent: accent || "#0f1419",
        accountType,
        businessName:
          accountType === "business" ? businessName.trim() || displayName : null,
        isPrivate,
        // Business accounts get the briefcase verified style
        ...(accountType === "business"
          ? {
              isVerified: true,
              verifiedType: "business" as const,
            }
          : profile.verifiedType === "business"
            ? { verifiedType: "flux" as const }
            : {}),
        socialLinks: {
          instagram: instagram.trim(),
          tiktok: tiktok.trim(),
          youtube: youtube.trim(),
          x: xLink.trim(),
          website: website.trim(),
        },
      });

      await refreshProfile();
      toast.success("Profile updated");
      router.push(nextUsername ? profilePath(nextUsername) : "/home");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="relative z-20 lg:sticky lg:top-0 lg:z-30 flex items-center justify-between gap-3 glass-strong border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="rounded-full p-2 transition hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Edit profile</h1>
        </div>
        <Button onClick={save} disabled={saving} className="min-w-[96px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </header>

      <PageTransition className="pb-12">
        <div
          className="relative h-36 sm:h-44"
          style={{
            background: `linear-gradient(120deg, ${accent}55, #a855f755, #ec489955)`,
          }}
        >
          {bannerPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(bannerPreview)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
          <label className="absolute bottom-3 right-3 z-10 inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-black/85">
            <Camera className="h-3.5 w-3.5" />
            Change banner
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 8 * 1024 * 1024) {
                  toast.error("Banner must be under 8MB");
                  return;
                }
                setBannerFile(f);
                setBannerPreview(URL.createObjectURL(f));
                toast.success("Banner selected — click Save");
              }}
            />
          </label>
        </div>

        <div className="relative -mt-12 px-4">
          <UserAvatar
            user={{
              displayName,
              username,
              avatarUrl: avatarPreview,
            }}
            size="xl"
            className="ring-4 ring-card"
            ring
          />
        </div>

        <div className="mt-6 space-y-6 px-4">
          <section className="surface-card p-4">
            <AvatarPicker
              value={avatarPreview}
              onChange={(url) => {
                setAvatarFile(null);
                setAvatarPreview(url);
              }}
              onUpload={(f) => {
                setAvatarFile(f);
                setAvatarPreview(URL.createObjectURL(f));
              }}
            />
          </section>

          <section className="surface-card space-y-3 p-4">
            <h2 className="text-sm font-bold">Account type</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={accountType === "personal" ? "sky" : "outline"}
                onClick={() => setAccountType("personal")}
              >
                Personal
              </Button>
              <Button
                type="button"
                size="sm"
                variant={accountType === "business" ? "sky" : "outline"}
                onClick={() => setAccountType("business")}
              >
                Business
              </Button>
            </div>
            {accountType === "business" ? (
              <Field label="Business name">
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your brand or company"
                />
              </Field>
            ) : null}
          </section>

          <section className="surface-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold">Private account</h2>
                <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">When enabled, only people you approve by following back can see your posts and activity.</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="Private account" />
            </div>
          </section>

          <section className="surface-card space-y-4 p-4">
            <Field label="Display name">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
              />
            </Field>
            <Field label="Username">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <Input
                  className="pl-8"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                  }
                  maxLength={20}
                />
              </div>
            </Field>
            <Field label="Bio">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                rows={3}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {bio.length}/{MAX_BIO_LENGTH}
              </p>
            </Field>
            <Field label="Location">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, country"
              />
            </Field>
            <Field label="Website">
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </Field>
          </section>

          <section className="surface-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Mood status</h2>
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((m) => {
                const active = (mood || "none") === m.id;
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setMood(m.id === "none" ? null : m.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      active
                        ? "border-primary bg-accent text-accent-foreground shadow-sm"
                        : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    {m.emoji ? `${m.emoji} ` : ""}
                    {m.label}
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="surface-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Profile accent color</h2>
            <div className="flex flex-wrap gap-2.5">
              {PROFILE_ACCENTS.map((a) => {
                const active = accent === a.color;
                return (
                  <motion.button
                    key={a.id}
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setAccent(a.color)}
                    title={a.label}
                    className={cn(
                      "h-9 w-9 rounded-full border-2 shadow-sm transition",
                      active ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ background: a.color }}
                  />
                );
              })}
            </div>
          </section>

          <section className="surface-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Social accounts</h2>
            <Field label="Instagram">
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="username or URL"
              />
            </Field>
            <Field label="TikTok">
              <Input
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="username or URL"
              />
            </Field>
            <Field label="YouTube">
              <Input
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="channel URL"
              />
            </Field>
            <Field label="X / Twitter">
              <Input
                value={xLink}
                onChange={(e) => setXLink(e.target.value)}
                placeholder="username or URL"
              />
            </Field>
          </section>
        </div>
      </PageTransition>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
