"use client";

import * as React from "react";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoldButton } from "./kit/kit";

const DEFAULT_MIN = 45; // typical shisha session ~45min

function fmt(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionTimer() {
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0); // ms elapsed
  const [targetMin, setTargetMin] = React.useState(DEFAULT_MIN);
  const startRef = React.useRef<number>(0);
  const baseRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(baseRef.current + (Date.now() - startRef.current));
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const targetMs = targetMin * 60_000;
  const remaining = targetMs - elapsed;
  const overTime = remaining <= 0;
  const over = overTime && elapsed > 0;
  // notify when crossing the target
  const crossedRef = React.useRef(false);
  React.useEffect(() => {
    if (running && overTime && !crossedRef.current) {
      crossedRef.current = true;
      toast.info("Session time's up!", {
        description: `The ${targetMin}-min target has passed — offer a coal refresh.`,
      });
    }
    if (!overTime) crossedRef.current = false;
  }, [running, overTime, targetMin]);

  const toggle = () => {
    if (running) {
      baseRef.current = elapsed;
      setRunning(false);
    } else {
      setRunning(true);
    }
  };
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    baseRef.current = 0;
    crossedRef.current = false;
  };

  const pct = Math.max(
    0,
    Math.min(100, (elapsed / Math.max(1, targetMs)) * 100)
  );

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      {/* ambient ember glow */}
      <div
        className="pointer-events-none absolute -top-12 left-1/2 h-24 w-44 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Timer className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-base font-bold tracking-tight text-gold-soft">
              Session timer
            </p>
            <p className="text-[11px] text-muted-foreground">
              Track the active bowl
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]",
            over
              ? "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/45"
              : running
              ? "bg-primary/15 text-primary ring-1 ring-primary/45"
              : "bg-white/[0.04] text-muted-foreground ring-1 ring-white/10"
          )}
        >
          {running && !over && (
            <span
              className="size-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none"
              aria-hidden
            />
          )}
          {over ? "Over time" : running ? "Running" : "Idle"}
        </span>
      </div>

      {/* display-font time readout */}
      <div className="relative flex flex-col items-center py-1">
        <span
          className={cn(
            "font-display text-5xl font-bold tabular-nums tracking-tight transition-colors duration-500",
            over ? "text-amber-500" : "text-gold"
          )}
        >
          {fmt(overTime ? -remaining : remaining)}
        </span>
        <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
          {over
            ? `+${fmt(elapsed - targetMs)} over the ${targetMin}-min target`
            : `of the ${targetMin}-min target`}
        </p>
      </div>

      {/* gold progress bar */}
      <div
        className="relative mt-4 mb-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(over ? 100 : pct)}
        aria-label="Session progress"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            over
              ? "bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_14px_oklch(0.78_0.15_65/0.5)]"
              : "bg-gradient-to-r from-[oklch(0.72_0.145_60)] to-[oklch(0.86_0.13_74)] shadow-[0_0_14px_oklch(0.78_0.15_65/0.5)]"
          )}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>

      {/* target chips — gold-ring pills */}
      <div className="relative mb-4 flex items-center justify-center gap-2">
        {[30, 45, 60, 90].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setTargetMin(m);
              reset();
            }}
            aria-pressed={targetMin === m}
            className={cn(
              "inline-flex h-11 items-center rounded-full px-4 text-xs font-semibold tabular-nums transition-all active:scale-95",
              targetMin === m
                ? "bg-primary/15 text-primary ring-1 ring-primary/45"
                : "bg-white/[0.04] text-muted-foreground ring-1 ring-white/[0.08] hover:text-foreground hover:ring-primary/35"
            )}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="relative flex gap-2.5">
        {running ? (
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-foreground/90 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07] active:scale-[0.97]"
          >
            <Pause className="size-4" /> Pause
          </button>
        ) : (
          <GoldButton
            className="h-12 flex-1 text-sm"
            onClick={toggle}
          >
            <Play className="size-4" /> {elapsed > 0 ? "Resume" : "Start"}
          </GoldButton>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={elapsed === 0 && !running}
          aria-label="Reset timer"
          title="Reset timer"
          className="glass grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  );
}
