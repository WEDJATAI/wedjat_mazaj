"use client";

/**
 * r61 — Platform Control Center · SETTINGS tab.
 *
 * The owner's control desk for the platform engine itself:
 *   • RSM revenue-share — commission % on shisha + WEDJAT's share of it,
 *     with a LIVE formula preview (the same math every dashboard uses).
 *     Defaults 12% × 40% = 4.8%.
 *   • Platform identity — the display name.
 *
 * Changes take effect on every dashboard on the next request (the
 * settings layer is request-cached for at most 5 seconds).
 */

import * as React from "react";
import {
  DatabaseBackup,
  Landmark,
  Loader2,
  RotateCcw,
  Save,
  ScrollText,
  ShieldCheck,
  Type,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/store/i18n";
import type { Translations } from "@/lib/i18n";
import { CineCard, GoldButton, Kicker } from "../kit/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SettingsData {
  ok: boolean;
  rsm: { commissionPct: number; wedjatSharePct: number };
  platform: { displayName: string };
  defaults: { rsm: { commissionPct: number; wedjatSharePct: number } };
}

const r2 = (n: number) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ */
/* SettingsTab                                                         */
/* ------------------------------------------------------------------ */

export function SettingsTab() {
  const { t } = useI18n();
  const [data, setData] = React.useState<SettingsData | null>(null);
  const [commission, setCommission] = React.useState("12");
  const [share, setShare] = React.useState("40");
  const [displayName, setDisplayName] = React.useState("Mazaj Platform");
  const [saving, setSaving] = React.useState<"rsm" | "info" | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/platform/settings`);
      const json = (await res.json()) as SettingsData & { error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "failed");
      setData(json);
      setCommission(String(json.rsm.commissionPct));
      setShare(String(json.rsm.wedjatSharePct));
      setDisplayName(json.platform.displayName);
      setLoaded(true);
    } catch {
      toast.error(t("failed"));
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };
  const cNum = num(commission);
  const sNum = num(share);
  const cValid = Number.isFinite(cNum) && cNum >= 0.5 && cNum <= 90;
  const sValid = Number.isFinite(sNum) && sNum >= 1 && sNum <= 100;
  const rsmDirty =
    loaded &&
    data !== null &&
    (r2(cNum) !== data.rsm.commissionPct || r2(sNum) !== data.rsm.wedjatSharePct);
  const infoDirty = loaded && data !== null && displayName.trim() !== data.platform.displayName;

  const effective = cValid && sValid ? r2(cNum * (sNum / 100)) : NaN;

  const saveRsm = async () => {
    if (!cValid || !sValid || saving) return;
    setSaving("rsm");
    try {
      const res = await fetch("/api/platform/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rsm: { commissionPct: r2(cNum), wedjatSharePct: r2(sNum) },
        }),
      });
      const json = (await res.json()) as SettingsData & { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? t("failed"));
      setData((d) => (d ? { ...d, rsm: json.rsm } : d));
      toast.success(t("pccSettingsSavedToast"), { description: t("pccRsmSavedDesc") });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSaving(null);
    }
  };

  const saveInfo = async () => {
    if (displayName.trim().length < 2 || saving) return;
    setSaving("info");
    try {
      const res = await fetch("/api/platform/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: { displayName: displayName.trim() } }),
      });
      const json = (await res.json()) as SettingsData & { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? t("failed"));
      setData((d) => (d ? { ...d, platform: json.platform } : d));
      toast.success(t("pccSettingsSavedToast"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSaving(null);
    }
  };

  if (!loaded || !data) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" />
      </div>
    );
  }

  const inputCls = "h-11 rounded-xl border-white/[0.09] bg-white/[0.04]";
  const isDefault =
    data.rsm.commissionPct === data.defaults.rsm.commissionPct &&
    data.rsm.wedjatSharePct === data.defaults.rsm.wedjatSharePct;

  return (
    <div className="space-y-6">
      {/* ── RSM revenue-share engine ─────────────────────────────────── */}
      <CineCard className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <Kicker className="justify-start">
              <Landmark className="size-3.5" aria-hidden />
              {t("pccRsmEngineTitle")}
            </Kicker>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("pccRsmEngineDesc")}</p>
          </div>
          {!isDefault && (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-inset ring-amber-500/30">
              {t("pccCustom")}
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-commission" className="text-xs text-muted-foreground">
              {t("pccCommissionPct")}
            </Label>
            <Input
              id="set-commission"
              value={commission}
              onChange={(e) => setCommission(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className={cn(inputCls, !cValid && "border-destructive/50")}
            />
            <p className="text-[10px] text-muted-foreground">
              {t("pccCommissionHint")} ({data.defaults.rsm.commissionPct}%)
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-share" className="text-xs text-muted-foreground">
              {t("pccSharePct")}
            </Label>
            <Input
              id="set-share"
              value={share}
              onChange={(e) => setShare(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className={cn(inputCls, !sValid && "border-destructive/50")}
            />
            <p className="text-[10px] text-muted-foreground">
              {t("pccShareHint")} ({data.defaults.rsm.wedjatSharePct}%)
            </p>
          </div>
        </div>

        {/* live formula preview */}
        <div className="mt-4 rounded-2xl bg-gradient-to-b from-primary/[0.08] to-transparent p-4 ring-1 ring-inset ring-primary/20">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <ScrollText className="size-3.5" aria-hidden />
            {t("rsmFormula")}
          </p>
          <p className="font-display mt-2 text-center text-lg font-bold leading-relaxed text-gold-soft" dir="ltr">
            {t("rsmShishaRevenue")} ×{" "}
            <span className="text-gold">{cValid ? r2(cNum) : "?"}%</span> ×{" "}
            <span className="text-gold">{sValid ? r2(sNum) : "?"}%</span>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t("pccEffectiveTake")}:{" "}
            <span className="font-bold text-gold">
              {Number.isFinite(effective) ? `${effective}%` : "—"}
            </span>{" "}
            · {t("pccPartnerGets")}{" "}
            <span className="font-semibold text-foreground/80">
              {cValid && sValid ? `${r2(r2(cNum) * (1 - sNum / 100))}%` : "—"}
            </span>
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {t("rsmTaxNote")}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <GoldButton
            className="h-11 flex-1"
            disabled={!cValid || !sValid || saving !== null || !rsmDirty}
            onClick={() => void saveRsm()}
          >
            {saving === "rsm" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {t("pccSaveEngine")}
          </GoldButton>
          <button
            type="button"
            disabled={saving !== null || isDefault}
            onClick={() => {
              setCommission(String(data.defaults.rsm.commissionPct));
              setShare(String(data.defaults.rsm.wedjatSharePct));
            }}
            className="glass flex h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold text-foreground/85 ring-1 ring-inset ring-white/[0.09] transition-colors hover:border-primary/35 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t("pccResetToDefault")}
          </button>
        </div>
      </CineCard>

      {/* ── platform identity ────────────────────────────────────────── */}
      <CineCard className="p-5">
        <Kicker className="mb-1 justify-start">
          <Type className="size-3.5" aria-hidden />
          {t("pccIdentityTitle")}
        </Kicker>
        <p className="mb-4 text-xs text-muted-foreground">{t("pccIdentityDesc")}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-label={t("pccPlatformName")}
            className={inputCls}
          />
          <GoldButton
            className="h-11 shrink-0"
            disabled={displayName.trim().length < 2 || saving !== null || !infoDirty}
            onClick={() => void saveInfo()}
          >
            {saving === "info" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {t("saveBtn")}
          </GoldButton>
        </div>
      </CineCard>

      {/* ── off-site backups (r73) ───────────────────────────────── */}
      <BackupsCard />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BackupsCard — nightly off-site snapshot + on-demand runs            */
/* ------------------------------------------------------------------ */

interface BackupRunRow {
  id: string;
  kind: string;
  status: string;
  tables: number;
  rows: number;
  sizeBytes: number;
  offsite: boolean;
  error: string | null;
  createdAt: string;
}

function ago(
  iso: string,
  t: (key: keyof Translations, params?: Record<string, string | number>) => string
): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t("pccBackupAgoNow");
  if (mins < 60) return t("pccBackupAgoMin").replace("{n}", String(mins));
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("pccBackupAgoHour").replace("{n}", String(hours));
  return t("pccBackupAgoDay").replace("{n}", String(Math.round(hours / 24)));
}

const kb = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function BackupsCard() {
  const { t } = useI18n();
  const [runs, setRuns] = React.useState<BackupRunRow[] | null>(null);
  const [running, setRunning] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/platform/backup");
      const json = (await res.json()) as { ok: boolean; runs?: BackupRunRow[] };
      if (!res.ok || !json.ok) throw new Error();
      setRuns(json.runs ?? []);
    } catch {
      setRuns([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/platform/backup", { method: "POST" });
      const json = (await res.json()) as {
        ok: boolean;
        result?: { status: string; rows: number };
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? t("failed"));
      toast.success(t("pccBackupDoneToast"), {
        description: `${json.result?.rows ?? 0} ${t("pccBackupRows")} · ${t(
          json.result?.status === "success" ? "pccBackupSuccess" : "pccBackupPartial"
        )}`,
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setRunning(false);
    }
  };

  const last = runs?.[0];
  const statusChip = (s: string) =>
    s === "success"
      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
      : s === "partial"
        ? "bg-amber-500/10 text-amber-300 ring-amber-500/30"
        : "bg-destructive/15 text-red-300 ring-destructive/40";

  return (
    <CineCard className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Kicker className="justify-start">
            <DatabaseBackup className="size-3.5" aria-hidden />
            {t("pccBackupsTitle")}
          </Kicker>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("pccBackupsDesc")}
          </p>
        </div>
        <GoldButton
          className="h-10 shrink-0 px-4 text-xs"
          disabled={running}
          onClick={() => void runNow()}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="size-4" aria-hidden />
          )}
          {running ? t("pccBackupRunning") : t("pccBackupRunNow")}
        </GoldButton>
      </div>

      {/* last run summary */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-inset ring-white/[0.07]">
        {last ? (
          <>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${statusChip(last.status)}`}
            >
              {t(
                last.status === "success"
                  ? "pccBackupSuccess"
                  : last.status === "partial"
                    ? "pccBackupPartial"
                    : "pccBackupFailed"
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {ago(last.createdAt, t)} · {last.rows} {t("pccBackupRows")} · {kb(last.sizeBytes)}
            </span>
            <span
              className={`ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                last.offsite ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              {last.offsite ? t("pccBackupOffsite") : t("pccBackupOffsiteNo")}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{t("pccBackupLastNever")}</span>
        )}
      </div>

      {/* history */}
      {runs && runs.length > 0 && (
        <div className="slim-scroll mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs ring-1 ring-inset ring-white/[0.05]"
            >
              <span className={`size-1.5 shrink-0 rounded-full ${
                r.status === "success" ? "bg-emerald-400" : r.status === "partial" ? "bg-amber-400" : "bg-red-400"
              }`} aria-hidden />
              <span className="text-muted-foreground">{ago(r.createdAt, t)}</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
                {r.kind === "cron" ? t("pccBackupCron") : t("pccBackupManual")}
              </span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {r.rows} · {kb(r.sizeBytes)}
              </span>
              <span className={`shrink-0 font-bold ${r.offsite ? "text-emerald-300" : "text-amber-300"}`}>
                {r.offsite ? "✓" : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">
        {t("pccBackupCronHint")}
      </p>
    </CineCard>
  );
}
