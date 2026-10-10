"use client";

import * as React from "react";
import { useSession } from "@/store/session";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Flame,
  Delete,
  ShieldCheck,
  UserRound,
  ArrowRight,
  Loader2,
  Store,
  Sparkles,
  Zap,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LangToggle } from "./lang-toggle";
import { useI18n } from "@/store/i18n";
import { useTableContext } from "@/store/table-context";
import { usePwa } from "@/store/pwa";
import { EASE, GoldButton, Kicker, ScreenShell } from "./kit/kit";
import type { EmployeeBranch } from "@/store/session";
import { MapPin, LayoutGrid } from "lucide-react";

export function SignIn() {
  const [tab, setTab] = React.useState<"role" | "pin" | "guest">("role");
  const t = useI18n((s) => s.t);
  const setGetAppOpen = usePwa((s) => s.setGetAppOpen);
  // r57: no download CTAs once the app is installed on this device
  const installed = usePwa((s) => s.installed);
  // Demo PIN hints only on trusted local development origins — never on the
  // public production deployment (the PINs are real employee credentials).
  const [isLocal, setIsLocal] = React.useState(false);
  React.useEffect(() => {
    try {
      const h = window.location.hostname;
      setIsLocal(h === "localhost" || h === "127.0.0.1" || h.endsWith(".local"));
    } catch {
      setIsLocal(false);
    }
  }, []);
  return (
    <ScreenShell embers emberDensity={0.4} className="min-h-[100dvh]">
      {/* Language toggle */}
      <div className="absolute end-4 top-4 z-10">
        <LangToggle />
      </div>
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        {/* ── the marquee ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-9 flex flex-col items-center text-center"
        >
          <motion.span
            initial={{ scale: 0, rotate: -18 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.15, stiffness: 200, damping: 16 }}
            className="mb-4 grid size-20 place-items-center rounded-[1.6rem] bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary shadow-[0_0_44px_-6px_oklch(0.78_0.15_65/0.45)] ring-1 ring-primary/30"
          >
            <Flame className="size-10" />
          </motion.span>
          <p className="text-xs font-semibold tracking-[0.5em] text-muted-foreground">
            مــزاج
          </p>
          <h1 className="font-display mt-2 text-5xl font-bold tracking-wide text-gold">
            MAZAJ
          </h1>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
            className="ember-hairline mt-4 w-32"
            aria-hidden
          />
          <p className="mt-3 text-sm text-muted-foreground">{t("hookahLounge")}</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {tab === "role" && (
            <motion.div
              key="role"
              initial={{ opacity: 0, x: -24, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -24, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: EASE }}
              className="grid gap-3"
            >
              <RoleCard
                icon={<Store className="size-6" />}
                title={t("imStaff")}
                desc={t("imStaffDesc")}
                onClick={() => setTab("pin")}
              />
              <RoleCard
                icon={<UserRound className="size-6" />}
                title={t("imGuest")}
                desc={t("imGuestDesc")}
                onClick={() => setTab("guest")}
              />

              {/* Quick guest — one tap, no name needed */}
              <button
                type="button"
                onClick={() => {
                  useSession.getState().signInGuest({ name: "Guest", table: "" });
                  toast.success(`${t("browseSkipToast")}`);
                }}
                className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-3 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
              >
                <Zap className="size-4 text-primary" />
                {t("justBrowsing")}
              </button>

              {/* Get the app — QR download + one-tap install (hidden when
                  this device already runs the installed app) */}
              {!installed && (
                <button
                  type="button"
                  onClick={() => setGetAppOpen(true)}
                  className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm font-medium text-primary transition-all hover:border-primary/60 hover:bg-primary/15"
                >
                  <QrCode className="size-4" />
                  {t("getApp")} — iOS & Android
                </button>
              )}

              {isLocal && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {t("staffPins")} · Boss{" "}
                  <span className="font-mono text-primary">1111</span> ·
                  Manager <span className="font-mono text-primary">0000</span>
                  <br />
                  Hassan <span className="font-mono text-primary">1234</span>{" "}
                  · Omar <span className="font-mono text-primary">5678</span>
                </p>
              )}
            </motion.div>
          )}

          {tab === "pin" && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 24, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 24, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <PinPanel onBack={() => setTab("role")} />
            </motion.div>
          )}
          {tab === "guest" && (
            <motion.div
              key="guest"
              initial={{ opacity: 0, x: 24, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 24, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <GuestPanel onBack={() => setTab("role")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScreenShell>
  );
}

function RoleCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group glass relative flex min-h-20 items-center gap-4 overflow-hidden rounded-2xl p-5 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.8)]"
    >
      {/* warm corner glow */}
      <div
        className="pointer-events-none absolute -end-10 -top-12 size-36 rounded-full bg-primary/15 opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-90"
        aria-hidden
      />
      <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
        {icon}
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="font-display text-lg font-bold text-gold-soft">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="relative size-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary rtl:rotate-180" />
    </button>
  );
}

