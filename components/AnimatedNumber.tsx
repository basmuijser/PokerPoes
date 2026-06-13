"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  className?: string;
  duration?: number;
  format?: (n: number) => string;
}

export default function AnimatedNumber({
  value,
  className,
  duration = 450,
  format,
}: Props) {
  const [display, setDisplay] = useState(value);
  const [pulse, setPulse] = useState(false);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (display === value) return;
    fromRef.current = display;
    startRef.current = null;
    setPulse(true);
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(
        fromRef.current + (value - fromRef.current) * eased,
      );
      setDisplay(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        window.setTimeout(() => setPulse(false), 180);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Locale-independent thousand separator to avoid SSR/CSR hydration
  // mismatches (server defaults to en-US "1,240", client may be nl-NL "1.240").
  const defaultFormat = (n: number) =>
    Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const text = format ? format(display) : defaultFormat(display);
  return (
    <span
      className={`${className ?? ""} inline-block ${pulse ? "animate-pop text-feltLight" : ""}`}
    >
      {text}
    </span>
  );
}
