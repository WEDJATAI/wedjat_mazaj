"use client";

import * as React from "react";
import { BRANDS, Brand, egp } from "@/lib/catalog";
import { useCart, computeTotals } from "@/store/cart";
import { BrandCard } from "./brand-card";
import { ConfigSheet } from "./config-sheet";
import { CartDrawer } from "./cart-drawer";
import { CheckoutDialog } from "./checkout-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Flame,
  Sparkles,
  Wind,
  FlaskRound,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function useMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return m;
}

export function AppShell() {
  const mounted = useMounted();
  const items = useCart((s) => s.items);
  const ownType = useCart((s) => s.ownType);
  const totals = computeTotals(items, ownType);

  const [selectedBrand, setSelectedBrand] = React.useState<Brand | null>(null);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);

  const cartCount = mounted ? totals.totalQty : 0;

  const handleSelectBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    setConfigOpen(true);
  };

  const handleCheckout = () => {
    setCartOpen(false);
    // allow drawer close animation before opening dialog
    setTimeout(() => setCheckoutOpen(true), 180);
  };

  const inCartFor = (brandId: string) =>
    items.filter((i) => i.brandId === brandId).reduce((s, i) => s + i.qty, 0);

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />

      <div className="relative flex min-h-screen flex-col">
        {/* App bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <Flame className="size-5" />
              </span>
              <div className="leading-tight">
                <p className="text-base font-bold tracking-tight smoke-text">
                  Mazaj
                </p>
                <p className="-mt-0.5 text-[11px] text-muted-foreground">
                  Hookah ordering
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Badge
                variant="secondary"
                className="hidden bg-muted/60 text-muted-foreground sm:inline-flex"
              >
                20g molasses / hookah
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="relative gap-2 rounded-full"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingBag className="size-4" />
                <span className="hidden sm:inline">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-40 pt-6">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl border border-border">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url(/images/hero.png)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
            <div className="relative flex flex-col gap-4 p-6 sm:p-10">
              <Badge
                variant="secondary"
                className="w-fit gap-1.5 border border-primary/30 bg-primary/10 text-primary"
              >
                <Sparkles className="size-3.5" />
                Egyptian market · lounge pricing
              </Badge>
              <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Build your perfect{" "}
                <span className="smoke-text">hookah session</span>
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                Pick your molasses brand — Mazaya, Al Fakher, Dandash, Nakhla,
                Amy, Salom or Kass. Every hookah is 20g of molasses, mixed fresh
                for you.
              </p>

              {/* Promo cards */}
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <PromoCard
                  icon={<Wind className="size-4" />}
                  title="Bring your own hookah"
                  body="Get 2 hookahs for the price of 1."
                />
                <PromoCard
                  icon={<FlaskRound className="size-4" />}
                  title="Bring your own molasses"
                  body="Same 2-for-1 deal applies."
                />
                <PromoCard
                  icon={<Flame className="size-4" />}
                  title="Fresh 20g bowls"
                  body="Salom & Kass from just 45 EGP."
                />
              </div>
            </div>
          </section>

          {/* Price legend */}
          <section className="mt-6 grid gap-3 sm:grid-cols-4">
            <LegendCard title="Regular fruits" price="125 EGP" sub="Mazaya · Al Fakher · Dandash · Nakhla" />
            <LegendCard title="Fruits mix" price="145 EGP" sub="Same regular brands" />
            <LegendCard title="Amy (premium)" price="180 EGP" sub="Fruits & mix" badge="Premium" />
            <LegendCard title="Salom / Kass" price="45 EGP" sub="Everyday flat price" />
          </section>

          {/* Brands */}
          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Choose your molasses
                </h2>
                <p className="text-sm text-muted-foreground">
                  Tap a brand to set flavor & quantity.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {BRANDS.length} brands
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BRANDS.map((brand) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  inCart={mounted ? inCartFor(brand.id) : 0}
                  onSelect={() => handleSelectBrand(brand)}
                />
              ))}
            </div>
          </section>

          {/* How the promo works */}
          <section className="mt-8 rounded-3xl border border-border bg-card/60 p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="size-5 text-primary" />
              How the 2-for-1 works
            </h2>
            <ol className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <li className="rounded-2xl bg-muted/40 p-3">
                <span className="font-semibold text-foreground">1. Order</span>{" "}
                your hookahs as usual — any brand, any flavor.
              </li>
              <li className="rounded-2xl bg-muted/40 p-3">
                <span className="font-semibold text-foreground">
                  2. Bring your own
                </span>{" "}
                hookah or your own molasses, then toggle it in the cart.
              </li>
              <li className="rounded-2xl bg-muted/40 p-3">
                <span className="font-semibold text-foreground">
                  3. Pay half
                </span>{" "}
                — every pair of hookahs is charged as one.
              </li>
            </ol>
          </section>
        </main>

        {/* Footer */}
        <footer className="relative mt-auto border-t border-border bg-background/60 py-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-1 px-4 text-center text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Mazaj Hookah Lounge</p>
            <p>20g molasses per hookah · Prices in EGP · Egyptian market</p>
          </div>
        </footer>
      </div>

      {/* Floating cart bar */}
      {mounted && cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <ShoppingBag className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="text-xs text-muted-foreground">
                  {cartCount} hookah{cartCount > 1 ? "s" : ""}
                  {totals.bogo ? " · 2-for-1 on" : ""}
                </p>
                <p className="text-base font-bold tabular-nums">
                  {egp(totals.total)}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="ml-auto rounded-xl font-semibold"
              onClick={() => setCartOpen(true)}
            >
              View cart
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
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
        />
        <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
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
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/70 p-3 backdrop-blur">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
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
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {badge && (
          <Badge
            variant="secondary"
            className="border border-primary/30 bg-primary/15 text-primary"
          >
            {badge}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xl font-bold text-primary">{price}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
