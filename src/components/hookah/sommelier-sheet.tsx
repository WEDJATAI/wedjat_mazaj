"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Trash2, Loader2, Wand2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { egp, getBrand, BOWL_PRESETS, MOLASSES_GRAMS } from "@/lib/catalog";
import type { SommPick } from "@/lib/sommelier";
import {
  useCart,
  FlavorComponent,
  priceForConfig,
  splitGrams,
} from "@/store/cart";
import { useI18n } from "@/store/i18n";
import { toast } from "sonner";
import { haptic } from "@/lib/delight";
import { EASE, GoldButton, SheetGrip } from "./kit/kit";
import { BrandStack } from "./brand-mark";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  picks?: SommPick[];
  source?: "ai" | "engine";
}

const STORAGE_KEY = "mazaj:sommelier-chat";
const MAX_MESSAGES = 24;

export function SommelierSheet({
  open,
  onOpenChange,
  guestName,
  mode = "guest",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** guest name for personalized recommendations (optional) */
  guestName?: string;
  /** guest: quick-add picks go to the cart · staff: advisory only (the
   *  employee builds the bowl in the Bowl Builder) */
  mode?: "guest" | "staff";
}) {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const addItem = useCart((s) => s.addItem);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Restore the conversation from sessionStorage (survives reloads during
  // the session, resets naturally on a new visit).
  React.useEffect(() => {
    if (!loaded) {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed.slice(-MAX_MESSAGES));
          }
        }
      } catch {
        // ignore
      }
      setLoaded(true);
    }
  }, [loaded]);

  const persist = (next: ChatMessage[]) => {
    setMessages(next);
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next.slice(-MAX_MESSAGES))
      );
    } catch {
      // storage full — ignore
    }
  };

  // Auto-scroll to the newest message.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;
    setInput("");
    haptic("light");

    const history = [...messages, { role: "user" as const, content }];
    // optimistic user bubble
    persist(history);
    setThinking(true);

    try {
      const res = await fetch("/api/ai/sommelier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content }))
            .slice(-10),
          lang,
          guestName: guestName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "failed");
      persist([
        ...history,
        {
          role: "assistant",
          content: data.reply as string,
          picks: (data.picks ?? []) as SommPick[],
          source: data.source as "ai" | "engine",
        },
      ]);
    } catch {
      toast.error(t("sommelierError"));
      persist([
        ...history,
        {
          role: "assistant",
          content: t("sommelierError"),
          source: "engine",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const clearChat = () => {
    persist([]);
    setInput("");
  };

  // ─── Cart add from a pick ────────────────────────────────────────────────
  const addPick = (pick: SommPick) => {
    let components: FlavorComponent[] = [];
    let flavor: "fruits" | "fruits-mix" | "flat" = "fruits";
    let flavorLabel = "Fruits";
    let primaryBrandId = pick.brandIds[0];
    let primaryBrand: ReturnType<typeof getBrand> = getBrand(primaryBrandId);

    if (pick.kind === "preset") {
      const preset = BOWL_PRESETS.find((p) => p.id === pick.id);
      if (!preset) return;
      components = preset.components.map((c) => {
        const b = getBrand(c.brandId)!;
        return {
          brandId: c.brandId,
          brandName: b.name,
          flavorName: c.flavorName,
          emoji: b.emoji,
          grams: MOLASSES_GRAMS,
        };
      });
      primaryBrandId = preset.components[0].brandId;
      primaryBrand = getBrand(primaryBrandId);
      if (preset.components.length > 1) {
        const grams = splitGrams(components.length);
        components = components.map((c, i) => ({ ...c, grams: grams[i] }));
        flavor = "fruits-mix";
        flavorLabel = "Fruits Mix";
      }
    } else if (pick.kind === "single") {
      const b = getBrand(pick.brandIds[0]);
      if (!b) return;
      const isFlat = b.flavorTypes.length === 1 && b.flavorTypes[0] === "flat";
      flavor = isFlat ? "flat" : "fruits";
      flavorLabel = isFlat ? "Standard" : "Fruits";
      components = [
        {
          brandId: b.id,
          brandName: b.name,
          flavorName: pick.flavorNames[0],
          emoji: b.emoji,
          grams: MOLASSES_GRAMS,
        },
      ];
    } else {
      // mix
      components = pick.brandIds.map((brandId, i) => {
        const b = getBrand(brandId)!;
        return {
          brandId,
          brandName: b.name,
          flavorName: pick.flavorNames[i],
          emoji: b.emoji,
          grams: 0,
        };
      });
      const grams = splitGrams(components.length);
      components = components.map((c, i) => ({ ...c, grams: grams[i] }));
      flavor = "fruits-mix";
      flavorLabel = "Fruits Mix";
    }

    if (!primaryBrand || components.length === 0) return;

    const unitPrice =
      flavor === "fruits-mix"
        ? priceForConfig("fruits-mix", components)
        : flavor === "flat"
          ? primaryBrand.pricing.flat ?? 45
          : primaryBrand.pricing.fruits ?? 125;

    addItem({
      primaryBrandId,
      primaryBrandName: primaryBrand.name,
      emoji: primaryBrand.emoji,
      accent: primaryBrand.accent,
      flavor,
      flavorLabel,
      components,
      molassesGrams: MOLASSES_GRAMS,
      unitPrice,
      qty: 1,
    });
    haptic("success");
    toast.success(`${pick.label} — ${t("addedToCart")}`, {
      description: `${egp(unitPrice)} · ${t("viewCart")}`,
    });
  };

  const quickChips = [
    { label: t("somethingSweet"), query: t("somethingSweet") },
    { label: t("strongClassic"), query: t("strongClassic") },
    { label: t("mintyFresh"), query: t("mintyFresh") },
    { label: t("surpriseMe"), query: t("surpriseMe") },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex h-[88vh] w-full max-w-xl flex-col rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl"
      >
        <SheetHeader className="border-b border-white/[0.06] px-5 pb-3 pt-2">
          <SheetGrip kicker="AI SOMMELIER" />
          <div className="flex items-center gap-3">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
              <Wand2 className="size-5" />
              <span className="absolute -end-1 -top-1 size-3 animate-pulse rounded-full bg-primary shadow-[0_0_10px_oklch(0.78_0.15_65/0.7)]" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex flex-wrap items-center gap-2 font-display text-lg font-bold tracking-tight text-gold-soft">
                {t("aiSommelier")}
                <Badge
                  variant="secondary"
                  className="border border-primary/30 bg-primary/10 text-[10px] text-primary"
                >
                  {t("aiBadge")}
                </Badge>
              </SheetTitle>
              <SheetDescription className="truncate text-xs">
                {t("sommelierTagline")}
                {guestName ? ` · ${guestName}` : ""}
              </SheetDescription>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                aria-label={t("clearChat")}
                className="glass grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="slim-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 && (
            <div className="space-y-4 pt-2">
              <div className="glass relative overflow-hidden rounded-2xl p-4">
                <div
                  className="pointer-events-none absolute -end-8 -top-10 size-28 rounded-full bg-primary/15 opacity-50 blur-3xl"
                  aria-hidden
                />
                <p className="relative text-sm leading-relaxed text-foreground/90">
                  {t("sommelierGreeting")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickChips.map((c) => (
                  <motion.button
                    key={c.label}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => send(c.query)}
                    className="glass rounded-full px-3.5 py-2 text-xs font-semibold text-gold-soft transition-all duration-300 hover:border-primary/40 hover:text-primary"
                  >
                    {c.label}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="space-y-2">
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <motion.div
                    initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="max-w-[85%] rounded-2xl rounded-ee-md bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] px-3.5 py-2.5 text-sm font-medium text-[oklch(0.17_0.03_50)] shadow-[0_8px_24px_-10px_oklch(0.72_0.145_60/0.55)]"
                  >
                    {m.content}
                  </motion.div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[92%] space-y-2">
                    <motion.div
                      initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="glass rounded-2xl rounded-es-md px-3.5 py-2.5 text-sm leading-relaxed"
                    >
                      <Typewriter
                        text={m.content}
                        animate={i === messages.length - 1}
                      />
                    </motion.div>
                    {m.source === "engine" && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        {t("engineBadge")}
                      </p>
                    )}
                    {m.picks && m.picks.length > 0 && mode === "guest" && (
                      <div className="space-y-1.5">
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-soft">
                          {t("quickAdd")}
                        </p>
                        {m.picks.map((p) => (
                          <motion.button
                            key={p.id}
                            type="button"
                            whileTap={{ scale: 0.99 }}
                            onClick={() => addPick(p)}
                            className="group glass flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)]"
                          >
                            <span className="shrink-0 transition-transform group-hover:scale-105">
                              <BrandStack brandIds={p.brandIds} size="sm" max={3} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">
                                {p.label}
                              </span>
                              {p.why && (
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {p.why}
                                </span>
                              )}
                            </span>
                            <span className="font-display shrink-0 text-sm font-bold tabular-nums text-gold">
                              {egp(p.price)}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="glass flex items-center gap-2.5 rounded-2xl rounded-es-md px-4 py-3">
                <TypingDots />
                <span className="text-xs text-muted-foreground">
                  {t("thinking")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.06] bg-[oklch(0.155_0.014_60/0.72)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("askPlaceholder")}
              className="h-11 flex-1 rounded-full border-white/[0.09] bg-white/[0.04] px-4 text-sm"
              maxLength={400}
              dir={lang === "ar" ? "rtl" : "ltr"}
              aria-label={t("askPlaceholder")}
            />
            <GoldButton
              type="submit"
              className="size-11 shrink-0 rounded-full p-0"
              disabled={!input.trim() || thinking}
              aria-label={t("sendBtn")}
            >
              {thinking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4 rtl:-scale-x-100" />
              )}
            </GoldButton>
          </form>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
            <Sparkles className="size-3 text-primary" /> {t("sommelierTagline")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Pulsing gold dots — the sommelier is composing. */
function TypingDots() {
  const reduced = useReducedMotion();
  return (
    <span className="flex gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) =>
        reduced ? (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary/70"
          />
        ) : (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_oklch(0.78_0.15_65/0.6)]"
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.18,
              ease: "easeInOut",
            }}
          />
        )
      )}
    </span>
  );
}

/** Reveals text progressively for a streaming feel (only for fresh messages). */
function Typewriter({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = React.useState(animate ? 0 : text.length);

  React.useEffect(() => {
    if (!animate) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      if (i >= text.length) {
        setShown(text.length);
        clearInterval(id);
      } else {
        setShown(i);
      }
    }, 16);
    return () => clearInterval(id);
  }, [text, animate]);

  return (
    <span className={cn(animate && shown < text.length && "after:content-['▌']")}>
      {text.slice(0, shown)}
    </span>
  );
}
