"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The thin accent bar X runs across the top while a page is loading.
 *
 * The App Router gives no navigation-start event, so the bar is armed by the
 * click that begins the navigation and retired when the pathname settles.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      // Only same-tab, in-app navigations move the bar.
      if (!href || !href.startsWith("/") || (target && target !== "_self")) return;
      if (href === window.location.pathname) return;
      clearTimers();
      setDone(false);
      setActive(true);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    // The route has changed: run the bar out, then take it off the page.
    setDone(true);
    timers.current.push(
      window.setTimeout(() => {
        setActive(false);
        setDone(false);
      }, 320)
    );
    return clearTimers;
    // Intentionally keyed on the pathname — that is the completion signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;
  return <div className="flux8-route-progress" data-done={done ? "true" : undefined} aria-hidden />;
}
