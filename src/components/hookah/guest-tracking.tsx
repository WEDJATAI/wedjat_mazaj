"use client";

import * as React from "react";
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
import { motion } from "framer-motion";
import {
  pushSupported,
  subscribeToPush,
  isSubscribed,
} from "@/lib/push-client";
import { toast } from "sonner";
import {
  EASE,
  EmptyState,
  GoldButton,
  SheetGrip,
  Stagger,
  StaggerItem,
} from "./kit/kit";

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
        className="dark slim-scroll mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl border-white/[0.08] bg-[oklch(0.155_0.014_60/0.95)] p-0 text-foreground shadow-[0_-28px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
      >
        <SheetHeader className="relative overflow-hidden px-5 pb-1 pt-2.5">
          {/* ambient ember glow behind the title */}
          <div
            className="pointer-events-none absolute -top-28 left-1/2 h-44 w-80 -translate-x-1/2 rounded-full bg-primary/[0.13] blur-3xl"
            aria-hidden
          />
          <SheetGrip />
          <SheetTitle className="relative flex items-center justify-center gap-2.5 font-display text-2xl font-bold tracking-tight text-gold-soft">
            <Radar className="size-5 text-primary" /> {t("trackOrders")}
          </SheetTitle>
          <SheetDescription className="relative text-center text-xs">
            {t("trackDesc")}
          </SheetDescription>
          <div className="ember-hairline relative mt-2.5" aria-hidden />
        </SheetHeader>

        <div className="flex-1 px-5 pb-8 pt-3">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-44 rounded-2xl bg-white/[0.05]" />
              <Skeleton className="h-24 rounded-2xl bg-white/[0.05]" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<Radar className="size-6" />}
              title={t("noOrders48")}
              action={
                <GoldButton
                  size="sm"
                  className="normal-case tracking-normal"
                  onClick={() => onOpenChange(false)}
                >
                  {t("startOrdering")}
                </GoldButton>
              }
            />
          ) : (
            <Stagger className="space-y-3">
              {!anyActive && (
                <StaggerItem>
                  <div className="glass relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl border-primary/25 p-3.5 text-center">
                    <div
                      className="pointer-events-none absolute -top-10 left-1/2 h-20 w-44 -translate-x-1/2 rounded-full bg-primary/20 blur-2xl"
                      aria-hidden
                    />
                    <p className="relative font-display text-base font-bold text-gold-soft">
                      🎉 {t("allServed")}
                    </p>
                  </div>
                </StaggerItem>
              )}
              {orders.map((o) => (
                <StaggerItem key={o.id}>
                  <TrackedOrder order={o} onChanged={load} />
                </StaggerItem>
              ))}
              {anyActive && (
                <StaggerItem>
                  <div className="glass relative flex items-center gap-3 overflow-hidden rounded-2xl p-3.5">
                    <div
                      className="pointer-events-none absolute -end-8 -top-10 size-28 rounded-full bg-primary/10 blur-2xl"
                      aria-hidden
                    />
                    <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
                      {pushState === "on" ? (
                        <BellRing className="size-5" />
                      ) : (
                        <BellOff className="size-5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="relative min-w-0 flex-1">
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
                      <GoldButton
                        size="sm"
                        className="relative h-11 shrink-0 normal-case tracking-normal"
                        disabled={subscribing}
                        onClick={enablePush}
                      >
                        {subscribing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <BellRing className="size-4" />
                        )}
                        {t("notifyMe")}
                      </GoldButton>
                    )}
                  </div>
                </StaggerItem>
              )}
            </Stagger>
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
  const isDone = order.status === "done";

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
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-4",
        isDone && "border-primary/20"
      )}
    >
      {/* warm corner glow */}
      <div
        className="pointer-events-none absolute -end-12 -top-14 size-36 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold tracking-tight text-foreground">
            {order.itemCount} {order.itemCount > 1 ? t("bowls") : t("bowl")}
            {order.table ? ` · ${order.table}` : ""}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            #{order.id.slice(-6).toUpperCase()} · {timeAgoText}
          </p>
        </div>
        <p className="font-display shrink-0 text-lg font-bold tabular-nums text-gold">
          {egp(order.total)}
        </p>
      </div>

      {/* items summary */}
      {items.length > 0 && (
        <div className="relative mt-2.5 flex flex-wrap gap-1.5">
          {items.slice(0, 4).map((it, i) => (
            <span
              key={i}
              className="rounded-lg border border-white/[0.06] bg-white/[0.05] px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {it.qty}× {it.primaryBrandName} · {it.flavorLabel}
            </span>
          ))}
        </div>
      )}

      {/* live stepper — molten gold, animates as the kitchen advances */}
      <div className="relative mt-4">
        <div className="flex items-center">
          {STEPS_KEYS.map((key, i) => {
            const Icon = STEPS_ICONS[i];
            const reached = i <= idx;
            const current = i === idx && order.status !== "done";
            return (
              <React.Fragment key={key}>
                <div className="flex flex-col items-center gap-1.5">
                  <motion.span
                    initial={false}
                    animate={{
                      scale: reached ? 1 : 0.9,
                      backgroundColor: reached
                        ? "oklch(0.78 0.15 65 / 0.16)"
                        : "oklch(1 0 0 / 0.04)",
                      borderColor: reached
                        ? "oklch(0.78 0.15 65 / 0.6)"
                        : "oklch(1 0 0 / 0.12)",
                      color: reached
                        ? "oklch(0.78 0.15 65)"
                        : "oklch(0.72 0.02 65 / 0.75)",
                    }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className={cn(
                      "relative grid size-9 place-items-center rounded-full border",
                      current && "ring-2 ring-primary/40"
                    )}
                  >
                    <Icon className="size-4" />
                    {current && (
                      <span
                        className="absolute inset-0 animate-pulse rounded-full ring-2 ring-primary/30"
                        aria-hidden
                      />
                    )}
                  </motion.span>
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-colors duration-500",
                      reached ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {t(key)}
                  </span>
                </div>
                {i < STEPS_KEYS.length - 1 && (
                  <div className="relative -mt-4 h-0.5 flex-1 overflow-hidden rounded bg-white/[0.08]">
                    <motion.div
                      className="absolute inset-0 origin-left bg-gradient-to-r from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] rtl:origin-right"
                      initial={false}
                      animate={{ scaleX: i < idx ? 1 : 0 }}
                      transition={{ duration: 0.6, ease: EASE }}
                      aria-hidden
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* status detail line */}
        {order.status === "pending" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="glass inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
              <Clock className="size-3.5 shrink-0 text-primary" />
              <span className="text-xs text-muted-foreground">
                {t("inQueue")}
              </span>
              <span className="font-display text-sm font-bold tabular-nums text-gold">
                ~{est}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("minutesShort")}
              </span>
            </span>
            {elapsedMin > est && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                <Clock className="size-3" aria-hidden />
                {t("longerUsual")}
              </span>
            )}
          </div>
        )}
        {order.status === "preparing" && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-300">
            <Flame className="size-3.5 animate-pulse text-primary" />
            {t("preparingNow")}
          </p>
        )}
        {order.status === "done" && order.pointsEarned > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Gift className="size-3.5" />{" "}
            <span className="tabular-nums">+{order.pointsEarned}</span>{" "}
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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative mt-3 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.08] p-2.5 text-sm"
      >
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={cn(
                "size-4",
                n <= (order.rating ?? 0)
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/50"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("thanksRating")}</p>
      </motion.div>
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
    <div className="relative mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
      <p className="text-sm font-semibold">{t("howWasSession")}</p>
      <div className="mt-1 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            disabled={sending}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setStars(n);
              haptic("light");
            }}
            aria-label={`${n}`}
            className="grid size-11 place-items-center rounded-xl transition-colors hover:bg-primary/10"
          >
            <Star
              className={cn(
                "size-6 transition-transform duration-300",
                n <= stars
                  ? "scale-110 fill-primary text-primary drop-shadow-[0_0_8px_oklch(0.78_0.15_65/0.45)]"
                  : "text-muted-foreground"
              )}
            />
          </motion.button>
        ))}
        <span className="ms-2 text-xs text-muted-foreground">{ratingWord}</span>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("feedbackPlaceholder")}
        rows={2}
        className="mt-2 resize-none rounded-xl border-white/[0.08] bg-white/[0.04] text-sm"
        aria-label={t("feedbackPlaceholder")}
      />
      <GoldButton
        size="md"
        className="mt-3 w-full normal-case tracking-normal"
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
      </GoldButton>
    </div>
  );
}
