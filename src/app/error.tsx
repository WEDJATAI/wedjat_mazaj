"use client";

// Global error boundary — catches unhandled runtime errors anywhere in the
// app and shows a friendly fallback instead of a blank white screen. The user
// can retry (re-mount the route segment) or go back to the start.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Flame, RefreshCw, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log to the server console for visibility during development.
    console.error("[Mazaj] unhandled error:", error);
  }, [error]);

  const goHome = () => {
    try {
      // Clear any potentially-corrupt client state that may have caused the crash.
      for (const key of ["mazaj-cart"]) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  };

  return (
    <div className="dark relative flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-5 text-center text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center gap-4">
        <span className="grid size-16 place-items-center rounded-3xl bg-primary/15 text-primary">
          <Flame className="size-8" />
        </span>
        <div>
          <h1 className="text-2xl font-bold smoke-text">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. You can retry, or reset to a clean
            state and start over.
          </p>
        </div>

        {error?.message && (
          <p className="max-w-md rounded-lg border border-border bg-muted/40 px-3 py-2 text-left font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset} className="gap-2 rounded-xl">
            <RefreshCw className="size-4" /> Try again
          </Button>
          <Button
            onClick={goHome}
            variant="outline"
            className="gap-2 rounded-xl"
          >
            <RotateCcw className="size-4" /> Reset & go home
          </Button>
        </div>
      </div>
    </div>
  );
}
