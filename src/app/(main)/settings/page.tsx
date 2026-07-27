"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  LogOut,
  Moon,
  Shield,
  User,
  Palette,
  Activity,
  Bookmark,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { updateUserProfile } from "@/services/users";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { resolved, toggleDark } = useTheme();
  const router = useRouter();

  const onDarkToggle = async (enabled: boolean) => {
    toggleDark(enabled);
    if (user) {
      try {
        await updateUserProfile(user.uid, {
          settings: { theme: enabled ? "dark" : "light" },
        });
        await refreshProfile();
      } catch {
        /* local theme still works */
      }
    }
    toast.success(enabled ? "Dark mode on" : "Light mode on");
  };

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass-strong border-b border-border/70 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">Settings</h1>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 p-4"
      >
        {/* Appearance — dark mode switch lives here */}
        <section className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-primary" />
            Appearance
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm">
                <Moon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">
                  Light is the default. Toggle dark mode here.
                </p>
              </div>
            </div>
            <Switch
              checked={resolved === "dark"}
              onCheckedChange={onDarkToggle}
              aria-label="Toggle dark mode"
            />
          </div>
        </section>

        <section className="surface-card overflow-hidden">
          <SettingsLink
            href="/settings/profile"
            icon={User}
            title="Edit profile"
            description="Avatars, banner, bio, business account"
          />
          <Separator />
          <SettingsLink
            href="/settings/accounts"
            icon={Users}
            title="Accounts"
            description="Link up to 5 accounts & switch securely"
          />
          <Separator />
          <SettingsLink
            href="/activity"
            icon={Activity}
            title="Activity history"
            description="Likes, follows, replies timeline"
          />
          <Separator />
          <SettingsLink
            href="/bookmarks"
            icon={Bookmark}
            title="Bookmarks"
            description="Posts you saved"
          />
          <Separator />
          <SettingsLink
            href="/notifications"
            icon={Bell}
            title="Notifications"
            description="Alerts and mentions"
          />
          <Separator />
          <SettingsRow
            icon={Shield}
            title="Privacy & safety"
            description="Report posts from the ··· menu on any post"
          />
        </section>

        <section className="surface-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Account
          </p>
          <p className="mt-2 text-sm">{profile?.email || user?.email}</p>
          <p className="text-sm text-muted-foreground">
            @{profile?.username} · {profile?.coins ?? 0} Flux Coins
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full text-destructive hover:bg-destructive/10"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </section>
      </motion.div>
    </div>
  );
}

function SettingsLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof User;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  description,
  trailing,
}: {
  icon: typeof User;
  title: string;
  description: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {trailing}
    </div>
  );
}
