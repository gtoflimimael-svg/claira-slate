"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

interface TypewriterHeadlineProps {
  prefix: string;
  words: string[];
  suffix: string;
  className?: string;
  style?: CSSProperties;
  typingSpeed?: number;
  deletingSpeed?: number;
  holdMs?: number;
  pauseMs?: number;
}

export function TypewriterHeadline({
  prefix,
  words,
  suffix,
  className,
  style,
  typingSpeed = 80,
  deletingSpeed = 60,
  holdMs = 2000,
  pauseMs = 400,
}: TypewriterHeadlineProps) {
  const reduce = useReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "deleting">("typing");
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reduce || words.length === 0) return;
    const current = words[wordIndex % words.length];

    if (phase === "typing") {
      if (text.length < current.length) {
        const id = setTimeout(() => setText(current.slice(0, text.length + 1)), typingSpeed);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => setPhase("deleting"), holdMs);
      return () => clearTimeout(id);
    }

    if (text.length > 0) {
      const id = setTimeout(() => setText(text.slice(0, -1)), deletingSpeed);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setWordIndex((i) => (i + 1) % words.length);
      setPhase("typing");
    }, pauseMs);
    return () => clearTimeout(id);
  }, [phase, text, wordIndex, words, reduce, typingSpeed, deletingSpeed, holdMs, pauseMs]);

  // Root-cause fix: whatever the animated word's length, the full line
  // (prefix + longest possible word + suffix) must never wrap or overflow.
  // Rather than trust viewport-based CSS clamps (which can't know how long
  // a translated word is), measure the actual rendered text and shrink the
  // font until the worst-case line fits inside the h1's own width.
  useLayoutEffect(() => {
    const h1 = h1Ref.current;
    if (!h1) return;

    const longestWord = words.reduce((a, b) => (b.length > a.length ? b : a), words[0] ?? "");
    const worstCase = `${prefix}${longestWord}${suffix}`;

    const fit = () => {
      // Reset to the CSS-defined size first so we measure against the
      // "natural" responsive size, not a previously shrunk value.
      h1.style.fontSize = "";
      const computed = window.getComputedStyle(h1);
      const naturalSize = parseFloat(computed.fontSize);
      const containerWidth = h1.clientWidth;
      if (!containerWidth || !naturalSize) return;

      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      ctx.font = `${computed.fontWeight} ${naturalSize}px ${computed.fontFamily}`;
      const measured = ctx.measureText(worstCase).width;

      if (measured > containerWidth) {
        const scaled = (naturalSize * containerWidth * 0.97) / measured;
        h1.style.fontSize = `${Math.max(scaled, 14)}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(h1);
    if (h1.parentElement) ro.observe(h1.parentElement);
    return () => ro.disconnect();
  }, [prefix, suffix, words]);

  const displayedWord = reduce ? words[0] ?? "" : text;

  return (
    <h1 ref={h1Ref} className={className} style={style}>
      <span>{prefix}</span>
      <span className="typewriter-word">
        {displayedWord}
        {!reduce && (
          <span className="cs-tw-cursor" aria-hidden="true">
            |
          </span>
        )}
      </span>
      <span>{suffix}</span>
    </h1>
  );
}
