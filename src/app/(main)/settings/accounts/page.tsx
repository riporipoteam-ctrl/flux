"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  createLinkedAccount,
  ensureAccountLink,
  getLinkedProfiles,
  listLinkedPublicMembers,
  MAX_LINKED,
  switchLinkedAccount,
} from "@/services/linked-accounts";
import type { UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LinkedAccountsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [linked, setLinked] = useState<UserProfile[]>([]);
  const [members, setMembers] = useState<
    Array<{ uid: string; email: string; displayName: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await ensureAccountLink(user.uid);
      const profiles = await getLinkedProfiles(user.uid);
      setLinked(profiles as UserProfile[]);
      const p = profiles[0] as UserProfile | undefined;
      if (p?.accountLinkId) {
        setMembers(await listLinkedPublicMembers(p.accountLinkId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const create = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await createLinkedAccount({
        primaryUid: user.uid,
        email,
        password,
        displayName: displayName || email.split("@")[0],
      });
      toast.success("Linked account created — you are now on that account");
      setOpen(false);
      setEmail("");
      setPassword("");
      setDisplayName("");
      await refreshProfile();
      window.location.href = "/home";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  const doSwitch = async () => {
    if (!switchOpen || !password) return;
    setBusy(true);
    try {
      await switchLinkedAccount(switchOpen, password);
      toast.success("Switched account");
      window.location.href = "/home";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Switch failed");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="relative z-20 lg:sticky lg:top-0 lg:z-30 flex items-center gap-3 glass-strong border-b border-border px-4 py-3">
        <Link href="/settings" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-extrabold">Accounts</h1>
          <p className="text-xs text-muted-foreground">
            Link up to {MAX_LINKED} accounts · password required to switch
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-1 text-sm font-bold">Current</p>
              <div className="flex items-center gap-3">
                <UserAvatar user={profile} />
                <div>
                  <p className="font-bold">{profile?.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    @{profile?.username} · {profile?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="font-bold">
                <Users className="mr-1 inline h-4 w-4" />
                Linked ({linked.length}/{MAX_LINKED})
              </p>
              <Button
                size="sm"
                variant="sky"
                disabled={linked.length >= MAX_LINKED}
                onClick={() => setOpen(true)}
              >
                <Plus className="h-4 w-4" /> Add account
              </Button>
            </div>

            <ul className="space-y-2">
              {(members.length
                ? members
                : linked.map((l) => ({
                    uid: l.uid,
                    email: l.email,
                    displayName: l.displayName,
                  }))
              ).map((m) => (
                <li
                  key={m.uid}
                  className="flex items-center justify-between rounded-2xl border border-border px-3 py-3"
                >
                  <div>
                    <p className="font-semibold">{m.displayName}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {m.uid === user?.uid ? (
                    <span className="text-xs font-bold text-[#1d9bf0]">
                      Active
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSwitchOpen(m.email);
                        setPassword("");
                      }}
                    >
                      Switch
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            <p className="text-xs text-muted-foreground">
              Security: we never store passwords for linked accounts. Switching
              always requires the account password so others cannot access them.
            </p>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create linked account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Display name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />
            </div>
            <Button
              className="w-full"
              variant="sky"
              loading={busy}
              onClick={create}
              disabled={!email || password.length < 6}
            >
              Create & switch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!switchOpen} onOpenChange={() => setSwitchOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to {switchOpen}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Account password"
            />
            <Button
              className="w-full"
              variant="sky"
              loading={busy}
              onClick={doSwitch}
            >
              Switch account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
