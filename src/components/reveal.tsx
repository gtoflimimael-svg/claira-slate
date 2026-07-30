"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type RevealVariant = "left" | "right" | "scale" | "fade";

interface RevealProps {
  as?: ElementType;
  variant?: RevealVariant;
  index?: number;
  staggerMs?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  [key: string]: unknown;
}

export function Reveal({ as: Tag = "div", variant, index, staggerMs = 80, className, style, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      requestAnimationFrame(() => setShown(true));
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={variant ?? ""}
      data-shown={shown ? "" : undefined}
      style={index !== undefined ? { transitionDelay: `${index * staggerMs}ms`, ...style } : style}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}
