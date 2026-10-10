// ─────────────────────────────────────────────────────────────────────────────
// WEDJAT RSM — Revenue Share Management (r59).
//
// Business model: WEDJAT Mazaj operates the shisha corner inside partner
// cafés/restaurants — the venue rents the corner to the shisha operation.
//
// Revenue-share rules (owner-defined):
//   1. A 12% commission applies to SHISHA sales only. It is tracked
//      completely APART from the café/restaurant's own orders (food &
//      beverages) — those carry no shisha commission.
//   2. WEDJAT owns 40% of the shisha operation, so 40% of the 12%
//      commission is WEDJAT's gross profit. The remaining 60% belongs to
//      the partner and is reported separately.
//   3. Tax & VAT on the corner's sales are paid by the VENUE (the rented
//      shisha corner place), NOT by WEDJAT. The gross profit below is
//      therefore computed BEFORE tax/VAT, with zero tax deduction on the
//      WEDJAT side.
//
//   Effective take: 12% × 40% = 4.8% of shisha revenue.
// ─────────────────────────────────────────────────────────────────────────────

/** Commission percentage charged on shisha sales (applies to shisha only). */
export const SHISHA_COMMISSION_PCT = 12;

/** WEDJAT's ownership share of the shisha operation (and of the commission). */
export const WEDJAT_SHARE_PCT = 40;

/** The partner's share of the commission (100 − 40). */
export const PARTNER_SHARE_PCT = 100 - WEDJAT_SHARE_PCT;

/** 12 × 40 / 100 = 4.8 — WEDJAT's effective take of shisha revenue. */
export const WEDJAT_EFFECTIVE_PCT =
  Math.round(((SHISHA_COMMISSION_PCT * WEDJAT_SHARE_PCT) / 100) * 10) / 10;

export interface RsmGrossProfit {
  /** shisha revenue the commission is computed on (EGP) */
  shishaRevenue: number;
  /** shishaRevenue × 12% — the full commission on shisha */
  commission: number;
  /** commission × 40% — WEDJAT's gross profit (pre-tax; venue pays tax/VAT) */
  wedjatGross: number;
  /** commission × 60% — the partner's share */
  partnerShare: number;
  /** effective take as % of shisha revenue (4.8) */
  effectivePct: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The single source of truth for the WEDJAT RSM gross-profit calculation.
 * Pure — safe on server and client.
 */
export function computeRsmGrossProfit(shishaRevenue: number): RsmGrossProfit {
  const revenue = Math.max(0, r2(shishaRevenue));
  const commission = r2(revenue * (SHISHA_COMMISSION_PCT / 100));
  const wedjatGross = r2(commission * (WEDJAT_SHARE_PCT / 100));
  const partnerShare = r2(commission - wedjatGross);
  return {
    shishaRevenue: revenue,
    commission,
    wedjatGross,
    partnerShare,
    effectivePct: WEDJAT_EFFECTIVE_PCT,
  };
}
