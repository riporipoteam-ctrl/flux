"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { claimUsername, isUsernameAvailable, updateUserProfile } from "@/services/users";
import { uploadAvatar, uploadBanner } from "@/services/media";
import { MAX_BIO_LENGTH } from "@/lib/constants";
import { formatUsername } from "@/lib/utils";
import { assetUrl } from "@/lib/asset-url";
import { profilePath } from "@/lib/routes";

export default function EditProfilePage() {
  const { user, profile, refreshProfile, updateProfileOptimistic } = useAuth();
  const router = useRouter();
  const bannerBlobRef = useRef<string | null>(null);
  const avatarBlobRef = useRef<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [xLink, setXLink] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [businessName, setBusinessName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState("Ready");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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
    setAccountType(profile.accountType === "business" ? "business" : "personal");
    setBusinessName(profile.businessName || "");
    setIsPrivate(profile.isPrivate ?? false);
    setAvatarPreview(profile.avatarUrl);
    setBannerPreview(profile.bannerUrl);
  }, [profile]);

  useEffect(() => () => {
    if (avatarBlobRef.current) URL.revokeObjectURL(avatarBlobRef.current);
    if (bannerBlobRef.current) URL.revokeObjectURL(bannerBlobRef.current);
  }, []);

  const setLocalFile = (kind: "avatar" | "banner", file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (file.size > 30 * 1024 * 1024) return toast.error("Image must be under 30 MB before compression.");
    const url = URL.createObjectURL(file);
    if (kind === "avatar") {
      if (avatarBlobRef.current) URL.revokeObjectURL(avatarBlobRef.current);
      avatarBlobRef.current = url;
      setAvatarFile(file);
      setAvatarPreview(url);
    } else {
      if (bannerBlobRef.current) URL.revokeObjectURL(bannerBlobRef.current);
      bannerBlobRef.current = url;
      setBannerFile(file);
      setBannerPreview(url);
    }
  };

  const save = async () => {
    if (!user || !profile || saving) return;
    setSaving(true);
    setUploadProgress(null);
    const warnings: string[] = [];

    try {
      const nextUsername = formatUsername(username);
      if (nextUsername !== profile.username) {
        setSaveStage("Checking username…");
        const available = await isUsernameAvailable(nextUsername);
        if (!available) throw new Error("Username is taken");
        await claimUsername(user.uid, nextUsername);
      }

      let avatarUrl = profile.avatarUrl || "/avatars/fox.png";
      let bannerUrl = profile.bannerUrl ?? null;

      if (avatarFile) {
        setSaveStage("Compressing and uploading avatar…");
        try {
          avatarUrl = await uploadAvatar(user.uid, avatarFile, setUploadProgress);
        } catch (error) {
          warnings.push(`Avatar: ${error instanceof Error ? error.message : "upload failed"}`);
        }
      }

      if (bannerFile) {
        setSaveStage("Compressing and uploading banner…");
        setUploadProgress(0);
        try {
          bannerUrl = await uploadBanner(user.uid, bannerFile, setUploadProgress);
        } catch (error) {
          warnings.push(`Banner: ${error instanceof Error ? error.message : "upload failed"}`);
        }
      }

      const patch = {
        displayName: displayName.trim() || profile.displayName || "Flux User",
        bio: bio.trim().slice(0, MAX_BIO_LENGTH),
        location: location.trim() || null,
        website: website.trim() || null,
        avatarUrl,
        bannerUrl,
        accountType,
        businessName: accountType === "business" ? businessName.trim() || displayName.trim() : null,
        isPrivate,
        socialLinks: {
          instagram: instagram.trim(),
          tiktok: tiktok.trim(),
          youtube: youtube.trim(),
          x: xLink.trim(),
          website: website.trim(),
        },
      } as const;

      setSaveStage("Saving profile…");
      updateProfileOptimistic(patch);
      await updateUserProfile(user.uid, {
        ...patch,
        ...(accountType === "business"
          ? { isVerified: true, verifiedType: "business" as const }
          : profile.verifiedType === "business"
            ? { verifiedType: "flux" as const }
            : {}),
      });
      await refreshProfile().catch(() => undefined);

      setAvatarFile(null);
      setBannerFile(null);
      setSaveStage("Saved");
      setUploadProgress(100);
      if (warnings.length) {
        toast.warning(`Profile text saved. ${warnings.join(" · ")}`);
      } else {
        toast.success("Profile updated everywhere");
      }
      router.push(nextUsername ? profilePath(nextUsername) : "/home");
    } catch (error) {
      console.error(error);
      setSaveStage("Could not save");
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
      window.setTimeout(() => setUploadProgress(null), 1200);
    }
  };

  if (!profile) {
    return <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /><p className="mt-3 text-sm text-muted-foreground">Opening profile settings…</p></div></div>;
  }

  return (
    <main className="min-h-screen pb-24">
      <header className="x-header sticky top-0 z-30 justify-between bg-background/92 backdrop-blur-xl">
        <div className="flex items-center gap-3"><Link href="/settings" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="text-lg font-bold">Edit profile</h1><p className="text-xs text-muted-foreground">Your identity updates across Flux</p></div></div>
        <Button onClick={() => void save()} disabled={saving} className="min-w-[104px] rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saving" : "Save"}</Button>
      </header>

      <section className="border-b border-border bg-card">
        <div className="relative aspect-[3/1] min-h-36 overflow-hidden bg-muted">
          {bannerPreview ? <img src={bannerPreview.startsWith("blob:") ? bannerPreview : assetUrl(bannerPreview)} alt="Profile banner preview" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-[linear-gradient(135deg,var(--v8-panel-3),var(--v8-accent-soft))]"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>}
          <label className="absolute bottom-3 right-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs font-bold text-white backdrop-blur hover:bg-black"><Camera className="h-4 w-4" />Change banner<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) setLocalFile("banner", file); event.currentTarget.value = ""; }} /></label>
        </div>
        <div className="relative mx-auto max-w-2xl px-4 pb-5">
          <div className="-mt-14 flex items-end justify-between gap-4"><UserAvatar user={{ ...profile, displayName, username, avatarUrl: avatarPreview }} size="xl" className="h-28 w-28 ring-4 ring-background" clickable={false} /><span className="mb-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">Images are cropped and compressed automatically</span></div>
        </div>
      </section>

      {(saving || uploadProgress !== null) ? <div className="sticky top-[53px] z-20 border-b border-border bg-background px-4 py-3"><div className="mx-auto max-w-2xl"><div className="flex items-center justify-between text-xs"><span className="font-semibold">{saveStage}</span><span className="text-muted-foreground">{uploadProgress !== null ? `${uploadProgress}%` : ""}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${uploadProgress ?? (saving ? 12 : 100)}%` }} /></div></div></div> : null}

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <SettingsCard icon={UserRound} title="Profile photo" description="Upload a photo or choose a Flux avatar."><AvatarPicker value={avatarPreview} onChange={(url) => { setAvatarFile(null); setAvatarPreview(url); }} onUpload={(file) => setLocalFile("avatar", file)} /></SettingsCard>

        <SettingsCard icon={ShieldCheck} title="Account" description="Control your account type and privacy."><div className="grid grid-cols-2 gap-2"><ChoiceButton active={accountType === "personal"} onClick={() => setAccountType("personal")}>Personal</ChoiceButton><ChoiceButton active={accountType === "business"} onClick={() => setAccountType("business")}>Business</ChoiceButton></div>{accountType === "business" ? <Field label="Business name"><Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Brand or company" /></Field> : null}<div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-3"><div><strong className="text-sm">Private account</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">Only approved followers can see your activity.</p></div><Switch checked={isPrivate} onCheckedChange={setIsPrivate} /></div></SettingsCard>

        <SettingsCard title="Public profile" description="What people see when they open your profile."><Field label="Display name"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 50))} /></Field><Field label="Username"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span><Input value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))} className="pl-8" /></div></Field><Field label="Bio"><Textarea value={bio} onChange={(event) => setBio(event.target.value.slice(0, MAX_BIO_LENGTH))} rows={4} /><p className="mt-1 text-right text-[11px] text-muted-foreground">{bio.length}/{MAX_BIO_LENGTH}</p></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Location"><Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, country" /></Field><Field label="Website"><Input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" /></Field></div></SettingsCard>

        <SettingsCard title="Social links" description="Usernames or full profile URLs."><Field label="Instagram"><Input value={instagram} onChange={(event) => setInstagram(event.target.value)} /></Field><Field label="TikTok"><Input value={tiktok} onChange={(event) => setTiktok(event.target.value)} /></Field><Field label="YouTube"><Input value={youtube} onChange={(event) => setYoutube(event.target.value)} /></Field><Field label="X / Twitter"><Input value={xLink} onChange={(event) => setXLink(event.target.value)} /></Field></SettingsCard>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><div><strong className="text-sm">Firebase profile sync</strong><p className="text-xs text-muted-foreground">Avatar and banner URLs update across Flux after Save.</p></div></div><Button onClick={() => void save()} disabled={saving} className="rounded-full">Save changes</Button></div>
      </div>
    </main>
  );
}

function SettingsCard({ icon: Icon, title, description, children }: { icon?: typeof UserRound; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><header className="mb-4 flex items-start gap-3">{Icon ? <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span> : null}<div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></header><div className="space-y-4">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "rounded-xl border border-primary bg-primary px-4 py-3 text-sm font-bold text-white" : "rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-muted"}>{children}</button>;
}
