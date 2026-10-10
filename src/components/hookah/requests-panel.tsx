"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BellRing,
  CheckCheck,
  RefreshCw,
  LogOut,
  MapPin,
  User,
  Clock,
  HandHelping,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useI18n } from "@/store/i18n";
import {
  AppHeader,
  EmptyState,
  GoldButton,
  Kicker,
  StatTile,
  Stagger,
  StaggerItem,
} from "./kit/kit";

interface ServiceRequest {
  id: string;
  type: string;
  guestName: string | null;
  table: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
  /** r57 — the branch this request belongs to (set in the all-branches scope) */
  branchName?: string | null;
  branchNameAr?: string | null;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

/* ── Midnight Ember shared bits (panel-local) ─────────────────────────── */

const glassIconBtn =
  "glass grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground active:scale-95";

const donePillBtn =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-500 transition-all hover:bg-emerald-500/20 active:scale-[0.97]";

export function RequestsPanel({ onSignOut }: { onSignOut: () => void }) {
  const { branchParam, branchName } = useBranchScope();
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  // r57 — "all" = every branch of the venue; show a branch chip per request
  const scopeAll = branchParam === "all";
  const scopeLabel = branchName ?? t("allBranches");
  const [requests, setRequests] = React.useState<ServiceRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/requests?branchId=${encodeURIComponent(branchParam)}`
      );
      const data = await res.json();
      if (data.ok) setRequests(data.requests);
      else toast.error("Could not load requests");
    } catch {
      toast.error("Could not load requests");
    } finally {
      setLoading(false);
    }
  }, [branchParam]);

  React.useEffect(() => {
    load();
    // poll for new requests every 15s
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const acknowledge = async (req: ServiceRequest, status: string) => {
    try {
      const res = await fetch(`/api/requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      toast.success(
        status === "acknowledged" ? "Request acknowledged" : "Marked done"
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const active = requests.filter((r) => r.status === "acknowledged");
  const done = requests.filter((r) => r.status === "done");

  return (
    <div className="dark relative flex min-h-screen flex-col text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <AppHeader
          icon={<BellRing className="size-5" />}
          title="Requests"
          subtitle={`Guest calls for the shisha man · ${scopeLabel}`}
          actions={
            <>
              {pending.length > 0 && (
                <span className="hidden items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-bold text-primary ring-1 ring-primary/40 sm:inline-flex">
                  <BellRing className="size-3.5" /> {pending.length} new
                </span>
              )}
              <button
                type="button"
                onClick={load}
                aria-label="Refresh"
                title="Refresh"
                className={glassIconBtn}
              >
                <RefreshCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className={glassIconBtn}
              >
                <LogOut className="size-4" />
              </button>
            </>
          }
        />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-6 sm:px-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl bg-white/[0.05]" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={<HandHelping className="size-6" />}
              title="No requests yet"
              description="When a guest calls the shisha man, it shows up here."
            />
          ) : (
            <div className="space-y-8">
              {/* Live request pulse — gold stat tiles */}
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  icon={<BellRing className="size-4" />}
                  text={String(pending.length)}
                  label="Pending"
                />
                <StatTile
                  icon={<HandHelping className="size-4" />}
                  text={String(active.length)}
                  label="In progress"
                />
                <StatTile
                  icon={<CheckCheck className="size-4" />}
                  text={String(done.length)}
                  label="Done"
                />
              </div>

              {pending.length > 0 && (
                <Section title="Pending" count={pending.length}>
                  {pending.map((r) => (
                    <StaggerItem key={r.id}>
                      <RequestCard
                        req={r}
                        showBranch={scopeAll}
                        onAck={() => acknowledge(r, "acknowledged")}
                      />
                    </StaggerItem>
                  ))}
                </Section>
              )}
              {active.length > 0 && (
                <Section title="In progress" count={active.length}>
                  {active.map((r) => (
                    <StaggerItem key={r.id}>
                      <RequestCard
                        req={r}
                        showBranch={scopeAll}
                        onAck={() => acknowledge(r, "done")}
                        ackLabel="Mark done"
                      />
                    </StaggerItem>
                  ))}
                </Section>
              )}
              {done.length > 0 && (
                <Section title="Done" count={done.length} muted>
                  {done.map((r) => (
                    <StaggerItem key={r.id}>
                      <RequestCard req={r} showBranch={scopeAll} />
                    </StaggerItem>
                  ))}
                </Section>
              )}
            </div>
          )}
        </main>

        <footer className="relative mt-auto border-t border-white/[0.06] bg-[oklch(0.135_0.014_60/0.6)] py-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
            <Flame className="size-3.5 text-primary" aria-hidden />
            <span>Auto-refreshes every 15 seconds</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <Kicker className={muted ? "opacity-60" : undefined}>{title}</Kicker>
        <span
          className={cn(
            "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold ring-1",
            muted
              ? "bg-white/[0.04] text-muted-foreground ring-white/10"
              : "bg-primary/15 text-primary ring-primary/35"
          )}
          aria-label={`${count} requests`}
        >
          {count}
        </span>
      </div>
      <Stagger className="space-y-3">{children}</Stagger>
    </section>
  );
}

