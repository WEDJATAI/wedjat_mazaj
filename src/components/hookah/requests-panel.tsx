"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BellRing,
  CheckCheck,
  RefreshCw,
  LogOut,
  MapPin,
  User,
  Clock,
  HandHelping,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ServiceRequest {
  id: string;
  type: string;
  guestName: string | null;
  table: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function RequestsPanel({ onSignOut }: { onSignOut: () => void }) {
  const [requests, setRequests] = React.useState<ServiceRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      const data = await res.json();
      if (data.ok) setRequests(data.requests);
      else toast.error("Could not load requests");
    } catch {
      toast.error("Could not load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    // poll for new requests every 15s
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const acknowledge = async (req: ServiceRequest, status: string) => {
    try {
      const res = await fetch(`/api/requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      toast.success(
        status === "acknowledged" ? "Request acknowledged" : "Marked done"
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const active = requests.filter((r) => r.status === "acknowledged");
  const done = requests.filter((r) => r.status === "done");

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <BellRing className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Requests
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Guest calls for the shisha man
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {pending.length > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 border border-primary/30 bg-primary/15 text-primary"
                >
                  <BellRing className="size-3" /> {pending.length} new
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={load}
                aria-label="Refresh"
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onSignOut}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-muted/50">
                <HandHelping className="size-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No requests yet</p>
                <p className="text-sm text-muted-foreground">
                  When a guest calls the shisha man, it shows up here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {pending.length > 0 && (
                <Section title="Pending" count={pending.length}>
                  {pending.map((r) => (
                    <RequestCard
                      key={r.id}
                      req={r}
                      onAck={() => acknowledge(r, "acknowledged")}
                    />
                  ))}
                </Section>
              )}
              {active.length > 0 && (
                <Section title="In progress" count={active.length}>
                  {active.map((r) => (
                    <RequestCard
                      key={r.id}
                      req={r}
                      onAck={() => acknowledge(r, "done")}
                      ackLabel="Mark done"
                    />
                  ))}
                </Section>
              )}
              {done.length > 0 && (
                <Section title="Done" count={done.length} muted>
                  {done.map((r) => (
                    <RequestCard key={r.id} req={r} />
                  ))}
                </Section>
              )}
            </div>
          )}
        </main>

        <footer className="relative mt-auto border-t border-border bg-background/60 py-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
            <Flame className="size-3 text-primary" />
            Auto-refreshes every 15 seconds
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2
          className={cn(
            "text-sm font-semibold",
            muted ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {title}
        </h2>
        <Badge variant="secondary" className="bg-muted/60 text-muted-foreground">
          {count}
        </Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function RequestCard({
  req,
  onAck,
  ackLabel = "Acknowledge",
}: {
  req: ServiceRequest;
  onAck?: () => void;
  ackLabel?: string;
}) {
  const isCoal = req.type === "coal_request";
  const title = isCoal
    ? "Coal request"
    : req.type === "call_shisha_man"
    ? "Call the shisha man"
    : req.type;
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        req.status === "pending"
          ? isCoal
            ? "border-amber-500/50"
            : "border-primary/50"
          : req.status === "acknowledged"
          ? "border-amber-500/40"
          : "border-border opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            isCoal
              ? "bg-amber-500/15 text-amber-500"
              : "bg-primary/15 text-primary"
          )}
        >
          {isCoal ? <Flame className="size-5" /> : <HandHelping className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{title}</p>
            <Badge
              variant="secondary"
              className={cn(
                req.status === "pending"
                  ? isCoal
                    ? "border border-amber-500/30 bg-amber-500/15 text-amber-500"
                    : "border border-primary/30 bg-primary/15 text-primary"
                  : req.status === "acknowledged"
                  ? "border border-amber-500/30 bg-amber-500/15 text-amber-500"
                  : "bg-muted/60 text-muted-foreground"
              )}
            >
              {req.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {req.guestName && (
              <span className="flex items-center gap-1">
                <User className="size-3" /> {req.guestName}
              </span>
            )}
            {req.table && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {req.table}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {timeAgo(req.createdAt)}
            </span>
          </div>
          {req.note && (
            <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground/80">
              “{req.note}”
            </p>
          )}
        </div>
      </div>
      {onAck && (
        <Button
          className="mt-3 w-full rounded-xl"
          variant={req.status === "pending" ? "default" : "outline"}
          onClick={onAck}
        >
          <CheckCheck className="size-4" /> {ackLabel}
        </Button>
      )}
    </div>
  );
}
