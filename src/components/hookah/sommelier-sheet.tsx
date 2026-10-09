"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Trash2, Plus, Loader2, Wand2 } from "lucide-react";
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
        className="mx-auto flex h-[88vh] w-full max-w-xl flex-col rounded-t-3xl border-t border-border p-0"
      >
        <SheetHeader className="border-b border-border px-5 pb-3 pt-5">
          <div className="flex items-center gap-3">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Wand2 className="size-5" />
              <span className="absolute -right-1 -top-1 size-3 animate-pulse rounded-full bg-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
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
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-full"
                onClick={clearChat}
                aria-label={t("clearChat")}
              >
                <Trash2 className="size-4" />
              </Button>
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
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm leading-relaxed text-foreground/90">
                  {t("sommelierGreeting")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickChips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => send(c.query)}
                    className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20 active:scale-95"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="space-y-2">
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[92%] space-y-2">
                    <div className="rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed">
                      <Typewriter
                        text={m.content}
                        animate={i === messages.length - 1}
                      />
                    </div>
                    {m.source === "engine" && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        {t("engineBadge")}
                      </p>
                    )}
                    {m.picks && m.picks.length > 0 && mode === "guest" && (
                      <div className="space-y-1.5">
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("quickAdd")}
                        </p>
                        {m.picks.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addPick(p)}
                            className="group flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-start transition-all hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99]"
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary transition-transform group-hover:scale-105">
                              <Plus className="size-4" />
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
                            <span className="shrink-0 text-sm font-bold text-primary">
                              {egp(p.price)}
                            </span>
                          </button>
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
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5">
                <span className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("thinking")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border bg-background/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
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
              className="h-11 flex-1 rounded-full border-border bg-card px-4 text-sm"
              maxLength={400}
              dir={lang === "ar" ? "rtl" : "ltr"}
              aria-label={t("askPlaceholder")}
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 rounded-full"
              disabled={!input.trim() || thinking}
              aria-label={t("sendBtn")}
            >
              {thinking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4 rtl:-scale-x-100" />
              )}
            </Button>
          </form>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
            <Sparkles className="size-3" /> {t("sommelierTagline")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
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
