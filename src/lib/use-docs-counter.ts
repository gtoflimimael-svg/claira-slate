"use client";

import { useEffect, useState } from "react";

const TARGET = 48219364;

export function useDocsCounter(): string {
  const [docs, setDocs] = useState(0);

  useEffect(() => {
    let raf = 0;
    let tick: ReturnType<typeof setInterval> | undefined;
    const t0 = performance.now();
    const dur = 1500;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDocs(Math.round(TARGET * e));
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        tick = setInterval(() => {
          setDocs((d) => d + 1 + Math.floor(Math.random() * 4));
        }, 900);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (tick) clearInterval(tick);
    };
  }, []);

  return docs.toLocaleString("en-US");
}
