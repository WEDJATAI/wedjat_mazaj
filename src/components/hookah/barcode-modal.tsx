"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getBrandByBarcode, BRANDS, egp } from "@/lib/catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScanLine, Camera, Keyboard, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoldButton } from "./kit/kit";
import { BrandMark } from "./brand-mark";

interface BarcodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (brandId: string) => void;
}

type BarcodeDetectorCtor = new (opts: unknown) => {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

/** Molten-gold selected pill (Midnight Ember signature). */
const GOLD_FILL =
  "border-transparent bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.6)]";

export function BarcodeModal({ open, onOpenChange, onScan }: BarcodeModalProps) {
  const reduced = useReducedMotion();
  const [mode, setMode] = React.useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = React.useState("");
  const [camSupported, setCamSupported] = React.useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const detectedRef = React.useRef<Set<string>>(new Set());

  // Keep latest callbacks in refs so the camera effect stays stable.
  const onScanRef = React.useRef(onScan);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onScanRef.current = onScan;
    onOpenChangeRef.current = onOpenChange;
  }, [onScan, onOpenChange]);

  // Reset state on open
  React.useEffect(() => {
    if (open) {
      setManualCode("");
      setMode("camera");
      detectedRef.current = new Set();
    }
  }, [open]);

  // Detect BarcodeDetector support once.
  React.useEffect(() => {
    setCamSupported(
      typeof window !== "undefined" && "BarcodeDetector" in window
    );
  }, []);

  const handleCode = React.useCallback((code: string) => {
    const brand = getBrandByBarcode(code);
    if (brand) {
      toast.success(`Scanned: ${brand.name}`, {
        description: brand.barcode,
      });
      onScanRef.current(brand.id);
      onOpenChangeRef.current(false);
    } else {
      toast.error("Unknown barcode", {
        description: `Code "${code}" isn't a known molasses brand.`,
      });
      setTimeout(() => detectedRef.current.delete(code), 1500);
    }
  }, []);

  // Camera lifecycle.
  React.useEffect(() => {
    if (!open || mode !== "camera" || !camSupported) return;
    let cancelled = false;
    const video = videoRef.current;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        detectLoop();
      } catch (err) {
        console.error("camera error", err);
        toast.error("Camera unavailable", {
          description: "Use manual entry instead.",
        });
        setMode("manual");
      }
    };

    const detectLoop = async () => {
      const Ctor = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
      ).BarcodeDetector;
      if (!Ctor || !videoRef.current) return;
      const detector = new Ctor({
        formats: ["code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
      });
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          for (const c of codes) {
            const val = c.rawValue.trim();
            if (val && !detectedRef.current.has(val)) {
              detectedRef.current.add(val);
              handleCode(val);
              return;
            }
          }
        } catch {
          // ignore frame errors
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, mode, camSupported, handleCode]);

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    handleCode(code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl">
        <DialogHeader className="gap-1 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <ScanLine className="size-4" />
            </span>
            Scan to order
          </DialogTitle>
          <DialogDescription className="text-xs">
            Scan the barcode on the molasses pack to add it to your order.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* mode switch — gold pill indicator */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scale: 0.97 }}
              onClick={() => setMode("camera")}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-all duration-300",
                mode === "camera" ? GOLD_FILL : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-primary/40 hover:text-primary"
              )}
            >
              <Camera className="size-4" /> Camera
            </motion.button>
            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scale: 0.97 }}
              onClick={() => setMode("manual")}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-all duration-300",
                mode === "manual" ? GOLD_FILL : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-primary/40 hover:text-primary"
              )}
            >
              <Keyboard className="size-4" /> Manual
            </motion.button>
          </div>

          {mode === "camera" ? (
            <div className="space-y-3">
              {camSupported === false ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-muted-foreground">
                  Camera scanning isn&apos;t supported in this browser.
                  <br />
                  Use manual entry or tap a brand below.
                </div>
              ) : (
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
                  <video
                    ref={videoRef}
                    className="size-full object-cover"
                    muted
                    playsInline
                  />
                  {/* scan frame — gold corner brackets + sweeping ember line */}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="relative h-1/3 w-3/4 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]">
                      <span
                        className="absolute -top-px -start-px size-7 rounded-tl-xl border-s-2 border-t-2 border-primary"
                        aria-hidden
                      />
                      <span
                        className="absolute -top-px -end-px size-7 rounded-tr-xl border-e-2 border-t-2 border-primary"
                        aria-hidden
                      />
                      <span
                        className="absolute -bottom-px -start-px size-7 rounded-bl-xl border-b-2 border-s-2 border-primary"
                        aria-hidden
                      />
                      <span
                        className="absolute -bottom-px -end-px size-7 rounded-br-xl border-b-2 border-e-2 border-primary"
                        aria-hidden
                      />
                      {!reduced && (
                        <motion.span
                          initial={{ top: "12%" }}
                          animate={{ top: ["12%", "82%", "12%"] }}
                          transition={{
                            duration: 2.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="absolute inset-x-3 h-0.5 rounded-full bg-primary/90 shadow-[0_0_12px_oklch(0.78_0.15_65/0.9)]"
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>
                  <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">
                    Align the barcode inside the frame
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. MZ-001"
                aria-label="Barcode"
                onKeyDown={(e) => e.key === "Enter" && submitManual()}
                className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04]"
              />
              <GoldButton className="w-full" onClick={submitManual}>
                <Check className="size-4" /> Add by code
              </GoldButton>
              <p className="text-center text-[11px] text-muted-foreground">
                Try <span className="font-mono">MZ-001</span>,{" "}
                <span className="font-mono">AF-002</span>,{" "}
                <span className="font-mono">AM-005</span>…
              </p>
            </div>
          )}

          {/* quick brand list (fallback) */}
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <X className="size-3" /> No scanner? Pick directly:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BRANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onScan(b.id);
                    onOpenChange(false);
                  }}
                  className="glass flex items-center gap-2 rounded-xl p-2 text-start text-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)]"
                >
                  <BrandMark brandId={b.id} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="font-display text-[11px] font-bold tabular-nums text-gold">
                      from {egp(b.pricing.flat ?? b.pricing.fruits ?? 0)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
