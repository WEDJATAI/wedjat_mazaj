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
import { Landmark, Loader2, RotateCcw, Save, ScrollText, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/store/i18n";
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

export function SettingsTab({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();
  const [data, setData] = React.useState<SettingsData | null>(null);
  const [commission, setCommission] = React.useState("12");
  const [share, setShare] = React.useState("40");
  const [displayName, setDisplayName] = React.useState("Mazaj Platform");
  const [saving, setSaving] = React.useState<"rsm" | "info" | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/platform/settings?employeeId=${encodeURIComponent(employeeId)}`
      );
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
  }, [employeeId, t]);

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
          employeeId,
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
        body: JSON.stringify({ employeeId, platform: { displayName: displayName.trim() } }),
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
    </div>
  );
}
