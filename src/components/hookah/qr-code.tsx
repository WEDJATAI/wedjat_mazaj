"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";

/**
 * Renders a crisp QR code (SVG) for the given text.
 * Used by the Get-App sheet (desktop showcase) and the install landing
 * (desktop branch) so phones can scan the code directly off the screen.
 */
export function QrCodeSvg({ text, size = 232 }: { text: string; size?: number }) {
  const [svg, setSvg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    QRCode.toString(text, {
      type: "svg",
      margin: 0,
      width: size,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1917", light: "#ffffff" },
    })
      .then((s) => {
        if (alive) setSvg(s);
      })
      .catch(() => {
        if (alive) setSvg("");
      });
    return () => {
      alive = false;
    };
  }, [text, size]);

  if (svg === null) {
    return (
      <div
        className="grid place-items-center rounded-2xl bg-white/90"
        style={{ width: size, height: size }}
      >
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    );
  }
  if (svg === "") {
    return (
      <div
        className="grid place-items-center rounded-2xl bg-white/90 text-center text-xs text-stone-500"
        style={{ width: size, height: size }}
      >
        QR unavailable
      </div>
    );
  }
  return (
    <div
      className="[&_svg]:size-full"
      style={{ width: size, height: size }}
      // SVG generated locally from a URL string — safe markup
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label="QR code to install Mazaj"
    />
  );
}
