"use client";

import * as React from "react";
import { useSession } from "@/store/session";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScrollText,
  RefreshCw,
  LogOut,
  MapPin,
  Clock,
  MessageCircle,
  Send,
  ChefHat,
  CheckCheck,
  Pause,
  Flame,
  Loader2,
  Hand,
  UserCheck,
  AlarmClock,
  Banknote,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { egp } from "@/lib/catalog";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useI18n } from "@/store/i18n";
import { useCart, type CartItem } from "@/store/cart";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AppHeader,
  EmptyState,
  GoldButton,
  Kicker,
  StatTile,
  Stagger,
  StaggerItem,
} from "./kit/kit";
import { BrandMark, BrandStack } from "./brand-mark";

interface OrderRow {
  id: string;
  customerName: string | null;
  table: string | null;
  itemsJson: string;
  total: number;
  itemCount: number;
  status: string;
  source: string;
  orderedByName: string | null;
  assignment: string | null; // unassigned | assigned | null
  assignedToName: string | null;
  createdAt: string;
  /** r57 — the branch this order belongs to (set in the all-branches scope) */
  branchName?: string | null;
  branchNameAr?: string | null;
  /** r58 living orders — amend support */
  ownType?: string | null;
  addonsJson?: string | null;
  revision?: number;
}

interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

interface ItemSummary {
  primaryBrandName: string;
  primaryBrandId?: string;
  components?: { brandId: string }[];
  flavorLabel: string;
  qty: number;
}