/* ── Gold status stepper — Requested → Acknowledged → Done ────────────── */

const STEP_LABELS = ["Requested", "Acknowledged", "Done"] as const;

function GoldStepper({ status }: { status: string }) {
  const current =
    status === "done" ? 2 : status === "acknowledged" ? 1 : 0;
  return (
    <div className="mt-3.5" aria-label={`Status: ${status}`}>
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && (
              <span
                className={cn(
                  "h-px flex-1 transition-colors duration-500",
                  i <= current ? "bg-primary/55" : "bg-white/10"
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-all duration-500",
                i < current &&
                  "bg-primary/20 text-primary ring-1 ring-primary/50",
                i === current &&
                  status !== "done" &&
                  "bg-primary/15 text-primary ring-1 ring-primary/60 shadow-[0_0_12px_oklch(0.78_0.15_65/0.4)] animate-pulse motion-reduce:animate-none",
                i === current &&
                  status === "done" &&
                  "bg-primary text-primary-foreground ring-1 ring-primary shadow-[0_0_14px_oklch(0.78_0.15_65/0.55)]",
                i > current &&
                  "bg-white/[0.04] text-muted-foreground/70 ring-1 ring-white/10"
              )}
            >
              {i < current ? <CheckCheck className="size-3" /> : i + 1}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className={cn(
              "text-[10px] font-medium tracking-wide",
              i === 0 && "text-start",
              i === STEP_LABELS.length - 1 && "text-end",
              i <= current ? "text-gold-soft" : "text-muted-foreground/70"
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RequestCard({
  req,
  onAck,
  ackLabel = "Acknowledge",
  showBranch,
}: {
  req: ServiceRequest;
  onAck?: () => void;
  ackLabel?: string;
  /** r57 — all-branches scope: render the branch chip when present */
  showBranch?: boolean;
}) {
  const lang = useI18n((s) => s.lang);
  const isCoal = req.type === "coal_request";
  const title = isCoal
    ? "Coal request"
    : req.type === "call_shisha_man"
    ? "Call the shisha man"
    : req.type;
  const statusLabel =
    req.status.charAt(0).toUpperCase() + req.status.slice(1);

  const pillCls =
    req.status === "pending"
      ? isCoal
        ? "rounded-full border-transparent bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/45"
        : "rounded-full border-transparent bg-primary/15 text-primary ring-1 ring-primary/45"
      : req.status === "acknowledged"
      ? "rounded-full border-transparent bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/40"
      : "rounded-full border-transparent bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/40";

  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]",
        req.status === "pending" &&
          (isCoal ? "ring-1 ring-amber-500/40" : "ring-1 ring-primary/45"),
        req.status === "acknowledged" && "ring-1 ring-amber-500/30",
        req.status === "done" && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl ring-1",
            isCoal
              ? "bg-amber-500/15 text-amber-500 ring-amber-500/30"
              : "bg-primary/15 text-primary ring-primary/30"
          )}
        >
          {isCoal ? (
            <Flame className="size-5" />
          ) : (
            <HandHelping className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-bold tracking-tight text-gold-soft">
              {title}
            </p>
            <Badge variant="secondary" className={pillCls}>
              {statusLabel}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {req.guestName && (
              <span className="flex items-center gap-1">
                <User className="size-3" /> {req.guestName}
              </span>
            )}
            {req.table && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {req.table}
              </span>
            )}
            {showBranch && req.branchName && (
              <span className="flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                <MapPin className="size-3" /> {(lang === "ar" && req.branchNameAr) || req.branchName}
              </span>
            )}
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="size-3" /> {timeAgo(req.createdAt)}
            </span>
          </div>
          {req.note && (
            <p className="mt-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm italic text-foreground/80">
              “{req.note}”
            </p>
          )}
        </div>
      </div>

      <GoldStepper status={req.status} />

      {onAck && (
        <div className="mt-3.5">
          {req.status === "pending" ? (
            <GoldButton className="h-11 w-full text-sm" onClick={onAck}>
              <CheckCheck className="size-4" /> {ackLabel}
            </GoldButton>
          ) : (
            <button type="button" className={donePillBtn} onClick={onAck}>
              <CheckCheck className="size-4" /> {ackLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
