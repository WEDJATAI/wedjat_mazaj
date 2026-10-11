import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { catalogSummary, recommend, SommLang } from "@/lib/sommelier";

export const runtime = "nodejs";
export const maxDuration = 30;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(600),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(12),
  lang: z.enum(["en", "ar"]).default("en"),
  guestName: z.string().trim().max(80).optional(),
});

// Simple in-memory rate limit: 20 requests / minute / IP.
const RATE_LIMIT = 20;
const rateMap = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// Periodic sweep so the map never grows unbounded.
if (typeof globalThis !== "undefined") {
  const g = globalThis as { __sommelierSweep?: ReturnType<typeof setInterval> };
  if (!g.__sommelierSweep) {
    g.__sommelierSweep = setInterval(() => {
      const now = Date.now();
      for (const [ip, e] of rateMap) {
        if (now > e.reset) rateMap.delete(ip);
      }
    }, 120_000);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "local";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many requests — take a breath 🌿" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request" },
        { status: 400 }
      );
    }
    const { messages, lang, guestName } = parsed.data;

    // Reliable quick-add picks are ALWAYS computed locally from the last
    // user message (the LLM never gates the add-to-cart action).
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const local = lastUser
      ? recommend(lastUser.content, lang as SommLang)
      : { reply: "", picks: [] };

    // Personal context: recent orders + saved favorites (read-only).
    let context = "";
    if (guestName) {
      try {
        const [recentOrders, favs] = await Promise.all([
          db.order.findMany({
            where: { customerName: { equals: guestName } },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { itemsJson: true, createdAt: true },
          }),
          db.favoriteMix.findMany({
            where: { guestName: { equals: guestName } },
            orderBy: { createdAt: "desc" },
            take: 2,
            select: { label: true },
          }),
        ]);
        const ordered: string[] = [];
        for (const o of recentOrders) {
          try {
            const items = JSON.parse(o.itemsJson) as {
              qty: number;
              primaryBrandName: string;
              flavorLabel: string;
            }[];
            for (const it of items) {
              ordered.push(`${it.qty}x ${it.primaryBrandName} ${it.flavorLabel}`);
            }
          } catch {
            // ignore malformed
          }
        }
        const bits: string[] = [];
        if (ordered.length > 0) {
          bits.push(`Guest "${guestName}" recently ordered: ${ordered.join(", ")}`);
        }
        if (favs.length > 0) {
          bits.push(`Saved favorites: ${favs.map((f) => f.label).join(", ")}`);
        }
        if (bits.length > 0) context = bits.join(". ");
      } catch {
        // context is optional — ignore DB hiccups
      }
    }

    // Try the LLM; fall back to the local engine on ANY failure so the
    // sommelier always answers (sandbox → production safe).
    try {
      const { default: ZAI } = await import("z-ai-web-dev-sdk");
      const zai = await ZAI.create();

      const systemPrompt = [
        lang === "ar"
          ? "أنت «صاحب الصالة» — سوميلييه شيشة مصري ودود في صالة مزاج. جاوب بالعربية المصرية بس."
          : "You are the house shisha sommelier at Mazaj Hookah Lounge — warm, concise, expert. Answer in English.",
        lang === "ar"
          ? "جاوب في ٦٠ كلمة كحد أقصى، بنبرة ودودة. رشّح من المنيو فقط بالأسعار بالجنيه المصري. منساش إن الجبلة = ٢٠ جرام والمكس بياخد أغلى سعر مكس."
          : "Keep every reply under 60 words, warm tone. ONLY recommend items from this menu with EGP prices. Every hookah is 20g; a mix bowl costs the highest mix price of its brands.",
        "MENU:\n" + catalogSummary(),
        context ? `GUEST CONTEXT: ${context}` : "",
        lang === "ar"
          ? "لو العميل مش محدد، اسأله عن مزاجه بكلمة واحدة."
          : "If the guest is vague, ask one short question about their mood.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          ...messages.slice(-8),
        ],
        thinking: { type: "disabled" },
      });
      const reply = completion.choices[0]?.message?.content?.trim();
      if (reply) {
        return NextResponse.json({ ok: true, reply, picks: local.picks, source: "ai" });
      }
      throw new Error("empty completion");
    } catch {
      // LLM unavailable → deterministic engine answer
      return NextResponse.json({
        ok: true,
        reply: local.reply,
        picks: local.picks,
        source: "engine",
      });
    }
  } catch (err) {
    console.error("sommelier error", err);
    return NextResponse.json(
      { ok: false, error: "Could not reach the sommelier" },
      { status: 500 }
    );
  }
}
