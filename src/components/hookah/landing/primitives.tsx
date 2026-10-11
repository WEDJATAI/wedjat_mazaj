"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Reveal — scroll-triggered entrance with cinema timing              */
/* ------------------------------------------------------------------ */

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 34, filter: "blur(6px)" },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "span" | "li" | "p" | "h2" | "h3";
}) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      variants={revealVariants}
      custom={delay}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-12% 0px" }}
    >
      {children}
    </Comp>
  );
}

/* ------------------------------------------------------------------ */
/* WordReveal — headline words rise from a mask, staggered            */
/* ------------------------------------------------------------------ */

export function WordReveal({
  text,
  className,
  wordClassName,
  delay = 0,
  stagger = 0.09,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={cn("inline-block", className)}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
          <motion.span
            className={cn("inline-block will-change-transform", wordClassName)}
            initial={{ y: "110%", rotate: 2 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{
              duration: 1.05,
              delay: delay + i * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* SectionKicker — hairline · label · hairline, in gold              */
/* ------------------------------------------------------------------ */

export function SectionKicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("flex items-center gap-4", className)}>
      <span className="ember-hairline w-10 sm:w-16" aria-hidden />
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.42em] text-gold-soft sm:text-xs">
        {children}
      </span>
      <span className="ember-hairline w-10 sm:w-16" aria-hidden />
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic — subtle cursor attraction for desktop CTAs               */
/* ------------------------------------------------------------------ */

export function Magnetic({
  children,
  className,
  strength = 0.32,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [pos, setPos] = React.useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    if (window.matchMedia("(hover: none)").matches) return; // touch device
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setPos({ x: x * strength, y: y * strength });
  };

  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      onMouseMove={onMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 180, damping: 16, mass: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Counter — animated number that counts up when scrolled into view   */
/* ------------------------------------------------------------------ */

export function Counter({
  to,
  suffix = "",
  prefix = "",
  duration = 1.8,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [value, setValue] = React.useState(0);
  const started = React.useRef(false);
  const nodeRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    const node = nodeRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - t0) / (duration * 1000), 1);
            const eased = 1 - Math.pow(1 - t, 4);
            setValue(Math.round(eased * to));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [to, duration, reduced]);

  return (
    <span ref={nodeRef} className={className}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}
