"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, Play, Pause, RotateCcw, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Timer className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Session timer</p>
            <p className="text-[11px] text-muted-foreground">
              Track the active bowl
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            overTime && elapsed > 0
              ? "border border-amber-500/30 bg-amber-500/15 text-amber-500"
              : running
              ? "border border-primary/30 bg-primary/15 text-primary"
              : "bg-muted/60 text-muted-foreground"
          )}
        >
          {elapsed > 0 && overTime
            ? "Over time"
            : running
            ? "Running"
            : "Idle"}
        </Badge>
      </div>

      <div className="flex items-end justify-center gap-1 py-2">
        <span
          className={cn(
            "font-mono text-4xl font-bold tabular-nums tracking-tight",
            overTime && elapsed > 0 ? "text-amber-500" : "text-foreground"
          )}
        >
          {fmt(overTime ? -remaining : remaining)}
        </span>
      </div>
      {overTime && elapsed > 0 && (
        <p className="mb-2 text-center text-[11px] text-amber-500">
          +{fmt(elapsed - targetMs)} over target
        </p>
      )}

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            overTime && elapsed > 0 ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${overTime ? 100 : pct}%` }}
        />
      </div>

      <div className="mb-3 flex items-center justify-center gap-1.5">
        {[30, 45, 60, 90].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setTargetMin(m);
              reset();
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-all",
              targetMin === m
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 rounded-xl"
          variant={running ? "outline" : "default"}
          onClick={toggle}
        >
          {running ? (
            <>
              <Pause className="size-4" /> Pause
            </>
          ) : (
            <>
              <Play className="size-4" /> {elapsed > 0 ? "Resume" : "Start"}
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl"
          onClick={reset}
          disabled={elapsed === 0 && !running}
          aria-label="Reset timer"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
