"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AppHeader,
  EmptyState,
  GoldButton,
  Kicker,
  ScreenShell,
  StatTile,
  Stagger,
  StaggerItem,
} from "./kit/kit";

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
    <ScreenShell className="min-h-screen">
      <AppHeader
        icon={<Crown className="size-5" />}
        title="Mazaj+ Loyalty"
        subtitle="Rewards members, points & tiers"
        actions={
          <>
            <GoldButton size="sm" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="size-3.5" />
              <span className="hidden sm:inline">Enroll</span>
            </GoldButton>
            <button
              type="button"
              onClick={load}
              aria-label="Refresh"
              className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-6 sm:px-5">
        {loading || !stats ? (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-2xl bg-white/[0.05]" />
            <Skeleton className="h-64 rounded-2xl bg-white/[0.05]" />
          </div>
        ) : (
          <>
            {/* Program stats */}
            <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StaggerItem>
                <StatTile
                  icon={<Crown className="size-4" />}
                  value={stats.members}
                  label="Members"
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  icon={<Coins className="size-4" />}
                  value={stats.pointsOutstanding}
                  label={
                    <>
                      Points outstanding
                      <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal opacity-70">
                        redeemable balance
                      </span>
                    </>
                  }
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  icon={<Sparkles className="size-4" />}
                  value={stats.pointsEarned}
                  label={
                    <>
                      Points earned
                      <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal opacity-70">
                        all-time
                      </span>
                    </>
                  }
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  icon={<Gift className="size-4" />}
                  value={stats.pointsRedeemed}
                  label={
                    <>
                      Points redeemed
                      <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal opacity-70">
                        ≈ {egp((stats.pointsRedeemed / 100) * 25)} given back
                      </span>
                    </>
                  }
                />
              </StaggerItem>
            </Stagger>

            {/* Tier legend */}
            <section className="glass mt-4 rounded-2xl p-4">
              <Kicker className="mb-3 justify-start">How Mazaj+ works</Kicker>
              <div className="grid gap-2 sm:grid-cols-4">
                {TIERS.map((t) => (
                  <div
                    key={t.key}
                    className={cn("rounded-xl p-2.5 backdrop-blur-sm", t.cls)}
                  >
                    <p className="font-display text-sm font-bold">
                      {t.emoji} {t.label}
                    </p>
                    <p className="text-[11px] opacity-80">
                      {t.min}+ lifetime pts · ×{t.multiplier} earn
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                1 pt per 1 EGP · 100 pts = {egp(25)} off · new members get a
                50-pt welcome bonus. Guests join automatically when they
                order with a phone number.
              </p>
            </section>

            {/* Members */}
            <section className="mt-6">
              <h2 className="sr-only">
                Members ({filtered.length})
              </h2>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Kicker className="justify-start">
                  Members · {filtered.length}
                </Kicker>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name / phone…"
                  className="h-10 w-44 rounded-full border-white/[0.09] bg-white/[0.04] text-sm sm:w-56"
                  aria-label="Search members"
                />
              </div>
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<UserPlus className="size-6" />}
                  title={
                    members.length === 0
                      ? "No members yet"
                      : "No members match your search."
                  }
                  description={
                    members.length === 0
                      ? "Guests join automatically when ordering with a phone number, or enroll them manually."
                      : undefined
                  }
                  action={
                    members.length === 0 ? (
                      <GoldButton size="sm" onClick={() => setEnrollOpen(true)}>
                        <UserPlus className="size-3.5" /> Enroll a member
                      </GoldButton>
                    ) : undefined
                  }
                />
              ) : (
                <Stagger className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((m) => {
                    const td = tierDef(m.tier);
                    const prog = nextTierProgress(m.lifetimePoints);
                    return (
                      <StaggerItem key={m.id}>
                        <div className="glass group rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-xl ring-1 ring-primary/20">
                                {td.emoji}
                              </span>
                              <div className="min-w-0">
                                <p className="font-display truncate text-base font-bold tracking-tight text-gold-soft">
                                  {m.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {m.phone}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-end">
                              <p className="font-display text-lg font-bold tabular-nums text-gold">
                                {m.points}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {" "}
                                  pts
                                </span>
                              </p>
                              <span
                                className={cn(
                                  "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  td.cls
                                )}
                              >
                                {td.label}
                              </span>
                            </div>
                          </div>

                          {/* next tier progress */}
                          {prog.next ? (
                            <div className="mt-3">
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[oklch(0.72_0.145_60)] to-[oklch(0.86_0.13_74)] transition-all"
                                  style={{ width: `${prog.pct}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {prog.remaining} pts to{" "}
                                {prog.next.emoji} {prog.next.label} ·{" "}
                                <span className="font-display font-semibold text-gold-soft">
                                  {m.lifetimePoints}
                                </span>{" "}
                                lifetime
                              </p>
                            </div>
                          ) : (
                            <p className="font-display mt-3 text-[11px] font-semibold text-gold-soft">
                              💎 Top tier — {m.lifetimePoints} lifetime points
                            </p>
                          )}
                          <div className="ember-hairline my-2.5" aria-hidden />
                          <p className="text-[11px] text-muted-foreground">
                            Member since{" "}
                            {new Date(m.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              )}
            </section>
          </>
        )}
      </main>

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnrolled={() => load()}
      />
    </ScreenShell>
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
      <DialogContent className="border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
              <UserPlus className="size-4" />
            </span>
            Enroll a member
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
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
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
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
            />
          </div>
        </div>
        <GoldButton
          className="w-full"
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
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}
