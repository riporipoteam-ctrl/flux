import type { SVGProps } from "react";
export type NavIconName =
  | "home"
  | "explore"
  | "notifications"
  | "messages"
  | "bookmarks"
  | "profile"
  | "communities"
  | "more"
  | "menu"
  | "create";
export function NavIcon({
  name,
  active = false,
  ...props
}: SVGProps<SVGSVGElement> & { name: NavIconName; active?: boolean }) {
  const solid = active ? "currentColor" : "none";
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {name === "home" ? (
        <path
          fill={solid}
          fillRule="evenodd"
          d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"
        />
      ) : null}
      {name === "explore" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path fill={solid} d="m16 8-2.5 5.5L8 16l2.5-5.5z" />
        </>
      ) : null}
      {name === "notifications" ? (
        <>
          <path
            fill={solid}
            d="M5 16c1-2 1-4 1-6a6 6 0 0 1 12 0c0 2 0 4 1 6l1 2H4z"
          />
          <path d="M10 21h4" />
        </>
      ) : null}
      {name === "messages" ? (
        <>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="3"
            fill={active ? "currentColor" : "none"}
          />
          <path
            d="m4 7 8 6 8-6"
            stroke={active ? "var(--p-surface)" : "currentColor"}
          />
        </>
      ) : null}
      {name === "bookmarks" ? (
        <path fill={solid} d="M6 4h12v17l-6-4-6 4z" />
      ) : null}
      {name === "profile" ? (
        <>
          <circle cx="12" cy="8" r="4" fill={solid} />
          <path fill={solid} d="M4 21v-2a8 6 0 0 1 16 0v2z" />
        </>
      ) : null}
      {name === "communities" ? (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2 20v-2a7 5 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8m2 3a5 4 0 0 1 3 4v1" />
        </>
      ) : null}
      {name === "more" ? (
        <>
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <circle cx="19" cy="12" r="1.2" fill="currentColor" />
        </>
      ) : null}
      {name === "menu" ? (
        <>
          <path d="M4 6h16M4 12h12M4 18h16" />
        </>
      ) : null}
      {name === "create" ? <path d="M12 4v16M4 12h16" /> : null}
    </svg>
  );
}
