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
import {
  GoldButton,
  Kicker,
  Stagger,
  StaggerItem,
} from "./kit/kit";

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
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl sm:max-w-md">
        <DialogHeader className="items-center px-6 pt-7 text-center sm:text-center">
          <div className="flex flex-col items-center gap-2.5">
            <Image
              src="/icons/icon-192.png"
              alt="Mazaj app icon"
              width={56}
              height={56}
              className="rounded-2xl shadow-[0_0_40px_-8px_oklch(0.78_0.15_65/0.45)] ring-1 ring-primary/30"
              priority
            />
            <Kicker>MAZAJ</Kicker>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight text-gold-soft">
              {t("getApp")}
            </DialogTitle>
            <DialogDescription className="max-w-[38ch] text-center text-xs leading-relaxed">
              {t("getAppDesc")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Stagger className="space-y-5 px-6 pb-7 pt-5">
          {/* QR card — scan with any phone camera */}
          <StaggerItem>
            <div className="glass relative flex flex-col items-center gap-3 rounded-2xl p-5">
              {/* gold corner accents */}
              <span
                aria-hidden
                className="pointer-events-none absolute start-3 top-3 size-5 rounded-tl-lg border-s-2 border-t-2 border-primary/60"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute end-3 top-3 size-5 rounded-tr-lg border-e-2 border-t-2 border-primary/60"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-3 start-3 size-5 rounded-bl-lg border-b-2 border-s-2 border-primary/60"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-3 end-3 size-5 rounded-br-lg border-b-2 border-e-2 border-primary/60"
              />
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <QrCode className="size-4 text-primary" />
                {t("scanToInstall")}
              </p>
              <div className="rounded-2xl bg-white p-4 shadow-[0_0_44px_-10px_oklch(0.78_0.15_65/0.4)] ring-2 ring-primary/40">
                <QrCodeSvg text={installUrl} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {t("scanHint")}
              </p>
              <p className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                {installUrl}
              </p>
            </div>
          </StaggerItem>

          {/* This-device install */}
          {standalone ? (
            <StaggerItem>
              <div className="glass flex items-center gap-3 rounded-2xl p-4 ring-1 ring-primary/25">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <CheckCircle2 className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{t("youHaveApp")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("syncDesc2")}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ) : platform === "ios" ? (
            <StaggerItem>
              <div className="glass rounded-2xl p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Smartphone className="size-4 text-primary" /> iPhone · iPad
                </p>
                <ol className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    { Icon: Share, text: t("iosStep1") },
                    { Icon: PlusSquare, text: t("iosStep2") },
                    { Icon: ArrowUpRight, text: t("iosStep3") },
                  ].map(({ Icon, text }, i) => (
                    <li key={text} className="flex items-center gap-2.5">
                      <span className="font-display grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/25">
                        {i + 1}
                      </span>
                      <Icon className="size-4 shrink-0 text-primary" />
                      {text}
                    </li>
                  ))}
                </ol>
              </div>
            </StaggerItem>
          ) : (
            <StaggerItem>
              <div className="glass space-y-3 rounded-2xl p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Smartphone className="size-4 text-primary" />{" "}
                  {platform === "desktop" ? "This device" : "This phone"}
                </p>
                <GoldButton
                  size="lg"
                  className="h-12 w-full"
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
                </GoldButton>
                {platform === "android" && (
                  <a
                    href="/downloads/mazaj.apk"
                    download="Mazaj.apk"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] text-sm font-semibold transition-all hover:border-primary/35 hover:bg-white/[0.06]"
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
            </StaggerItem>
          )}

          <StaggerItem>
            <div className="ember-hairline w-full" aria-hidden />
          </StaggerItem>

          {/* Two-way sync explainer */}
          <StaggerItem>
            <div className="space-y-3">
              <Kicker className="justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="size-3.5 text-primary" /> {t("syncTitle")}
                </span>
              </Kicker>
              <div className="space-y-2.5 text-xs text-muted-foreground">
                <p className="glass flex items-start gap-2 rounded-2xl p-3">
                  <WifiOff className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {t("syncDesc1")}
                </p>
                <p className="glass flex items-start gap-2 rounded-2xl p-3">
                  <RefreshCw className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {t("syncDesc2")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium">
                  <BellRing className="size-3 text-primary" />{" "}
                  {t("featTracking")}
                </span>
                <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium">
                  <Gift className="size-3 text-primary" /> {t("featLoyalty")}
                </span>
                <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium">
                  <WifiOff className="size-3 text-primary" /> {t("featOffline")}
                </span>
              </div>
            </div>
          </StaggerItem>
        </Stagger>
      </DialogContent>
    </Dialog>
  );
}
