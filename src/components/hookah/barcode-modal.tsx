"use client";

import * as React from "react";
import { getBrandByBarcode, BRANDS, egp } from "@/lib/catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, Camera, Keyboard, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BarcodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (brandId: string) => void;
}

type BarcodeDetectorCtor = new (opts: unknown) => {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

export function BarcodeModal({ open, onOpenChange, onScan }: BarcodeModalProps) {
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
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary" />
            Scan to order
          </DialogTitle>
          <DialogDescription>
            Scan the barcode on the molasses pack to add it to your order.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* mode switch */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Button
              variant={mode === "camera" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setMode("camera")}
            >
              <Camera className="size-4" /> Camera
            </Button>
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setMode("manual")}
            >
              <Keyboard className="size-4" /> Manual
            </Button>
          </div>

          {mode === "camera" ? (
            <div className="space-y-3">
              {camSupported === false ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Camera scanning isn&apos;t supported in this browser.
                  <br />
                  Use manual entry or tap a brand below.
                </div>
              ) : (
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black">
                  <video
                    ref={videoRef}
                    className="size-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-1/3 w-3/4 rounded-xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                  </div>
                  <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
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
              />
              <Button className="w-full rounded-xl" onClick={submitManual}>
                <Check className="size-4" /> Add by code
              </Button>
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
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 text-left text-sm transition-all hover:border-primary/60"
                >
                  <span className="text-lg">{b.emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="text-[11px] text-muted-foreground">
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
