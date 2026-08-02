"use client";

/**
 * Shared X-style page primitives.
 *
 * Every screen outside the timeline is built from these so headers, tabs,
 * rows, cards and empty states stay identical across the app and across
 * phone / tablet / desktop. Presentation lives in styles/flux-v8.css; this
 * file only owns structure, behaviour and motion.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Page shell                                                                  */
/* -------------------------------------------------------------------------- */

export function XPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <main className={cn("x-page", className)}>{children}</main>;
}

/**
 * Sticky page header. Mirrors X: back arrow (optional), stacked title and
 * subtitle, trailing actions. Hidden titles on phones are handled by the
 * global mobile header, so `hideOnMobile` collapses it when it would double up.
 */
export function XHeader({
  title,
  subtitle,
  back,
  backHref,
  icon: Icon,
  actions,
  hideOnMobile,
  className,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  backHref?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  hideOnMobile?: boolean;
  className?: string;
}) {
  const router = useRouter();

  return (
    <header className={cn("x-header", hideOnMobile && "hidden lg:flex", className)}>
      {back ? (
        <button
          type="button"
          className="x-header-action"
          aria-label="Go back"
          onClick={() => (backHref ? router.push(backHref) : router.back())}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}

      {Icon && !back ? (
        <span className="x-header-action" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
      ) : null}

      <div className="x-header-titles">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      {actions ? <div className="flex flex-none items-center gap-1">{actions}</div> : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

export type XTabItem<T extends string> = { id: T; label: string; count?: number };

/**
 * Sticky tab strip with a shared-layout underline. The indicator animates
 * between tabs via `layoutId` so switching feels physical rather than binary.
 */
export function XTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  scrollable,
}: {
  tabs: ReadonlyArray<XTabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
  scrollable?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn("x-tabs", className)}
      role="tablist"
      aria-orientation="horizontal"
      style={scrollable ? undefined : { display: "grid", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn("x-tab", active && "is-active")}
          >
            <span className="relative flex items-center gap-1.5 py-4">
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 ? (
                <em className="not-italic rounded-full bg-[var(--v8-panel-3)] px-1.5 py-0.5 text-[11px] font-bold">
                  {tab.count > 99 ? "99+" : tab.count}
                </em>
              ) : null}
              {active && !reduce ? (
                <motion.span
                  layoutId="x-tab-underline"
                  className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-full bg-[var(--v8-accent)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function XCard({
  children,
  className,
  interactive,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div className={cn("x-card", interactive && "x-card-interactive", className)} {...rest}>
      {children}
    </div>
  );
}

export function XSectionTitle({ children, meta }: { children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <h2 className="x-section-title">
      {children}
      {meta ? <span className="ml-auto">{meta}</span> : null}
    </h2>
  );
}

/** Full-bleed navigation/settings row. Renders as a link when `href` is set. */
export function XRow({
  icon: Icon,
  title,
  description,
  trailing,
  href,
  onClick,
  className,
  tone,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  tone?: "default" | "danger";
}) {
  const body = (
    <>
      {Icon ? (
        <span className="x-row-icon" style={tone === "danger" ? { background: "var(--v8-red-soft)", color: "var(--v8-red)" } : undefined}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      ) : null}
      <span className="x-row-main">
        <strong style={tone === "danger" ? { color: "var(--v8-red)" } : undefined}>{title}</strong>
        {description ? <span>{description}</span> : null}
      </span>
      {trailing ? <span className="flex flex-none items-center gap-2 text-[var(--v8-muted)]">{trailing}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("x-row", className)}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn("x-row", className)}>
      {body}
    </button>
  );
}

export function XStat({
  icon: Icon,
  label,
  value,
  tone = "var(--v8-accent)",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="x-stat">
      <Icon className="h-[18px] w-[18px]" style={{ color: tone }} />
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

export function XHero({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="x-hero">
      {eyebrow ? (
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--v8-accent)]">{eyebrow}</p>
      ) : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="x-hero-actions">{actions}</div> : null}
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */

export function XEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="x-empty">
      <div>
        <div className="x-empty-icon mx-auto">
          <Icon className="h-7 w-7" />
        </div>
        <h3>{title}</h3>
        {description ? <p className="mx-auto">{description}</p> : null}
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function XRowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-3 border-b border-[var(--v8-line)] px-4 py-4">
          <div className="x-skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="x-skeleton h-3.5 w-1/3 rounded" />
            <div className="x-skeleton h-3.5 w-full rounded" />
            <div className="x-skeleton h-3.5 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function XCardSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="x-card p-4">
          <div className="x-skeleton h-24 w-full rounded-xl" />
          <div className="x-skeleton mt-4 h-4 w-2/3 rounded" />
          <div className="x-skeleton mt-2 h-3 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Motion helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Fades and lifts content in once it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container for lists. Children should be `<RevealItem>`. */
export function RevealList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Crossfades tab panels without shifting layout. */
export function XSwitch({ id, children }: { id: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
