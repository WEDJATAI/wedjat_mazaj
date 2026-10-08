"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Radar,
  Flame,
  ChefHat,
  CheckCircle2,
  Star,
  Loader2,
  Clock,
  Gift,
  BellRing,
  BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { egp } from "@/lib/catalog";
import { tierDef } from "@/lib/loyalty";
import {
  pushSupported,
  subscribeToPush,
  isSubscribed,
} from "@/lib/push-client";
import { toast } from "sonner";

interface TrackOrder {
  id: string;
  customerName: string | null;
  table: string | null;
  status: string;
  itemCount: number;
  itemsJson: string;
  total: number;
  createdAt: string;
  rating: number | null;
  pointsEarned: number;
}

const POLL_MS = 10000;

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

/** Estimated prep time: base 7 min + 4 min per hookah, capped. */
function estimateMinutes(itemCount: number): number {
  return Math.min(30, 7 + itemCount * 4);
}

const STEPS = [
  { key: "pending", label: "Order placed", icon: Radar },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "done", label: "Served", icon: CheckCircle2 },
] as const;

function stepIndex(status: string): number {
  if (status === "preparing") return 1;
  if (status === "done") return 2;
  return 0;
}

export function GuestTrackingSheet({
  open,
  onOpenChange,
  guestName,
  focusOrderId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  guestName: string;
  /** order id to highlight (from the checkout confirmation) */
  focusOrderId?: string | null;
}) {
  const [orders, setOrders] = React.useState<TrackOrder[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (!data.ok) return;
      const all: TrackOrder[] = data.orders;
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const mine = all
        .filter(
          (o) =>
            (o.customerName?.toLowerCase() === guestName.toLowerCase() ||
              o.id === focusOrderId) &&
            new Date(o.createdAt).getTime() >= cutoff
        )
        .slice(0, 6);
      setOrders(mine);
    } catch {
      // silent — the next poll retries
    } finally {
      setLoading(false);
    }
  }, [guestName, focusOrderId]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [open, load]);

  const active = orders.filter((o) => o.status !== "done");
  const anyActive = active.length > 0;

  const [pushState, setPushState] = React.useState<
    "checking" | "off" | "on" | "unsupported"
  >("checking");
  const [subscribing, setSubscribing] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    if (!pushSupported()) {
      setPushState("unsupported");
      return;
    }
    isSubscribed().then((sub) => {
      if (alive) setPushState(sub ? "on" : "off");
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const enablePush = async () => {
    if (subscribing) return;
    setSubscribing(true);
    try {
      const result = await subscribeToPush(guestName);
      if (result === "ok") {
        setPushState("on");
        toast.success("You'll get a ping when it's ready 🔔", {
          description: "We'll notify you the moment your hookah is served.",
        });
      } else if (result === "denied") {
        toast.error("Notifications are blocked", {
          description:
            "Enable them for Mazaj in your browser/site settings to get updates.",
        });
      } else if (result === "unsupported") {
        setPushState("unsupported");
        toast.info("Install the app to get notifications", {
          description:
            "On iPhone, add Mazaj to your home screen first — then this button turns on pings.",
        });
      } else {
        toast.error("Couldn't enable notifications", {
          description: "Check your connection and try again.",
        });
      }
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl border-t border-border p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Radar className="size-5 text-primary" /> Track my orders
          </SheetTitle>
          <SheetDescription>
            Live status of your hookah sessions · updates every 10 seconds
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-5 pb-6 pt-1">
          {loading ? (
            <>
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No orders in the last 48 hours. Place an order to see it here
              live!
            </div>
          ) : (
            <>
              {!anyActive && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center text-sm text-emerald-500">
                  🎉 All your sessions are served. Enjoy!
                </div>
              )}
              {orders.map((o) => (
                <TrackedOrder key={o.id} order={o} onChanged={load} />
              ))}
              {anyActive && (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15">
                    {pushState === "on" ? (
                      <BellRing className="size-5 text-primary" />
                    ) : (
                      <BellOff className="size-5 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {pushState === "on"
                        ? "Notifications on"
                        : "Ping me when it's ready"}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {pushState === "on"
                        ? "We'll notify you when your hookah is prepared and served — even with the app closed."
                        : pushState === "unsupported"
                          ? "On iPhone: install the app first (Add to Home Screen), then come back to enable pings."
                          : "Get a notification on this phone when your hookah is prepared and served."}
                    </p>
                  </div>
                  {pushState !== "on" && pushState !== "unsupported" && (
                    <Button
                      size="sm"
                      className="h-9 shrink-0 rounded-xl px-3 font-semibold"
                      disabled={subscribing}
                      onClick={enablePush}
                    >
                      {subscribing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <BellRing className="size-4" />
                      )}
                      Notify me
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TrackedOrder({
  order,
  onChanged,
}: {
  order: TrackOrder;
  onChanged: () => void;
}) {
  const idx = stepIndex(order.status);
  const elapsedMin = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / 60000
  );
  const est = estimateMinutes(order.itemCount);

  let items: { qty: number; primaryBrandName: string; flavorLabel: string }[] =
    [];
  try {
    const parsed = JSON.parse(order.itemsJson);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    // keep empty
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {order.itemCount} hookah{order.itemCount > 1 ? "s" : ""}
            {order.table ? ` · ${order.table}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            #{order.id.slice(-6).toUpperCase()} · {timeAgo(order.createdAt)}
          </p>
        </div>
        <p className="font-bold text-primary">{egp(order.total)}</p>
      </div>

      {/* items summary */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.slice(0, 4).map((it, i) => (
          <span
            key={i}
            className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {it.qty}× {it.primaryBrandName} · {it.flavorLabel}
          </span>
        ))}
      </div>

      {/* live stepper */}
      <div className="mt-4">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const reached = i <= idx;
            const current = i === idx && order.status !== "done";
            return (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full border transition-all",
                      reached
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground",
                      current && "animate-pulse ring-2 ring-primary/40"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      reached ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "-mt-4 h-0.5 flex-1 rounded",
                      i < idx ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* status detail line */}
        {order.status === "pending" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            In the queue · est. ~{est} min
            {elapsedMin > est && (
              <span className="font-medium text-amber-500">
                (a little longer than usual)
              </span>
            )}
          </p>
        )}
        {order.status === "preparing" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
            <Flame className="size-3.5 animate-pulse" />
            Your shisha man is preparing it right now
          </p>
        )}
        {order.status === "done" && order.pointsEarned > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
            <Gift className="size-3.5" /> +{order.pointsEarned} Mazaj+ points
            earned on this order
          </p>
        )}
      </div>

      {/* rating — appears once served */}
      {order.status === "done" && <RateControls order={order} onChanged={onChanged} />}
    </div>
  );
}

function RateControls({
  order,
  onChanged,
}: {
  order: TrackOrder;
  onChanged: () => void;
}) {
  const [stars, setStars] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(order.rating != null);

  if (submitted) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-sm">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={cn(
                "size-4",
                n <= (order.rating ?? 0)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Thanks for rating!</p>
      </div>
    );
  }

  const submit = async () => {
    if (stars < 1) {
      toast.error("Tap the stars to rate first");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars, comment: comment.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      setSubmitted(true);
      toast.success("Thanks for your feedback!", {
        description: "It helps us serve you better 🙏",
      });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save rating");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-sm font-medium">How was your session?</p>
      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={sending}
            onClick={() => setStars(n)}
            aria-label={`Rate ${n} stars`}
            className="rounded p-0.5 transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={cn(
                "size-6",
                n <= stars
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              )}
            />
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          {stars === 0 ? "" : stars >= 5 ? "Loved it!" : stars >= 3 ? "Good" : "We'll do better"}
        </span>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything to tell the team? (optional)"
        rows={2}
        className="mt-2 resize-none bg-background text-sm"
        aria-label="Feedback comment"
      />
      <Button
        size="sm"
        className="mt-2 w-full rounded-xl"
        disabled={sending || stars < 1}
        onClick={submit}
      >
        {sending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          "Send feedback"
        )}
      </Button>
    </div>
  );
}
