"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [lightweight, setLightweight] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px), (pointer: coarse), (prefers-reduced-motion: reduce)");
    const sync = () => setLightweight(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const immersive = /^\/(studio|live\/create|live\/view|messages\/call|games\/play)(\/|$)/.test(pathname);
  if (reducedMotion || lightweight || immersive) return <div className="flux-route-frame">{children}</div>;

  return (
    <motion.div
      key={pathname}
      className="flux-route-frame"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
