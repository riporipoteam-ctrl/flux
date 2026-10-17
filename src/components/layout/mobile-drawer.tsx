"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  ChevronDown,
  HelpCircle,
  LogOut,
  Moon,
  Settings,
  Shield,
  Sun,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { fluxDestinations } from "@/lib/flux-navigation";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { cn, formatCount } from "@/lib/utils";
import { toast } from "sonner";
const visiblePaths = ["/groups", "/stories", "/live", "/create", "/flux-rec"];
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { resolved, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      onClose();
    } catch {
      toast.error("Couldn’t sign out. Try again.");
    } finally {
      setSigningOut(false);
    }
  };
  const renderItem = ({
    href,
    label,
    icon: Icon,
  }: (typeof fluxDestinations)[number]) => (
    <Link
      key={href}
      href={href}
      onClick={onClose}
      className={cn(
        "flux-drawer-link",
        isNavPathActive(pathname, href) && "is-active",
      )}
      aria-current={isNavPathActive(pathname, href) ? "page" : undefined}
    >
      <Icon size={22} />
      <span>{label}</span>
    </Link>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className="flux-navigation-drawer"
        id="flux-navigation-panel"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document
            .getElementById("flux-open-menu")
            ?.focus({ preventScroll: true });
        }}
      >
        <DialogTitle className="sr-only">Flux menu</DialogTitle>
        <DialogDescription className="sr-only">
          Your profile, communities, creator tools and account settings.
        </DialogDescription>
        <header className="flux-drawer-brand">
          <Logo size={36} onClick={onClose} />
        </header>
        <div className="flux-drawer-scroll">
          <Link
            href={profilePath(profile?.username)}
            onClick={onClose}
            className="flux-drawer-identity"
          >
            <UserAvatar
              user={profile}
              size="lg"
              clickable={false}
              decorations={profile?.decorations}
            />
            <strong>{profile?.displayName || "Your profile"}</strong>
            <span>@{profile?.username || "flux"}</span>
            <p>
              <b>{formatCount(profile?.followingCount || 0)}</b> following{" "}
              <b>{formatCount(profile?.followersCount || 0)}</b> followers
            </p>
          </Link>
          <nav aria-label="More destinations">
            <Link
              href="/bookmarks"
              onClick={onClose}
              className="flux-drawer-link"
            >
              <Bookmark size={22} />
              <span>Bookmarks</span>
            </Link>
            {fluxDestinations
              .filter((item) => visiblePaths.includes(item.href))
              .map(renderItem)}
            <details className="flux-drawer-more">
              <summary>
                More on Flux <ChevronDown size={18} />
              </summary>
              {fluxDestinations
                .filter(
                  (item) =>
                    !visiblePaths.includes(item.href) &&
                    !["/settings", "/help"].includes(item.href),
                )
                .map(renderItem)}
              {profile?.isAdmin ? (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flux-drawer-link"
                >
                  <Shield size={22} />
                  <span>Admin controls</span>
                </Link>
              ) : null}
            </details>
          </nav>
          <div className="flux-drawer-utilities">
            <Link href="/settings" onClick={onClose}>
              <Settings size={20} />
              Settings & privacy
            </Link>
            <Link href="/help" onClick={onClose}>
              <HelpCircle size={20} />
              Help center
            </Link>
            <button
              type="button"
              onClick={() => setTheme(resolved === "light" ? "dark" : "light")}
              aria-label="Dark appearance"
              role="switch"
              aria-checked={resolved !== "light"}
            >
              {resolved === "light" ? <Moon size={20} /> : <Sun size={20} />}
              Dark appearance
              <span
                className="flux-theme-switch"
                data-on={resolved !== "light"}
              />
            </button>
          </div>
        </div>
        <footer className="flux-drawer-footer">
          <button
            type="button"
            onClick={() => void logout()}
            disabled={signingOut}
          >
            <LogOut size={18} />
            {signingOut ? "Logging out…" : "Log out"}
          </button>
          <span>Flux by Ripo Team</span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
