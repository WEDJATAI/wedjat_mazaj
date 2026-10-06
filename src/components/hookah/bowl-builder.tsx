"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Plus,
  X,
  Check,
  Shuffle,
  Leaf,
  Wind,
  FlaskRound,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  Trash2,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

// --- the component ---

interface BowlBuilderProps {
  orderedByName: string;
  employeeId: string;
  onSignOut: () => void;
}

export function BowlBuilder({ orderedByName, employeeId, onSignOut }: BowlBuilderProps) {
  const [bowls, setBowls] = React.useState<Bowl[]>([]);
  const [editing, setEditing] = React.useState<Bowl | null>(null);
  const [customerName, setCustomerName] = React.useState("");
  const [table, setTable] = React.useState("");
  const [ownType, setOwnType] = React.useState<"hookah" | "molasses" | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<{ id: string; total: number } | null>(null);
  const [shishaCat, setShishaCat] = React.useState<string | null>(null);

  const bogo = ownType === "hookah" || ownType === "molasses";

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
          flavorLabel: b.flavor === "fruits" ? "Fruits" : "Fruits Mix",
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

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim() || null,
          table: table.trim() || null,
          items,
          subtotal,
          discount,
          total,
          bogo,
          ownType,
          source: "employee",
          orderedByName,
          employeeId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not send");
      setSent({ id: data.order.id, total });
      setBowls([]);
      setCustomerName("");
      setTable("");
      setOwnType(null);
      toast.success("Order sent to kitchen!", {
        description: `${totalHookahs} hookahs · ${egp(total)}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send order");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        {/* App bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Flame className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">Bowl builder</p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                {orderedByName} · build & send
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto rounded-full"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-40 pt-6">
          {sent ? (
            <SentConfirmation
              orderId={sent.id}
              total={sent.total}
              onDone={() => setSent(null)}
            />
          ) : (
            <>
              {/* Customer + table inline */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer (optional)"
                  aria-label="Customer name"
                  className="rounded-xl"
                />
                <Input
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  placeholder="Table / room"
                  aria-label="Table"
                  className="rounded-xl"
                />
              </div>

              {/* Quick presets */}
              <section className="mb-5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
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
                      className="group flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 transition-all hover:border-primary/60 hover:bg-primary/5"
                      style={{ minWidth: 88 }}
                    >
                      <span className="text-2xl">{p.emoji}</span>
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
                  <p className="text-sm font-semibold">
                    This order{" "}
                    <span className="text-muted-foreground">
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
                      className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center"
                    >
                      <span className="mb-2 block text-4xl">🌬️</span>
                      <p className="text-sm font-medium">No bowls yet</p>
                      <p className="text-xs text-muted-foreground">
                        Tap a brand below or a preset above to start.
                      </p>
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
                            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
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
                            <div className="text-right">
                              <p className="font-bold">{egp(unit * b.qty)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeBowl(b.uid)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                    <p className="mb-2 text-sm font-semibold">Choose shisha type</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {SHISHA_CATEGORIES.map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setShishaCat(cat.key)}
                          className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
                        >
                          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/95 ring-1 ring-border">
                            <img
                              src={cat.logo}
                              alt={cat.label}
                              className="h-full w-full object-contain p-1"
                              loading="lazy"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{cat.label}</p>
                            <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">
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
                          className="group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5"
                        >
                          <div
                            className="absolute -top-6 right-0 h-20 w-20 rounded-full opacity-60 blur-xl transition-opacity group-hover:opacity-100"
                            style={{ backgroundColor: brandColor(brand.id) }}
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
                          <p className="relative text-[10px] text-muted-foreground">
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
        <footer className="relative mt-auto border-t border-border bg-background/60 py-4">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
            <Flame className="size-3 text-primary" />
            20g per bowl · Profit shown live as you build
          </div>
        </footer>
      </div>

      {/* Floating send bar */}
      {bowls.length > 0 && !sent && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          style={{ bottom: 68 }}
        >
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
            {/* revenue + profit */}
            <div className="leading-tight">
              <p className="text-[11px] text-muted-foreground">
                {totalHookahs} bowl{totalHookahs > 1 ? "s" : ""}
                {bogo ? " · 2-for-1" : ""}
              </p>
              <p className="text-lg font-bold tabular-nums">{egp(revenue)}</p>
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
                "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all",
                bogo
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Wind className="size-3.5" />
              BYO
            </button>
            <Button
              size="lg"
              className="ml-auto gap-2 rounded-xl font-semibold"
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
            </Button>
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
    </div>
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
        className="grid place-items-center rounded-full border-2 border-dashed border-border bg-muted/40"
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
    <div className="relative" style={{ width: size, height: size }}>
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
        className="slim-scroll dark relative max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-background sm:rounded-3xl"
      >
        <div className="ember-glow pointer-events-none absolute inset-0 rounded-3xl" />
        <div className="relative p-5">
          {/* header */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={onCancel}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" /> Cancel
            </button>
            <p className="font-semibold">Build bowl</p>
            <div className="w-16" />
          </div>

          {/* Bowl visualization */}
          <div className="mb-5 flex flex-col items-center gap-3">
            <BowlViz components={draft.components} size={120} />
            <div className="text-center">
              <p className="font-bold">
                {brand?.emoji} {brand?.name}
              </p>
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
                  <button
                    key={ft.key}
                    type="button"
                    onClick={() => setFlavorType(ft.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2.5 transition-all",
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-primary">{ft.icon}</span>
                    <div className="text-left">
                      <p className="text-sm font-medium">{ft.label}</p>
                      <p className="text-xs text-primary">{egp(price)}</p>
                    </div>
                    {active && <Check className="ml-auto size-4 text-primary" />}
                  </button>
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
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span
                    className="size-3 rounded-full"
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
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add flavor button */}
          {!isFlat && (
            <Button
              type="button"
              variant="outline"
              className="mb-4 w-full rounded-xl"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="size-4" />
              {draft.components.length === 0 ? "Add a flavor" : "Add another flavor"}
            </Button>
          )}

          {/* Flat brand: pick a single flavor */}
          {isFlat && draft.components.length === 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {brand?.flavors.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => addComponent(brand.id, f)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Quantity */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-card p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDraft((d) => ({ ...d, qty: Math.max(1, d.qty - 1) }))}
              disabled={draft.qty <= 1}
            >
              −
            </Button>
            <span className="text-xl font-bold tabular-nums">{draft.qty}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDraft((d) => ({ ...d, qty: Math.min(99, d.qty + 1) }))}
            >
              +
            </Button>
          </div>

          {/* Live profit */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Revenue</p>
              <p className="text-sm font-bold">{egp(unit * draft.qty)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Cost</p>
              <p className="text-sm font-bold text-amber-500">{egp(cost)}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Profit</p>
              <p className="text-sm font-bold text-emerald-500">
                +{egp(profit.netProfit)}
              </p>
              <p className="text-[10px] text-emerald-500">{profit.marginPct}%</p>
            </div>
          </div>

          {/* Save */}
          <Button
            size="lg"
            className="w-full rounded-xl text-base font-semibold"
            disabled={!canSave}
            onClick={() => onSave(draft)}
          >
            <Check className="size-4" /> Add to order · {egp(unit * draft.qty)}
          </Button>
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
    <div className="absolute inset-0 z-10 flex flex-col rounded-3xl bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">Pick a flavor</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all",
              activeBrand === b.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            <span>{b.emoji}</span>
            {b.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {brand.flavors.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onPick(brand.id, f)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
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
  onDone,
}: {
  orderId: string;
  total: number;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="grid size-20 place-items-center rounded-full bg-emerald-500/15"
      >
        <Check className="size-10 text-emerald-500" />
      </motion.div>
      <div>
        <p className="text-xl font-bold">Order sent!</p>
        <p className="text-sm text-muted-foreground">
          #{orderId.slice(-6).toUpperCase()} · {egp(total)}
        </p>
      </div>
      <Button className="rounded-xl" onClick={onDone}>
        <Plus className="size-4" /> New order
      </Button>
    </motion.div>
  );
}
