"use client";

import * as React from "react";
import { useSession, GuestSession } from "@/store/session";
import { OrderScreen } from "./order-screen";
import { Button } from "@/components/ui/button";
import { HandHelping, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function GuestOrder() {
  const guest = useSession((s) => s.guest) as GuestSession | null;
  const signOut = useSession((s) => s.signOut);
  const [callOpen, setCallOpen] = React.useState(false);

  if (!guest) return null;

  return (
    <>
      <OrderScreen
        title="Guest order"
        subtitle={`${guest.name}${guest.table ? ` · ${guest.table}` : ""}`}
        source="guest_call"
        orderedByName={guest.name}
        defaultCustomer={guest.name}
        defaultTable={guest.table}
        onSignOut={signOut}
        enableScan
        headerExtra={
          <Button
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => setCallOpen(true)}
            aria-label="Call shisha man"
          >
            <HandHelping className="size-4" />
            <span className="hidden sm:inline">Call</span>
          </Button>
        }
      />

      <CallShishaManDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        guest={guest}
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
