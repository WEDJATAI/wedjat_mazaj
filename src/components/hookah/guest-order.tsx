"use client";

import * as React from "react";
import { useSession, GuestSession } from "@/store/session";
import { useTableContext } from "@/store/table-context";
import { OrderScreen } from "./order-screen";
import { FavoritesSheet } from "./favorites-sheet";
import { GuestTrackingSheet } from "./guest-tracking";
import { Button } from "@/components/ui/button";
import { HandHelping, Loader2, Heart, Flame, Sparkles, Radar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { egp } from "@/lib/catalog";

export function GuestOrder() {
  const guest = useSession((s) => s.guest) as GuestSession | null;
  const signOut = useSession((s) => s.signOut);
  const tableCtx = useTableContext();
  const [callOpen, setCallOpen] = React.useState(false);
  const [coalOpen, setCoalOpen] = React.useState(false);
  const [favOpen, setFavOpen] = React.useState(false);
  const [trackOpen, setTrackOpen] = React.useState(false);
  const [focusOrderId, setFocusOrderId] = React.useState<string | null>(null);
  const [favCount, setFavCount] = React.useState<number | null>(null);
  const [topPick, setTopPick] = React.useState<{
    label: string;
    unit: number;
  } | null>(null);

  // Returning-guest recognition: check for saved favorites on check-in.
  React.useEffect(() => {
    if (!guest?.name) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/favorites?guestName=${encodeURIComponent(guest.name)}`
        );
        const data = await res.json();
        if (cancelled || !data.ok) return;
        setFavCount(data.favorites.length);
        if (data.favorites.length > 0) {
          const first = data.favorites[0];
          try {
            const comps = JSON.parse(first.componentsJson);
            const unit = comps.reduce(
              (max: number, c: { brandId: string }) => {
                const p =
                  // best-effort: regular mix = 145, amy = 180
                  c.brandId === "amy" ? 180 : 145;
                return Math.max(max, p);
              },
              0
            );
            setTopPick({ label: first.label, unit });
          } catch {
            setTopPick({ label: first.label, unit: 145 });
          }
        }
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guest?.name]);

  if (!guest) return null;

  const isReturning = (favCount ?? 0) > 0;

  const handleOrderPlaced = (orderId: string) => {
    setFocusOrderId(orderId);
    // open the live tracker shortly after the confirmation dialog shows
    setTimeout(() => setTrackOpen(true), 1200);
  };

  return (
    <>
      <OrderScreen
        title="Guest order"
        subtitle={`${guest.name}${guest.table ? ` · ${guest.table}` : ""}`}
        source="guest_call"
        orderedByName={guest.name}
        defaultCustomer={guest.name}
        defaultTable={guest.table}
        defaultTableId={tableCtx.tableId}
        onSignOut={signOut}
        enableScan
        onOrderPlaced={handleOrderPlaced}
        headerExtra={
          <>
            <Button
              variant="outline"
              size="sm"
              className="relative gap-2 rounded-full"
              onClick={() => {
                setFocusOrderId(null);
                setTrackOpen(true);
              }}
              aria-label="Track my orders"
            >
              <Radar className="size-4" />
              <span className="hidden sm:inline">Track</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="relative gap-2 rounded-full"
              onClick={() => setFavOpen(true)}
              aria-label="Favorite mixes"
            >
              <Heart className="size-4" />
              <span className="hidden sm:inline">Favorites</span>
              {isReturning && (
                <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {favCount}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full"
              onClick={() => setCoalOpen(true)}
              aria-label="Request coal"
            >
              <Flame className="size-4" />
              <span className="hidden sm:inline">Coal</span>
            </Button>
            <Button
              size="sm"
              className="gap-2 rounded-full"
              onClick={() => setCallOpen(true)}
              aria-label="Call shisha man"
            >
              <HandHelping className="size-4" />
              <span className="hidden sm:inline">Call</span>
            </Button>
          </>
        }
        returningBanner={
          isReturning ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Welcome back, {guest.name}!</p>
                {topPick && (
                  <p className="text-xs text-muted-foreground">
                    Your usual:{" "}
                    <span className="font-medium text-foreground">
                      {topPick.label}
                    </span>{" "}
                    · {egp(topPick.unit)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => setFavOpen(true)}
              >
                Re-order
              </Button>
            </div>
          ) : null
        }
      />

      <CallShishaManDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        guest={guest}
      />
      <CoalRequestDialog
        open={coalOpen}
        onOpenChange={setCoalOpen}
        guest={guest}
      />
      <FavoritesSheet
        open={favOpen}
        onOpenChange={setFavOpen}
        guestName={guest.name}
      />
      <GuestTrackingSheet
        open={trackOpen}
        onOpenChange={setTrackOpen}
        guestName={guest.name}
        focusOrderId={focusOrderId}
      />
    </>
  );
}

function CallShishaManDialog({
  open,
  onOpenChange,
  guest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  guest: GuestSession;
}) {
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const submit = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "call_shisha_man",
          guestName: guest.name,
          table: guest.table,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      toast.success("The shisha man is on the way!", {
        description: "They'll be with you shortly.",
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHelping className="size-5 text-primary" />
            Call the shisha man
          </DialogTitle>
          <DialogDescription>
            A request will be sent to the staff. Add a note if you like.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span>{" "}
            <span className="font-medium">{guest.name}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Table:</span>{" "}
            <span className="font-medium">{guest.table || "—"}</span>
          </p>
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Need help choosing flavors"
          rows={3}
          className="resize-none"
        />

        <Button
          className="w-full rounded-xl"
          size="lg"
          disabled={sending}
          onClick={submit}
        >
          {sending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send request"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CoalRequestDialog({
  open,
  onOpenChange,
  guest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  guest: GuestSession;
}) {
  const [sending, setSending] = React.useState(false);

  const submit = async (coalType: "regular_coal" | "cubed_coal") => {
    setSending(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "coal_request",
          guestName: guest.name,
          table: guest.table,
          note: coalType === "cubed_coal" ? "Cubed coal please" : "Regular coal please",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      toast.success("Coal request sent!", {
        description:
          coalType === "cubed_coal" ? "Cubed coal on the way" : "Regular coal on the way",
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="size-5 text-primary" />
            Request coal
          </DialogTitle>
          <DialogDescription>
            Choose your coal type and a request goes straight to the shisha man.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span>{" "}
            <span className="font-medium">{guest.name}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Table:</span>{" "}
            <span className="font-medium">{guest.table || "—"}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={sending}
            onClick={() => submit("regular_coal")}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-all hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
          >
            <span className="text-4xl">⚫</span>
            <span className="font-semibold">Regular coal</span>
            <span className="text-xs text-muted-foreground">Quick light</span>
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => submit("cubed_coal")}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-all hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
          >
            <span className="text-4xl">🟫</span>
            <span className="font-semibold">Cubed coal</span>
            <span className="text-xs text-muted-foreground">Longer burn</span>
          </button>
        </div>

        {sending && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Sending…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
