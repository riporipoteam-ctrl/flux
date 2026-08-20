"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { INTERESTS, MAX_BIO_LENGTH } from "@/lib/constants";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";
import {
  completeOnboarding,
  getSuggestedUsers,
  isUsernameAvailable,
} from "@/services/users";
import { uploadAvatar, uploadBanner } from "@/services/media";
import { followUser } from "@/services/follows";
import type { UserProfile } from "@/types";
import { cn, formatUsername } from "@/lib/utils";
import { assetUrl } from "@/lib/asset-url";
import { clearOnboardingPending, hasOnboardingPending } from "@/lib/onboarding-state";

const STEPS = [
  "Username",
  "Profile",
  "Photo",
  "Banner",
  "Interests",
  "Follow",
] as const;

export default function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [selectedFollows, setSelectedFollows] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (profile?.onboardingComplete || String(profile?.username || "").trim()) router.replace("/home");
    // Deep-linking to onboarding must not be able to reset an existing account.
    // Only the signup/first-time OAuth flow can set this local intent marker.
    else if (profile && !hasOnboardingPending(user.uid)) router.replace("/home");
    else if (profile) {
      setDisplayName(profile.displayName || "");
      setAvatarPreview(profile.avatarUrl || DEFAULT_AVATARS[0].src);
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    const uname = formatUsername(username);
    if (uname.length < 3) {
      setUsernameOk(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const ok = await isUsernameAvailable(uname);
        setUsernameOk(ok);
      } catch {
        setUsernameOk(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    if (step === 5 && user) {
      getSuggestedUsers(user.uid, 8).then(setSuggestions);
    }
  }, [step, user]);

  const progress = useMemo(
    () => ((step + 1) / STEPS.length) * 100,
    [step]
  );

  if (loading || !user) return <LoadingScreen />;

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = () => {
    if (step === 0) return usernameOk === true;
    if (step === 1) return displayName.trim().length >= 2;
    if (step === 4) return interests.length >= 1;
    return true;
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let avatarUrl =
        avatarPreview || profile?.avatarUrl || DEFAULT_AVATARS[0].src;
      let bannerUrl = profile?.bannerUrl ?? null;
      if (avatarFile) avatarUrl = await uploadAvatar(user.uid, avatarFile);
      if (bannerFile) bannerUrl = await uploadBanner(user.uid, bannerFile);

      await completeOnboarding(user.uid, {
        username: formatUsername(username),
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl,
        bannerUrl,
        interests,
      });

      for (const id of selectedFollows) {
        try {
          await followUser(user.uid, id);
        } catch {
          /* ignore individual follow errors */
        }
      }

      await refreshProfile();
      clearOnboardingPending(user.uid);
      toast.success("You're in. Welcome to Flux!");
      router.replace("/home");
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Could not finish onboarding"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Logo href="#" />
          <span className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
            className="flex-1"
          >
            {step === 0 && (
              <StepShell
                title="Claim your username"
                subtitle="This is how people find you on Flux."
              >
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      @
                    </span>
                    <Input
                      id="username"
                      className="pl-8"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                      }
                      placeholder="yourname"
                      maxLength={20}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    3–20 characters. Letters, numbers, underscore.
                  </p>
                  {checking ? (
                    <p className="text-xs text-muted-foreground">Checking…</p>
                  ) : usernameOk === true ? (
                    <p className="text-xs text-success">Available</p>
                  ) : usernameOk === false ? (
                    <p className="text-xs text-destructive">Taken</p>
                  ) : null}
                </div>
              </StepShell>
            )}

            {step === 1 && (
              <StepShell
                title="Tell us about you"
                subtitle="A great profile starts with a clear name and bio."
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) =>
                        setBio(e.target.value.slice(0, MAX_BIO_LENGTH))
                      }
                      placeholder="Builder, creator, night owl…"
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {bio.length}/{MAX_BIO_LENGTH}
                    </p>
                  </div>
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell
                title="Pick your avatar"
                subtitle="Choose a Flux character — no photo needed. Or upload your own."
              >
                <div className="mb-5 flex justify-center">
                  <UserAvatar
                    user={{
                      displayName,
                      username,
                      avatarUrl: avatarPreview,
                    }}
                    size="xl"
                    ring
                    animate
                  />
                </div>
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
              </StepShell>
            )}

            {step === 3 && (
              <StepShell
                title="Pick a header banner"
                subtitle="Make your profile page pop."
              >
                <label className="relative flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/50 transition hover:bg-muted">
                  {bannerPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={assetUrl(bannerPreview)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-sm">Click to upload banner</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setBannerFile(f);
                      setBannerPreview(URL.createObjectURL(f));
                    }}
                  />
                </label>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell
                title="What are you into?"
                subtitle="Pick at least one interest to personalize your feed."
              >
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((item) => {
                    const active = interests.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setInterests((prev) =>
                            active
                              ? prev.filter((i) => i !== item)
                              : [...prev, item]
                          )
                        }
                        className={cn(
                          "rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-glow"
                            : "border-border bg-card hover:border-primary/40 hover:bg-accent"
                        )}
                      >
                        {active ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </StepShell>
            )}

            {step === 5 && (
              <StepShell
                title="Suggested follows"
                subtitle="Follow a few people to kick off your feed. Skip if you want."
              >
                <div className="space-y-2">
                  {suggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No suggestions yet — you&apos;re an early Flux pioneer.
                    </p>
                  ) : (
                    suggestions.map((u) => {
                      const selected = selectedFollows.includes(u.uid);
                      return (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() =>
                            setSelectedFollows((prev) =>
                              selected
                                ? prev.filter((id) => id !== u.uid)
                                : [...prev, u.uid]
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                            selected
                              ? "border-primary bg-accent"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <UserAvatar user={u} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{u.displayName}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              @{u.username}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            {selected ? "Selected" : "Follow"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </StepShell>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0 || saving}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={!canContinue()}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving} className="min-w-[140px]">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enter Flux"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
