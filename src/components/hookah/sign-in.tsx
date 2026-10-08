"use client";

import * as React from "react";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
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

export function SignIn() {
  const [tab, setTab] = React.useState<"role" | "pin" | "guest">("role");
  const t = useI18n((s) => s.t);
  const setGetAppOpen = usePwa((s) => s.setGetAppOpen);
  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      {/* Language toggle */}
      <div className="absolute right-4 top-4 z-10">
        <LangToggle />
      </div>
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex flex-col items-center text-center"
        >
          <motion.span
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="mb-3 grid size-20 place-items-center rounded-3xl bg-primary/15 text-primary shadow-lg shadow-primary/10"
          >
            <Flame className="size-10" />
          </motion.span>
          <h1 className="text-4xl font-bold tracking-tight smoke-text">{t("mazaj")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("hookahLounge")}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {tab === "role" && (
            <motion.div
              key="role"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid gap-3"
            >
              <RoleCard
                icon={<Store className="size-6" />}
                title="I'm staff"
                desc="Sign in with your PIN to take orders"
                accent="from-primary/20 to-primary/5"
                onClick={() => setTab("pin")}
              />
              <RoleCard
                icon={<UserRound className="size-6" />}
                title="I'm a guest"
                desc="Order from your table or call for help"
                accent="from-amber-500/20 to-amber-500/5"
                onClick={() => setTab("guest")}
              />

              {/* Quick guest — one tap, no name needed */}
              <button
                type="button"
                onClick={() => {
                  useSession.getState().signInGuest({ name: "Guest", table: "" });
                  toast.success("Welcome! Browse and order when ready.");
                }}
                className="mt-1 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-3 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
              >
                <Zap className="size-4 text-primary" />
                Just browsing — skip sign-in
              </button>

              {/* Get the app — QR download + one-tap install */}
              <button
                type="button"
                onClick={() => setGetAppOpen(true)}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm font-medium text-primary transition-all hover:border-primary/60 hover:bg-primary/15"
              >
                <QrCode className="size-4" />
                {t("getApp")} — iOS & Android
              </button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Staff PINs · Boss <span className="font-mono text-primary">1111</span>{" "}
                · Manager <span className="font-mono text-primary">0000</span>
                <br />
                Hassan <span className="font-mono text-primary">1234</span>{" "}
                · Omar <span className="font-mono text-primary">5678</span>
              </p>
            </motion.div>
          )}

          {tab === "pin" && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <PinPanel onBack={() => setTab("role")} />
            </motion.div>
          )}
          {tab === "guest" && (
            <motion.div
              key="guest"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <GuestPanel onBack={() => setTab("role")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  desc,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-100",
          accent
        )}
      />
      <span className="relative grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
        {icon}
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="relative size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}

function PinPanel({ onBack }: { onBack: () => void }) {
  const signIn = useSession((s) => s.signInEmployee);
  const [pin, setPin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [shake, setShake] = React.useState(false);

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
        throw new Error(data.error ?? "Invalid PIN");
      }
      toast.success(`Welcome, ${data.employee.name}!`);
      signIn(data.employee);
    } catch (err) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(err instanceof Error ? err.message : "Could not sign in");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

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
    <div className="rounded-3xl border border-border bg-card/70 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" />
        Enter your 4-digit PIN
      </div>

      <motion.div
        animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="mb-6 flex justify-center gap-4"
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            animate={{
              scale: i < pin.length ? 1.15 : 1,
              backgroundColor: i < pin.length ? "var(--primary)" : "transparent",
            }}
            className={cn(
              "grid size-7 place-items-center rounded-full border-2 transition-colors",
              i < pin.length
                ? "border-primary"
                : "border-border bg-muted/40"
            )}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <motion.button
            key={d}
            whileTap={{ scale: 0.92 }}
            type="button"
            className="grid h-16 place-items-center rounded-2xl border border-border bg-muted/40 text-2xl font-semibold transition-colors hover:bg-muted/70 active:bg-primary/15"
            onClick={() => press(d)}
            disabled={loading}
          >
            {d}
          </motion.button>
        ))}
        <Button
          variant="ghost"
          className="h-16 rounded-2xl text-sm"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </Button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="button"
          className="grid h-16 place-items-center rounded-2xl border border-border bg-muted/40 text-2xl font-semibold transition-colors hover:bg-muted/70 active:bg-primary/15"
          onClick={() => press("0")}
          disabled={loading}
        >
          0
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="button"
          className="grid h-16 place-items-center rounded-2xl border border-border bg-muted/40 transition-colors hover:bg-muted/70"
          onClick={back}
          disabled={loading || pin.length === 0}
          aria-label="Delete"
        >
          <Delete className="size-5" />
        </motion.button>
      </div>

      {loading && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking…
        </p>
      )}
    </div>
  );
}

function GuestPanel({ onBack }: { onBack: () => void }) {
  const signIn = useSession((s) => s.signInGuest);
  const tableCtx = useTableContext();
  const [name, setName] = React.useState("");
  const [table, setTable] = React.useState("");

  // Prefill the table from the POS link context (the employee opened
  // mazaj from the table's check) so the order lands on the right check.
  React.useEffect(() => {
    if (tableCtx.tableId != null || tableCtx.tableName) {
      setTable(tableCtx.tableName || (tableCtx.tableId != null ? `Table ${tableCtx.tableId}` : ""));
    }
  }, []);

  const valid = name.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    signIn({ name: name.trim(), table: table.trim() });
    toast.success(`Welcome, ${name.trim()}! 🎉`);
  };

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-5">
      <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4 text-primary" />
        Guest check-in
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3 text-primary" />
            Your name
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sara"
            aria-label="Guest name"
            className="h-12 rounded-xl text-base"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Table number (optional)
          </Label>
          <Input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="e.g. Table 5"
            aria-label="Guest table"
            className="h-12 rounded-xl text-base"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {tableCtx.fromPosLink && (tableCtx.tableId != null || tableCtx.tableName) && (
            <p className="flex items-center gap-1.5 text-xs text-primary">
              <Store className="size-3.5" aria-hidden />
              Linked to the table&apos;s check from the restaurant POS
              {tableCtx.tableName ? ` · ${tableCtx.tableName}` : ""}
            </p>
          )}
        </div>

        <Button
          className="h-12 w-full rounded-xl text-base font-semibold"
          size="lg"
          disabled={!valid}
          onClick={submit}
        >
          Start ordering
          <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          className="w-full text-sm"
          onClick={onBack}
        >
          ← Back
        </Button>
      </div>
    </div>
  );
}
