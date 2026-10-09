"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  QrCode,
  CheckCircle2,
  Share,
  PlusSquare,
  Smartphone,
  RefreshCw,
  WifiOff,
  BellRing,
  Gift,
  Loader2,
  ArrowUpRight,
  FileDown,
} from "lucide-react";
import { installPromptRef, usePwa } from "@/store/pwa";
import { useI18n } from "@/store/i18n";
import { QrCodeSvg } from "./qr-code";
import { toast } from "sonner";

export function GetAppSheet() {
  const open = usePwa((s) => s.getAppOpen);
  const setOpen = usePwa((s) => s.setGetAppOpen);
  const platform = usePwa((s) => s.platform);
  const standalone = usePwa((s) => s.standalone);
  const canInstall = usePwa((s) => s.canInstall);
  const setStandalone = usePwa((s) => s.setStandalone);
  const t = useI18n((s) => s.t);

  const [installing, setInstalling] = React.useState(false);
  const [origin, setOrigin] = React.useState("https://wmazaj.vercel.app");

  React.useEffect(() => {
    if (open && typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, [open]);

  const installUrl = `${origin}/?install=1`;

  const install = async () => {
    const prompt = installPromptRef.current;
    if (!prompt) {
      toast.info("Use your browser menu", {
        description:
          "Open the browser menu (⋮) and choose “Install app” or “Add to Home screen”.",
      });
      return;
    }
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        setStandalone(true);
        toast.success("Mazaj is installing…", {
          description: "Find it on your home screen in a moment.",
        });
        setOpen(false);
      }
    } catch {
      toast.error("Install was interrupted");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2.5">
            <Image
              src="/icons/icon-192.png"
              alt="Mazaj app icon"
              width={36}
              height={36}
              className="rounded-xl"
              priority
            />
            {t("getApp")}
          </DialogTitle>
          <DialogDescription>{t("getAppDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6">
          {/* QR card — scan with any phone camera */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/70 p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <QrCode className="size-4 text-primary" />
              {t("scanToInstall")}
            </p>
            <div className="rounded-2xl bg-white p-4 shadow-inner">
              <QrCodeSvg text={installUrl} />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t("scanHint")}
            </p>
            <p className="rounded-lg bg-muted/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {installUrl}
            </p>
          </div>

          {/* This-device install */}
          {standalone ? (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <CheckCircle2 className="size-6 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t("youHaveApp")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("syncDesc2")}
                </p>
              </div>
            </div>
          ) : platform === "ios" ? (
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <Smartphone className="size-4 text-primary" /> iPhone · iPad
              </p>
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    1
                  </span>
                  <Share className="size-4 shrink-0 text-primary" />
                  {t("iosStep1")}
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    2
                  </span>
                  <PlusSquare className="size-4 shrink-0 text-primary" />
                  {t("iosStep2")}
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    3
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-primary" />
                  {t("iosStep3")}
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-border bg-card/70 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Smartphone className="size-4 text-primary" />{" "}
                {platform === "desktop" ? "This device" : "This phone"}
              </p>
              <Button
                className="h-12 w-full rounded-xl text-base font-semibold"
                disabled={installing}
                onClick={install}
              >
                {installing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />{" "}
                    {t("installing")}
                  </>
                ) : (
                  <>
                    <Download className="size-4" /> {t("installNow")}
                  </>
                )}
              </Button>
              {platform === "android" && (
                <a
                  href="/downloads/mazaj.apk"
                  download="Mazaj.apk"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/70 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  <FileDown className="size-4 text-primary" aria-hidden />
                  {t("sheetApk")}
                </a>
              )}
              {!canInstall && (
                <p className="text-center text-xs text-muted-foreground">
                  {t("installFromMenu")}
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Two-way sync explainer */}
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <RefreshCw className="size-4 text-primary" /> {t("syncTitle")}
            </p>
            <div className="space-y-2.5 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <WifiOff className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {t("syncDesc1")}
              </p>
              <p className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {t("syncDesc2")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium">
                <BellRing className="size-3 text-primary" />{" "}
                {t("featTracking")}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium">
                <Gift className="size-3 text-primary" /> {t("featLoyalty")}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium">
                <WifiOff className="size-3 text-primary" /> {t("featOffline")}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
