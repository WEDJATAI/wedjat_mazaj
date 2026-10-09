import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  lang: z.enum(["en", "ar"]).default("en"),
});

interface BriefFacts {
  todayRevenue: number;
  todayOrders: number;
  todayHookahs: number;
  todayProfit: number;
  weekRevenue: number;
  weekOrders: number;
  prevWeekRevenue: number;
  topBrand: { name: string; revenue: number } | null;
  pendingCount: number;
  lowFlavors: string[];
  lowSupplies: string[];
  avgRating: number | null;
  ratedCount: number;
  loyaltyMembers: number;
  newMembers7d: number;
}

async function gatherFacts(): Promise<BriefFacts> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [orders, lowFlavorRows, lowSupplyRows, loyaltyMembers, newMembers7d] =
    await Promise.all([
      db.order.findMany({
        where: { createdAt: { gte: twoWeeksAgo } },
        select: {
          total: true,
          netProfit: true,
          itemCount: true,
          rating: true,
          createdAt: true,
          status: true,
          itemsJson: true,
        },
      }),
      db.flavorStock.findMany({
        where: { stockGrams: { lte: 60 } },
        select: { brandName: true, flavorName: true, stockGrams: true },
      }),
      db.supplyItem.findMany({
        where: { stock: { lte: 20 } },
        select: { name: true, stock: true, unit: true },
      }),
      db.loyaltyMember.count(),
      db.loyaltyMember.count({
        where: { createdAt: { gte: weekAgo } },
      }),
    ]);

  const todayOrders = orders.filter(
    (o) => o.createdAt.getTime() >= startOfToday.getTime()
  );
  const week = orders.filter((o) => o.createdAt.getTime() >= weekAgo.getTime());
  const prevWeek = orders.filter((o) => o.createdAt.getTime() < weekAgo.getTime());

  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const weekRevenue = week.reduce((s, o) => s + o.total, 0);
  const prevWeekRevenue = prevWeek.reduce((s, o) => s + o.total, 0);

  // top brand this week from itemsJson
  const brandRev = new Map<string, number>();
  for (const o of week) {
    try {
      const items = JSON.parse(o.itemsJson as string) as {
        primaryBrandName: string;
        unitPrice: number;
        qty: number;
      }[];
      for (const it of items) {
        brandRev.set(
          it.primaryBrandName,
          (brandRev.get(it.primaryBrandName) ?? 0) + it.unitPrice * it.qty
        );
      }
    } catch {
      // ignore
    }
  }
  let topBrand: { name: string; revenue: number } | null = null;
  for (const [name, revenue] of brandRev) {
    if (!topBrand || revenue > topBrand.revenue) topBrand = { name, revenue };
  }

  const rated = week.filter((o) => o.rating != null);
  const avgRating =
    rated.length > 0
      ? Math.round(
          (rated.reduce((s, o) => s + (o.rating ?? 0), 0) / rated.length) * 10
        ) / 10
      : null;

  return {
    todayRevenue,
    todayOrders: todayOrders.length,
    todayHookahs: todayOrders.reduce((s, o) => s + o.itemCount, 0),
    todayProfit: todayOrders.reduce((s, o) => s + o.netProfit, 0),
    weekRevenue,
    weekOrders: week.length,
    prevWeekRevenue,
    topBrand,
    pendingCount: orders.filter((o) => o.status === "pending").length,
    lowFlavors: lowFlavorRows
      .slice(0, 6)
      .map((f) => `${f.brandName} ${f.flavorName} (${Math.round(f.stockGrams)}g)`),
    lowSupplies: lowSupplyRows
      .slice(0, 4)
      .map((s) => `${s.name} (${Math.round(s.stock)} ${s.unit})`),
    avgRating,
    ratedCount: rated.length,
    loyaltyMembers,
    newMembers7d,
  };
}

