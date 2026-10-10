"use client";

import * as React from "react";
import {
  BRANDS,
  Brand,
  egp,
  BOWL_PRESETS,
  getBrand,
  MOLASSES_GRAMS,
  SHISHA_CATEGORIES,
  brandsForCategory,
  normalizeSearchQuery,
} from "@/lib/catalog";
import { useCart, computeTotals, splitGrams } from "@/store/cart";
import { BrandCard } from "./brand-card";
import { BrandMark, BrandStack } from "./brand-mark";
import { ConfigSheet } from "./config-sheet";
import { CartDrawer } from "./cart-drawer";
import { CheckoutDialog } from "./checkout-dialog";
import { Input } from "@/components/ui/input";
import {
  ShoppingBag,
  Sparkles,
  Wind,
  FlaskRound,
  ArrowRight,
  LogOut,
  ScanLine,
  Search,
  Plus,
  PenLine,
} from "lucide-react";
import { BarcodeModal } from "./barcode-modal";
import { SessionTimer } from "./session-timer";
import { motion } from "framer-motion";
import { useI18n } from "@/store/i18n";
import { toast } from "sonner";
import { haptic } from "@/lib/delight";
import { cn } from "@/lib/utils";
import {
  AppHeader,
  EASE,
  GoldButton,
  Kicker,
  ScreenShell,
  Stagger,
  StaggerItem,
  Wordmark,
} from "./kit/kit";

function useMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return m;
}

/** True when any search term is a substring of the text. */
function matchTerms(terms: string[], text: string): boolean {
  return terms.some((term) => text.includes(term));
}

interface OrderScreenProps {
  title: string;
  subtitle?: string;
  source: "employee" | "guest_scan" | "guest_call";
  orderedByName: string;
  employeeId?: string | null;
  defaultCustomer?: string;
  defaultTable?: string;
  /** R46: numeric Wedjat table id (POS link / picker) — threaded to the
   * checkout payload so the check lands on the right table. */
  defaultTableId?: number | null;
  /** r57: the branch this order is placed at (guest session / employee scope) */
  branchId?: string | null;
  headerExtra?: React.ReactNode;
  onSignOut?: () => void;
  /** show the scan button + barcode modal (guest mode) */
  enableScan?: boolean;
  /** show the session timer card (employee) */
  showTimer?: boolean;
  /** optional banner shown above the hero (e.g. returning-guest welcome) */
  returningBanner?: React.ReactNode;
  /** pixels to lift the floating cart bar (e.g. above a bottom tab bar) */
  bottomInset?: number;
  /** R49: called with the placed order id — lets the guest flow open
   * the live tracking view straight from checkout. */
  onOrderPlaced?: (orderId: string) => void;
  /** r58: fired after an amend session saves (parent lists refresh). */
  onAmended?: () => void;
}

