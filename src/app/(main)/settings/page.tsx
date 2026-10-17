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
  Palette,
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
import { XHeader, XPage, XRow, XSectionTitle } from "@/components/x/x-ui";
import { formatCount } from "@/lib/utils";
import { profilePath } from "@/lib/routes";

const BACKGROUND_LABEL: Record<"light" | "dim" | "dark", string> = {
  light: "Light",
  dim: "Dim",
  dark: "Lights out",
};

export default function SettingsPage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { resolved, accent, toggleDark } = useTheme();
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
    <XPage className="flux-settings-page">
      <XHeader
        title="Settings & privacy"
        subtitle="A little more you. A little more control."
        hideOnMobile
      />
      {profile ? (
        <div className="flux-settings-identity">
          <UserAvatar
            user={profile}
            size="lg"
            decorations={profile.decorations}
            clickable={false}
          />
          <div>
            <h2>{profile.displayName}</h2>
            <p>@{profile.username}</p>
            <small>{profile.email}</small>
          </div>
          <span className="flux-settings-balance">
            <Coins size={17} />
            {formatCount(profile.coins || 0)}
            <small>Flux Coins</small>
          </span>
        </div>
      ) : null}
      <div className="flux-settings-sections">
        <section>
          <XSectionTitle>Your account</XSectionTitle>
          <XRow
            icon={User}
            title="Edit profile"
            description="Your photo, banner, and the things that make you, you."
            href="/settings/profile"
            trailing={<ChevronRight size={15} />}
          />
          <XRow
            icon={Users}
            title="Linked accounts"
            description="Switch between your accounts."
            href="/settings/accounts"
            trailing={<ChevronRight size={15} />}
          />
          {profile?.username ? (
            <XRow
              icon={User}
              title="Public profile"
              description={`See how @${profile.username} looks to everyone.`}
              href={profilePath(profile.username)}
              trailing={<ChevronRight size={15} />}
            />
          ) : null}
        </section>
        <section>
          <XSectionTitle>Make it yours</XSectionTitle>
          <XRow
            icon={Palette}
            title="Display & appearance"
            description={`${BACKGROUND_LABEL[resolved]} appearance · ${accent === "blue" ? "Flux green" : accent} accent`}
            href="/settings/display"
            trailing={<ChevronRight size={15} />}
          />
          <div className="x-row">
            <span className="x-row-icon">
              <Moon size={18} />
            </span>
            <span className="x-row-main">
              <strong>Dark appearance</strong>
              <span>A softer view after hours.</span>
            </span>
            <Switch
              checked={resolved === "dark"}
              onCheckedChange={onDarkToggle}
              aria-label="Dark appearance"
            />
          </div>
          <XRow
            icon={Crown}
            title="Your plan"
            description="Premium features and creator limits."
            href="/premium"
            trailing={<ChevronRight size={15} />}
          />
        </section>
        <section>
          <XSectionTitle>Your activity</XSectionTitle>
          <XRow
            icon={Activity}
            title="Activity history"
            description="Your likes, follows, and conversations."
            href="/activity"
            trailing={<ChevronRight size={15} />}
          />
          <XRow
            icon={Bookmark}
            title="Saved posts"
            description="The things you want to come back to."
            href="/bookmarks"
            trailing={<ChevronRight size={15} />}
          />
          <XRow
            icon={Bell}
            title="Notifications"
            description="Keep up with your people."
            href="/notifications"
            trailing={<ChevronRight size={15} />}
          />
        </section>
        <section>
          <XSectionTitle>Safety & support</XSectionTitle>
          <XRow
            icon={Shield}
            title="Privacy & safety"
            description="Community rules and reporting."
            href="/help"
            trailing={<ChevronRight size={15} />}
          />
          <XRow
            icon={HelpCircle}
            title="Help center"
            description="Find answers and get in touch."
            href="/help"
            trailing={<ChevronRight size={15} />}
          />
          <XRow
            icon={Gamepad2}
            title="Connected game account"
            description="Your Flux Rec account and photos."
            href="/flux-rec"
            trailing={<ChevronRight size={15} />}
          />
        </section>
      </div>
      <div className="flux-settings-signout">
        <span>
          <strong>Signed in to Flux</strong>
          <small>{profile?.email || user?.email}</small>
        </span>
        <button
          type="button"
          className="x-btn x-btn-hollow"
          onClick={() => void onSignOut()}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </XPage>
  );
}
