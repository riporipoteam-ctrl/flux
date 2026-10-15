"use client";

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Animate navigation without keying the entire app tree by pathname.
 * Re-keying the root can remount shells and feel like a page flash.
 * Only opacity changes, so fixed dialogs and menus are not repositioned.
 */
export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const controls = useAnimationControls();
  const lastPath = useRef(pathname);
  const immersive = /^\/(studio|live\/create|live\/view|messages\/call|games\/play)(\/|$)/.test(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (reducedMotion || immersive) {
      controls.set({ opacity: 1 });
      return;
    }

    controls.set({ opacity: 0.96 });
    void controls.start({
      opacity: 1,
      transition: { duration: 0.18, ease: [0.2, 0.75, 0.25, 1] },
    });
  }, [pathname, reducedMotion, immersive, controls]);

  return (
    <motion.div initial={false} animate={controls} className="flux-route-frame">
      {children}
    </motion.div>
  );
}
