"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Plus, Users, Lock, Globe, Camera, ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createGroup, getGroups } from "@/services/groups";
import { uploadImage } from "@/services/media";
import type { Group } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileHeader } from "@/components/layout/mobile-header";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { assetUrl } from "@/lib/asset-url";

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState(
    "1. Be respectful\n2. No spam\n3. Stay on topic"
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPrev, setAvatarPrev] = useState<string | null>(null);
  const [bannerPrev, setBannerPrev] = useState<string | null>(null);
  const [extraRank, setExtraRank] = useState("");

  useEffect(() => {
    getGroups()
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  const reset = () => {
    setStep(0);
    setName("");
    setDescription("");
    setRules("1. Be respectful\n2. No spam\n3. Stay on topic");
    setIsPrivate(false);
    setAvatarFile(null);
    setBannerFile(null);
    setAvatarPrev(null);
    setBannerPrev(null);
    setExtraRank("");
  };

  const onCreate = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      let avatarUrl: string | null = null;
      let bannerUrl: string | null = null;
      if (avatarFile) {
        avatarUrl = await uploadImage(
          `groups/${user.uid}/avatar-${Date.now()}`,
          avatarFile
        );
      }
      if (bannerFile) {
        bannerUrl = await uploadImage(
          `groups/${user.uid}/banner-${Date.now()}`,
          bannerFile
        );
      }
      const id = await createGroup({
        ownerId: user.uid,
        name: name.trim(),
        description,
        isPrivate,
        avatarUrl,
        bannerUrl,
        rules,
        extraRanks: extraRank.trim()
          ? [{ name: extraRank.trim(), color: "#1d9bf0" }]
          : [],
      });
      toast.success("Group created");
      setOpen(false);
      reset();
      router.push(`/groups/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between glass-strong border-b border-border px-3 py-2.5 sm:px-4">
        <div className="lg:hidden">
          <MobileHeader title="Groups" />
        </div>
        <h1 className="hidden text-xl font-extrabold lg:block">Groups</h1>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="sky">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Create group · Step {step + 1}/3
              </DialogTitle>
            </DialogHeader>

            {step === 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">Private</p>
                    <p className="text-xs text-muted-foreground">
                      Only members see the feed
                    </p>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>
                <Button
                  className="w-full"
                  variant="sky"
                  disabled={!name.trim()}
                  onClick={() => setStep(1)}
                >
                  Next: branding
                </Button>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <label className="relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40">
                  {bannerPrev ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetUrl(bannerPrev)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="h-4 w-4" /> Banner
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setBannerFile(f);
                      setBannerPrev(URL.createObjectURL(f));
                    }}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border p-3 hover:bg-muted/40">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-muted">
                    {avatarPrev ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(avatarPrev)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Group photo</p>
                    <p className="text-xs text-muted-foreground">Optional avatar</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setAvatarFile(f);
                      setAvatarPrev(URL.createObjectURL(f));
                    }}
                  />
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button className="flex-1" variant="sky" onClick={() => setStep(2)}>
                    Next: rules
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Community rules</Label>
                  <Textarea
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra custom rank (optional)</Label>
                  <Input
                    value={extraRank}
                    onChange={(e) => setExtraRank(e.target.value)}
                    placeholder="e.g. VIP, Contributor"
                  />
                  <p className="text-xs text-muted-foreground">
                    Owner, Moderator, and Member ranks are created automatically.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    variant="sky"
                    loading={creating}
                    onClick={onCreate}
                  >
                    Create group
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#1d9bf0]" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create a community with banner, rules, and ranks."
        />
      ) : (
        <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-border">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="flex items-start gap-3 px-4 py-4 transition hover:bg-muted/40"
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-muted text-lg font-bold">
                  {g.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetUrl(g.avatarUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    g.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{g.name}</p>
                    {g.isPrivate ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {g.description || "No description"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {g.memberCount} members
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
