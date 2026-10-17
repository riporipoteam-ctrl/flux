"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Crown,
  Gamepad2,
  Gift,
  Headphones,
  Images,
  Radio,
  Shield,
  Sticker,
  Users,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { XPage, XRow, XSectionTitle } from "@/components/x/x-ui";

const creatorTools = [
  {
    href: "/studio",
    title: "Flux Studio",
    eyebrow: "Games + websites",
    description:
      "Generate, code, preview and publish interactive browser projects on phones, tablets and desktops.",
    icon: Boxes,
    accent: "from-violet-500 to-indigo-700",
    wide: true,
  },
  {
    href: "/stories/create",
    title: "Story Studio",
    eyebrow: "24-hour canvas",
    description:
      "Create photo, video and text Stories with draggable stickers and 130 public-domain tracks.",
    icon: Images,
    accent: "from-fuchsia-500 to-rose-600",
  },
  {
    href: "/live/create",
    title: "Go Live",
    eyebrow: "Camera + screen",
    description:
      "Broadcast your camera, microphone or screen with screen audio and live analytics.",
    icon: Radio,
    accent: "from-red-500 to-orange-600",
  },
  {
    href: "/studio/music",
    title: "Audio Library",
    eyebrow: "130 CC0 tracks",
    description: "Preview real MP3 music and attach it to a Studio project.",
    icon: Headphones,
    accent: "from-cyan-500 to-blue-700",
  },
  {
    href: "/ask-ai",
    title: "AskAI Create",
    eyebrow: "Prompt to project",
    description:
      "Create games, websites, agents and your one owned Flux group from a conversation.",
    icon: WandSparkles,
    accent: "from-emerald-500 to-teal-700",
    wide: true,
  },
  {
    href: "/stickers",
    title: "Sticker Lab",
    eyebrow: "Static + animated",
    description:
      "Basic and Premium creators can publish reusable PNG, WebP and GIF stickers.",
    icon: Sticker,
    accent: "from-amber-400 to-orange-600",
  },
  {
    href: "/gifts",
    title: "Gift Studio",
    eyebrow: "Animated support",
    description:
      "Send animated Flux gifts to users and creators using Flux Coins.",
    icon: Gift,
    accent: "from-pink-500 to-violet-700",
  },
  {
    href: "/groups",
    title: "Create a Group",
    eyebrow: "Community space",
    description:
      "Build and manage your Flux community. Each user can own one group.",
    icon: Users,
    accent: "from-sky-500 to-cyan-700",
  },
];

const destinations = [
  {
    href: "/flux-rec",
    label: "Flux Rec",
    icon: Gamepad2,
    description: "Rooms, photos and your game account",
  },
  {
    href: "/stories",
    label: "Stories",
    icon: Images,
    description: "Watch active Stories and view analytics",
  },
  {
    href: "/live",
    label: "Live",
    icon: Radio,
    description: "Discover broadcasts happening now",
  },
  {
    href: "/premium",
    label: "Premium",
    icon: Crown,
    description: "Unlock creator limits, rewards and verification",
  },
];

export default function CreatePage() {
  const { profile } = useAuth();
  return (
    <XPage>
      <div className="flux-create-intro">
        <span>Your creator workspace</span>
        <h1>What will you make next?</h1>
        <p>
          A post, a new community, a live moment. Pick a starting point and make
          it yours.
        </p>
        <Link href="/home" className="x-btn mt-5">
          Write a post <ArrowRight size={15} />
        </Link>
      </div>
      <div className="flux-create-grid">
        {creatorTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} href={tool.href} className="flux-create-tool">
              <Icon />
              <small>{tool.eyebrow}</small>
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <span>
                Open tool <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </div>
      <div className="flux-create-access">
        <Crown size={24} />
        <span>
          <strong>Your {profile?.planTier || "free"} creator plan</strong>
          <small>See your available tools and account limits.</small>
        </span>
        <Link href="/premium" className="x-btn x-btn-outline">
          View plans <ArrowRight size={14} />
        </Link>
      </div>
      <XSectionTitle>Keep exploring</XSectionTitle>
      {destinations.map(({ href, label, icon, description }) => (
        <XRow
          key={href}
          href={href}
          icon={icon}
          title={label}
          description={description}
          trailing={<ArrowRight size={16} />}
        />
      ))}
      {profile?.isAdmin ? (
        <XRow
          href="/admin"
          icon={Shield}
          title="Platform controls"
          description="Manage and moderate Flux."
          trailing={<ArrowRight size={16} />}
        />
      ) : null}
    </XPage>
  );
}
