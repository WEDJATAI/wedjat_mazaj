import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";

export default function NotFound() {
  return (
    <div className="dark relative flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-5 text-center text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center gap-4">
        <span className="grid size-16 place-items-center rounded-3xl bg-primary/15 text-primary">
          <Flame className="size-8" />
        </span>
        <div>
          <h1 className="text-2xl font-bold smoke-text">Page not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This page doesn&apos;t exist.
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link href="/">Back to Mazaj</Link>
        </Button>
      </div>
    </div>
  );
}
