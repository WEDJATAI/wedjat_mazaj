import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requirePlatformAdminSession } from "@/lib/auth";
import {
  SETTING_KEYS,
  DEFAULT_RSM_CONFIG,
  getRsmConfig,
  getMenuPricing,
  getPlatformInfo,
  invalidateSettingsCache,
} from "@/lib/platform-settings";

/**
 * r61 — Platform Control Center · SETTINGS.
 *
 * GET /api/platform/settings?employeeId=…
 *   → { rsm: { commissionPct, wedjatSharePct },
 *       platform: { displayName },
 *       defaults: { ... } }   (defaults shown for one-tap reset)
 *
 * PUT /api/platform/settings
 *   { employeeId, rsm?: { commissionPct, wedjatSharePct },
 *     platform?: { displayName } }
 *
 * The RSM percentages steer the whole revenue-share engine at runtime
 * (defaults 12% commission on shisha × 40% WEDJAT share = 4.8%).
 */

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;
    const [rsm, platform] = await Promise.all([getRsmConfig(), getPlatformInfo()]);
    return NextResponse.json({
      ok: true,
      rsm,
      platform,
      defaults: {
        rsm: DEFAULT_RSM_CONFIG,
        platform: { displayName: "Mazaj Platform" },
      },
    });
  } catch (err) {
    console.error("platform settings get error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load settings" },
      { status: 500 }
    );
  }
}

const PutSchema = z.object({
  rsm: z
    .object({
      commissionPct: z.number().min(0.5).max(90),
      wedjatSharePct: z.number().min(1).max(100),
    })
    .optional(),
  platform: z
    .object({ displayName: z.string().trim().min(2).max(60) })
    .optional(),
});

async function upsertSetting(key: string, value: unknown, updatedBy: string) {
  const json = JSON.stringify(value);
  await db.platformSetting.upsert({
    where: { key },
    update: { value: json, updatedBy },
    create: { key, value: json, updatedBy },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;
    const admin = guard.emp;

    if (data.rsm) {
      await upsertSetting(SETTING_KEYS.rsm, data.rsm, admin.name);
      invalidateSettingsCache(SETTING_KEYS.rsm);
    }
    if (data.platform) {
      await upsertSetting(SETTING_KEYS.info, data.platform, admin.name);
      invalidateSettingsCache(SETTING_KEYS.info);
    }

    const [rsm, platform] = await Promise.all([getRsmConfig(), getPlatformInfo()]);
    return NextResponse.json({ ok: true, rsm, platform });
  } catch (err) {
    console.error("platform settings put error", err);
    return NextResponse.json(
      { ok: false, error: "Could not save settings" },
      { status: 500 }
    );
  }
}
