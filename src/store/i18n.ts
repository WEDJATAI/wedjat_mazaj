"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translations, type Lang, type Translations } from "@/lib/i18n";

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: keyof Translations) => string;
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
      toggle: () => set((s) => ({ lang: s.lang === "en" ? "ar" : "en" })),
      t: (key) => {
        const { lang } = get();
        return translations[lang]?.[key] ?? (translations.en?.[key] ?? (key as string));
      },
    }),
    { name: "mazaj-lang" }
  )
);
