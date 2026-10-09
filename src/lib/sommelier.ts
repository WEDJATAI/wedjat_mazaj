// AI Sommelier — deterministic recommendation engine.
// Powers two things:
//  1. The "quick add" picks rendered under every chat reply (always reliable).
//  2. The full fallback when the LLM is unavailable (the feature never breaks).
// Bilingual: intent keywords cover English + Egyptian Arabic.

import {
  BRANDS,
  BOWL_PRESETS,
  BRAND_NOTES,
  getBrand,
  flavorTags,
  mixPrice,
} from "./catalog";

export type SommLang = "en" | "ar";

export interface SommPick {
  kind: "single" | "mix" | "preset";
  /** primary brand id (single/mix) or preset id */
  id: string;
  brandIds: string[];
  flavorNames: string[];
  /** display label, e.g. "Nakhla Double Apple" */
  label: string;
  price: number;
  why: string;
}

interface ScoredCandidate {
  brandId: string;
  brandName: string;
  flavorName: string;
  score: number;
  reasons: string[];
}

// ─── Intent detection ────────────────────────────────────────────────────────

interface Intent {
  tags: Set<string>;
  budget: "any" | "premium" | "value";
  surprise: boolean;
}

const KEYWORD_TAGS: Record<string, string[]> = {
  // English
  sweet: ["sweet"],
  sugary: ["sweet"],
  candy: ["sweet"],
  strong: ["strong"],
  heavy: ["strong"],
  buzz: ["strong"],
  nicotine: ["strong"],
  classic: ["classic"],
  traditional: ["classic", "traditional"],
  original: ["classic"],
  mint: ["minty"],
  minty: ["minty"],
  menthol: ["minty"],
  icy: ["minty", "icy"],
  cold: ["minty", "icy"],
  fresh: ["fresh", "icy"],
  refreshing: ["fresh", "refreshing"],
  light: ["light"],
  mild: ["light", "mild"],
  smooth: ["light", "mild"],
  fruity: ["fruity"],
  fruit: ["fruity"],
  berry: ["berry"],
  berries: ["berry"],
  blueberry: ["berry", "fruity", "sweet"],
  watermelon: ["fruity", "refreshing", "summer"],
  grape: ["fruity", "sweet"],
  peach: ["fruity", "sweet"],
  apple: ["classic", "sweet"],
  rose: ["floral"],
  floral: ["floral"],
  flower: ["floral"],
  lemon: ["citrus", "fresh"],
  citrus: ["citrus"],
  tangy: ["citrus", "tangy"],
  cinnamon: ["spicy"],
  spicy: ["spicy"],
  warm: ["spicy", "warm"],
  summer: ["summer"],
  tropical: ["tropical"],
  guava: ["tropical", "fruity"],
  premium: ["premium"],
  best: ["premium"],
  luxury: ["premium"],
  fancy: ["premium"],
  cheap: ["value"],
  budget: ["value"],
  value: ["value"],
  affordable: ["value"],
  everyday: ["value"],
  simple: ["value", "classic"],
  // Egyptian Arabic
  حلو: ["sweet"],
  حلوة: ["sweet"],
  سكر: ["sweet"],
  قوي: ["strong"],
  قوية: ["strong"],
  تقيل: ["strong"],
  نعناع: ["minty"],
  نعنع: ["minty"],
  بارد: ["minty", "icy"],
  منعش: ["fresh", "refreshing"],
  منعشة: ["fresh", "refreshing"],
  خفيف: ["light", "mild"],
  خفيفة: ["light", "mild"],
  فواكه: ["fruity"],
  فاكهة: ["fruity"],
  توت: ["berry", "fruity"],
  بطيخ: ["fruity", "refreshing", "summer"],
  عنب: ["fruity", "sweet"],
  خوخ: ["fruity", "sweet"],
  تفاح: ["classic", "sweet"],
  ورد: ["floral"],
  زهر: ["floral"],
  ليمون: ["citrus", "fresh"],
  قرفة: ["spicy"],
  حار: ["spicy"],
  صيف: ["summer"],
  استوائي: ["tropical"],
  جوافة: ["tropical", "fruity"],
  بريميوم: ["premium"],
  فخم: ["premium"],
  احسن: ["premium"],
  رخيص: ["value"],
  اقتصادي: ["value"],
  سعر: ["value"],
};

const SURPRISE_WORDS = [
  "surprise",
  "random",
  "anything",
  "whatever",
  "chef",
  "recommend",
  "مفاجأة",
  "اي حاجة",
  "أي حاجة",
  "اختر",
  "اختار",
  "رشح",
];

