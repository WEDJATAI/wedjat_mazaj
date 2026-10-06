"use client";

import { useEffect } from "react";
import { useI18n } from "@/store/i18n";

/** Sets the document `dir` and `lang` attributes based on the selected language. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useI18n((s) => s.lang);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  return <>{children}</>;
}