function parseItems(json: string): ItemSummary[] {
  try {
    const arr = JSON.parse(json) as ItemSummary[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** r58: the full cart items stored on the order (for amend sessions). */
function parseFullItems(json: string): CartItem[] {
  try {
    const arr = JSON.parse(json) as CartItem[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (i) =>
        i &&
        typeof i.primaryBrandId === "string" &&
        Array.isArray(i.components) &&
        i.components.length > 0
    );
  } catch {
    return [];
  }
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

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: {
    label: "Pending",
    cls: "rounded-full border-transparent bg-primary/15 text-primary ring-1 ring-primary/45",
  },
  preparing: {
    label: "Preparing",
    cls: "rounded-full border-transparent bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/40",
  },
  done: {
    label: "Done",
    cls: "rounded-full border-transparent bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/40",
  },
};

/** R49 prep SLA: pending >15m warns, >30m escalates; preparing >25m warns. */
function slaState(
  createdAt: string,
  status: string
): { level: "warn" | "late"; minutes: number } | null {
  if (status === "done") return null;
  const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const warnAt = status === "preparing" ? 25 : 15;
  const lateAt = status === "preparing" ? 45 : 30;
  if (min >= lateAt) return { level: "late", minutes: min };
  if (min >= warnAt) return { level: "warn", minutes: min };
  return null;
}

/* ── Midnight Ember shared bits (panel-local) ─────────────────────────── */

const glassIconBtn =
  "glass grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground active:scale-95";

const glassPillBtn =
  "inline-flex h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-xs font-semibold text-foreground/90 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const donePillBtn =
  "inline-flex h-11 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-500 transition-all hover:bg-emerald-500/20 active:scale-[0.97]";

function HeaderPill({
  icon,
  children,
  tone,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone: "gold" | "amber";
}) {
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold sm:inline-flex",
        tone === "gold"
          ? "bg-primary/15 text-primary ring-1 ring-primary/40"
          : "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/40"
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function OrdersPanel({ onSignOut, onAmendStart }: { onSignOut: () => void; onAmendStart?: () => void }) {
  const employee = useSession((s) => s.employee);
  const { branchParam, branchName } = useBranchScope();
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  // r57 — "all" = every branch of the venue; show a branch chip per order
  const scopeAll = branchParam === "all";
  const scopeLabel = branchName ?? t("allBranches");
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commentsFor, setCommentsFor] = React.useState<OrderRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/orders?branchId=${encodeURIComponent(branchParam)}`
      );
      const data = await res.json();
      if (data.ok) setOrders(data.orders);
      else toast.error("Could not load orders");
    } catch {
      toast.error("Could not load orders");
    } finally {
      setLoading(false);
    }
  }, [branchParam]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 10000); // poll faster for incoming orders
    return () => clearInterval(id);
  }, [load]);

  const setStatus = async (order: OrderRow, status: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      toast.success(
        status === "preparing" ? "Marked preparing" : "Marked done"
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  // Confirm/claim an unassigned guest order → it goes under this employee's name.
  const claimOrder = async (order: OrderRow) => {
    if (!employee) return;
    try {
      const res = await fetch(`/api/orders/${order.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          employeeName: employee.name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not claim");
      toast.success("Order confirmed", {
        description: `Now preparing for ${order.customerName || "guest"}`,
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim order");
    }
  };

  // r58 living orders — load a placed order into the editor (amend mode):
  // the staff member keeps the full menu (mixes, BYO, add-ons) but the
  // cart now edits THIS order instead of creating a new one.
  const startAmend = (order: OrderRow) => {
    const items = parseFullItems(order.itemsJson);
    if (items.length === 0) {
      toast.error("This order can't be edited (legacy items)");
      return;
    }
    let addons: string[] = [];
    try {
      const arr = JSON.parse(order.addonsJson ?? "[]");
      if (Array.isArray(arr)) addons = arr;
    } catch {
      addons = [];
    }
    useCart
      .getState()
      .beginAmend(
        order.id,
        items,
        (order.ownType as "hookah" | "molasses" | null) ?? null,
        addons,
        employee?.name ?? "Staff"
      );
    toast.info(t("amendEditingTitle"), {
      description: t("amendStartDesc"),
    });
    onAmendStart?.();
  };

  const incoming = orders.filter((o) => o.assignment === "unassigned");
  const mine = orders.filter(
    (o) =>
      o.assignment !== "unassigned" &&
      o.assignedToName === employee?.name &&
      o.status !== "done"
  );
  const othersActive = orders.filter(
    (o) =>
      o.status !== "done" &&
      o.assignment !== "unassigned" &&
      o.assignedToName !== employee?.name
  );
  const done = orders.filter((o) => o.status === "done");

  const activeCount = mine.length + othersActive.length;
  const queueValue = [...incoming, ...mine, ...othersActive].reduce(
    (sum, o) => sum + (o.total ?? 0),
    0
  );

  return (
    <div className="dark relative flex min-h-screen flex-col text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <AppHeader
          icon={<ScrollText className="size-5" />}
          title="Queue"
          subtitle={`Active sessions & history · ${scopeLabel}`}
          actions={
            <>
              {incoming.length > 0 && (
                <HeaderPill tone="gold" icon={<Flame className="size-3.5" />}>
                  {incoming.length} incoming
                </HeaderPill>
              )}
              {activeCount > 0 && (
                <HeaderPill tone="amber" icon={<ChefHat className="size-3.5" />}>
                  {activeCount} active
                </HeaderPill>
              )}
              <button
                type="button"
                onClick={load}
                aria-label="Refresh"
                title="Refresh"
                className={glassIconBtn}
              >
                <RefreshCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className={glassIconBtn}
              >
                <LogOut className="size-4" />
              </button>
            </>
          }
        />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-6 sm:px-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl bg-white/[0.05]" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={<ScrollText className="size-6" />}
              title="No orders yet"
              description="Orders appear here once placed."
            />
          ) : (
            <div className="space-y-8">
              {/* Live queue pulse — gold stat tiles */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  icon={<Flame className="size-4" />}
                  text={String(incoming.length)}
                  label="Incoming"
                />
                <StatTile
                  icon={<ChefHat className="size-4" />}
                  text={String(activeCount)}
                  label="In progress"
                />
                <StatTile
                  icon={<CheckCheck className="size-4" />}
                  text={String(done.length)}
                  label="Done"
                />
                <StatTile
                  icon={<Banknote className="size-4" />}
                  text={egp(queueValue)}
                  label="Queue value"
                />
              </div>

              {incoming.length > 0 && (
                <Section title="Incoming — tap to confirm" count={incoming.length}>
                  {incoming.map((o) => (
                    <StaggerItem key={o.id}>
                      <OrderCard
                        order={o}
                        highlight
                        showBranch={scopeAll}
                        onClaim={() => claimOrder(o)}
                        onComments={() => setCommentsFor(o)}
                        onAmend={() => startAmend(o)}
                      />
                    </StaggerItem>
                  ))}
                </Section>
              )}
              {mine.length > 0 && (
                <Section title="My orders" count={mine.length}>
                  {mine.map((o) => (
                    <StaggerItem key={o.id}>
                      <OrderCard
                        order={o}
                        showBranch={scopeAll}
                        onStatus={(s) => setStatus(o, s)}
                        onComments={() => setCommentsFor(o)}
                        onAmend={() => startAmend(o)}
                      />
                    </StaggerItem>
                  ))}
                </Section>
              )}
              {othersActive.length > 0 && (
                <Section title="Other active" count={othersActive.length} muted>
                  {othersActive.map((o) => (
                    <StaggerItem key={o.id}>
                      <OrderCard
                        order={o}
                        showBranch={scopeAll}
                        onComments={() => setCommentsFor(o)}
                        onAmend={() => startAmend(o)}
                      />
                    </StaggerItem>
                  ))}
                </Section>
              )}
              {done.length > 0 && (
                <Section title="Done" count={done.length} muted>
                  {done.slice(0, 10).map((o) => (
                    <StaggerItem key={o.id}>
                      <OrderCard
                        order={o}
                        showBranch={scopeAll}
                        onComments={() => setCommentsFor(o)}
                      />
                    </StaggerItem>
                  ))}
                </Section>
              )}
            </div>
          )}
        </main>

        <footer className="relative mt-auto border-t border-white/[0.06] bg-[oklch(0.135_0.014_60/0.6)] py-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
            <Flame className="size-3.5 text-primary" aria-hidden />
            <span>Auto-refreshes every 10 seconds</span>
          </div>
        </footer>
      </div>

      <CommentsSheet
        order={commentsFor}
        open={!!commentsFor}
        onOpenChange={(o) => !o && setCommentsFor(null)}
      />
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
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <Kicker className={muted ? "opacity-60" : undefined}>{title}</Kicker>
        <span
          className={cn(
            "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold ring-1",
            muted
              ? "bg-white/[0.04] text-muted-foreground ring-white/10"
              : "bg-primary/15 text-primary ring-primary/35"
          )}
          aria-label={`${count} orders`}
        >
          {count}
        </span>
      </div>
      <Stagger className="space-y-3">{children}</Stagger>
    </section>
  );
}

function OrderCard({
  order,
  onStatus,
  onComments,
  onClaim,
  onAmend,
  highlight,
  showBranch,
}: {
  order: OrderRow;
  onStatus?: (status: string) => void;
  onComments: () => void;
  onClaim?: () => void;
  /** r58 — start an amend session (active orders only) */
  onAmend?: () => void;
  highlight?: boolean;
  /** r57 — all-branches scope: render the branch chip when present */
  showBranch?: boolean;
}) {
  const lang = useI18n((s) => s.lang);
  const t = useI18n((s) => s.t);
  const items = parseItems(order.itemsJson);
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  const isUnassigned = order.assignment === "unassigned";
  const sourceLabel = isUnassigned
    ? "Guest self-order"
    : order.assignedToName
    ? `Assigned: ${order.assignedToName}`
    : order.source === "guest_scan"
    ? "Guest scan"
    : order.source === "guest_call"
    ? "Guest call"
    : order.source === "employee"
    ? order.orderedByName ?? "Employee"
    : order.source;

  const sla = slaState(order.createdAt, order.status);

  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]",
        highlight
          ? "ring-1 ring-primary/50"
          : order.status === "pending"
          ? "ring-1 ring-primary/30"
          : order.status === "preparing"
          ? "ring-1 ring-amber-500/25"
          : "opacity-75",
        sla?.level === "late" && "ring-2 ring-destructive/60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-bold tracking-tight text-gold-soft">
              {order.customerName || "Walk-in"}
            </p>
            {isUnassigned ? (
              <Badge
                variant="secondary"
                className="rounded-full border-transparent bg-primary/15 text-primary ring-1 ring-primary/45"
              >
                Incoming
              </Badge>
            ) : (
              <Badge variant="secondary" className={meta.cls}>
                {meta.label}
              </Badge>
            )}
            {order.revision != null && order.revision > 0 && (
              <Badge
                variant="secondary"
                className="gap-1 rounded-full border-transparent bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/40"
              >
                <PenLine className="size-3" />
                {t("amendRevWord")} {order.revision}
              </Badge>
            )}
            {sla && (
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1 rounded-full",
                  sla.level === "warn"
                    ? "border-transparent bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/40"
                    : "animate-pulse border-transparent bg-destructive/15 text-destructive ring-1 ring-destructive/45 motion-reduce:animate-none"
                )}
              >
                <AlarmClock className="size-3" />
                {sla.level === "warn" ? "Waiting" : "Late"} {sla.minutes}m
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-foreground/80">
            {order.table && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {order.table}
              </span>
            )}
            {showBranch && order.branchName && (
              <span className="flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                <MapPin className="size-3" /> {(lang === "ar" && order.branchNameAr) || order.branchName}
              </span>
            )}
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="size-3" /> {timeAgo(order.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              {isUnassigned && <Hand className="size-3 text-primary" />}
              {sourceLabel}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/75">
            {order.itemCount} hookah{order.itemCount > 1 ? "s" : ""}
          </p>
          <p className="font-display text-xl font-bold tabular-nums text-gold">
            {egp(order.total)}
          </p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {items.map((it, i) => {
            const brandIds =
              it.components && it.components.length > 1
                ? it.components.map((c) => c.brandId)
                : it.primaryBrandId
                ? [it.primaryBrandId]
                : [];
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] py-0.5 pe-2.5 ps-1 text-[11px] font-medium text-foreground/90"
              >
                {brandIds.length > 1 ? (
                  <BrandStack brandIds={brandIds} size="xs" max={3} />
                ) : brandIds.length === 1 ? (
                  <BrandMark brandId={brandIds[0]} size="xs" noRing />
                ) : null}
                {it.qty}× {it.primaryBrandName} · {it.flavorLabel}
              </span>
            );
          })}
        </div>
      )}

      <div className="ember-hairline mt-3.5" aria-hidden />

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {onClaim && (
          <GoldButton
            size="sm"
            className="h-11 normal-case tracking-wide"
            onClick={onClaim}
          >
            <UserCheck className="size-4" /> Confirm & take
          </GoldButton>
        )}
        {onStatus && order.status === "pending" && (
          <GoldButton
            size="sm"
            className="h-11 normal-case tracking-wide"
            onClick={() => onStatus("preparing")}
          >
            <ChefHat className="size-4" /> Start preparing
          </GoldButton>
        )}
        {onStatus && order.status === "preparing" && (
          <button
            type="button"
            className={glassPillBtn}
            onClick={() => onStatus("pending")}
          >
            <Pause className="size-4" /> Back to pending
          </button>
        )}
        {onStatus && order.status !== "done" && (
          <button
            type="button"
            className={donePillBtn}
            onClick={() => onStatus("done")}
          >
            <CheckCheck className="size-4" /> Mark done
          </button>
        )}
        {onAmend && order.status !== "done" && (
          <button type="button" className={glassPillBtn} onClick={onAmend}>
            <PenLine className="size-4" /> {t("amendAction")}
          </button>
        )}
        <button type="button" className={glassPillBtn} onClick={onComments}>
          <MessageCircle className="size-4" /> Comments
        </button>
      </div>
    </div>
  );
}

