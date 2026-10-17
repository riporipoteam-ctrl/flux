"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Moon, Search, Sun } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { profilePath } from "@/lib/routes";

export function AppMasthead() {
  const router = useRouter();
  const { profile } = useAuth();
  const { resolved, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  return (
    <header className="flux-masthead">
      <div className="flux-masthead-inner">
        <Link
          href="/home"
          className="flux-masthead-brand"
          aria-label="Flux home"
        >
          <span className="flux-brand-symbol" aria-hidden="true">
            f<span />
          </span>
          <strong>
            flux<span>social</span>
          </strong>
        </Link>
        <form
          role="search"
          className="flux-global-search"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim())
              router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search Flux"
            placeholder="Search people, posts, and conversations"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span aria-hidden="true">Explore</span>
        </form>
        <div className="flux-masthead-actions">
          <Link href="/create" className="flux-masthead-create">
            Create something <ArrowUpRight size={16} />
          </Link>
          <button
            type="button"
            className="flux-icon-button"
            aria-label={
              resolved === "light"
                ? "Use dark appearance"
                : "Use light appearance"
            }
            onClick={() => setTheme(resolved === "light" ? "dark" : "light")}
          >
            {resolved === "light" ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <Link
            href={profilePath(profile?.username)}
            aria-label="Open your profile"
            className="flux-masthead-account"
          >
            <UserAvatar user={profile} clickable={false} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
