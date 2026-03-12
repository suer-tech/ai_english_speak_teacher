import React from "react";
import { motion } from "motion/react";

const playbackBars = [
  { idle: 24, peak: 54, settle: 30, duration: 0.82, delay: 0 },
  { idle: 32, peak: 84, settle: 42, duration: 0.72, delay: 0.08 },
  { idle: 40, peak: 118, settle: 56, duration: 0.94, delay: 0.02 },
  { idle: 28, peak: 72, settle: 34, duration: 0.68, delay: 0.12 },
  { idle: 46, peak: 132, settle: 60, duration: 0.9, delay: 0.04 },
  { idle: 34, peak: 96, settle: 48, duration: 0.76, delay: 0.14 },
  { idle: 42, peak: 124, settle: 58, duration: 0.88, delay: 0.06 },
  { idle: 30, peak: 80, settle: 40, duration: 0.74, delay: 0.16 },
  { idle: 22, peak: 52, settle: 28, duration: 0.8, delay: 0.1 },
];

export function PlaybackVisualizer() {
  return (
    <div className="flex h-36 items-end justify-center gap-2" aria-hidden="true">
      {playbackBars.map((bar, index) => (
        <motion.span
          key={index}
          className="rounded-full bg-gradient-to-t from-white/40 via-white/85 to-white shadow-[0_0_18px_rgba(129,140,248,0.38)]"
          animate={{
            height: [bar.idle, bar.peak, bar.settle, bar.peak - 18, bar.idle],
            opacity: [0.34, 1, 0.72, 1, 0.4],
            scaleY: [0.92, 1, 0.96, 1, 0.92],
          }}
          transition={{
            repeat: Infinity,
            duration: bar.duration,
            ease: "easeInOut",
            delay: bar.delay,
          }}
          style={{
            width: index % 2 === 0 ? 8 : 6,
            transformOrigin: "bottom center",
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}
