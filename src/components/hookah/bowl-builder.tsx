"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BRANDS,
  MIXABLE_BRANDS,
  BOWL_PRESETS,
  MOLASSES_GRAMS,
  egp,
  brandColor,
  getBrand,
  mixPrice,
  molassesCostPerHookah,
  computeProfit,
  chargeableQty,
  SHISHA_CATEGORIES,
  brandsForCategory,
  type FlavorType,
  type Brand,
} from "@/lib/catalog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Plus,
  X,
  Check,
  CloudUpload,
  Shuffle,
  Leaf,
  Wind,
  Send,
  Loader2,
  TrendingUp,
  Trash2,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { toast } from "sonner";
import { queueOrder } from "@/lib/offline-queue";
import { tierDef } from "@/lib/loyalty";
import { AppHeader, EmptyState, GoldButton, ScreenShell } from "./kit/kit";
import { BrandMark, BrandStack } from "./brand-mark";

// --- types ---

interface FlavorComp {
  brandId: string;
  brandName: string;
  flavorName: string;
  emoji: string;
  grams: number;
}

interface Bowl {
  uid: string; // local id
  primaryBrandId: string;
  flavor: FlavorType;
  components: FlavorComp[];
  qty: number;
}

// --- helpers ---

const FLAVOR_TYPES: { key: FlavorType; label: string; icon: React.ReactNode }[] = [
  { key: "fruits", label: "Fruits", icon: <Leaf className="size-4" /> },
  { key: "fruits-mix", label: "Mix", icon: <Shuffle className="size-4" /> },
];

function bowlUnitPrice(b: Bowl): number {
  if (b.flavor === "fruits") {
    return getBrand(b.primaryBrandId)?.pricing.fruits ?? 0;
  }
  if (b.flavor === "flat") {
    return getBrand(b.primaryBrandId)?.pricing.flat ?? 0;
  }
  return mixPrice(b.components.map((c) => c.brandId));
}

function bowlCost(b: Bowl): number {
  const comps = b.components.length || 1;
  const perHookah = b.components.reduce(
    (s, c) => s + molassesCostPerHookah(c.brandId),
    0
  );
  return (perHookah / comps) * b.qty;
}

let _uid = 0;
function newUid() {
  _uid += 1;
  return `bowl-${_uid}-${Date.now()}`;
}

/** Cinematic gold check that draws itself in (reduced-motion aware). */
function GoldCheck({ size = "size-10" }: { size?: string }) {
  const reduced = useReducedMotion();
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("text-primary", size)}
      fill="none"
      aria-hidden
    >
      <motion.path
        d="m5 13 4.2 4.2L19 7.4"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 170, damping: 22, delay: 0.2 }}
      />
    </svg>
  );
}

// --- the component ---

interface BowlBuilderProps {
  orderedByName: string;
  employeeId: string;
  onSignOut: () => void;
}

