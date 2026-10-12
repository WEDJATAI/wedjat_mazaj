/**
 * r69 (audit ②) — localized "time ago" for the staff panels.
 *
 * Shares the justNow / mAgo / hAgo dictionary keys the guest tracking
 * surface already uses, so orders-panel and requests-panel no longer
 * hardcode English ("5m ago").
 */
type TFn = (
  key: "justNow" | "mAgo" | "hAgo"
) => string;

export function timeAgo(iso: string, t: TFn): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("justNow");
  if (min < 60) return `${min}${t("mAgo")}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}${t("hAgo")}`;
  return new Date(iso).toLocaleDateString();
}
