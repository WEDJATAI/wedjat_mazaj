"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  RefreshCw,
  LogOut,
  UserPlus,
  Gift,
  Coins,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { egp } from "@/lib/catalog";
import { TIERS, tierDef, nextTierProgress } from "@/lib/loyalty";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MemberRow {
  id: string;
  name: string;
  phone: string;
  points: number;
  lifetimePoints: number;
  tier: string;
  createdAt: string;
}

interface Stats {
  members: number;
  pointsOutstanding: number;
  lifetimePoints: number;
  pointsRedeemed: number;
  pointsEarned: number;
}

export function LoyaltyPanel({ onSignOut }: { onSignOut: () => void }) {
  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loyalty");
      const data = await res.json();
      if (data.ok) {
        setMembers(data.members);
        setStats(data.stats);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) || m.phone.includes(q)
      )
    : members;

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Crown className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Mazaj+ Loyalty
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Rewards members, points &amp; tiers
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setEnrollOpen(true)}
              >
                <UserPlus className="size-4" />
                <span className="hidden sm:inline">Enroll</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={load}
                aria-label="Refresh"
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onSignOut}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6">
          {loading || !stats ? (
            <div className="space-y-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Program stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  icon={<Crown className="size-4" />}
                  label="Members"
                  value={String(stats.members)}
                  accent
                />
                <Stat
                  icon={<Coins className="size-4" />}
                  label="Points outstanding"
                  value={stats.pointsOutstanding.toLocaleString()}
                  sub="redeemable balance"
                />
                <Stat
                  icon={<Sparkles className="size-4" />}
                  label="Points earned"
                  value={stats.pointsEarned.toLocaleString()}
                  sub="all-time"
                />
                <Stat
                  icon={<Gift className="size-4" />}
                  label="Points redeemed"
                  value={stats.pointsRedeemed.toLocaleString()}
                  sub={`≈ ${egp((stats.pointsRedeemed / 100) * 25)} given back`}
                />
              </div>

              {/* Tier legend */}
              <section className="mt-4 rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-sm font-semibold">How Mazaj+ works</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {TIERS.map((t) => (
                    <div
                      key={t.key}
                      className={cn("rounded-xl border p-2.5", t.cls)}
                    >
                      <p className="text-sm font-bold">
                        {t.emoji} {t.label}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {t.min}+ lifetime pts · ×{t.multiplier} earn
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  1 pt per 1 EGP · 100 pts = {egp(25)} off · new members get a
                  50-pt welcome bonus. Guests join automatically when they
                  order with a phone number.
                </p>
              </section>

              {/* Members */}
              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold tracking-tight">
                    Members ({filtered.length})
                  </h2>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name / phone…"
                    className="h-9 w-44 rounded-xl text-sm sm:w-56"
                    aria-label="Search members"
                  />
                </div>
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    {members.length === 0
                      ? "No members yet — guests join automatically when ordering with a phone number, or enroll them manually."
                      : "No members match your search."}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filtered.map((m) => {
                      const td = tierDef(m.tier);
                      const prog = nextTierProgress(m.lifetimePoints);
                      return (
                        <div
                          key={m.id}
                          className="rounded-2xl border border-border bg-card p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="text-2xl">{td.emoji}</span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {m.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {m.phone}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-bold text-primary">
                                {m.points}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {" "}
                                  pts
                                </span>
                              </p>
                              <Badge
                                variant="secondary"
                                className={cn("mt-0.5", td.cls)}
                              >
                                {td.label}
                              </Badge>
                            </div>
                          </div>

                          {/* next tier progress */}
                          {prog.next ? (
                            <div className="mt-3">
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${prog.pct}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {prog.remaining} pts to{" "}
                                {prog.next.emoji} {prog.next.label} ·{" "}
                                {m.lifetimePoints} lifetime
                              </p>
                            </div>
                          ) : (
                            <p className="mt-3 text-[11px] font-medium text-primary">
                              💎 Top tier — {m.lifetimePoints} lifetime points
                            </p>
                          )}
                          <Separator className="my-2" />
                          <p className="text-[11px] text-muted-foreground">
                            Member since{" "}
                            {new Date(m.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnrolled={() => load()}
      />
    </div>
  );
}

function EnrollDialog({
  open,
  onOpenChange,
  onEnrolled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEnrolled: () => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || phone.trim().length < 5) {
      toast.error("Name and a phone number (5+ digits) are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      toast.success(
        data.existed
          ? `${data.member.name} is already a member`
          : `${data.member.name} enrolled — 50 welcome pts!`
      );
      onOpenChange(false);
      onEnrolled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enroll");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> Enroll a member
          </DialogTitle>
          <DialogDescription>
            They start with a 50-point welcome bonus (100 pts = {egp(25)} off).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="loyalty-name" className="text-xs text-muted-foreground">
              Full name
            </Label>
            <Input
              id="loyalty-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Hassan"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loyalty-phone" className="text-xs text-muted-foreground">
              Phone number (their loyalty ID)
            </Label>
            <Input
              id="loyalty-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              inputMode="tel"
            />
          </div>
        </div>
        <Button
          className="w-full rounded-xl"
          disabled={sending}
          onClick={submit}
        >
          {sending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Enrolling…
            </>
          ) : (
            "Enroll member"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/60 p-4",
        accent ? "border-primary/40 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={accent ? "text-primary" : "text-muted-foreground"}>
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
