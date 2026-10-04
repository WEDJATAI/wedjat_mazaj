"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ScrollText,
  RefreshCw,
  LogOut,
  MapPin,
  Clock,
  MessageCircle,
  Send,
  ChefHat,
  CheckCheck,
  Pause,
  Flame,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { egp } from "@/lib/catalog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface OrderRow {
  id: string;
  customerName: string | null;
  table: string | null;
  itemsJson: string;
  total: number;
  itemCount: number;
  status: string;
  source: string;
  orderedByName: string | null;
  createdAt: string;
}

interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

interface ItemSummary {
  primaryBrandName: string;
  flavorLabel: string;
  qty: number;
}

function parseItems(json: string): ItemSummary[] {
  try {
    const arr = JSON.parse(json) as ItemSummary[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: {
    label: "Pending",
    cls: "border border-primary/30 bg-primary/15 text-primary",
  },
  preparing: {
    label: "Preparing",
    cls: "border border-amber-500/30 bg-amber-500/15 text-amber-500",
  },
  done: {
    label: "Done",
    cls: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
};

export function OrdersPanel({ onSignOut }: { onSignOut: () => void }) {
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commentsFor, setCommentsFor] = React.useState<OrderRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.ok) setOrders(data.orders);
      else toast.error("Could not load orders");
    } catch {
      toast.error("Could not load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const setStatus = async (order: OrderRow, status: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      toast.success(
        status === "preparing" ? "Marked preparing" : "Marked done"
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const active = orders.filter((o) => o.status !== "done");
  const done = orders.filter((o) => o.status === "done");

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <ScrollText className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Order queue
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Active sessions & history
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {active.length > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 border border-primary/30 bg-primary/15 text-primary"
                >
                  <Flame className="size-3" /> {active.length} active
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={load}
                aria-label="Refresh"
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onSignOut}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-muted/50">
                <ScrollText className="size-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No orders yet</p>
                <p className="text-sm text-muted-foreground">
                  Orders appear here once placed.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {active.length > 0 && (
                <Section title="Active" count={active.length}>
                  {active.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onStatus={(s) => setStatus(o, s)}
                      onComments={() => setCommentsFor(o)}
                    />
                  ))}
                </Section>
              )}
              {done.length > 0 && (
                <Section title="Done" count={done.length} muted>
                  {done.slice(0, 10).map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onComments={() => setCommentsFor(o)}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </main>

        <footer className="relative mt-auto border-t border-border bg-background/60 py-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
            <Flame className="size-3 text-primary" />
            Auto-refreshes every 15 seconds
          </div>
        </footer>
      </div>

      <CommentsSheet
        order={commentsFor}
        open={!!commentsFor}
        onOpenChange={(o) => !o && setCommentsFor(null)}
      />
    </div>
  );
}

function Section({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2
          className={cn(
            "text-sm font-semibold",
            muted ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {title}
        </h2>
        <Badge variant="secondary" className="bg-muted/60 text-muted-foreground">
          {count}
        </Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function OrderCard({
  order,
  onStatus,
  onComments,
}: {
  order: OrderRow;
  onStatus?: (status: string) => void;
  onComments: () => void;
}) {
  const items = parseItems(order.itemsJson);
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  const sourceLabel =
    order.source === "guest_scan"
      ? "Guest scan"
      : order.source === "guest_call"
      ? "Guest call"
      : order.source === "employee"
      ? order.orderedByName ?? "Employee"
      : order.source;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        order.status === "pending"
          ? "border-primary/50"
          : order.status === "preparing"
          ? "border-amber-500/40"
          : "border-border opacity-80"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {order.customerName || "Walk-in"}
            </p>
            <Badge variant="secondary" className={meta.cls}>
              {meta.label}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {order.table && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {order.table}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {timeAgo(order.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              by {sourceLabel}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {order.itemCount} hookah{order.itemCount > 1 ? "s" : ""}
          </p>
          <p className="font-bold text-primary">{egp(order.total)}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={i}
            className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {it.qty}× {it.primaryBrandName} · {it.flavorLabel}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onStatus && order.status === "pending" && (
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => onStatus("preparing")}
          >
            <ChefHat className="size-4" /> Start preparing
          </Button>
        )}
        {onStatus && order.status === "preparing" && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => onStatus("pending")}
          >
            <Pause className="size-4" /> Back to pending
          </Button>
        )}
        {onStatus && order.status !== "done" && (
          <Button
            size="sm"
            variant="default"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-600/90"
            onClick={() => onStatus("done")}
          >
            <CheckCheck className="size-4" /> Mark done
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={onComments}
        >
          <MessageCircle className="size-4" /> Comments
        </Button>
      </div>
    </div>
  );
}

function CommentsSheet({
  order,
  open,
  onOpenChange,
}: {
  order: OrderRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [author, setAuthor] = React.useState("Staff");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!order) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/comments`);
      const data = await res.json();
      if (data.ok) setComments(data.comments);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [order]);

  React.useEffect(() => {
    if (open && order) {
      load();
    }
  }, [open, order, load]);

  const submit = async () => {
    if (!order || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: author.trim() || "Staff",
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      setBody("");
      toast.success("Comment added");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add comment");
    } finally {
      setSending(false);
    }
  };

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl border-t border-border p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-primary" /> Order comments
          </SheetTitle>
          <SheetDescription>
            Order #{order.id.slice(-6).toUpperCase()} ·{" "}
            {order.customerName || "Walk-in"}
            {order.table ? ` · ${order.table}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="slim-scroll flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              No comments yet. Add the first one below.
            </div>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {c.author}
                    </span>
                    <span>{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />
        <div className="space-y-2 p-4">
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            aria-label="Author"
          />
          <textarea
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment — e.g. needs extra coal, customer wants less heat…"
            rows={2}
            aria-label="Comment"
          />
          <Button
            className="w-full rounded-xl"
            disabled={!body.trim() || sending}
            onClick={submit}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Send className="size-4" /> Add comment
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
