"use client";

import * as React from "react";
import { useSession, GuestSession } from "@/store/session";
import { useTableContext } from "@/store/table-context";
import { OrderScreen } from "./order-screen";
import { FavoritesSheet } from "./favorites-sheet";
import { GuestTrackingSheet } from "./guest-tracking";
import { SommelierSheet } from "./sommelier-sheet";
import {
  HandHelping,
  Loader2,
  Heart,
  Flame,
  Sparkles,
  Radar,
  Download,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { egp, getBrand } from "@/lib/catalog";
import { sendServiceRequest } from "@/lib/request-queue";
import { usePwa } from "@/store/pwa";
import { useI18n } from "@/store/i18n";
import { attachGuestIfSubscribed } from "@/lib/push-client";
import { motion } from "framer-motion";
import { EASE, GoldButton, Stagger, StaggerItem } from "./kit/kit";

export function GuestOrder() {
  const guest = useSession((s) => s.guest) as GuestSession | null;
  const signOut = useSession((s) => s.signOut);
  const tableCtx = useTableContext();
  const t = useI18n((s) => s.t);
  const setGetAppOpen = usePwa((s) => s.setGetAppOpen);
  // r57: hide every "download the app" CTA when the app is already installed
  const installed = usePwa((s) => s.installed);
  const [callOpen, setCallOpen] = React.useState(false);
  const [coalOpen, setCoalOpen] = React.useState(false);
  const [favOpen, setFavOpen] = React.useState(false);
  const [trackOpen, setTrackOpen] = React.useState(false);
  const [sommOpen, setSommOpen] = React.useState(false);
  const [focusOrderId, setFocusOrderId] = React.useState<string | null>(null);
  const [favCount, setFavCount] = React.useState<number | null>(null);
  const [topPick, setTopPick] = React.useState<{
    label: string;
    unit: number;
  } | null>(null);

  // Deep link from a push notification / app shortcut: ?track=<orderId>
  // (or ?track=1 → just open the tracker). Survives the sign-in flow via
  // sessionStorage, so tapping a push before checking in still opens the
  // tracker right after the guest signs in.
  React.useEffect(() => {
    if (!guest?.name) return;
    let target: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("track");
      if (t) {
        target = t === "1" ? "latest" : t;
        const url = new URL(window.location.href);
        url.searchParams.delete("track");
        url.searchParams.delete("source");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      } else {
        const raw = window.sessionStorage.getItem("mazaj:pending-track");
        window.sessionStorage.removeItem("mazaj:pending-track");
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { t?: string; at?: number };
            // only honor the stashed link within 10 minutes (a push tap
            // → sign-in → tracker should feel instant, not resurface hours
            // later for whoever signs in next)
            if (
              parsed.t &&
              parsed.at &&
              Date.now() - parsed.at < 10 * 60 * 1000
            ) {
              target = parsed.t;
            }
          } catch {
            // old format / corrupt — ignore
          }
        }
      }
    } catch {
      // non-fatal
    }
    if (!target) return;
    if (target !== "latest") setFocusOrderId(target);
    setTrackOpen(true);
  }, [guest?.name]);

  // Returning-guest recognition: check for saved favorites on check-in.
  React.useEffect(() => {
    if (!guest?.name) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/favorites?guestName=${encodeURIComponent(guest.name)}`
        );
        const data = await res.json();
        if (cancelled || !data.ok) return;
        setFavCount(data.favorites.length);
        if (data.favorites.length > 0) {
          const first = data.favorites[0];
          try {
            const comps = JSON.parse(first.componentsJson);
            // real catalog pricing: max mix price across the favorite's brands
            const unit = comps.reduce(
              (max: number, c: { brandId: string }) => {
                const p =
                  getBrand(c.brandId)?.pricing.fruitsMix ?? 145;
                return Math.max(max, p);
              },
              0
            );
            setTopPick({ label: first.label, unit });
          } catch {
            setTopPick({ label: first.label, unit: 145 });
          }
        }
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guest?.name]);

  if (!guest) return null;

  const isReturning = (favCount ?? 0) > 0;

  const handleOrderPlaced = (orderId: string) => {
    setFocusOrderId(orderId);
    // keep this phone's push subscription attached to the guest's name
    // (no-op unless notifications were already enabled on this device)
    void attachGuestIfSubscribed(guest.name);
    // open the live tracker shortly after the confirmation dialog shows
    setTimeout(() => setTrackOpen(true), 1200);
  };

  return (
    <>
      <OrderScreen
        title={t("guestOrderTitle")}
        subtitle={`${guest.name}${guest.table ? ` · ${guest.table}` : ""}`}
        source="guest_call"
        orderedByName={guest.name}
        defaultCustomer={guest.name}
        defaultTable={guest.table}
        defaultTableId={tableCtx.tableId}
        branchId={guest.branchId ?? null}
        onSignOut={signOut}
        enableScan
        onOrderPlaced={handleOrderPlaced}
        onAmended={() => setTrackOpen(true)}
        headerExtra={
          <Stagger className="flex items-center gap-1" delay={0.22}>
            <StaggerItem>
              <QuickPill
                icon={<Wand2 className="size-4" />}
                label={t("aiBtn")}
                ariaLabel={t("aiSommelier")}
                onClick={() => setSommOpen(true)}
              />
            </StaggerItem>
            {!installed && (
              <StaggerItem>
                <QuickPill
                  icon={<Download className="size-4" />}
                  label={t("getApp")}
                  ariaLabel={t("getApp")}
                  onClick={() => setGetAppOpen(true)}
                />
              </StaggerItem>
            )}
            <StaggerItem>
              <QuickPill
                icon={<Radar className="size-4" />}
                label={t("track")}
                ariaLabel={t("trackOrders")}
                onClick={() => {
                  setFocusOrderId(null);
                  setTrackOpen(true);
                }}
              />
            </StaggerItem>
            <StaggerItem>
              <QuickPill
                icon={<Heart className="size-4" />}
                label={t("favorites")}
                ariaLabel={t("favorites")}
                onClick={() => setFavOpen(true)}
                badge={
                  isReturning ? (
                    <span className="absolute -top-1 -end-1 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] px-1 text-[9px] font-bold text-[oklch(0.17_0.03_50)] shadow-lg">
                      {favCount}
                    </span>
                  ) : undefined
                }
              />
            </StaggerItem>
            <StaggerItem>
              <QuickPill
                icon={<Flame className="size-4" />}
                label={t("coal")}
                ariaLabel={t("requestCoal")}
                onClick={() => setCoalOpen(true)}
              />
            </StaggerItem>
            <StaggerItem>
              <GoldButton
                size="sm"
                className="h-10 px-2 normal-case tracking-wide sm:px-4"
                onClick={() => setCallOpen(true)}
                aria-label={t("callShishaMan")}
              >
                <HandHelping className="size-4" />
                <span className="hidden sm:inline">{t("call")}</span>
              </GoldButton>
            </StaggerItem>
          </Stagger>
        }
        returningBanner={
          isReturning ? (
            <motion.div
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
              className="glass relative mb-4 flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl p-3.5"
            >
              {/* warm corner glow */}
              <div
                className="pointer-events-none absolute -end-10 -top-14 size-40 rounded-full bg-primary/15 opacity-50 blur-3xl"
                aria-hidden
              />
              <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
                <Sparkles className="size-5" />
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="font-display text-base font-bold tracking-tight text-gold-soft">
                  {t("welcomeBackName")} {guest.name}!
                </p>
                {topPick && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("yourUsual")}{" "}
                    <span className="font-medium text-foreground">
                      {topPick.label}
                    </span>{" "}
                    ·{" "}
                    <span className="font-display font-bold tabular-nums text-gold">
                      {egp(topPick.unit)}
                    </span>
                  </p>
                )}
              </div>
              <GoldButton
                size="sm"
                className="relative normal-case tracking-normal"
                onClick={() => setFavOpen(true)}
              >
                {t("reorderBtn")}
              </GoldButton>
            </motion.div>
          ) : null
        }
      />

      <CallShishaManDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        guest={guest}
      />
      <CoalRequestDialog
        open={coalOpen}
        onOpenChange={setCoalOpen}
        guest={guest}
      />
      <FavoritesSheet
        open={favOpen}
        onOpenChange={setFavOpen}
        guestName={guest.name}
      />
      <GuestTrackingSheet
        open={trackOpen}
        onOpenChange={setTrackOpen}
        guestName={guest.name}
        focusOrderId={focusOrderId}
      />
      <SommelierSheet
        open={sommOpen}
        onOpenChange={setSommOpen}
        guestName={guest.name}
      />
    </>
  );
}

/** Midnight Ember quick-action pill — glass pill, gold-ring icon, hover lift. */
function QuickPill({
  icon,
  label,
  ariaLabel,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="glass relative inline-flex h-10 items-center gap-2 rounded-full px-2 text-xs font-medium text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:text-foreground active:scale-[0.97] sm:ps-2 sm:pe-3.5"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
      {badge}
    </button>
  );
}

function CallShishaManDialog({
  open,
  onOpenChange,
  guest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  guest: GuestSession;
}) {
  const t = useI18n((s) => s.t);
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const submit = async () => {
    setSending(true);
    try {
      const result = await sendServiceRequest({
        type: "call_shisha_man",
        guestName: guest.name,
        table: guest.table,
        note: note.trim(),
        branchId: guest.branchId ?? null,
      });
      if (result === "queued") {
        // cloud unreachable — the request is saved and will auto-deliver
        toast.warning(t("requestQueued"), {
          description: t("requestQueuedDesc"),
          duration: 5000,
        });
      } else {
        toast.success(t("shishaManToast"), {
          description: t("shishaManToastDesc"),
        });
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("couldNotSignIn"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="dark relative max-w-md overflow-hidden rounded-3xl border-white/[0.08] bg-[oklch(0.17_0.016_60/0.95)] p-5 text-foreground backdrop-blur-2xl">
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <HandHelping className="size-4" />
            </span>
            {t("callShishaMan")}
          </DialogTitle>
          <DialogDescription className="ps-[2.875rem] text-xs">
            {t("callDescShort")}
          </DialogDescription>
        </DialogHeader>

        <div className="glass relative rounded-2xl p-3.5 text-sm">
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("nameLabel")}</span>
            <span className="font-semibold">{guest.name}</span>
          </div>
          <div className="ember-hairline my-2.5" aria-hidden />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("tableLabel")}</span>
            <span className="font-semibold">{guest.table || "—"}</span>
          </div>
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("needHelpPlaceholder")}
          rows={3}
          className="relative resize-none rounded-2xl border-white/[0.08] bg-white/[0.04]"
        />

        <GoldButton
          size="lg"
          className="relative w-full"
          disabled={sending}
          onClick={submit}
        >
          {sending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("sending")}
            </>
          ) : (
            t("sendRequest")
          )}
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}

function CoalRequestDialog({
  open,
  onOpenChange,
  guest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  guest: GuestSession;
}) {
  const t = useI18n((s) => s.t);
  const [sending, setSending] = React.useState(false);

  const submit = async (coalType: "regular_coal" | "cubed_coal") => {
    setSending(true);
    try {
      const result = await sendServiceRequest({
        type: "coal_request",
        guestName: guest.name,
        table: guest.table,
        branchId: guest.branchId ?? null,
        note:
          coalType === "cubed_coal"
            ? t("coalNoteCubed")
            : t("coalNoteRegular"),
      });
      if (result === "queued") {
        // cloud unreachable — the request is saved and will auto-deliver
        toast.warning(t("requestQueued"), {
          description: t("requestQueuedDesc"),
          duration: 5000,
        });
      } else {
        toast.success(t("coalToast"), {
          description:
            coalType === "cubed_coal" ? t("cubedOnWay") : t("regularOnWay"),
        });
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("couldNotSignIn"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="dark relative max-w-md overflow-hidden rounded-3xl border-white/[0.08] bg-[oklch(0.17_0.016_60/0.95)] p-5 text-foreground backdrop-blur-2xl">
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Flame className="size-4" />
            </span>
            {t("requestCoal")}
          </DialogTitle>
          <DialogDescription className="ps-[2.875rem] text-xs">
            {t("coalDescShort")}
          </DialogDescription>
        </DialogHeader>

        <div className="glass relative rounded-2xl p-3.5 text-sm">
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("nameLabel")}</span>
            <span className="font-semibold">{guest.name}</span>
          </div>
          <div className="ember-hairline my-2.5" aria-hidden />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("tableLabel")}</span>
            <span className="font-semibold">{guest.table || "—"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.button
            type="button"
            disabled={sending}
            whileTap={{ scale: 0.97 }}
            onClick={() => submit("regular_coal")}
            className="group glass relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl p-5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <div
              className="pointer-events-none absolute -top-10 left-1/2 h-20 w-28 -translate-x-1/2 rounded-full bg-primary/15 opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-primary/10 text-3xl ring-1 ring-primary/20">
              ⚫
            </span>
            <span className="relative font-semibold">
              {t("regularCoalType")}
            </span>
            <span className="relative text-xs text-muted-foreground">
              {t("quickLight")}
            </span>
          </motion.button>
          <motion.button
            type="button"
            disabled={sending}
            whileTap={{ scale: 0.97 }}
            onClick={() => submit("cubed_coal")}
            className="group glass relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl p-5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <div
              className="pointer-events-none absolute -top-10 left-1/2 h-20 w-28 -translate-x-1/2 rounded-full bg-primary/15 opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-primary/10 text-3xl ring-1 ring-primary/20">
              🟫
            </span>
            <span className="relative font-semibold">
              {t("cubedCoalType")}
            </span>
            <span className="relative text-xs text-muted-foreground">
              {t("longerBurn")}
            </span>
          </motion.button>
        </div>

        {sending && (
          <p className="relative flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("sending")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
