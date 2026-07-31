"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SVG_BEFORE_PLANT, SVG_PLANT_INNER, SVG_AFTER_PLANT } from "@/components/home/hero-illustration-svg";

const VIOLET = "#6C63FF";
const CYAN = "#06B6D4";

// Bottom-center of the Plant group's bounding box in the illustration's own
// 0-500 viewBox coordinate space (computed from its path data) — used as the
// pivot so the pot sways from its base instead of its geometric center.
const PLANT_PIVOT = "419.33px 432.43px";

const PARTICLES: { top?: string; left?: string; right?: string; bottom?: string; size: number; color: string; duration: number; delay: number }[] = [
  { top: "6%", left: "4%", size: 6, color: VIOLET, duration: 2.4, delay: 0 },
  { top: "16%", right: "2%", size: 4, color: CYAN, duration: 3.2, delay: 0.4 },
  { top: "46%", left: "-3%", size: 8, color: VIOLET, duration: 2.8, delay: 0.8 },
  { bottom: "20%", right: "-4%", size: 5, color: CYAN, duration: 3.6, delay: 1.2 },
  { bottom: "6%", left: "10%", size: 6, color: VIOLET, duration: 2.2, delay: 0.2 },
  { top: "60%", right: "12%", size: 4, color: CYAN, duration: 4, delay: 1.6 },
];

const NETWORK_NODES = [
  { cx: 70, cy: 50 },
  { cx: 430, cy: 80 },
  { cx: 410, cy: 410 },
  { cx: 60, cy: 400 },
];

export function HeroIllustration() {
  const reduceMotion = useReducedMotion();

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      {/* Glow behind the illustration */}
      <motion.div
        aria-hidden
        animate={reduceMotion ? undefined : { opacity: [0.05, 0.12, 0.05] }}
        transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: "-12%",
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${VIOLET}, ${CYAN} 55%, transparent 75%)`,
          filter: "blur(44px)",
          opacity: reduceMotion ? 0.08 : undefined,
          zIndex: 0,
        }}
      />

      {/* Connected dots network */}
      <svg
        aria-hidden
        viewBox="0 0 500 500"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "visible" }}
      >
        <g stroke={VIOLET} strokeOpacity={0.22} strokeWidth={1}>
          <line x1={NETWORK_NODES[0].cx} y1={NETWORK_NODES[0].cy} x2={NETWORK_NODES[1].cx} y2={NETWORK_NODES[1].cy} />
          <line x1={NETWORK_NODES[1].cx} y1={NETWORK_NODES[1].cy} x2={NETWORK_NODES[2].cx} y2={NETWORK_NODES[2].cy} />
          <line x1={NETWORK_NODES[2].cx} y1={NETWORK_NODES[2].cy} x2={NETWORK_NODES[3].cx} y2={NETWORK_NODES[3].cy} />
          <line x1={NETWORK_NODES[3].cx} y1={NETWORK_NODES[3].cy} x2={NETWORK_NODES[0].cx} y2={NETWORK_NODES[0].cy} />
        </g>
        {NETWORK_NODES.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.cx}
            cy={n.cy}
            r={4}
            fill={VIOLET}
            fillOpacity={0.4}
            style={{ transformOrigin: `${n.cx}px ${n.cy}px`, willChange: reduceMotion ? undefined : "transform" }}
            animate={reduceMotion ? undefined : { scale: [1, 1.4, 1] }}
            transition={reduceMotion ? undefined : { duration: 1.5, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}
      </svg>

      {/* Main illustration — gentle float */}
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -12, 0] }}
        transition={reduceMotion ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "relative", zIndex: 2, height: "100%", willChange: reduceMotion ? undefined : "transform" }}
      >
        <svg viewBox="0 0 500 500" width="100%" height="100%" style={{ display: "block" }} aria-hidden>
          <g dangerouslySetInnerHTML={{ __html: SVG_BEFORE_PLANT }} />
          <motion.g
            style={{ transformOrigin: PLANT_PIVOT, willChange: reduceMotion ? undefined : "transform" }}
            animate={reduceMotion ? undefined : { rotate: [-3, 3, -3] }}
            transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
            dangerouslySetInnerHTML={{ __html: SVG_PLANT_INNER }}
          />
          <g dangerouslySetInnerHTML={{ __html: SVG_AFTER_PLANT }} />
        </svg>

        {/* Document chip — subtle rotation oscillation */}
        <motion.div
          animate={reduceMotion ? undefined : { rotate: [-2, 2, -2] }}
          transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            bottom: "10%",
            insetInlineEnd: "6%",
            width: 54,
            height: 68,
            borderRadius: 8,
            background: "var(--cs-card)",
            border: "1px solid var(--cs-line)",
            boxShadow: "0 10px 24px rgba(0,0,0,.14)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            padding: "10px 8px",
            overflow: "hidden",
            transformOrigin: "center",
            willChange: reduceMotion ? undefined : "transform",
          }}
        >
          <div style={{ width: "70%", height: 4, borderRadius: 2, background: VIOLET }} />
          <div style={{ width: "100%", height: 3, borderRadius: 2, background: "var(--cs-line)" }} />
          <div style={{ width: "85%", height: 3, borderRadius: 2, background: "var(--cs-line)" }} />
          <div style={{ width: "60%", height: 3, borderRadius: 2, background: "var(--cs-line)" }} />
        </motion.div>

        {/* Click/tap indicator — stands in for a hand/cursor interaction since the
            source illustration has no isolable hand or arm element to animate. */}
        <motion.div
          aria-hidden
          animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
          transition={reduceMotion ? undefined : { duration: 0.8, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
          style={{
            position: "absolute",
            bottom: "16%",
            insetInlineStart: "18%",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: CYAN,
            boxShadow: `0 0 0 4px color-mix(in oklab, ${CYAN} 25%, transparent)`,
            willChange: reduceMotion ? undefined : "transform",
          }}
        />
      </motion.div>

      {/* Floating particle dots */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          aria-hidden
          animate={reduceMotion ? undefined : { opacity: [0.2, 0.8, 0.2] }}
          transition={reduceMotion ? undefined : { duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: p.top,
            left: p.left,
            right: p.right,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            opacity: reduceMotion ? 0.5 : undefined,
            zIndex: 3,
          }}
        />
      ))}
    </div>
  );
}
