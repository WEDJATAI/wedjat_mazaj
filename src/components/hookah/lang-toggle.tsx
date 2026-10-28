"use client";

import { useI18n } from "@/store/i18n";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

export function LangToggle({ className }: { className?: string }) {
  const { lang, toggle } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/60",
        className
      )}
      aria-label="Toggle language"
    >
      <Languages className="size-3.5 text-primary" />
      {lang === "en" ? "العربية" : "English"}
    </button>
  );
}