export function OrderScreen({
  title,
  subtitle,
  source,
  orderedByName,
  employeeId,
  defaultCustomer,
  defaultTable,
  defaultTableId,
  branchId,
  headerExtra,
  onSignOut,
  enableScan = false,
  showTimer = false,
  returningBanner,
  bottomInset = 0,
  onOrderPlaced,
  onAmended,
}: OrderScreenProps) {
  const mounted = useMounted();
  const t = useI18n((s) => s.t);
  const items = useCart((s) => s.items);
  const ownType = useCart((s) => s.ownType);
  const addItem = useCart((s) => s.addItem);
  // r58 living orders — the whole screen becomes the order editor
  const amendOrderId = useCart((s) => s.amendOrderId);
  const amending = !!amendOrderId;
  const totals = computeTotals(items, ownType);

  const [selectedBrand, setSelectedBrand] = React.useState<Brand | null>(null);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [shishaCat, setShishaCat] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const cartCount = mounted ? totals.totalQty : 0;

  const handleSelectBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    setConfigOpen(true);
  };

  const handleScan = (brandId: string) => {
    const brand = BRANDS.find((b) => b.id === brandId);
    if (brand) {
      setSelectedBrand(brand);
      setConfigOpen(true);
    }
  };

  const handleCheckout = () => {
    setCartOpen(false);
    setTimeout(() => setCheckoutOpen(true), 180);
  };

  const inCartFor = (brandId: string) =>
    items.filter((i) => i.primaryBrandId === brandId).reduce((s, i) => s + i.qty, 0);

  // ─── r54: live menu search (brands, flavors, presets) ───────────────────
  // Arabic queries are normalized to the catalog's English names first.
  const terms = React.useMemo(
    () =>
      normalizeSearchQuery(query.trim().toLowerCase())
        .split(/\s+/)
        .filter((w) => w.length > 1),
    [query]
  );
  const searchActive = terms.length > 0;

  const flavorMatches = React.useMemo(() => {
    if (!searchActive) return [];
    const out: { brand: Brand; flavor: string }[] = [];
    for (const brand of BRANDS) {
      for (const flavor of brand.flavors) {
        if (
          matchTerms(terms, flavor.toLowerCase()) ||
          matchTerms(terms, brand.name.toLowerCase())
        ) {
          out.push({ brand, flavor });
        }
      }
    }
    return out.slice(0, 12);
  }, [terms, searchActive]);

  const brandMatches = React.useMemo(() => {
    if (!searchActive) return [];
    return BRANDS.filter((b) => matchTerms(terms, b.name.toLowerCase()));
  }, [terms, searchActive]);

  const presetMatches = React.useMemo(() => {
    if (!searchActive) return [];
    return BOWL_PRESETS.filter(
      (p) =>
        matchTerms(terms, p.name.toLowerCase()) ||
        p.components.some((c) => matchTerms(terms, c.flavorName.toLowerCase()))
    );
  }, [terms, searchActive]);

  const hasMatches =
    flavorMatches.length > 0 ||
    brandMatches.length > 0 ||
    presetMatches.length > 0;

  const addFlavorQuick = (brand: Brand, flavor: string) => {
    const isFlat = brand.flavorTypes.length === 1 && brand.flavorTypes[0] === "flat";
    addItem({
      primaryBrandId: brand.id,
      primaryBrandName: brand.name,
      emoji: brand.emoji,
      accent: brand.accent,
      flavor: isFlat ? "flat" : "fruits",
      flavorLabel: isFlat ? "Standard" : "Fruits",
      components: [
        {
          brandId: brand.id,
          brandName: brand.name,
          flavorName: flavor,
          emoji: brand.emoji,
          grams: MOLASSES_GRAMS,
        },
      ],
      molassesGrams: MOLASSES_GRAMS,
      unitPrice: isFlat ? brand.pricing.flat ?? 45 : brand.pricing.fruits ?? 125,
      qty: 1,
    });
    haptic("light");
    toast.success(`${brand.name} · ${flavor} — ${t("addedToCart")}`);
  };

  const addPreset = (presetId: string) => {
    const p = BOWL_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    const brand = getBrand(p.components[0].brandId);
    if (!brand) return;
    const comps = p.components.map((c) => {
      const b = getBrand(c.brandId)!;
      return {
        brandId: c.brandId,
        brandName: b.name,
        flavorName: c.flavorName,
        emoji: b.emoji,
        grams: MOLASSES_GRAMS,
      };
    });
    const unit =
      p.components.length > 1
        ? Math.max(
            ...p.components.map(
              (c) => getBrand(c.brandId)?.pricing.fruitsMix ?? 145
            )
          )
        : getBrand(p.components[0]?.brandId)?.pricing.fruits ?? 125;
    addItem({
      primaryBrandId: comps[0].brandId,
      primaryBrandName: comps[0].brandName,
      emoji: comps[0].emoji,
      accent: brand.accent,
      flavor: p.components.length > 1 ? "fruits-mix" : "fruits",
      flavorLabel: p.components.length > 1 ? "Fruits Mix" : "Fruits",
      components:
        p.components.length > 1
          ? (() => {
              const grams = splitGrams(comps.length);
              return comps.map((c, i) => ({ ...c, grams: grams[i] }));
            })()
          : comps,
      molassesGrams: MOLASSES_GRAMS,
      unitPrice: unit,
      qty: 1,
    });
    haptic("light");
    toast.success(`${p.emoji} ${p.name} — ${t("addedToCart")}`);
  };

  return (
    <ScreenShell>
      <AppHeader
        wordmark
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {enableScan && (
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="glass inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Scan barcode"
              >
                <ScanLine className="size-4" />
                <span className="hidden sm:inline">{t("scan")}</span>
              </button>
            )}
            {headerExtra}
            <span className="hidden rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground md:inline-flex">
              20g / {t("perHookah")}
            </span>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="glass relative inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("cartBtn")}
            >
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">{t("cartBtn")}</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -end-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] px-1 text-[11px] font-bold text-[oklch(0.17_0.03_50)] shadow-lg">
                  {cartCount}
                </span>
              )}
            </button>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t("signOut")}
              >
                <LogOut className="size-4" />
              </button>
            )}
          </>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-40 pt-6 sm:px-5">
        {returningBanner}
        {showTimer && (
          <section className="mb-6">
            <SessionTimer />
          </section>
        )}

        {/* Menu search (r54) */}
        <section className="mb-6" aria-label={t("searchMenu")}>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] ps-10 pe-4 text-base backdrop-blur-xl"
              aria-label={t("searchMenu")}
            />
            {searchActive && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t("cancel")}
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {searchActive ? (
          /* ─── Search results ─── */
          <section className="space-y-6">
            <div>
              <Kicker className="mb-4">{t("searchMatches")}: “{query.trim()}”</Kicker>
              {!hasMatches && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
                  {t("searchNoResults")}
                </div>
              )}

              {/* matching flavors — one-tap add rows */}
              {flavorMatches.length > 0 && (
                <Stagger className="space-y-2">
                  {flavorMatches.map(({ brand, flavor }) => {
                    const isFlat =
                      brand.flavorTypes.length === 1 &&
                      brand.flavorTypes[0] === "flat";
                    return (
                      <StaggerItem key={`${brand.id}:${flavor}`}>
                        <button
                          type="button"
                          onClick={() => addFlavorQuick(brand, flavor)}
                          className="group glass flex w-full items-center gap-3 rounded-2xl p-3 text-start transition-all hover:border-primary/35 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)] active:scale-[0.99]"
                        >
                          <BrandMark brandId={brand.id} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {brand.name} · {flavor}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isFlat ? brand.pricing.flat : brand.pricing.fruits}{" "}
                              EGP · {isFlat ? "Standard" : "Fruits"} · 20g
                            </p>
                          </div>
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-105">
                            <Plus className="size-4" />
                          </span>
                        </button>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              )}

              {/* matching presets */}
              {presetMatches.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {presetMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addPreset(p.id)}
                      className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-1.5 pe-3.5 ps-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 active:scale-95"
                    >
                      <BrandStack
                        brandIds={p.components.map((c) => c.brandId)}
                        size="xs"
                        max={2}
                      />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {/* whole-brand matches open the config sheet */}
              {brandMatches.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {brandMatches.map((brand, i) => (
                    <BrandCard
                      key={brand.id}
                      brand={brand}
                      inCart={mounted ? inCartFor(brand.id) : 0}
                      onSelect={() => handleSelectBrand(brand)}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* ─── Hero — the lounge invitation ───────────────────────── */}
            <section className="relative overflow-hidden rounded-3xl border border-white/[0.07]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url(/images/hero.png)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.135_0.014_60)] via-[oklch(0.135_0.014_60/0.82)] to-[oklch(0.135_0.014_60/0.35)]" />
              <div className="vignette absolute inset-0 opacity-50" aria-hidden />

              <div className="relative flex flex-col gap-4 p-6 sm:p-10">
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                  className="glass inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary"
                >
                  <Sparkles className="size-3.5" />
                  {t("egyptianLounge")}
                </motion.span>
                <motion.h1
                  initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.85, delay: 0.2, ease: EASE }}
                  className="font-display max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl"
                >
                  {t("heroLine1")}{" "}
                  <span className="text-gold">{t("heroLine2")}</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.38, ease: EASE }}
                  className="max-w-xl text-sm text-muted-foreground sm:text-base"
                >
                  {t("heroBody")}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
                  className="mt-2 grid gap-3 sm:grid-cols-3"
                >
                  <PromoCard
                    icon={<Wind className="size-4" />}
                    title={t("promoByoTitle")}
                    body={t("promoByoBody")}
                  />
                  <PromoCard
                    icon={<FlaskRound className="size-4" />}
                    title={t("promoMolassesTitle")}
                    body={t("promoMolassesBody")}
                  />
                  <PromoCard
                    icon={<Sparkles className="size-4" />}
                    title={t("promoMixTitle")}
                    body={t("promoMixBody")}
                  />
                </motion.div>
              </div>
            </section>

            {/* Quick start — popular bowls for one-tap add */}
            <section className="mt-8">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-gold-soft">
                    {t("popularBowls")}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {t("oneTapFav")}
                  </p>
                </div>
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {BOWL_PRESETS.map((p, i) => {
                  const unit =
                    p.components.length > 1
                      ? Math.max(
                          ...p.components.map(
                            (c) => getBrand(c.brandId)?.pricing.fruitsMix ?? 145
                          )
                        )
                      : getBrand(p.components[0]?.brandId)?.pricing.fruits ?? 125;
                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.55 + i * 0.05, ease: EASE }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => addPreset(p.id)}
                      className="glass group flex shrink-0 flex-col items-center gap-1 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35"
                      style={{ minWidth: 96 }}
                    >
                      <span className="transition-transform duration-300 group-hover:scale-110">
                        <BrandStack
                          brandIds={p.components.map((c) => c.brandId)}
                          size="md"
                          max={2}
                        />
                      </span>
                      <span className="text-center text-[11px] font-medium leading-tight">
                        {p.name}
                      </span>
                      <span className="font-display text-[11px] font-bold text-gold">
                        {egp(unit)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Price legend */}
            <section className="mt-8">
              <Kicker className="mb-4">{t("priceList")}</Kicker>
              <div className="grid gap-3 sm:grid-cols-4">
                <LegendCard
                  title={t("legendFruits")}
                  price="125 EGP"
                  sub="Mazaya · Al Fakher · Dandash · Nakhla"
                />
                <LegendCard title={t("legendMix")} price="145 EGP" sub="" />
                <LegendCard
                  title={t("legendAmy")}
                  price="180 EGP"
                  sub=""
                  badge="Premium"
                />
                <LegendCard
                  title={t("legendSpecial")}
                  price="45 EGP"
                  sub={t("legendFlatSub")}
                />
              </div>
            </section>

            {/* Shisha category + Brands */}
            <section className="mt-10">
              {/* Step 1: choose shisha type */}
              {!shishaCat && (
                <div>
                  <div className="mb-4">
                    <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                      {t("chooseShisha")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("chooseShishaDesc")}
                    </p>
                  </div>
                  <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {SHISHA_CATEGORIES.map((cat) => (
                      <StaggerItem key={cat.key}>
                        <button
                          type="button"
                          onClick={() => setShishaCat(cat.key)}
                          className="group glass relative flex w-full items-center gap-4 overflow-hidden rounded-2xl p-5 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.8)]"
                        >
                          <div
                            className="pointer-events-none absolute -end-10 -top-12 size-36 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
                            aria-hidden
                          />
                          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/95 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                            <img
                              src={cat.logo}
                              alt={cat.label}
                              className="h-full w-full object-contain p-1.5"
                              loading="lazy"
                            />
                          </span>
                          <div className="relative min-w-0 flex-1">
                            <p className="font-display text-lg font-bold text-gold-soft">
                              {cat.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cat.desc}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-primary">
                              {cat.brandIds.length} {t("brands")} →
                            </p>
                          </div>
                          <ArrowRight className="relative size-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary rtl:rotate-180" />
                        </button>
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              )}

              {/* Step 2: brands in chosen category */}
              {shishaCat && (
                <div>
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <button
                        type="button"
                        onClick={() => setShishaCat(null)}
                        className="mb-1 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        ← {t("changeCategory")}
                      </button>
                      <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                        {SHISHA_CATEGORIES.find((c) => c.key === shishaCat)?.label}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t("tapBrandHint")}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {brandsForCategory(shishaCat).length} {t("brands")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {brandsForCategory(shishaCat).map((brand, i) => (
                      <BrandCard
                        key={brand.id}
                        brand={brand}
                        inCart={mounted ? inCartFor(brand.id) : 0}
                        onSelect={() => handleSelectBrand(brand)}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative mt-auto border-t border-white/[0.06] bg-[oklch(0.135_0.014_60/0.6)] py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-4 text-center text-xs text-muted-foreground">
          <Wordmark size="sm" />
          <span className="ember-hairline w-16" aria-hidden />
          <p>{t("footerLine")}</p>
        </div>
      </footer>

      {/* Floating cart bar — always anchored to the bottom (bottomInset
          lifts it above things like the staff tab bar). In AMEND mode it
          becomes the living-order editor bar. */}
      {mounted && (cartCount > 0 || amending) && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={cn(
            "fixed inset-x-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            amending && "amend-bar"
          )}
          style={bottomInset ? { bottom: `${bottomInset}px` } : undefined}
        >
          <div
            className={cn(
              "glass mx-auto flex w-full max-w-5xl items-center gap-3 rounded-2xl p-3 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.9)]",
              amending && "ring-1 ring-primary/50"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "relative grid size-10 place-items-center rounded-xl ring-1",
                  amending
                    ? "bg-primary/20 text-primary ring-primary/40"
                    : "bg-primary/15 text-primary ring-primary/25"
                )}
              >
                {amending ? (
                  <PenLine className="size-4" />
                ) : (
                  <ShoppingBag className="size-4" />
                )}
                {amending && (
                  <span
                    className="absolute -end-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-primary"
                    aria-hidden
                  />
                )}
              </span>
              <div className="leading-tight">
                {amending ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      {t("amendBarTitle")}
                    </p>
                    <p className="font-display text-lg font-bold tabular-nums text-gold">
                      #{amendOrderId?.slice(-6).toUpperCase()} · {cartCount}{" "}
                      {cartCount > 1 ? t("bowls") : t("bowl")} · {egp(totals.total)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {cartCount} {cartCount > 1 ? t("bowls") : t("bowl")}
                      {totals.bogo ? ` · ${t("bogoOn")}` : ""}
                    </p>
                    <p className="font-display text-lg font-bold tabular-nums text-gold">
                      {egp(totals.total)}
                    </p>
                  </>
                )}
              </div>
            </div>
            {amending ? (
              <GoldButton className="ms-auto" onClick={() => setCartOpen(true)}>
                {t("amendBarCta")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </GoldButton>
            ) : (
              <GoldButton className="ms-auto" onClick={() => setCartOpen(true)}>
                {t("viewCart")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </GoldButton>
            )}
          </div>
        </motion.div>
      )}

      <ConfigSheet
        brand={selectedBrand}
        open={configOpen}
        onOpenChange={setConfigOpen}
      />
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={handleCheckout}
        onAmended={onAmended}
      />
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        source={source}
        orderedByName={orderedByName}
        employeeId={employeeId}
        defaultCustomer={defaultCustomer}
        defaultTable={defaultTable}
        defaultTableId={defaultTableId}
        branchId={branchId}
        onOrderPlaced={onOrderPlaced}
      />

      {enableScan && (
        <BarcodeModal
          open={scanOpen}
          onOpenChange={setScanOpen}
          onScan={handleScan}
        />
      )}
    </ScreenShell>
  );
}

function PromoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="glass flex items-start gap-3 rounded-2xl p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function LegendCard({
  title,
  price,
  sub,
  badge,
}: {
  title: string;
  price: string;
  sub: string;
  badge?: string;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
      <div
        className="pointer-events-none absolute -top-8 -end-6 size-24 rounded-full bg-primary/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
        {badge && (
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {badge}
          </span>
        )}
      </div>
      <p className="font-display relative mt-1.5 text-2xl font-bold text-gold">
        {price}
      </p>
      <p className="relative mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
