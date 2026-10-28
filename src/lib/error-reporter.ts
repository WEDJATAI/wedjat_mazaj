/**
 * r69 (audit ⑧) — client-side error reporter.
 *
 * Hooks window.onerror + unhandledrejection and ships a compact report to
 * POST /api/errors (deduped + counted server-side). Guardrails so the
 * reporter can never hurt the app it watches:
 *   - max 5 reports per page session
 *   - identical messages reported once per session
 *   - fire-and-forget with keepalive; failures are swallowed
 *   - never installed twice, never in SSR
 */

const MAX_REPORTS_PER_SESSION = 5;
const reported = new Set<string>();

function report(message: string, stack?: string) {
  if (typeof window === "undefined") return;
  if (reported.size >= MAX_REPORTS_PER_SESSION) return;
  const key = message.slice(0, 200);
  if (reported.has(key)) return;
  reported.add(key);

  try {
    const body = JSON.stringify({
      message: message.slice(0, 1000),
      stack: stack?.slice(0, 4000) ?? null,
      url: window.location.href.slice(0, 500),
      userAgent: navigator.userAgent.slice(0, 300),
    });
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* the logger must never break the app */
    });
  } catch {
    /* ignore */
  }
}

let installed = false;

/** Install once per app mount (idempotent). */
export function installErrorReporter(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (ev) => {
    const msg = ev.message || "Uncaught error";
    report(msg, ev.error?.stack);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg =
      reason instanceof Error
        ? `Unhandled rejection: ${reason.message}`
        : `Unhandled rejection: ${String(reason).slice(0, 200)}`;
    report(msg, reason instanceof Error ? reason.stack : undefined);
  });
}
