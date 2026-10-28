"use client";

// r67 — THE ORDER WIZARD (the guest "ritual" flow)
// ─────────────────────────────────────────────────────────────────────────
// The owner found the old guest ordering surface scattered (hero + promos +
// legend + categories + search + sheets). The wizard replaces it with ONE
// guided, organized flow that always starts with the right question:
//
//   1. WHO    — who's this shisha for? (label for the table stack)
//   2. SETUP  — "Did you bring your own?" → own molasses / own hookah / menu
//   3. PIPE   — Regular or Amy (Amy = the premium pipe: 180 EGP flat)
//   4. FLAVORS— the molasses brand + flavors (only what this branch can pour)
//   5. REVIEW — one summary card → "Add to table order"
//
// Each shisha at a shared table runs its OWN wizard (own BYO answer, own
// pipe, own flavors) — the corner card stacks them into the table order.
//
// Amy is a PIPE TYPE here, never a molasses brand (r67): the Amy-pipe path
// offers every brand except Salom & Kass, and Amy never appears in any
// flavor list anywhere.

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AMY_SESSION_PRICE,
  BOWL_PRESETS,
  chargeableQty,
  egp,
  FLAVOR_LABELS,
  FlavorType,
  getBrand,
  type Brand,
  type HookahType,
  MIXABLE_BRANDS,
  MOLASSES_GRAMS,
  OWN_MOLASSES_REGULAR_PRICE,
  splitGrams,
  visibleBrands,
  brandsForCategory,
} from "@/lib/catalog";
import {
  type CartItem,
  type FlavorComponent,
  type OwnType,
  priceForConfig,
  useCart,
} from "@/store/cart";
import {
  availableFlavorsOf,
  isBrandAvailable,
  isFlavorAvailable,
  type StockMap,
} from "@/lib/stock-availability";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Backpack,
  BellRing,
  Check,
  ChevronLeft,
  Crown,
  Flame,
  Leaf,
  Loader2,
  Minus,
  Plus,
  Send,
  Shuffle,
  Sparkles,
  UserRound,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/store/i18n";
import { useSession } from "@/store/session";
import { sendServiceRequest } from "@/lib/request-queue";
import { toast } from "sonner";
import { haptic } from "@/lib/delight";
import { BrandMark, BrandStack } from "./brand-mark";
import { EASE, FadeSwap, GoldButton, Kicker } from "./kit/kit";

// ─── types ────────────────────────────────────────────────────────────────

type Setup = "own_molasses" | "own_hookah" | "menu";
type Step = "who" | "setup" | "pipe" | "molasses" | "flavors" | "review" | "added";

/** r67 — the wizard session OrderScreen controls (restart / edit / scan). */
export interface WizardSession {
  /** bump to restart the wizard from scratch */
  seed: number;
  /** the shisha being edited (null = fresh shisha). A snapshot keeps the
   * wizard independent of live cart changes while editing. */
  edit: CartItem | null;
  /** a barcode-scanned brand to preselect (funnels in mid-flow) */
  scanBrandId: string | null;
}

interface OrderWizardProps {
  session: WizardSession;
  stockMap: StockMap | null;
  /** r69 (audit ③) — false when the branch has no tracked flavor jars
   * at all ("not stocked yet" empty state instead of "sold out"). */
  branchStocked?: boolean;
  onSend: () => void;
  onRestart: () => void;
  onCancelEdit: () => void;
}

/** Molten-gold selected pill (Midnight Ember signature). */
const GOLD_FILL =
  "border-transparent bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.6)]";

const GLASS_PILL =
  "border-white/[0.14] bg-white/[0.06] font-semibold text-foreground/95 hover:border-primary/40 hover:bg-white/[0.09] hover:text-primary";

/** Flavors marked popular (⭐) to guide first-time guests. */
const POPULAR_FLAVORS = new Set([
  "Double Apple",
  "Mint",
  "Grape",
  "Blueberry",
  "Watermelon",
]);

const OWN_MOLASSES_ID = "own-molasses";

// ─── the component ────────────────────────────────────────────────────────

