"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const immersive = /^\/(studio|live\/create|messages\/call)(\/|$)/.test(pathname);

  if (reducedMotion || immersive) {
    return <div className="flux-route-frame">{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      className="flux-route-frame"
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
