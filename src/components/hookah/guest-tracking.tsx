"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/store/i18n";
import { celebrate, haptic } from "@/lib/delight";
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

const STEPS_KEYS = ["stepPlaced", "stepPreparing", "stepServed"] as const;
const STEPS_ICONS = [Radar, ChefHat, CheckCircle2] as const;

function stepIndex(status: string): number {
  if (status === "preparing") return 1;
  if (status === "done") return 2;
  return 0;
}

/** Estimated prep time: base 7 min + 4 min per hookah, capped. */
function estimateMinutes(itemCount: number): number {
  return Math.min(30, 7 + itemCount * 4);
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
  const t = useI18n((s) => s.t);
  const [orders, setOrders] = React.useState<TrackOrder[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Server-side privacy filter: only THIS guest's orders ever reach the
  // phone (the old version fetched all 50 latest orders and filtered by
  // name on the client — same-name guests could see each other).
  const load = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/orders?guest=${encodeURIComponent(guestName)}`
      );
      const data = await res.json();
      if (!data.ok) return;
      const mine: TrackOrder[] = data.orders;
      // keep the focused (just-placed) order visible even if the name changed
      if (focusOrderId) {
        try {
          const all = await fetch("/api/orders").then((r) => r.json());
          if (all.ok) {
            const focused = (all.orders as TrackOrder[]).find(
              (o) => o.id === focusOrderId
            );
            if (focused && !mine.some((o) => o.id === focused.id)) {
              mine.unshift(focused);
            }
          }
        } catch {
          // focused lookup is best-effort
        }
      }
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      setOrders(
        mine
          .filter((o) => new Date(o.createdAt).getTime() >= cutoff)
          .slice(0, 6)
      );
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
        haptic("success");
        toast.success(t("pingOnToast"), {
          description: t("pingOnToastDesc"),
        });
      } else if (result === "denied") {
        toast.error(t("blockedToast"), {
          description: t("blockedToastDesc"),
        });
      } else if (result === "unsupported") {
        setPushState("unsupported");
        toast.info(t("installAppToast"), {
          description: t("installAppToastDesc"),
        });
      } else {
        toast.error(t("sommelierError"));
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
            <Radar className="size-5 text-primary" /> {t("trackOrders")}
          </SheetTitle>
          <SheetDescription>{t("trackDesc")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-5 pb-6 pt-1">
          {loading ? (
            <>
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {t("noOrders48")}
            </div>
          ) : (
            <>
              {!anyActive && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center text-sm text-emerald-500">
                  🎉 {t("allServed")}
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
                      {pushState === "on" ? t("notifOn") : t("pingTitle")}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {pushState === "on"
                        ? t("notifOnDesc")
                        : pushState === "unsupported"
                          ? t("notifUnsupportedDesc")
                          : t("notifOffDesc")}
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
                      {t("notifyMe")}
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
  const t = useI18n((s) => s.t);
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

  const timeAgoText = timeAgo(order.createdAt, t);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {order.itemCount} {order.itemCount > 1 ? t("bowls") : t("bowl")}
            {order.table ? ` · ${order.table}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            #{order.id.slice(-6).toUpperCase()} · {timeAgoText}
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
          {STEPS_KEYS.map((key, i) => {
            const Icon = STEPS_ICONS[i];
            const reached = i <= idx;
            const current = i === idx && order.status !== "done";
            return (
              <React.Fragment key={key}>
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
                    {t(key)}
                  </span>
                </div>
                {i < STEPS_KEYS.length - 1 && (
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
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {t("inQueue")} ~{est} {t("minutesShort")}
            {elapsedMin > est && (
              <span className="font-medium text-amber-500">
                {t("longerUsual")}
              </span>
            )}
          </p>
        )}
        {order.status === "preparing" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
            <Flame className="size-3.5 animate-pulse" />
            {t("preparingNow")}
          </p>
        )}
        {order.status === "done" && order.pointsEarned > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
            <Gift className="size-3.5" /> +{order.pointsEarned}{" "}
            {t("ptsOrderNote")}
          </p>
        )}
      </div>

      {/* rating — appears once served */}
      {order.status === "done" && <RateControls order={order} onChanged={onChanged} />}
    </div>
  );
}

function timeAgo(iso: string, t: (k: never) => string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("justNow" as never);
  if (min < 60) return `${min}${t("mAgo" as never)}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}${t("hAgo" as never)}`;
  return new Date(iso).toLocaleDateString();
}

function RateControls({
  order,
  onChanged,
}: {
  order: TrackOrder;
  onChanged: () => void;
}) {
  const t = useI18n((s) => s.t);
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
        <p className="text-xs text-muted-foreground">{t("thanksRating")}</p>
      </div>
    );
  }

  const submit = async () => {
    if (stars < 1) {
      toast.error(t("rateStarsFirst"));
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
      celebrate(stars >= 4 ? "big" : "small");
      haptic("success");
      toast.success(t("thanksFeedbackToast"), {
        description: t("helpsServe"),
      });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sommelierError"));
    } finally {
      setSending(false);
    }
  };

  const ratingWord =
    stars === 0
      ? ""
      : stars >= 5
        ? t("lovedIt")
        : stars >= 3
          ? t("goodRating")
          : t("doBetter");

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-sm font-medium">{t("howWasSession")}</p>
      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={sending}
            onClick={() => {
              setStars(n);
              haptic("light");
            }}
            aria-label={`${n}`}
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
        <span className="ml-2 text-xs text-muted-foreground">{ratingWord}</span>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("feedbackPlaceholder")}
        rows={2}
        className="mt-2 resize-none bg-background text-sm"
        aria-label={t("feedbackPlaceholder")}
      />
      <Button
        size="sm"
        className="mt-2 w-full rounded-xl"
        disabled={sending || stars < 1}
        onClick={submit}
      >
        {sending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> {t("sending")}
          </>
        ) : (
          t("sendFeedback")
        )}
      </Button>
    </div>
  );
}