export function OrderWizard({
  session,
  stockMap,
  branchStocked = true,
  onSend,
  onRestart,
  onCancelEdit,
}: OrderWizardProps) {
  const t = useI18n((s) => s.t);
  const reduced = useReducedMotion();
  const guest = useSession((s) => s.guest);
  const items = useCart((s) => s.items);
  const addItem = useCart((s) => s.addItem);
  const updateItem = useCart((s) => s.updateItem);

  const editing = session.edit;

  // ── wizard state ──
  const [step, setStep] = React.useState<Step>("who");
  const [forName, setForName] = React.useState("");
  const [setup, setSetup] = React.useState<Setup | null>(null);
  const [hookahType, setHookahType] = React.useState<HookahType | null>(null);
  const [brand, setBrand] = React.useState<Brand | null>(null);
  const [flavorType, setFlavorType] = React.useState<FlavorType>("fruits");
  const [singleFlavor, setSingleFlavor] = React.useState("");
  const [mixComponents, setMixComponents] = React.useState<FlavorComponent[]>([]);
  const [qty, setQty] = React.useState(1);

  // (Re)initialize whenever the session changes (restart / edit / scan).
  React.useEffect(() => {
    const edit = session.edit;
    if (edit) {
      // ── edit mode: prefill everything, land on the review card ──
      setForName(edit.forName ?? "");
      setSetup(
        edit.ownType === "molasses"
          ? "own_molasses"
          : edit.ownType === "hookah"
            ? "own_hookah"
            : "menu"
      );
      setHookahType(edit.hookahType ?? "regular");
      const b = getBrand(edit.primaryBrandId) ?? null;
      setBrand(edit.primaryBrandId === OWN_MOLASSES_ID ? null : b);
      setFlavorType(edit.flavor);
      // mixes carry ALL components in the mix builder; single-flavor items
      // keep their one flavor (fix: the first mix component used to leak
      // into singleFlavor and get dropped from the mix)
      if (edit.flavor === "fruits-mix") {
        setSingleFlavor("");
        setMixComponents(edit.components.map((c) => ({ ...c })));
      } else {
        setSingleFlavor(edit.components[0]?.flavorName ?? "");
        setMixComponents([]);
      }
      setQty(edit.qty);
      setStep("review");
      return;
    }
    // ── fresh shisha ──
    setForName("");
    setSetup(null);
    setHookahType(null);
    setBrand(null);
    setFlavorType("fruits");
    setSingleFlavor("");
    setMixComponents([]);
    setQty(1);
    if (session.scanBrandId) {
      // a scanned barcode funnels in mid-flow: molasses locked, pipe first
      const b = getBrand(session.scanBrandId) ?? null;
      setSetup("menu");
      setBrand(b && !b.hidden ? b : null);
      setSingleFlavor(b ? (availableFlavorsOf(stockMap, b)[0] ?? b.flavors[0] ?? "") : "");
      setStep("pipe");
    } else {
      setStep("who");
    }
  }, [session.seed, session.edit, session.scanBrandId]);

  // ── the shisha's auto label ("Shisha 2") when no name is given ──
  // (when editing, keep the shisha's position in the stack)
  const shishaNumber = editing
    ? Math.max(1, items.findIndex((i) => i.id === editing.id) + 1)
    : items.length + 1;
  const label = forName.trim() || `${t("wizShishaNum")} ${Math.max(1, shishaNumber)}`;

  // ── brand list for the molasses step (availability + pipe rules) ──
  const isAmyPipe = hookahType === "amy";
  const brandList = React.useMemo(() => {
    // own hookah or regular pipe: every visible brand (incl. Salom/Kass);
    // Amy pipe: every brand except Salom & Kass (and never Amy itself).
    const list = setup === "own_hookah" || !isAmyPipe
      ? visibleBrands()
      : brandsForCategory("amy");
    return list.filter((b) => isBrandAvailable(stockMap, b));
  }, [setup, isAmyPipe, stockMap]);

  const isFlat = !!brand && brand.flavorTypes.length === 1 && brand.flavorTypes[0] === "flat";
  const flavorList = React.useMemo(
    () => (brand ? availableFlavorsOf(stockMap, brand) : []),
    [brand, stockMap]
  );

  // ── pricing ──
  const ownType: OwnType =
    setup === "own_molasses" ? "molasses" : setup === "own_hookah" ? "hookah" : null;
  const unit = React.useMemo(() => {
    if (setup === "own_molasses") {
      return isAmyPipe ? AMY_SESSION_PRICE : OWN_MOLASSES_REGULAR_PRICE;
    }
    if (!brand) return 0;
    const components =
      flavorType === "fruits" || isFlat
        ? [{ brandId: brand.id } as FlavorComponent]
        : mixComponents;
    return priceForConfig(flavorType, components, hookahType ?? "regular");
  }, [setup, isAmyPipe, brand, flavorType, isFlat, mixComponents, hookahType]);

  const bogo = ownType !== null;
  const chargeTotal = unit * chargeableQty(qty, bogo);

  // ── step path & navigation (cheap to rebuild — no memo needed) ──
  const steps: { key: Step; label: string }[] = (() => {
    const path: { key: Step; label: string }[] = [
      { key: "who", label: t("wizStepWho") },
      { key: "setup", label: t("wizStepSetup") },
    ];
    if (setup !== "own_hookah") path.push({ key: "pipe", label: t("wizStepPipe") });
    if (setup !== "own_molasses") path.push({ key: "molasses", label: t("wizStepMolasses") });
    path.push({
      key: "flavors",
      label: setup === "own_molasses" ? t("wizQtyTitle") : t("wizStepFlavors"),
    });
    path.push({ key: "review", label: t("wizStepReview") });
    return path;
  })();

  const stepIndex = steps.findIndex((s) => s.key === step);
  const canContinue = (): boolean => {
    if (step === "flavors") {
      if (setup === "own_molasses") return true;
      if (isFlat || flavorType === "fruits") return !!singleFlavor;
      return mixComponents.length > 0;
    }
    return true;
  };

  const goNext = () => {
    haptic("light");
    if (step === "who") return setStep("setup");
    if (step === "flavors") return setStep("review");
  };
  const goBack = () => {
    haptic("light");
    if (step === "review") return setStep(setup === "own_molasses" ? "pipe" : "flavors");
    if (step === "flavors") return setStep(setup === "own_molasses" ? "pipe" : "molasses");
    if (step === "molasses") return setStep(setup === "own_hookah" ? "setup" : "pipe");
    if (step === "pipe") return setStep("setup");
    if (step === "setup") return setStep("who");
  };

  const chooseSetup = (s: Setup) => {
    haptic("light");
    setSetup(s);
    setBrand(null);
    setSingleFlavor("");
    setMixComponents([]);
    setStep(s === "own_hookah" ? "molasses" : "pipe");
  };

  // r69 (audit ③) — "Call staff" from the wizard's empty states: rides
  // the resilient request queue (offline-safe) exactly like the guest
  // tracking surface's call-shisha-man button.
  const [staffCalling, setStaffCalling] = React.useState(false);
  const callStaff = async () => {
    if (staffCalling) return;
    setStaffCalling(true);
    haptic("light");
    try {
      const result = await sendServiceRequest({
        type: "call_shisha_man",
        guestName: guest?.name,
        table: guest?.table,
        note: t("wizStaffCallNote"),
        branchId: guest?.branchId ?? null,
      });
      if (result === "queued") {
        toast.warning(t("requestQueued"), {
          description: t("requestQueuedDesc"),
          duration: 5000,
        });
      } else {
        toast.success(t("shishaManToast"), {
          description: t("shishaManToastDesc"),
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("wizCallStaff"));
    } finally {
      setStaffCalling(false);
    }
  };

  const choosePipe = (p: HookahType) => {
    haptic("light");
    setHookahType(p);
    if (p === "amy" && brand && (brand.id === "salom" || brand.id === "kass")) {
      // a scanned Salom/Kass can't ride the Amy pipe — re-pick the molasses
      setBrand(null);
      setSingleFlavor("");
      toast.error(t("wizAmyNoBudget"));
    }
    setStep(setup === "own_molasses" ? "flavors" : "molasses");
  };

  const chooseBrand = (b: Brand) => {
    haptic("light");
    setBrand(b);
    setFlavorType(b.flavorTypes[0] ?? "fruits");
    setSingleFlavor(availableFlavorsOf(stockMap, b)[0] ?? b.flavors[0] ?? "");
    setMixComponents([]);
    setStep("flavors");
  };

  const addMixComponent = (brandId: string, flavorName: string) => {
    const b = getBrand(brandId);
    if (!b) return;
    if (mixComponents.some((c) => c.brandId === brandId && c.flavorName === flavorName)) {
      toast.error("Flavor already added");
      return;
    }
    setMixComponents((prev) => [
      ...prev,
      { brandId, brandName: b.name, flavorName, emoji: b.emoji, grams: 0 },
    ]);
  };

  // ── quick picks (one-tap house presets, straight to review) ──
  const quickPicks = React.useMemo(
    () =>
      BOWL_PRESETS.filter((p) =>
        p.components.every(
          (c) =>
            isBrandAvailable(stockMap, getBrand(c.brandId)!) &&
            isFlavorAvailable(stockMap, c.brandId, c.flavorName)
        )
      ),
    [stockMap]
  );

  const applyQuickPick = (id: string) => {
    const p = BOWL_PRESETS.find((x) => x.id === id);
    if (!p) return;
    haptic("light");
    const first = getBrand(p.components[0].brandId);
    if (!first) return;
    setSetup("menu");
    setHookahType("regular");
    setBrand(first);
    setFlavorType(p.components.length > 1 ? "fruits-mix" : "fruits");
    if (p.components.length > 1) {
      setMixComponents(
        p.components.map((c) => {
          const b = getBrand(c.brandId)!;
          return {
            brandId: c.brandId,
            brandName: b.name,
            flavorName: c.flavorName,
            emoji: b.emoji,
            grams: 0,
          };
        })
      );
      setSingleFlavor("");
    } else {
      setSingleFlavor(p.components[0].flavorName);
      setMixComponents([]);
    }
    setQty(1);
    setStep("review");
  };

  // ── add / update the shisha ──
  const commit = () => {
    const built = buildItem();
    if (!built) return;
    haptic("success");
    if (editing) {
      updateItem(editing.id, built);
      toast.success(t("wizAddedToast"), { description: label });
      onCancelEdit();
      return;
    }
    addItem(built);
    toast.success(t("wizAddedToast"), { description: label });
    setStep("added");
  };

  const buildItem = (): Omit<CartItem, "id"> | null => {
    let components: FlavorComponent[] = [];
    if (setup !== "own_molasses" && brand) {
      if (isFlat || flavorType === "fruits") {
        components = [
          {
            brandId: brand.id,
            brandName: brand.name,
            flavorName: singleFlavor || brand.flavors[0] || "Standard",
            emoji: brand.emoji,
            grams: MOLASSES_GRAMS,
          },
        ];
      } else {
        const grams = splitGrams(Math.max(1, mixComponents.length));
        components = mixComponents.map((c, i) => ({ ...c, grams: grams[i] }));
      }
    }
    const primary =
      setup === "own_molasses"
        ? {
            primaryBrandId: OWN_MOLASSES_ID,
            primaryBrandName: t("wizOwnMolasses"),
            emoji: "🎒",
            accent: "from-amber-500/25 to-amber-500/5",
          }
        : {
            primaryBrandId: brand!.id,
            primaryBrandName: brand!.name,
            emoji: brand!.emoji,
            accent: brand!.accent,
          };
    return {
      ...primary,
      flavor: setup === "own_molasses" ? "fruits" : isFlat ? "flat" : flavorType,
      flavorLabel:
        setup === "own_molasses"
          ? t("wizOwnMolasses")
          : isFlat
            ? FLAVOR_LABELS.flat
            : FLAVOR_LABELS[flavorType],
      components,
      molassesGrams: MOLASSES_GRAMS,
      unitPrice: unit,
      qty,
      hookahType: setup === "own_hookah" ? "regular" : (hookahType ?? "regular"),
      ownType,
      forName: label,
    };
  };

  // ── render ──

  const stepLabel = steps[stepIndex]?.label ?? "";
  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;

  return (
    <section
      aria-label={t("wizTitle")}
      className="glass-card relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl"
    >
      {/* warm corner glow */}
      <div
        className="pointer-events-none absolute -end-16 -top-20 size-48 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />

      {/* ── header: title + progress ── */}
      <div className="relative border-b border-white/[0.06] px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
            <Flame className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold tracking-tight text-gold-soft">
              {t("wizTitle")}
            </p>
            <p className="text-xs text-muted-foreground">{t("wizSubtitle")}</p>
          </div>
          {editing && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("cancel")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* segmented progress + step caption */}
        {step !== "added" && (
          <div className="mt-4">
            <div
              className="flex h-1.5 gap-1 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={stepLabel}
            >
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={cn(
                    "h-full flex-1 rounded-full transition-colors duration-500",
                    i < stepIndex
                      ? "bg-primary/60"
                      : i === stepIndex
                        ? "bg-gradient-to-r from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)]"
                        : "bg-white/[0.08]"
                  )}
                />
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>
                {stepIndex + 1} / {steps.length} · {stepLabel}
              </span>
              <span className="flex items-center gap-1 text-primary/80">
                <Zap className="size-3" />
                {t("wizStepWho")} → {t("wizStepReview")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── step body ── */}
      <div className="relative px-5 py-5">
        <AnimatePresence mode="wait">
          {step === "who" && (
            <motion.div
              key="who"
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {t("wizForWhomTitle")}
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t("wizForWhomDesc")}
              </p>
              <div className="relative mt-4">
                <UserRound className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={forName}
                  onChange={(e) => setForName(e.target.value)}
                  placeholder={t("wizForWhomPlaceholder")}
                  aria-label={t("wizForWhomTitle")}
                  maxLength={40}
                  className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] ps-10 text-base"
                />
              </div>

              {/* quick picks — one tap, straight to review */}
              {quickPicks.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Sparkles className="size-3.5 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-soft">
                      {t("wizQuickPicks")}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {t("wizQuickPicksDesc")}
                    </span>
                  </div>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {quickPicks.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyQuickPick(p.id)}
                        className="glass flex shrink-0 flex-col items-center gap-1 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35"
                        style={{ minWidth: 92 }}
                      >
                        <BrandStack
                          brandIds={p.components.map((c) => c.brandId)}
                          size="sm"
                          max={2}
                        />
                        <span className="text-center text-[11px] font-medium leading-tight">
                          {p.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === "setup" && (
            <motion.div
              key="setup"
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {t("wizSetupTitle")}
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t("wizSetupDesc")}
              </p>
              <div className="mt-4 space-y-2.5">
                <SetupCard
                  icon={<Backpack className="size-5" />}
                  title={t("wizOwnMolasses")}
                  desc={t("wizOwnMolassesDesc")}
                  badge={t("wizByoBadge")}
                  onClick={() => chooseSetup("own_molasses")}
                />
                <SetupCard
                  icon={<Wind className="size-5" />}
                  title={t("wizOwnHookah")}
                  desc={t("wizOwnHookahDesc")}
                  badge={t("wizByoBadge")}
                  onClick={() => chooseSetup("own_hookah")}
                />
                <SetupCard
                  icon={<Leaf className="size-5" />}
                  title={t("wizFromMenu")}
                  desc={t("wizFromMenuDesc")}
                  onClick={() => chooseSetup("menu")}
                />
              </div>
            </motion.div>
          )}

          {step === "pipe" && (
            <motion.div
              key="pipe"
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {t("wizPipeTitle")}
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t("wizPipeDesc")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => choosePipe("regular")}
                  className="group glass relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35"
                >
                  <span className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-white/95 ring-1 ring-white/10">
                    <img
                      src="/images/brands/regular.jpg"
                      alt={t("wizPipeRegular")}
                      className="h-full w-full object-contain p-1.5"
                      loading="lazy"
                    />
                  </span>
                  <span className="font-semibold">{t("wizPipeRegular")}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {t("wizPipeRegularDesc")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => choosePipe("amy")}
                  className="group glass relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl p-4 text-center ring-1 ring-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/45"
                >
                  <span className="pointer-events-none absolute -top-8 left-1/2 size-24 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl" aria-hidden />
                  <span className="relative grid size-14 place-items-center overflow-hidden rounded-2xl bg-white/95 ring-1 ring-primary/30">
                    <img
                      src="/images/brands/amy.jpg"
                      alt={t("wizPipeAmy")}
                      className="h-full w-full object-contain p-1.5"
                      loading="lazy"
                    />
                  </span>
                  <span className="relative flex items-center gap-1 font-semibold">
                    <Crown className="size-3.5 text-primary" />
                    {t("wizPipeAmy")}
                  </span>
                  <span className="relative text-[11px] leading-tight text-muted-foreground">
                    {t("wizPipeAmyDesc")}
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {step === "molasses" && (
            <motion.div
              key="molasses"
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {t("wizMolassesTitle")}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {isAmyPipe && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Crown className="size-3" />
                    180 {t("wizPriceFlatNote")}
                  </span>
                )}
                {t("wizMolassesDesc")}
              </p>
              {brandList.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {brandList.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => chooseBrand(b)}
                      className="group glass relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35"
                    >
                      <span className="grid size-12 place-items-center overflow-hidden rounded-xl bg-white/95">
                        <img
                          src={b.logo}
                          alt={b.name}
                          className="h-full w-full object-contain p-1"
                          loading="lazy"
                        />
                      </span>
                      <span className="text-sm font-semibold">{b.name}</span>
                      <span className="font-display text-[11px] font-bold tabular-nums text-gold">
                        {isAmyPipe
                          ? `180 ${t("wizPriceFlatNote").split("—")[0].trim()}`
                          : `from ${egp(b.pricing.flat ?? b.pricing.fruits ?? 0)}`}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyMolasses
                  branchStocked={branchStocked}
                  calling={staffCalling}
                  onOwnMolasses={() => chooseSetup("own_molasses")}
                  onCallStaff={callStaff}
                />
              )}
            </motion.div>
          )}

          {step === "flavors" && (
            <motion.div
              key="flavors"
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="space-y-5"
            >
              {setup === "own_molasses" ? (
                <>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                    {t("wizQtyTitle")}
                  </h2>
                  <div className="glass flex items-start gap-3 rounded-2xl p-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                      <Backpack className="size-4" />
                    </span>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("wizOwnMolassesNote")}
                    </p>
                  </div>
                  <QtyStepper qty={qty} setQty={setQty} />
                  {bogo && <BogoNote />}
                </>
              ) : (
                <>
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                      {t("wizFlavorsTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("wizFlavorsDesc")}
                    </p>
                  </div>

                  {/* flavor type — fruits or mix (not for flat brands) */}
                  {!isFlat && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["fruits", "fruits-mix"] as FlavorType[]).map((f) => {
                        const active = flavorType === f;
                        const price = priceForConfig(
                          f,
                          f === "fruits"
                            ? ([{ brandId: brand?.id ?? "mazaya" }] as FlavorComponent[])
                            : mixComponents,
                          hookahType ?? "regular"
                        );
                        return (
                          <motion.button
                            key={f}
                            type="button"
                            whileTap={reduced ? undefined : { scale: 0.97 }}
                            onClick={() => setFlavorType(f)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-2xl border p-3 text-start transition-all duration-300",
                              active
                                ? "border-primary/40 bg-primary/10 ring-1 ring-primary/40"
                                : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:bg-white/[0.06]"
                            )}
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                              {f === "fruits" ? (
                                <Leaf className="size-4" />
                              ) : (
                                <Shuffle className="size-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">
                                {FLAVOR_LABELS[f]}
                              </span>
                              <span className="font-display block text-sm font-bold tabular-nums text-gold">
                                {egp(price)}
                              </span>
                            </span>
                            {active && <Check className="size-4 shrink-0 text-primary" />}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  <FadeSwap swapKey={`${brand?.id}:${flavorType}`}>
                    {flavorType === "fruits" || isFlat ? (
                      <div className="flex flex-wrap gap-2">
                        {flavorList.map((f) => (
                          <FlavorChip
                            key={f}
                            flavor={f}
                            active={singleFlavor === f}
                            onClick={() => {
                              haptic("light");
                              setSingleFlavor(f);
                            }}
                          />
                        ))}
                        {flavorList.length === 0 && (
                          <div className="w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              {t("wizBrandSoldOut")}
                            </p>
                            <button
                              type="button"
                              onClick={goBack}
                              className="glass mt-3 inline-flex h-11 items-center gap-1 rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:text-foreground active:scale-[0.98]"
                            >
                              <ChevronLeft className="size-4 rtl:rotate-180" />
                              {t("wizBackToBrands")}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <MixBuilder
                        brand={brand}
                        hookahType={hookahType ?? "regular"}
                        components={mixComponents}
                        onChange={setMixComponents}
                        onAdd={addMixComponent}
                        stockMap={stockMap}
                      />
                    )}
                  </FadeSwap>

                  <QtyStepper qty={qty} setQty={setQty} />
                </>
              )}
            </motion.div>
          )}

          {step === "review" && (
            <motion.div
              key="review"
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {t("wizReviewTitle")}
              </h2>

              {/* the shisha card */}
              <div className="glass mt-4 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="glass grid size-12 shrink-0 place-items-center rounded-2xl text-primary ring-1 ring-primary/25">
                    {setup === "own_molasses" ? (
                      <Backpack className="size-5" />
                    ) : (
                      <BrandStack
                        brandIds={
                          flavorType === "fruits" || isFlat
                            ? [brand?.id ?? "mazaya"]
                            : mixComponents.map((c) => c.brandId)
                        }
                        size="md"
                        max={2}
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-lg font-bold text-gold-soft">
                      {label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {setup === "own_molasses"
                        ? t("wizOwnMolassesTag")
                        : brand
                          ? `${brand.name} · ${
                              isFlat
                                ? singleFlavor
                                : flavorType === "fruits"
                                  ? singleFlavor
                                  : mixComponents.map((c) => c.flavorName).join(" + ")
                            }`
                          : ""}
                    </p>
                  </div>
                  {bogo && (
                    <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      {t("wizByoBadge")}
                    </span>
                  )}
                </div>

                {/* attribute chips */}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <ReviewChip
                    label={t("wizReviewSetup")}
                    value={
                      setup === "own_molasses"
                        ? t("wizOwnMolassesTag")
                        : setup === "own_hookah"
                          ? t("wizOwnHookahTag")
                          : t("wizFromMenu")
                    }
                  />
                  {setup !== "own_hookah" && (
                    <ReviewChip
                      label={t("wizReviewPipe")}
                      value={
                        hookahType === "amy" ? t("wizAmyPipeTag") : t("wizRegularPipeTag")
                      }
                    />
                  )}
                  {qty > 0 && <ReviewChip label={t("wizQtyTitle")} value={`× ${qty}`} />}
                </div>

                {/* price */}
                <div className="mt-3 flex items-baseline justify-between border-t border-white/[0.06] pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {egp(unit)} × {qty}
                    {bogo ? ` → ${chargeableQty(qty, true)} × ${egp(unit)}` : ""}
                  </span>
                  <span className="font-display text-2xl font-bold tabular-nums text-gold">
                    {egp(chargeTotal)}
                  </span>
                </div>
                {bogo && (
                  <p className="mt-1 text-end text-[11px] font-medium text-emerald-300">
                    {t("wizBogoYou")} — {t("wizBogoYouDesc")}
                  </p>
                )}
              </div>

              {/* qty can be tweaked right on the review card (edit mode
               * lands here directly, so the stepper must be reachable) */}
              <div className="mt-4">
                <QtyStepper qty={qty} setQty={setQty} />
              </div>
            </motion.div>
          )}

          {step === "added" && (
            <motion.div
              key="added"
              initial={reduced ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <motion.span
                initial={reduced ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="relative grid size-20 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/30"
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-full bg-primary/15 blur-xl"
                  aria-hidden
                />
                <svg viewBox="0 0 24 24" className="size-10 text-primary" fill="none" aria-hidden>
                  <motion.path
                    d="m5 13 4.2 4.2L19 7.4"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ type: "spring", stiffness: 170, damping: 22, delay: 0.15 }}
                  />
                </svg>
              </motion.span>
              <div>
                <p className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                  {label} ✓
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {items.length} × {t("wizShishaCount")} ·{" "}
                  <span className="font-display font-bold tabular-nums text-gold">
                    {egp(chargeTotal)}
                  </span>
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onRestart}
                  className="glass flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-foreground transition-all duration-300 hover:border-primary/40 hover:text-primary active:scale-[0.98]"
                >
                  <Plus className="size-4" />
                  {t("wizAddAnother")}
                  <span className="sr-only"> — {t("wizAddAnotherDesc")}</span>
                </button>
                <GoldButton size="lg" className="min-h-12" onClick={onSend}>
                  <Send className="size-4" />
                  {t("wizSendTable")}
                </GoldButton>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("wizAddAnotherDesc")}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── footer: back + continue ── */}
      {step !== "added" && (
        <div className="relative flex items-center gap-2 border-t border-white/[0.06] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {step !== "who" && (
            <button
              type="button"
              onClick={goBack}
              className="glass flex h-12 items-center gap-1 rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:text-foreground active:scale-[0.98]"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
              {t("back")}
            </button>
          )}
          {step === "who" && (
            <GoldButton size="lg" className="h-12 flex-1" onClick={goNext}>
              {t("wizContinue")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </GoldButton>
          )}
          {step === "flavors" && (
            <GoldButton
              size="lg"
              className="h-12 flex-1"
              disabled={!canContinue()}
              onClick={goNext}
            >
              {t("wizContinue")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </GoldButton>
          )}
          {step === "review" && (
            <GoldButton size="lg" className="h-12 flex-1" onClick={commit}>
              <Check className="size-4" />
              {editing ? t("wizEditShisha") : t("wizAddCta")} · {egp(chargeTotal)}
            </GoldButton>
          )}
        </div>
      )}
    </section>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────

/**
 * r69 (audit ③) — the molasses step's empty state. Distinguishes:
 *   - branchStocked → "sold out right now" (jars tracked but empty)
 *   - !branchStocked → "this branch isn't stocked yet" (no jars at all)
 * Both offer the two real escapes: pack the guest's own molasses
 * (2-for-1) or call the staff (offline-safe request queue).
 */
function EmptyMolasses({
  branchStocked,
  calling,
  onOwnMolasses,
  onCallStaff,
}: {
  branchStocked: boolean;
  calling: boolean;
  onOwnMolasses: () => void;
  onCallStaff: () => void;
}) {
  const t = useI18n((s) => s.t);
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
      <span className="relative mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-primary/15 blur-xl"
          aria-hidden
        />
        <Leaf className="relative size-5" />
      </span>
      <p className="mt-3 font-display text-lg font-bold tracking-tight text-gold-soft">
        {branchStocked ? t("wizSoldOutTitle") : t("wizNotStockedTitle")}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {branchStocked ? t("wizSoldOutDesc") : t("wizNotStockedDesc")}
      </p>
      <div className="mx-auto mt-4 grid max-w-sm gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOwnMolasses}
          className="glass flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-foreground transition-all duration-300 hover:border-primary/40 hover:text-primary active:scale-[0.98]"
        >
          <Backpack className="size-4" />
          {t("wizOwnMolasses")}
          <span className="rounded-full bg-emerald-400/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/25">
            {t("wizByoBadge")}
          </span>
        </button>
        <GoldButton className="min-h-12 justify-center" disabled={calling} onClick={onCallStaff}>
          {calling ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BellRing className="size-4" />
          )}
          {t("wizCallStaff")}
        </GoldButton>
      </div>
    </div>
  );
}

/** A big glass option card (the setup answers / quick picks). */
function SetupCard({
  icon,
  title,
  desc,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group glass relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35"
    >
      <div
        className="pointer-events-none absolute -end-8 -top-10 size-28 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
        aria-hidden
      />
      <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
        {icon}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-base font-bold text-gold-soft">{title}</span>
          {badge && (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="relative size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180" />
    </motion.button>
  );
}

/** − / + quantity stepper. */
function QtyStepper({ qty, setQty }: { qty: number; setQty: (n: number) => void }) {
  const t = useI18n((s) => s.t);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Kicker>{t("wizQtyTitle")}</Kicker>
        <p className="text-xs tabular-nums text-muted-foreground">
          {qty} × 20g = {qty * 20}g
        </p>
      </div>
      <div className="glass flex items-center justify-between rounded-2xl p-2">
        <button
          type="button"
          onClick={() => setQty(Math.max(1, qty - 1))}
          disabled={qty <= 1}
          aria-label="Decrease quantity"
          className="grid size-11 place-items-center rounded-full text-lg font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <span className="font-display min-w-12 text-center text-2xl font-bold tabular-nums text-gold">
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQty(Math.min(99, qty + 1))}
          aria-label="Increase quantity"
          className="grid size-11 place-items-center rounded-full text-lg font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function BogoNote() {
  const t = useI18n((s) => s.t);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300">
        <Sparkles className="size-4" />
      </span>
      <p className="text-xs leading-snug text-emerald-200/90">
        <span className="font-bold">{t("wizBogoYou")}</span> — {t("wizBogoYouDesc")}
      </p>
    </div>
  );
}

/** A single flavor pill. */
function FlavorChip({
  flavor,
  active,
  onClick,
}: {
  flavor: string;
  active: boolean;
  onClick: () => void;
}) {
  const popular = POPULAR_FLAVORS.has(flavor);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative min-h-11 rounded-full border px-4 text-sm font-medium transition-all duration-300",
        active ? GOLD_FILL : GLASS_PILL
      )}
    >
      {flavor}
      {popular && <span className="absolute -top-1.5 -end-1.5 text-[10px]">⭐</span>}
    </button>
  );
}

/** Small labeled value chip for the review card. */
function ReviewChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground/90">{value}</span>
    </span>
  );
}

/** Compact cross-brand mix builder (mirrors the config-sheet pattern). */
function MixBuilder({
  brand,
  hookahType,
  components,
  onChange,
  onAdd,
  stockMap,
}: {
  brand: Brand | null;
  hookahType: HookahType;
  components: FlavorComponent[];
  onChange: (c: FlavorComponent[]) => void;
  onAdd: (brandId: string, flavorName: string) => void;
  stockMap: StockMap | null;
}) {
  const t = useI18n((s) => s.t);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [activeBrand, setActiveBrand] = React.useState(brand?.id ?? "mazaya");
  const grams = splitGrams(Math.max(1, components.length));

  const mixable = React.useMemo(() => {
    // the mix picker mirrors the molasses step rules: Amy pipe → premium
    // brands only (no Salom/Kass); MIXABLE_BRANDS already excludes the
    // hidden Amy "brand" (a pipe type, never a molasses).
    const base =
      hookahType === "amy"
        ? ["mazaya", "al-fakher", "dandash", "nakhla"].map((id) => getBrand(id)!).filter(Boolean)
        : MIXABLE_BRANDS;
    return base.filter((b) => isBrandAvailable(stockMap, b));
  }, [hookahType, stockMap]);

  const current = getBrand(activeBrand) ?? mixable[0];
  const currentFlavors = current ? availableFlavorsOf(stockMap, current) : [];

  return (
    <div className="space-y-2.5">
      {components.length > 0 ? (
        <ul className="space-y-1.5">
          {components.map((c, i) => (
            <li
              key={`${c.brandId}:${c.flavorName}:${i}`}
              className="glass flex items-center gap-2.5 rounded-xl px-3 py-1.5"
            >
              <BrandMark brandId={c.brandId} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.brandName} · {c.flavorName}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {grams[i]?.toFixed(2)}g
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(components.filter((_, idx) => idx !== i))}
                className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                aria-label="Remove flavor"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-center text-sm font-medium text-foreground/80">
          {t("mixEmpty")}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-medium text-foreground transition-all duration-300 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
      >
        <Plus className="size-4" />
        {components.length === 0 ? t("pickFlavor") : t("addFlavor")}
      </button>

      {pickerOpen && (
        <div className="glass rounded-2xl p-3">
          <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {mixable.map((b) => (
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
          <div className="flex flex-wrap gap-2">
            {currentFlavors.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onAdd(current.id, f)}
                className={cn("min-h-11 rounded-full border px-4 text-sm", GLASS_PILL)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