function deterministicBrief(f: BriefFacts, lang: "en" | "ar"): string {
  const delta =
    f.prevWeekRevenue > 0
      ? Math.round(((f.weekRevenue - f.prevWeekRevenue) / f.prevWeekRevenue) * 100)
      : null;
  if (lang === "ar") {
    const lines = [
      `📊 مبيعات اليوم: ${Math.round(f.todayRevenue)} ج.م من ${f.todayOrders} طلب (${f.todayHookahs} جبلة، ربح ${Math.round(f.todayProfit)} ج.م).`,
      f.topBrand
        ? `👑 أكثر علامة مبيعاً هذا الأسبوع: ${f.topBrand.name} بـ ${Math.round(f.topBrand.revenue)} ج.م.`
        : "👑 لسه مفيش مبيعات كفاية هذا الأسبوع لتحديد العلامة الأولى.",
      delta != null
        ? `${delta >= 0 ? "📈 الإيراد الأسبوعي أعلى بـ" : "📉 الإيراد الأسبوعي أقل بـ"} ${Math.abs(delta)}% عن الأسبوع الماضي.`
        : "📈 أول أسبوع ببيانات — هنتقدّر نقارن الأسبوع الجاي.",
      f.pendingCount > 0
        ? `⏳ ${f.pendingCount} طلب مستني في الطابور دلوقتي.`
        : "✅ الطابور نضيف — مفيش طلبات مستنية.",
    ];
    if (f.lowFlavors.length > 0) {
      lines.push(`⚠️ نكهات قاربت تخلص: ${f.lowFlavors.join("، ")}.`);
    }
    if (f.lowSupplies.length > 0) {
      lines.push(`⚠️ مستلزمات واطية: ${f.lowSupplies.join("، ")}.`);
    }
    if (f.avgRating != null) {
      lines.push(
        `⭐ متوسط التقييم هذا الأسبوع: ${f.avgRating}/5 من ${f.ratedCount} تقييم.`
      );
    }
    if (f.loyaltyMembers > 0) {
      lines.push(
        `💜 مزاج+: ${f.loyaltyMembers} عضو (${f.newMembers7d} جديد هذا الأسبوع).`
      );
    }
    return lines.join("\n");
  }
  const lines = [
    `📊 Today: ${Math.round(f.todayRevenue)} EGP from ${f.todayOrders} orders (${f.todayHookahs} hookahs, ${Math.round(f.todayProfit)} EGP profit).`,
    f.topBrand
      ? `👑 Top brand this week: ${f.topBrand.name} at ${Math.round(f.topBrand.revenue)} EGP.`
      : "👑 Not enough sales yet this week to crown a top brand.",
    delta != null
      ? `${delta >= 0 ? "📈 Weekly revenue is up" : "📉 Weekly revenue is down"} ${Math.abs(delta)}% vs last week.`
      : "📈 First week with data — comparison starts next week.",
    f.pendingCount > 0
      ? `⏳ ${f.pendingCount} order(s) waiting in the queue right now.`
      : "✅ Queue is clear — no pending orders.",
  ];
  if (f.lowFlavors.length > 0) {
    lines.push(`⚠️ Flavors running low: ${f.lowFlavors.join(", ")}.`);
  }
  if (f.lowSupplies.length > 0) {
    lines.push(`⚠️ Supplies low: ${f.lowSupplies.join(", ")}.`);
  }
  if (f.avgRating != null) {
    lines.push(
      `⭐ Average rating this week: ${f.avgRating}/5 from ${f.ratedCount} reviews.`
    );
  }
  if (f.loyaltyMembers > 0) {
    lines.push(
      `💜 Mazaj+ loyalty: ${f.loyaltyMembers} members (${f.newMembers7d} new this week).`
    );
  }
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    const lang = parsed.success ? parsed.data.lang : "en";

    const facts = await gatherFacts();

    try {
      const { default: ZAI } = await import("z-ai-web-dev-sdk");
      const zai = await ZAI.create();

      const systemPrompt = [
        lang === "ar"
          ? "أنت مستشار أعمال صالة شيشة. اكتب ملخصاً تنفيذياً بالعربية المصرية للمالك: ٥ إلى ٧ نقاط قصيرة، كل نقطة سطر واحد بإيموجي، وتنتهي بتوصية عملية واحدة. كل المبالغ بالجنيه المصري (ج.م) — ممنوع استخدام الدولار أبداً."
          : "You are a hookah lounge business consultant. Write an executive brief in English for the owner: 5-7 short bullet lines (emoji per line, one line each) and end with ONE actionable recommendation. All amounts MUST be in EGP (Egyptian pounds) — never use $ or USD.",
        "Use ONLY these verified facts — never invent numbers:",
        JSON.stringify(facts, null, 2),
        lang === "ar"
          ? "لو الأرقام صفر، قول كده بصراحة واقترح حاجة تحسّن اليوم."
          : "If numbers are zero, say so plainly and suggest one way to improve the day.",
      ].join("\n\n");

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: lang === "ar" ? "اعمل الملخص" : "Write the brief" },
        ],
        thinking: { type: "disabled" },
      });
      const brief = completion.choices[0]?.message?.content?.trim();
      if (brief) {
        return NextResponse.json({ ok: true, brief, source: "ai" });
      }
      throw new Error("empty completion");
    } catch {
      return NextResponse.json({
        ok: true,
        brief: deterministicBrief(facts, lang),
        source: "engine",
      });
    }
  } catch (err) {
    console.error("brief error", err);
    return NextResponse.json(
      { ok: false, error: "Could not build the brief" },
      { status: 500 }
    );
  }
}
