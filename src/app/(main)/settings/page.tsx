"use client";

import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Bookmark,
  ChevronRight,
  Coins,
  Crown,
  Gamepad2,
  HelpCircle,
  LogOut,
  Moon,
  Settings as SettingsIcon,
  Shield,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { Switch } from "@/components/ui/switch";
import { updateUserProfile } from "@/services/users";
import { UserAvatar } from "@/components/shared/user-avatar";
import { XCard, XHeader, XPage, XRow, XSectionTitle } from "@/components/x/x-ui";
import { formatCount } from "@/lib/utils";
import { profilePath } from "@/lib/routes";

export default function SettingsPage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { resolved, toggleDark } = useTheme();
  const router = useRouter();

  const onDarkToggle = async (enabled: boolean) => {
    toggleDark(enabled);
    if (user) {
      try {
        await updateUserProfile(user.uid, { settings: { theme: enabled ? "dark" : "light" } });
        await refreshProfile();
      } catch {
        /* the local theme still applies even if the write fails */
      }
    }
    toast.success(enabled ? "Dark mode on" : "Light mode on");
  };

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <XPage>
      <XHeader title="Settings" subtitle="Your account and appearance" icon={SettingsIcon} hideOnMobile />

      {profile ? (
        <div className="p-4">
          <XCard className="flex items-center gap-3 p-4">
            <UserAvatar user={profile} decorations={profile.decorations} clickable={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{profile.displayName}</p>
              <p className="truncate text-[13px] text-[var(--v8-muted)]">@{profile.username}</p>
            </div>
            <span className="flex flex-none items-center gap-1.5 rounded-full bg-[var(--v8-panel-3)] px-3 py-1.5 text-[13px] font-black">
              <Coins className="h-3.5 w-3.5 text-[var(--v8-orange)]" />
              {formatCount(profile.coins ?? 0)}
            </span>
          </XCard>
        </div>
      ) : null}

      <XSectionTitle>Appearance</XSectionTitle>
      <div className="x-row">
        <span className="x-row-icon">
          <Moon className="h-[18px] w-[18px]" />
        </span>
        <span className="x-row-main">
          <strong>Dark mode</strong>
          <span>Light is the default. Flip it whenever.</span>
        </span>
        <Switch checked={resolved === "dark"} onCheckedChange={onDarkToggle} aria-label="Toggle dark mode" />
      </div>

      <XSectionTitle>Your account</XSectionTitle>
      <XRow icon={User} title="Edit profile" description="Avatar, banner, bio, business account" href="/settings/profile" trailing={<ChevronRight className="h-4 w-4" />} />
      <XRow icon={Users} title="Linked accounts" description="Link up to 5 accounts and switch securely" href="/settings/accounts" trailing={<ChevronRight className="h-4 w-4" />} />
      {profile?.username ? (
        <XRow icon={User} title="View public profile" description={`@${profile.username}`} href={profilePath(profile.username)} trailing={<ChevronRight className="h-4 w-4" />} />
      ) : null}

      <XSectionTitle>Content</XSectionTitle>
      <XRow icon={Activity} title="Activity history" description="Likes, follows and replies timeline" href="/activity" trailing={<ChevronRight className="h-4 w-4" />} />
      <XRow icon={Bookmark} title="Bookmarks" description="Posts you saved for later" href="/bookmarks" trailing={<ChevronRight className="h-4 w-4" />} />
      <XRow icon={Bell} title="Notifications" description="Alerts and mentions" href="/notifications" trailing={<ChevronRight className="h-4 w-4" />} />
      <XRow icon={Gamepad2} title="Games" description="Flux Farm and the rest of the arcade" href="/games" trailing={<ChevronRight className="h-4 w-4" />} />

      <XSectionTitle>Support</XSectionTitle>
      <XRow icon={Crown} title="Flux Premium" description="Plans, multipliers and creator tools" href="/premium" trailing={<ChevronRight className="h-4 w-4" />} />
      <XRow icon={Shield} title="Privacy and safety" description="Report content from the ··· menu on any post" href="/help" trailing={<ChevronRight className="h-4 w-4" />} />
      <XRow icon={HelpCircle} title="Help centre" description="Rules, FAQ and human support" href="/help" trailing={<ChevronRight className="h-4 w-4" />} />

      <div className="p-4">
        <XCard className="p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--v8-muted)]">Signed in as</p>
          <p className="mt-2 text-sm">{profile?.email || user?.email}</p>
          <button type="button" className="x-btn x-btn-hollow x-btn-block mt-4 !text-[var(--v8-red)]" onClick={() => void onSignOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </XCard>
      </div>
    </XPage>
  );
}