function PinPanel({ onBack }: { onBack: () => void }) {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const signIn = useSession((s) => s.signInEmployee);
  const [pin, setPin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [shake, setShake] = React.useState(false);
  // r57: branch chooser state — multi-branch staff pick where they work
  const [chooser, setChooser] = React.useState<{
    employee: {
      id: string;
      name: string;
      role: string;
      permissions: string[];
      venueId: string | null;
      branchId: string | null;
      branches: EmployeeBranch[];
    };
  } | null>(null);

  const finishSignIn = (
    emp: {
      id: string;
      name: string;
      role: string;
      permissions: string[];
      venueId: string | null;
      branchId: string | null;
      branches: EmployeeBranch[];
    },
    chosenBranchId: string | null
  ) => {
    toast.success(`${t("welcome")} ${emp.name}!`);
    const branch = emp.branches.find((b) => b.id === chosenBranchId) ?? null;
    signIn({
      ...emp,
      permissions: emp.permissions as never,
      branchId: chosenBranchId,
      branchName: branch ? branch.nameAr ?? branch.name : null,
    });
  };

  const submit = async (fullPin?: string) => {
    const value = (fullPin ?? pin).trim();
    if (value.length !== 4 || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? t("invalidPin"));
      }
      const emp = data.employee as {
        id: string;
        name: string;
        role: string;
        permissions: string[];
        venueId: string | null;
        branchId: string | null;
        branches: EmployeeBranch[];
      };
      // r57 routing after auth:
      //  platform_admin → straight into the Platform Console
      //  multi-branch floaters (venue_admin / super_admin) → branch chooser
      //  single-branch staff → straight in with their branch
      if (emp.role !== "platform_admin" && emp.branches.length > 1) {
        setChooser({ employee: emp });
        return; // keep loading state off via finally
      }
      finishSignIn(emp, emp.branches[0]?.id ?? null);
    } catch (err) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(err instanceof Error ? err.message : t("couldNotSignIn"));
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  // ── r57: the branch chooser (multi-branch staff) ──
  if (chooser) {
    const emp = chooser.employee;
    const isFloater = emp.role === "venue_admin" || emp.role === "super_admin";
    const name = (b: EmployeeBranch) =>
      lang === "ar" && b.nameAr ? b.nameAr : b.name;
    return (
      <div className="glass relative overflow-hidden rounded-3xl p-5">
        <div
          className="pointer-events-none absolute -top-14 left-1/2 h-28 w-48 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <Kicker className="relative mb-1.5 justify-center">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {t("chooseBranch")}
          </span>
        </Kicker>
        <p className="relative mb-5 text-center text-sm font-medium text-foreground/80">
          {t("chooseBranchDesc")}
        </p>
        <div className="relative grid gap-2.5">
          {isFloater && (
            <button
              type="button"
              onClick={() => finishSignIn(emp, null)}
              className="group glass relative flex min-h-16 items-center gap-3.5 rounded-2xl p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
                <LayoutGrid className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-base font-bold text-gold-soft">
                  {t("allBranches")}
                </span>
                <span className="block text-xs font-medium text-foreground/75">
                  {t("allBranchesDesc")}
                </span>
              </span>
            </button>
          )}
          {emp.branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => finishSignIn(emp, b.id)}
              className="group glass relative flex min-h-16 items-center gap-3.5 rounded-2xl p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
                <MapPin className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-base font-bold text-gold-soft">
                  {name(b)}
                </span>
                <span className="block text-xs font-medium text-foreground/75">
                  {lang === "ar" && b.venueNameAr ? b.venueNameAr : b.venueName}
                </span>
              </span>
              {b.isFlagship && (
                <span className="shrink-0 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  ★
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            className="relative mt-1 w-full py-2 text-sm font-medium text-foreground/75 transition-colors hover:text-foreground"
            onClick={() => setChooser(null)}
          >
            ← {t("back")}
          </button>
        </div>
      </div>
    );
  }

  // ── the PIN pad (unchanged behavior) ──

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => submit(next), 120);
    }
  };
  const back = () => setPin(pin.slice(0, -1));

  return (
    <div className="glass relative overflow-hidden rounded-3xl p-5">
      <div
        className="pointer-events-none absolute -top-14 left-1/2 h-28 w-48 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <Kicker className="relative mb-4 justify-center">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> {t("enterPin")}
        </span>
      </Kicker>

      {/* PIN dots — molten gold when lit */}
      <motion.div
        animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="relative mb-6 flex justify-center gap-4"
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            animate={{
              scale: i < pin.length ? 1.15 : 1,
              backgroundColor:
                i < pin.length ? "oklch(0.78 0.15 65)" : "oklch(0.78 0.15 65 / 0)",
              boxShadow: i < pin.length
                ? "0 0 18px oklch(0.78 0.15 65 / 0.55)"
                : "0 0 0 oklch(0.78 0.15 65 / 0)",
            }}
            className={cn(
              "grid size-7 place-items-center rounded-full border-2 transition-colors",
              i < pin.length ? "border-primary" : "border-white/15 bg-white/[0.03]"
            )}
          />
        ))}
      </motion.div>

      <div className="relative grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <motion.button
            key={d}
            whileTap={{ scale: 0.92 }}
            type="button"
            className="font-display grid h-16 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-2xl font-bold text-foreground transition-all hover:border-primary/40 hover:bg-primary/[0.09] active:bg-primary/20"
            onClick={() => press(d)}
            disabled={loading}
          >
            {d}
          </motion.button>
        ))}
        <button
          type="button"
          className="grid h-16 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.02] text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          onClick={onBack}
          disabled={loading}
        >
          ← {t("back")}
        </button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="button"
          className="font-display grid h-16 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-2xl font-bold transition-all hover:border-primary/40 hover:bg-primary/[0.09] active:bg-primary/20"
          onClick={() => press("0")}
          disabled={loading}
        >
          0
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="button"
          className="grid h-16 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.09]"
          onClick={back}
          disabled={loading || pin.length === 0}
          aria-label="Delete"
        >
          <Delete className="size-5" />
        </motion.button>
      </div>

      {loading && (
        <p className="relative mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t("checking")}
        </p>
      )}
    </div>
  );
}

