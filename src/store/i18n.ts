"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translations, type Lang, type Translations } from "@/lib/i18n";

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** r61: optional {placeholder} interpolation for parameterized strings */
  t: (key: keyof Translations, params?: Record<string, string | number>) => string;
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
      toggle: () => set((s) => ({ lang: s.lang === "en" ? "ar" : "en" })),
      t: (key, params) => {
        const { lang } = get();
        let s =
          translations[lang]?.[key] ??
          (translations.en?.[key] ?? (key as string));
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            s = s.split(`{${k}}`).join(String(v));
          }
        }
        return s;
      },
    }),
    { name: "mazaj-lang" }
  )
);