function CommentsSheet({
  order,
  open,
  onOpenChange,
}: {
  order: OrderRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [author, setAuthor] = React.useState("Staff");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!order) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/comments`);
      const data = await res.json();
      if (data.ok) setComments(data.comments);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [order]);

  React.useEffect(() => {
    if (open && order) {
      load();
    }
  }, [open, order, load]);

  const submit = async () => {
    if (!order || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: author.trim() || "Staff",
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      setBody("");
      toast.success("Comment added");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add comment");
    } finally {
      setSending(false);
    }
  };

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.155_0.014_60/0.92)] p-0 backdrop-blur-2xl"
      >
        <div
          className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/15"
          aria-hidden
        />
        <SheetHeader className="px-5 pt-2 pb-2">
          <SheetTitle className="flex items-center gap-3 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <MessageCircle className="size-4" />
            </span>
            Order comments
          </SheetTitle>
          <SheetDescription className="tabular-nums">
            Order #{order.id.slice(-6).toUpperCase()} ·{" "}
            {order.customerName || "Walk-in"}
            {order.table ? ` · ${order.table}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="slim-scroll flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl bg-white/[0.05]" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center text-sm text-muted-foreground">
              No comments yet. Add the first one below.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="glass rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-gold-soft">
                      {c.author}
                    </span>
                    <span className="tabular-nums">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground/90">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ember-hairline" aria-hidden />
        <div className="space-y-2.5 p-5 pb-6">
          <input
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            aria-label="Author"
          />
          <textarea
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment — e.g. needs extra coal, customer wants less heat…"
            rows={2}
            aria-label="Comment"
          />
          <GoldButton
            className="h-12 w-full text-sm"
            disabled={!body.trim() || sending}
            onClick={submit}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Send className="size-4" /> Add comment
              </>
            )}
          </GoldButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