function GuestPanel({ onBack }: { onBack: () => void }) {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const signIn = useSession((s) => s.signInGuest);
  const tableCtx = useTableContext();
  const [name, setName] = React.useState("");
  const [table, setTable] = React.useState("");
  // r57 — which branch is this guest sitting at?
  const [branches, setBranches] = React.useState<
    { id: string; name: string; nameAr: string | null; venueName: string; venueNameAr: string | null; isFlagship: boolean }[]
  >([]);
  const [branchId, setBranchId] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/branches");
        const data = await res.json();
        if (cancelled || !data.ok) return;
        const list = data.branches as typeof branches;
        setBranches(list);
        // preselect the flagship (or first) branch
        setBranchId((prev) => prev || list.find((b) => b.isFlagship)?.id || list[0]?.id || "");
      } catch {
        // silent — single-branch/legacy behavior when unreachable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefill the table from the POS link context (the employee opened
  // mazaj from the table's check) so the order lands on the right check.
  React.useEffect(() => {
    if (tableCtx.tableId != null || tableCtx.tableName) {
      setTable(tableCtx.tableName || (tableCtx.tableId != null ? `Table ${tableCtx.tableId}` : ""));
    }
  }, []);

  const valid = name.trim().length > 0;
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  const submit = () => {
    if (!valid) return;
    signIn({
      name: name.trim(),
      table: table.trim(),
      branchId: branchId || null,
      branchName: selectedBranch
        ? (lang === "ar" && selectedBranch.nameAr) || selectedBranch.name
        : null,
    });
    toast.success(`Welcome, ${name.trim()}! 🎉`);
  };

  return (
    <div className="glass relative overflow-hidden rounded-3xl p-5">
      <div
        className="pointer-events-none absolute -top-14 left-1/2 h-28 w-48 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <Kicker className="relative mb-5 justify-center">
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-3.5" /> {t("guestCheckIn")}
        </span>
      </Kicker>

      <div className="relative space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3 text-primary" />
            {t("yourName")}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            aria-label="Guest name"
            className="h-12 rounded-xl border-white/[0.09] bg-white/[0.04] text-base"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground/85">
            {t("tableOptional")}
          </Label>
          <Input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder={t("tablePlaceholder")}
            aria-label="Guest table"
            className="h-12 rounded-xl border-white/[0.09] bg-white/[0.04] text-base"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {tableCtx.fromPosLink && (tableCtx.tableId != null || tableCtx.tableName) && (
            <p className="flex items-center gap-1.5 text-xs text-primary">
              <Store className="size-3.5" aria-hidden />
              {t("linkedPosNote")}
              {tableCtx.tableName ? ` · ${tableCtx.tableName}` : ""}
            </p>
          )}
        </div>

        {/* r57 — the branch picker (only when the venue has multiple) */}
        {branches.length > 1 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground/85">
              <MapPin className="size-3 text-primary" />
              {t("chooseBranchGuest")}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {branches.map((b) => {
                const label = (lang === "ar" && b.nameAr) || b.name;
                const active = branchId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBranchId(b.id)}
                    aria-pressed={active}
                    className={
                      "flex min-h-12 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-start transition-all duration-200 " +
                      (active
                        ? "border-primary/50 bg-primary/15"
                        : "border-white/[0.12] bg-white/[0.05] hover:border-primary/35")
                    }
                  >
                    <span
                      className={
                        "text-sm font-semibold " + (active ? "text-primary" : "text-foreground/90")
                      }
                    >
                      {label}
                    </span>
                    <span className="truncate text-[10px] font-medium text-foreground/70">
                      {(lang === "ar" && b.venueNameAr) || b.venueName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <GoldButton
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={submit}
        >
          {t("startOrdering")}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </GoldButton>
        <button
          type="button"
          className="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={onBack}
        >
          ← {t("back")}
        </button>
      </div>
    </div>
  );
}
