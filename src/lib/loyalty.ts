// R49 — Loyalty & rewards program rules (shared client + server).
//
// EARN: 1 point per 1 EGP of the final total (after discounts), multiplied
//       by the member's tier multiplier, rounded down.
// TIERS (by LIFETIME points — never decrease):
//   bronze   0      ×1.00
//   silver   300    ×1.10
//   gold     1000   ×1.25
//   platinum 2500   ×1.50
// REDEEM: 100 pts = 25 EGP off, in 100-pt multiples. Server-validated:
//   never more than the member's balance, and never more than the order
//   total (the total can reach 0 but not go negative).
// SIGNUP: new members get a 50-point welcome bonus.

export type Tier = "bronze" | "silver" | "gold" | "platinum";

export interface TierDef {
  key: Tier;
  label: string;
  emoji: string;
  /** lifetime points required */
  min: number;
  /** points multiplier on earn */
  multiplier: number;
  /** tailwind classes for the tier badge */
  cls: string;
}

export const TIERS: TierDef[] = [
  {
    key: "bronze",
    label: "Bronze",
    emoji: "🥉",
    min: 0,
    multiplier: 1,
    cls: "border border-amber-700/40 bg-amber-700/15 text-amber-600",
  },
  {
    key: "silver",
    label: "Silver",
    emoji: "🥈",
    min: 300,
    multiplier: 1.1,
    cls: "border border-slate-400/40 bg-slate-400/15 text-slate-300",
  },
  {
    key: "gold",
    label: "Gold",
    emoji: "🥇",
    min: 1000,
    multiplier: 1.25,
    cls: "border border-yellow-500/40 bg-yellow-500/15 text-yellow-500",
  },
  {
    key: "platinum",
    label: "Platinum",
    emoji: "💎",
    min: 2500,
    multiplier: 1.5,
    cls: "border border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  },
];

export const SIGNUP_BONUS = 50;
export const REDEEM_BLOCK = 100; // points per redemption step
export const REDEEM_BLOCK_EGP = 25; // EGP value of one redemption step

export function tierForLifetime(lifetimePoints: number): TierDef {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (lifetimePoints >= t.min) tier = t;
  }
  return tier;
}

export function tierDef(tier: string): TierDef {
  return TIERS.find((t) => t.key === tier) ?? TIERS[0];
}

export function multiplierFor(tier: string): number {
  return tierDef(tier).multiplier;
}

/** Points earned on an order: floor(total × tier multiplier). */
export function pointsEarnedOn(totalEgp: number, tier: string): number {
  if (totalEgp <= 0) return 0;
  return Math.floor(totalEgp * multiplierFor(tier));
}

/** EGP discount for a number of redeemed points (blocks of 100 → 25 EGP). */
export function redeemDiscount(points: number): number {
  const blocks = Math.floor(points / REDEEM_BLOCK);
  return blocks * REDEEM_BLOCK_EGP;
}

/** Max redeemable points for a given balance and order total (multiple of 100). */
export function maxRedeemable(balance: number, totalEgp: number): number {
  const byBalance = Math.floor(balance / REDEEM_BLOCK) * REDEEM_BLOCK;
  const byTotal =
    Math.floor(totalEgp / REDEEM_BLOCK_EGP) * REDEEM_BLOCK;
  return Math.max(0, Math.min(byBalance, byTotal));
}

/** Redemption step options for the checkout chips (e.g. 100/200/300). */
export function redeemOptions(
  balance: number,
  totalEgp: number,
  maxOptions = 4
): number[] {
  const max = maxRedeemable(balance, totalEgp);
  const opts: number[] = [];
  for (let p = REDEEM_BLOCK; p <= max && opts.length < maxOptions; p += REDEEM_BLOCK) {
    opts.push(p);
  }
  return opts;
}

/** Progress to the next tier (for member cards). */
export function nextTierProgress(
  lifetimePoints: number
): { next: TierDef | null; pct: number; remaining: number } {
  const current = tierForLifetime(lifetimePoints);
  const next = TIERS.find((t) => t.min > lifetimePoints) ?? null;
  if (!next) return { next: null, pct: 100, remaining: 0 };
  const span = next.min - current.min;
  const pct = Math.min(
    100,
    Math.round(((lifetimePoints - current.min) / span) * 100)
  );
  return { next, pct, remaining: next.min - lifetimePoints };
}
