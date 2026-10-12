/**
 * r69 (audit ⑤) — atomic stock guard for order placement & amend.
 *
 * The r68 audit found both /api/orders (POST) and /api/orders/[id]/amend
 * validated stock OUTSIDE their write transaction: two concurrent orders
 * could both pass validation against the same jar and both deduct it —
 * an oversell race. The fix has two layers, both inside the transaction:
 *
 *   1. re-read + validate (fast, friendly message with need/have numbers)
 *   2. CONDITIONAL decrements (`updateMany` with a `gte` guard) — an
 *      atomic compare-and-decrement at the row level. If a concurrent
 *      transaction drained the jar between read and write, the update
 *      matches zero rows and we abort with StockShortError (the whole
 *      transaction rolls back — no partial order, no negative stock).
 *
 * StockShortError carries the same 409 payload shape the routes always
 * returned, so clients and tests see identical errors.
 */

export class StockShortError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "StockShortError";
  }
}

/** Format a shortage line exactly like the pre-r69 409s. */
export function shortLine(name: string, need: number, have: number): string {
  return `${name} (need ${Math.round(need)}g, have ${Math.round(have)}g)`;
}
