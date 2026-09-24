"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Mouse-tracking radial glow, same effect as the spotlight-over-a-dark-card
 * pattern (react-spline/spotlight demos use framer-motion for this) — built
 * natively here since this project doesn't use Tailwind/framer-motion (see
 * this component's call site). Just two CSS custom properties updated on
 * pointer move; the actual glow is a plain radial-gradient in CSS, so there
 * is no dependency to add for it.
 */
export function HeroSpotlight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--my", `${e.clientY - rect.top}px`);
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="hero-stage">
      <div className="hero-spotlight" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow-lime" aria-hidden="true" />
      {children}
    </div>
  );
}