export function BowlBuilder({ orderedByName, employeeId, onSignOut }: BowlBuilderProps) {
  // r57: orders created here belong to the employee's working branch
  const { branchId: workingBranchId } = useBranchScope();
  const [bowls, setBowls] = React.useState<Bowl[]>([]);
  const [editing, setEditing] = React.useState<Bowl | null>(null);
  const [customerName, setCustomerName] = React.useState("");
  const [table, setTable] = React.useState("");
  const [loyaltyPhone, setLoyaltyPhone] = React.useState("");
  const [loyaltyChip, setLoyaltyChip] = React.useState<
    { name: string; tier: string; points: number } | null | "new"
  >(null);
  // R46: the numeric Wedjat table id — set by the table picker (the
  // unambiguous check reference), cleared when the name is typed manually.
  const [tableId, setTableId] = React.useState<number | null>(null);
  const [ownType, setOwnType] = React.useState<"hookah" | "molasses" | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<{
    id: string;
    total: number;
    queuedOffline?: boolean;
  } | null>(null);
  const [shishaCat, setShishaCat] = React.useState<string | null>(null);
  const [wedjatTables, setWedjatTables] = React.useState<
    { id: number; name: string; status: string; floor?: string | null }[]
  >([]);

  // Fetch Wedjat RSM tables so the employee can pick from real restaurant tables
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wedjat/tables");
        const data = await res.json();
        if (!cancelled && data.ok) setWedjatTables(data.tables);
      } catch {
        // silent — Wedjat integration is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bogo = ownType === "hookah" || ownType === "molasses";

  // R49: debounced loyalty lookup for the employee-side attach chip.
  React.useEffect(() => {
    const digits = loyaltyPhone.trim();
    if (digits.length < 5) {
      setLoyaltyChip(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/loyalty?phone=${encodeURIComponent(digits)}`
        );
        const data = await res.json();
        setLoyaltyChip(
          data.ok && data.member
            ? {
                name: data.member.name,
                tier: data.member.tier,
                points: data.member.points,
              }
            : "new"
        );
      } catch {
        setLoyaltyChip(null);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [loyaltyPhone]);

  // revenue / cost / profit across all bowls
  const revenue = bowls.reduce((s, b) => {
    const unit = bowlUnitPrice(b);
    return s + unit * chargeableQty(b.qty, bogo);
  }, 0);
  const cost = bowls.reduce((s, b) => bowlCost(b), 0);
  const profit = computeProfit(revenue, cost);
  const totalHookahs = bowls.reduce((s, b) => s + b.qty, 0);

  const startNewBowl = (brand?: Brand) => {
    const b: Bowl = {
      uid: newUid(),
      primaryBrandId: brand?.id ?? "mazaya",
      flavor: brand?.flavorTypes[0] ?? "fruits",
      components: [],
      qty: 1,
    };
    setEditing(b);
  };

  const saveBowl = (b: Bowl) => {
    setBowls((prev) => {
      const exists = prev.find((x) => x.uid === b.uid);
      if (exists) return prev.map((x) => (x.uid === b.uid ? b : x));
      return [...prev, b];
    });
    setEditing(null);
  };

  const removeBowl = (uid: string) => {
    setBowls((prev) => prev.filter((b) => b.uid !== uid));
  };

  const sendOrder = async () => {
    if (bowls.length === 0 || sending) return;
    // Table number is mandatory for employees
    if (!table.trim()) {
      toast.error("Table number is required", {
        description: "Enter the table number before sending the order.",
      });
      return;
    }
    setSending(true);
    try {
      const items = bowls.map((b) => {
        const brand = getBrand(b.primaryBrandId)!;
        return {
          id: `${b.primaryBrandId}:${b.flavor}:${b.uid}`,
          primaryBrandId: b.primaryBrandId,
          primaryBrandName: brand.name,
          emoji: brand.emoji,
          accent: brand.accent,
          flavor: b.flavor,
          flavorLabel:
            b.flavor === "fruits"
              ? "Fruits"
              : b.flavor === "flat"
              ? "Standard"
              : "Fruits Mix",
          components: b.components.map((c) => ({
            brandId: c.brandId,
            brandName: c.brandName,
            flavorName: c.flavorName,
            emoji: c.emoji,
            grams: MOLASSES_GRAMS, // server re-derives anyway
          })),
          molassesGrams: MOLASSES_GRAMS,
          unitPrice: bowlUnitPrice(b),
          qty: b.qty,
        };
      });
      const subtotal = bowls.reduce((s, b) => s + bowlUnitPrice(b) * b.qty, 0);
      const total = revenue;
      const discount = Math.max(0, subtotal - total);

      const resetAfterSend = () => {
        setBowls([]);
        setCustomerName("");
        setTable("");
        setLoyaltyPhone("");
        setLoyaltyChip(null);
        setOwnType(null);
      };

      // Offline (or the network dropped): queue locally — the two-way
      // sync replays it to the kitchen the moment we reconnect.
      const queueOffline = async () => {
        const item = await queueOrder(
          {
            customerName: customerName.trim() || null,
            phone: loyaltyPhone.trim() || null,
            table: table.trim() || null,
            tableId: tableId,
            items,
            subtotal,
            discount,
            total,
            bogo,
            ownType,
            source: "employee",
            orderedByName,
            employeeId,
            branchId: workingBranchId ?? undefined,
            loyaltyPhone: loyaltyPhone.trim() || undefined,
          },
          `${orderedByName} · Table ${table.trim()} · ${egp(total)}`
        );
        setSent({ id: item.id, total, queuedOffline: true });
        resetAfterSend();
        toast.success("Order saved offline", {
          description:
            "It will sync to the kitchen automatically when you reconnect.",
        });
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueOffline();
        return;
      }

      let res: Response;
      try {
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: customerName.trim() || null,
            phone: loyaltyPhone.trim() || null,
            table: table.trim() || null,
            tableId: tableId,
            items,
            subtotal,
            discount,
            total,
            bogo,
            ownType,
            source: "employee",
            orderedByName,
            employeeId,
            loyaltyPhone: loyaltyPhone.trim() || undefined,
          }),
        });
      } catch {
        queueOffline();
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not send");
      setSent({ id: data.order.id, total });
      resetAfterSend();
      toast.success("Order sent to kitchen!", {
        description:
          data.loyalty && data.loyalty.pointsEarned > 0
            ? `${totalHookahs} hookahs · ${egp(total)} · +${data.loyalty.pointsEarned} pts for ${data.loyalty.memberName}`
            : `${totalHookahs} hookahs · ${egp(total)} · synced to Wedjat RSM`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send order");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenShell>
      {/* App bar — cinematic glass header */}
      <AppHeader
        icon={<Flame className="size-5" />}
        title="Bowl builder"
        subtitle={`${orderedByName} · build & send`}
        actions={
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-40 pt-6">
        {sent ? (
          <SentConfirmation
            orderId={sent.id}
            total={sent.total}
            queuedOffline={sent.queuedOffline}
            onDone={() => setSent(null)}
          />
        ) : (
          <>
            {/* Customer + table inline — table is REQUIRED for employees */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer (optional)"
                aria-label="Customer name"
                className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04]"
              />
              <div className="relative">
                <Input
                  value={table}
                  onChange={(e) => {
                    setTable(e.target.value);
                    setTableId(null); // manual typing → name-only reference
                  }}
                  placeholder="Table number *"
                  aria-label="Table number (required)"
                  className={cn(
                    "h-11 rounded-xl border-white/[0.08] bg-white/[0.04]",
                    !table.trim() && "border-amber-500/50"
                  )}
                />
                {wedjatTables.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const t = wedjatTables.find((x) => String(x.id) === v);
                      if (t) {
                        setTable(t.name);
                        setTableId(t.id); // the unambiguous check reference
                      }
                    }}
                    className="absolute end-1 top-1/2 -translate-y-1/2 rounded-lg border border-white/[0.08] bg-[oklch(0.21_0.016_60/0.95)] px-2 py-1.5 text-xs text-muted-foreground backdrop-blur-xl"
                    aria-label="Pick from Wedjat tables"
                  >
                    <option value="">📋 Pick</option>
                    {wedjatTables
                      .filter((t) => t.status === "free" || t.status === "occupied")
                      .map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {`${t.floor ? `${t.floor} · ` : ""}${t.name} (${t.status})`}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              {/* R49: loyalty phone attach — employees can link the order to a member */}
              <div className="col-span-2">
                <Input
                  value={loyaltyPhone}
                  onChange={(e) => setLoyaltyPhone(e.target.value)}
                  placeholder="📱 Loyalty phone (optional — earn points for the customer)"
                  inputMode="tel"
                  aria-label="Loyalty phone (optional)"
                  className={cn(
                    "h-11 rounded-xl border-white/[0.08] bg-white/[0.04]",
                    loyaltyChip &&
                      loyaltyChip !== "new" &&
                      "border-primary/50 bg-primary/5"
                  )}
                />
                {loyaltyChip === "new" && (
                  <p className="mt-1 text-[11px] text-amber-500">
                    New member — joins Mazaj+ automatically (50 bonus pts)
                  </p>
                )}
                {loyaltyChip && loyaltyChip !== "new" && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-primary">
                    {tierDef(loyaltyChip.tier).emoji} {loyaltyChip.name} ·{" "}
                    {tierDef(loyaltyChip.tier).label} · {loyaltyChip.points} pts
                  </p>
                )}
              </div>
            </div>

            {/* Quick presets */}
            <section className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-gold-soft">
                <Zap className="size-3.5 text-primary" /> Quick presets
              </p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {BOWL_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const comps: FlavorComp[] = p.components.map((c) => {
                        const brand = getBrand(c.brandId)!;
                        return {
                          brandId: c.brandId,
                          brandName: brand.name,
                          flavorName: c.flavorName,
                          emoji: brand.emoji,
                          grams: MOLASSES_GRAMS,
                        };
                      });
                      const b: Bowl = {
                        uid: newUid(),
                        primaryBrandId: comps[0].brandId,
                        flavor: "fruits-mix",
                        components: comps,
                        qty: 1,
                      };
                      setBowls((prev) => [...prev, b]);
                      toast.success(`${p.name} added`, {
                        description: p.tag,
                      });
                    }}
                    className="glass group flex shrink-0 flex-col items-center gap-1 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35"
                    style={{ minWidth: 88 }}
                  >
                    <span className="transition-transform duration-300 group-hover:scale-110">
                      <BrandStack
                        brandIds={p.components.map((c) => c.brandId)}
                        size="sm"
                        max={2}
                      />
                    </span>
                    <span className="text-center text-[11px] font-medium leading-tight">
                      {p.name}
                    </span>
                    <span className="text-[9px] text-primary">{p.tag}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Bowls in this order */}
            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-lg font-bold tracking-tight text-gold-soft">
                  This order{" "}
                  <span className="font-sans text-xs font-normal text-muted-foreground">
                    ({bowls.length} bowl{bowls.length !== 1 ? "s" : ""})
                  </span>
                </p>
                {bowls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBowls([])}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <AnimatePresence mode="popLayout">
                {bowls.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <EmptyState
                      icon={<span className="text-2xl">🌬️</span>}
                      title="No bowls yet"
                      description="Tap a brand below or a preset above to start."
                    />
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {bowls.map((b) => {
                      const unit = bowlUnitPrice(b);
                      const costB = bowlCost(b);
                      const profitB = computeProfit(unit * b.qty, costB);
                      return (
                        <motion.div
                          key={b.uid}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="glass flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35"
                        >
                          {/* mini bowl viz */}
                          <BowlViz components={b.components} size={44} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">
                              {getBrand(b.primaryBrandId)?.name} ·{" "}
                              {b.flavor === "fruits" ? "Fruits" : "Mix"}
                              {b.qty > 1 && ` × ${b.qty}`}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {b.components.length === 0
                                ? "No flavors"
                                : b.components
                                    .map((c) => c.flavorName)
                                    .join(" + ")}
                            </p>
                            <p className="text-[11px] text-emerald-500">
                              +{egp(profitB.netProfit)} profit ({profitB.marginPct}%)
                            </p>
                          </div>
                          <div className="text-end">
                            <p className="font-display font-bold tabular-nums text-gold">
                              {egp(unit * b.qty)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBowl(b.uid)}
                            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Remove bowl"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
            </section>

            {/* Shisha category + Brand grid */}
            <section>
              {!shishaCat ? (
                <div>
                  <p className="font-display mb-2 text-lg font-bold tracking-tight text-gold-soft">
                    Choose shisha type
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SHISHA_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setShishaCat(cat.key)}
                        className="group glass relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.8)]"
                      >
                        <div
                          className="pointer-events-none absolute -end-10 -top-12 size-36 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
                          aria-hidden
                        />
                        <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/95 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                          <img
                            src={cat.logo}
                            alt={cat.label}
                            className="h-full w-full object-contain p-1"
                            loading="lazy"
                          />
                        </span>
                        <div className="relative min-w-0 flex-1">
                          <p className="font-display text-base font-bold text-gold-soft">
                            {cat.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-display text-lg font-bold tracking-tight text-gold-soft">
                      {SHISHA_CATEGORIES.find((c) => c.key === shishaCat)?.label}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShishaCat(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← Change
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {brandsForCategory(shishaCat).map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => startNewBowl(brand)}
                        className="group glass relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.8)]"
                      >
                        <div
                          className="absolute -top-6 right-0 h-20 w-20 rounded-full opacity-60 blur-xl transition-opacity group-hover:opacity-100"
                          style={{ backgroundColor: brandColor(brand.id) }}
                          aria-hidden
                        />
                        <span
                          className="relative grid size-12 place-items-center overflow-hidden rounded-xl bg-white/95"
                          style={{ boxShadow: `0 0 0 1px ${brandColor(brand.id)}40` }}
                        >
                          <img
                            src={brand.logo}
                            alt={brand.name}
                            className="h-full w-full object-contain p-1"
                            loading="lazy"
                          />
                        </span>
                        <p className="relative text-sm font-semibold">{brand.name}</p>
                        <p className="font-display relative text-[10px] font-bold tabular-nums text-gold">
                          from {egp(brand.pricing.flat ?? brand.pricing.fruits ?? 0)}
                        </p>
                        {brand.badge && (
                          <Badge
                            variant="secondary"
                            className="relative border border-primary/30 bg-primary/15 text-primary"
                          >
                            {brand.badge}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative mt-auto border-t border-white/[0.06] bg-[oklch(0.135_0.014_60/0.6)] py-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
          <Flame className="size-3 text-primary" />
          20g per bowl · Profit shown live as you build
        </div>
      </footer>

      {/* Floating send bar */}
      {bowls.length > 0 && !sent && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          style={{ bottom: 68 }}
        >
          <div className="glass mx-auto flex w-full max-w-5xl items-center gap-3 rounded-2xl p-3 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.9)]">
            {/* revenue + profit */}
            <div className="leading-tight">
              <p className="text-[11px] text-muted-foreground">
                {totalHookahs} bowl{totalHookahs > 1 ? "s" : ""}
                {bogo ? " · 2-for-1" : ""}
              </p>
              <p className="font-display text-lg font-bold tabular-nums text-gold">
                {egp(revenue)}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-emerald-500">
                <TrendingUp className="size-3" />
                +{egp(profit.netProfit)} ({profit.marginPct}%)
              </p>
            </div>
            {/* BYO toggle */}
            <button
              type="button"
              onClick={() => setOwnType(ownType ? null : "hookah")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all duration-300",
                bogo
                  ? "border-primary/40 bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "border-white/[0.08] text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <Wind className="size-3.5" />
              BYO
            </button>
            <GoldButton
              size="lg"
              className="ms-auto"
              disabled={sending}
              onClick={sendOrder}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Send className="size-4" /> Send order
                </>
              )}
            </GoldButton>
          </div>
        </motion.div>
      )}

      {/* Bowl editor sheet */}
      <AnimatePresence>
        {editing && (
          <BowlEditor
            bowl={editing}
            onSave={saveBowl}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </ScreenShell>
  );
}

// --- visual bowl (circular SVG with colored segments) ---

function BowlViz({
  components,
  size = 64,
}: {
  components: FlavorComp[];
  size?: number;
}) {
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;

  if (components.length === 0) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-full border-2 border-dashed border-white/10 bg-white/[0.03]"
        style={{ width: size, height: size }}
      >
        <Plus className="size-4 text-muted-foreground" />
      </div>
    );
  }

  // pie segments
  const segments = components.map((c, i) => {
    const angle = (360 / components.length) * i;
    const color = brandColor(c.brandId);
    return { angle, color, flavorName: c.flavorName, brandId: c.brandId };
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {segments.map((s, i) => {
          const start = (s.angle * Math.PI) / 180;
          const end = ((s.angle + 360 / segments.length) * Math.PI) / 180;
          const x1 = cx + r * Math.cos(start);
          const y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end);
          const y2 = cy + r * Math.sin(end);
          const largeArc = 360 / segments.length > 180 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={s.color}
              opacity={0.85}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r * 0.35} fill="var(--background)" />
      </svg>
    </div>
  );
}

// --- bowl editor (full-screen modal) ---

function BowlEditor({
  bowl,
  onSave,
  onCancel,
}: {
  bowl: Bowl;
  onSave: (b: Bowl) => void;
  onCancel: () => void;
}) {
  const reduced = useReducedMotion();
  const [draft, setDraft] = React.useState<Bowl>(bowl);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const brand = getBrand(draft.primaryBrandId);
  const isFlat = brand?.flavorTypes.length === 1 && brand.flavorTypes[0] === "flat";
  const unit = bowlUnitPrice(draft);
  const cost = bowlCost(draft);
  const profit = computeProfit(unit * draft.qty, cost);

  const setFlavorType = (f: FlavorType) => {
    setDraft((d) => ({ ...d, flavor: f, components: f === "fruits" ? d.components.slice(0, 1) : d.components }));
  };

  const addComponent = (brandId: string, flavorName: string) => {
    const b = getBrand(brandId)!;
    setDraft((d) => ({
      ...d,
      components: [
        ...d.components,
        {
          brandId,
          brandName: b.name,
          flavorName,
          emoji: b.emoji,
          grams: MOLASSES_GRAMS,
        },
      ],
    }));
    setPickerOpen(false);
  };

  const removeComponent = (idx: number) => {
    setDraft((d) => ({
      ...d,
      components: d.components.filter((_, i) => i !== idx),
    }));
  };

  const canSave =
    draft.components.length > 0 && (isFlat || draft.flavor === "fruits" || draft.flavor === "fruits-mix");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="slim-scroll relative max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/[0.08] bg-[oklch(0.175_0.015_60/0.95)] backdrop-blur-2xl sm:rounded-3xl"
      >
        <div className="ember-glow pointer-events-none absolute inset-0 rounded-3xl" />
        <div className="relative p-5">
          {/* grab handle + header */}
          <div
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15"
            aria-hidden
          />
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={onCancel}
              className="flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" /> Cancel
            </button>
            <p className="font-display text-xl font-bold tracking-tight text-gold-soft">
              Build bowl
            </p>
            <div className="w-16" />
          </div>

          {/* Bowl visualization */}
          <div className="mb-5 flex flex-col items-center gap-3">
            <BowlViz components={draft.components} size={120} />
            <div className="text-center">
              <span className="inline-flex items-center gap-2">
                {brand && <BrandMark brandId={brand.id} size="md" />}
                <span className="font-display text-lg font-bold text-gold-soft">
                  {brand?.name}
                </span>
              </span>
              <p className="text-xs text-muted-foreground">
                {draft.components.length === 0
                  ? "Add flavors to fill the bowl"
                  : `${draft.components.length} flavor${draft.components.length > 1 ? "s" : ""} · 20g`}
              </p>
            </div>
          </div>

          {/* Flavor type */}
          {!isFlat && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {FLAVOR_TYPES.map((ft) => {
                const active = draft.flavor === ft.key;
                const price =
                  ft.key === "fruits"
                    ? brand?.pricing.fruits ?? 0
                    : brand?.pricing.fruitsMix ?? 0;
                return (
                  <motion.button
                    key={ft.key}
                    type="button"
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    onClick={() => setFlavorType(ft.key)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border p-2.5 text-start transition-all duration-300",
                      active
                        ? "border-primary/40 bg-primary/10 ring-1 ring-primary/40"
                        : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:bg-white/[0.06]"
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                      {ft.icon}
                    </span>
                    <div className="min-w-0 text-start">
                      <p className="text-sm font-medium">{ft.label}</p>
                      <p className="font-display text-sm font-bold tabular-nums text-gold">
                        {egp(price)}
                      </p>
                    </div>
                    {active && <Check className="ms-auto size-4 shrink-0 text-primary" />}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Flavor components */}
          {draft.components.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {draft.components.map((c, i) => (
                <div
                  key={`${c.brandId}:${c.flavorName}:${i}`}
                  className="glass flex items-center gap-2.5 rounded-xl px-3 py-1.5"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: brandColor(c.brandId) }}
                  />
                  <span className="text-lg">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.brandName} · {c.flavorName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeComponent(i)}
                    className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove flavor"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add flavor button */}
          {!isFlat && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-medium text-foreground transition-all duration-300 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <Plus className="size-4" />
              {draft.components.length === 0 ? "Add a flavor" : "Add another flavor"}
            </button>
          )}

          {/* Flat brand: pick a single flavor */}
          {isFlat && draft.components.length === 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {brand?.flavors.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => addComponent(brand.id, f)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm transition-all duration-300 hover:border-primary/40 hover:text-primary"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Quantity */}
          <div className="glass mb-4 flex items-center justify-between rounded-2xl p-1.5">
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, qty: Math.max(1, d.qty - 1) }))}
              disabled={draft.qty <= 1}
              aria-label="Decrease quantity"
              className="grid size-11 place-items-center rounded-full text-lg font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-40"
            >
              −
            </button>
            <span className="font-display text-2xl font-bold tabular-nums text-gold">
              {draft.qty}
            </span>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, qty: Math.min(99, d.qty + 1) }))}
              aria-label="Increase quantity"
              className="grid size-11 place-items-center rounded-full text-lg font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            >
              +
            </button>
          </div>

          {/* Live profit */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="glass rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Revenue</p>
              <p className="font-display text-sm font-bold tabular-nums text-gold">
                {egp(unit * draft.qty)}
              </p>
            </div>
            <div className="glass rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Cost</p>
              <p className="font-display text-sm font-bold tabular-nums text-amber-500">
                {egp(cost)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Profit</p>
              <p className="font-display text-sm font-bold tabular-nums text-emerald-500">
                +{egp(profit.netProfit)}
              </p>
              <p className="text-[10px] text-emerald-500">{profit.marginPct}%</p>
            </div>
          </div>

          {/* Save */}
          <GoldButton
            size="lg"
            className="w-full"
            disabled={!canSave}
            onClick={() => onSave(draft)}
          >
            <Check className="size-4" /> Add to order · {egp(unit * draft.qty)}
          </GoldButton>
        </div>

        {/* Flavor picker */}
        {pickerOpen && (
          <FlavorPickerModal
            onPick={addComponent}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

function FlavorPickerModal({
  onPick,
  onClose,
}: {
  onPick: (brandId: string, flavorName: string) => void;
  onClose: () => void;
}) {
  const [activeBrand, setActiveBrand] = React.useState(MIXABLE_BRANDS[0]?.id ?? "mazaya");
  const brand = getBrand(activeBrand) ?? MIXABLE_BRANDS[0]!;

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-3xl bg-[oklch(0.19_0.016_60/0.98)] p-4 backdrop-blur-2xl">
      {/* grab handle + header */}
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-lg font-bold tracking-tight text-gold-soft">
          Pick a flavor
        </p>
        <button
          onClick={onClose}
          aria-label="Close flavor picker"
          className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      {/* brand tabs */}
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {MIXABLE_BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setActiveBrand(b.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border py-1 pe-3 ps-1.5 text-xs transition-all duration-300",
              activeBrand === b.id
                ? "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/40"
                : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:text-primary"
            )}
          >
            <BrandMark brandId={b.id} size="xs" />
            {b.name}
          </button>
        ))}
      </div>
      <div className="slim-scroll flex flex-wrap content-start gap-2 overflow-y-auto">
        {brand.flavors.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onPick(brand.id, f)}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm transition-all duration-300 hover:border-primary/40 hover:text-primary"
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function SentConfirmation({
  orderId,
  total,
  queuedOffline,
  onDone,
}: {
  orderId: string;
  total: number;
  queuedOffline?: boolean;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      {queuedOffline && (
        <div className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-amber-300 ring-1 ring-amber-500/30">
          <CloudUpload className="size-4" />
          Saved offline — syncs to the kitchen when you reconnect
        </div>
      )}
      <motion.div
        initial={reduced ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="relative grid size-20 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/30"
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-primary/15 blur-xl"
          aria-hidden
        />
        <GoldCheck />
      </motion.div>
      <div>
        <p className="font-display text-2xl font-bold tracking-tight text-gold-soft">
          Order sent!
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">#{orderId.slice(-6).toUpperCase()}</span> ·{" "}
          <span className="font-display font-bold tabular-nums text-gold">
            {egp(total)}
          </span>
        </p>
      </div>
      <GoldButton onClick={onDone}>
        <Plus className="size-4" /> New order
      </GoldButton>
    </motion.div>
  );
}
