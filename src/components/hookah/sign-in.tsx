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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SignIn() {
  const [tab, setTab] = React.useState<"role" | "pin" | "guest">("role");
  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 grid size-16 place-items-center rounded-3xl bg-primary/15 text-primary">
            <Flame className="size-8" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight smoke-text">Mazaj</h1>
          <p className="text-sm text-muted-foreground">
            Hookah lounge · ordering system
          </p>
        </div>

        {tab === "role" && (
          <div className="grid gap-3">
            <RoleCard
              icon={<Store className="size-5" />}
              title="Employee"
              desc="Shisha staff — sign in with your PIN"
              onClick={() => setTab("pin")}
            />
            <RoleCard
              icon={<UserRound className="size-5" />}
              title="Guest"
              desc="Order yourself or call the shisha man"
              onClick={() => setTab("guest")}
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Demo PINs · Boss <span className="font-mono text-primary">1111</span>{" "}
              · Manager <span className="font-mono text-primary">0000</span>
              <br />
              Hassan <span className="font-mono text-primary">1234</span>{" "}
              · Omar <span className="font-mono text-primary">5678</span>
            </p>
          </div>
        )}

        {tab === "pin" && <PinPanel onBack={() => setTab("role")} />}
        {tab === "guest" && <GuestPanel onBack={() => setTab("role")} />}
      </div>
    </div>
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
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5"
    >
      <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function PinPanel({ onBack }: { onBack: () => void }) {
  const signIn = useSession((s) => s.signInEmployee);
  const [pin, setPin] = React.useState("");
  const [loading, setLoading] = React.useState(false);

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
      toast.success(`Welcome, ${data.employee.name}`);
      signIn(data.employee);
    } catch (err) {
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
        Employee PIN
      </div>

      <div className="mb-5 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "grid size-5 place-items-center rounded-full transition-colors",
              i < pin.length ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Button
            key={d}
            variant="secondary"
            className="h-14 rounded-2xl text-xl font-semibold"
            onClick={() => press(d)}
            disabled={loading}
          >
            {d}
          </Button>
        ))}
        <Button
          variant="ghost"
          className="h-14 rounded-2xl text-sm"
          onClick={onBack}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          className="h-14 rounded-2xl text-xl font-semibold"
          onClick={() => press("0")}
          disabled={loading}
        >
          0
        </Button>
        <Button
          variant="ghost"
          className="h-14 rounded-2xl"
          onClick={back}
          disabled={loading || pin.length === 0}
          aria-label="Delete"
        >
          <Delete className="size-5" />
        </Button>
      </div>

      {loading && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Verifying…
        </p>
      )}
    </div>
  );
}

function GuestPanel({ onBack }: { onBack: () => void }) {
  const signIn = useSession((s) => s.signInGuest);
  const [name, setName] = React.useState("");
  const [table, setTable] = React.useState("");

  const valid = name.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    signIn({ name: name.trim(), table: table.trim() });
    toast.success(`Welcome, ${name.trim()}`);
  };

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4 text-primary" />
        Guest check-in
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Your name
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sara"
            aria-label="Guest name"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Table (optional)
          </Label>
          <Input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="e.g. Table 5"
            aria-label="Guest table"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <Button
          className="w-full rounded-xl"
          size="lg"
          disabled={!valid}
          onClick={submit}
        >
          Continue as guest
          <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          className="w-full text-sm"
          onClick={onBack}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