export function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  const tags = new Set<string>();
  let budget: Intent["budget"] = "any";
  let surprise = false;

  for (const [kw, kwTags] of Object.entries(KEYWORD_TAGS)) {
    if (t.includes(kw.toLowerCase())) {
      for (const tag of kwTags) tags.add(tag);
    }
  }
  if (tags.has("premium")) budget = "premium";
  if (tags.has("value")) budget = "value";
  if (SURPRISE_WORDS.some((w) => t.includes(w))) surprise = true;

  return { tags, budget, surprise };
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

const POPULAR = new Set(["Double Apple", "Mint", "Grape", "Blueberry", "Watermelon"]);

function scoreCandidates(intent: Intent, query: string): ScoredCandidate[] {
  const t = query.toLowerCase();
  const out: ScoredCandidate[] = [];

  for (const brand of BRANDS) {
    const isPremium = brand.category === "premium";
    const isValue = brand.category === "special";
    for (const flavor of brand.flavors) {
      if (flavor === "Standard") continue;
      let score = 0;
      const reasons: string[] = [];
      const tags = flavorTags(flavor);

      // direct flavor mention (English name inside the query)
      if (t.includes(flavor.toLowerCase())) {
        score += 6;
        reasons.push("match");
      }
      // brand mention
      if (t.includes(brand.name.toLowerCase())) {
        score += 3;
      }
      // tag overlap with intent
      for (const tag of intent.tags) {
        if (tags.includes(tag)) {
          score += 2;
          reasons.push(tag);
        }
      }
      // budget fit
      if (intent.budget === "premium" && isPremium) {
        score += 4;
        reasons.push("premium");
      }
      if (intent.budget === "value" && isValue) {
        score += 4;
        reasons.push("value");
      }
      if (intent.budget === "premium" && isValue) score -= 3;
      if (intent.budget === "value" && isPremium) score -= 3;
      // popularity nudge
      if (POPULAR.has(flavor)) score += 1;
      // strong-classic loves Nakhla / Dandash
      if (intent.tags.has("strong") && (brand.id === "nakhla" || brand.id === "dandash")) {
        score += 1.5;
      }

      if (score > 0) {
        out.push({
          brandId: brand.id,
          brandName: brand.name,
          flavorName: flavor,
          score,
          reasons: [...new Set(reasons)],
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// ─── Recommendation ──────────────────────────────────────────────────────────

function flavorPrice(brandId: string): number {
  const b = getBrand(brandId);
  if (!b) return 0;
  if (b.category === "special") return b.pricing.flat ?? 45;
  return b.pricing.fruits ?? 125;
}

function reasonText(reasons: string[], lang: SommLang): string {
  const map: Record<string, [string, string]> = {
    match: ["exactly what you asked for", "بالظبط اللي طلبته"],
    sweet: ["sweet", "حلوة"],
    minty: ["minty & cooling", "نعناع ومنعشة"],
    icy: ["icy", "باردة"],
    fresh: ["fresh", "منعشة"],
    refreshing: ["refreshing", "منعشة"],
    light: ["light & smooth", "خفيفة وسلسة"],
    mild: ["easy-going", "هادية"],
    fruity: ["fruity", "فواكه"],
    berry: ["berry-rich", "توت"],
    summer: ["perfect for summer", "مثالية للصيف"],
    tropical: ["tropical", "استوائية"],
    classic: ["a timeless classic", "كلاسيكية"],
    traditional: ["traditional", "تقليدية"],
    strong: ["strong and satisfying", "قوية ومرضية"],
    floral: ["floral & elegant", "وردية وأنيقة"],
    citrus: ["citrusy", "حامضة منعشة"],
    tangy: ["tangy", "حامضة"],
    spicy: ["warm & spicy", "دافئة وحارة"],
    premium: ["the premium line", "الخط البريميوم"],
    value: ["great value", "سعرها ممتاز"],
    match2: ["", ""],
  };
  const parts = reasons
    .slice(0, 2)
    .map((r) => map[r]?.[lang === "ar" ? 1 : 0])
    .filter(Boolean);
  return parts.join(lang === "ar" ? "، " : ", ");
}

export function recommend(
  query: string,
  lang: SommLang = "en"
): { reply: string; picks: SommPick[] } {
  const intent = detectIntent(query);

  // "Surprise me" → weighted house favourites (deterministic per day so it
  // feels curated, not random noise).
  if (intent.surprise && intent.tags.size === 0) {
    const dayIdx = Math.floor(Date.now() / 86400000) % BOWL_PRESETS.length;
    const preset = BOWL_PRESETS[dayIdx];
    const price = presetPrice(preset.id);
    const reply =
      lang === "ar"
        ? `خدها منّي 😄 ترشيح اليوم: ${preset.name} ${preset.emoji} — ${presetFlavors(preset.id)} بسعر ${price} ج.م. لو حابب حاجة تانية قول لي مزاجك!`
        : `Let me pick for you 😄 Today's house pick: ${preset.name} ${preset.emoji} — ${presetFlavors(preset.id)} for ${price} EGP. Tell me your mood if you'd like something different!`;
    return {
      reply,
      picks: [presetToPick(preset.id, lang)],
    };
  }

  const ranked = scoreCandidates(intent, query);

  if (ranked.length === 0) {
    // no signal — offer the house special
    const reply =
      lang === "ar"
        ? "قول لي مزاجك وأرشحلك على طول: حلو؟ نعناع؟ قوي؟ ولا حاجة بريميوم؟ 🌿"
        : "Tell me your mood and I'll match it instantly: sweet, minty, strong — or something premium? 🌿";
    return { reply, picks: [presetToPick("blue-mint-bliss", lang)] };
  }

  const top = ranked[0];
  const second = ranked.find(
    (c) =>
      (c.brandId !== top.brandId || c.flavorName !== top.flavorName) &&
      c.flavorName !== top.flavorName && // never suggest the same flavor twice
      c.flavorName !== "Standard"
  );

  const picks: SommPick[] = [];

  // Single top pick
  picks.push({
    kind: "single",
    id: top.brandId,
    brandIds: [top.brandId],
    flavorNames: [top.flavorName],
    label: `${top.brandName} ${top.flavorName}`,
    price: flavorPrice(top.brandId),
    why: reasonText(top.reasons, lang),
  });

  // Mix suggestion when the runner-up complements the top pick
  if (second && second.score >= Math.max(3, top.score * 0.5)) {
    const bothMixable = top.brandId !== "salom" && top.brandId !== "kass";
    if (bothMixable) {
      const ids = [top.brandId, second.brandId];
      picks.push({
        kind: "mix",
        id: `mix:${top.brandId}:${top.flavorName}+${second.brandId}:${second.flavorName}`,
        brandIds: ids,
        flavorNames: [top.flavorName, second.flavorName],
        label: `${top.flavorName} + ${second.flavorName}`,
        price: mixPrice(ids),
        why:
          lang === "ar"
            ? "مكس بينهم — ١٠ جرام من كل نكهة"
            : "mix them — 10g of each in one bowl",
      });
    }
  }

  const topWhy = top.reasons.length > 0 ? reasonText(top.reasons, lang) : "";
  const reply =
    lang === "ar"
      ? `لِمزاجك ده، أنا رشحلك ${top.brandName} ${top.flavorName} 🌿${
          topWhy ? ` — ${topWhy}` : ""
        } بـ ${flavorPrice(top.brandId)} ج.م. ضيفها من تحت على طول ✨`
      : `For that mood I'd go with ${top.brandName} ${top.flavorName} 🌿${
          topWhy ? ` — ${topWhy}` : ""
        } at ${flavorPrice(top.brandId)} EGP. Add it straight from below ✨`;

  return { reply, picks };
}

// ─── Preset helpers ──────────────────────────────────────────────────────────

function findPreset(id: string) {
  return BOWL_PRESETS.find((p) => p.id === id) ?? BOWL_PRESETS[0];
}

function presetPrice(id: string): number {
  const p = findPreset(id);
  if (p.components.length > 1) {
    return mixPrice(p.components.map((c) => c.brandId));
  }
  return flavorPrice(p.components[0].brandId);
}

function presetFlavors(id: string): string {
  const p = findPreset(id);
  return p.components.map((c) => c.flavorName).join(" + ");
}

export function presetToPick(id: string, lang: SommLang): SommPick {
  const p = findPreset(id);
  return {
    kind: "preset",
    id: p.id,
    brandIds: p.components.map((c) => c.brandId),
    flavorNames: p.components.map((c) => c.flavorName),
    label: p.name,
    price: presetPrice(p.id),
    why: p.tag,
  };
}

/** Compact catalog summary for the LLM system prompt. */
export function catalogSummary(): string {
  const lines = BRANDS.map((b) => {
    const price =
      b.category === "special"
        ? `${b.pricing.flat} EGP flat`
        : `${b.pricing.fruits} EGP fruits / ${b.pricing.fruitsMix} EGP mix`;
    const notes = BRAND_NOTES[b.id] ?? "";
    return `- ${b.name} (${price}): ${b.flavors.join(", ")}. ${notes}`;
  });
  const presets = BOWL_PRESETS.map(
    (p) =>
      `- ${p.name} (${presetPrice(p.id)} EGP): ${p.components
        .map((c) => `${c.flavorName} (${getBrand(c.brandId)?.name})`)
        .join(" + ")}`
  );
  return `BRANDS:\n${lines.join("\n")}\n\nHOUSE PRESETS:\n${presets.join("\n")}\n\nRULES: every hookah is 20g. A mix bowl splits 20g across chosen flavors and costs the highest mix price of the involved brands (Amy 180 wins, otherwise 145). Salom/Kass are flat 45 EGP.`;
}
