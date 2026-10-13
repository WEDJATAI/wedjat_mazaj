import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveBranchScope } from "@/lib/branch-scope";
import { requireStaff } from "@/lib/auth";

/**
 * r57 — branch-scoped service requests (Call shisha man / Coal).
 *
 * GET  ?branchId=<id>  → that branch's requests (STAFF SESSION required,
 *      r70 — guests never list requests, they only create them)
 *      ?branchId=all   → every branch (multi-branch admin view, with
 *                        branchName attached to each row)
 *
 * POST { type, guestName, table, note, branchId } → the branch receives
 * the call; queued offline requests replay here with their branch intact.
 */
export async function GET(req: NextRequest) {
  try {
    {
      const guard = await requireStaff(req, "requests");
      if ("resp" in guard) return guard.resp;
    }
    const raw = req.nextUrl.searchParams.get("branchId");
    const { branchId } = await resolveBranchScope(raw);

    // r68-audit housekeeping: requests still pending/acknowledged after 4h
    // are auto-closed so the staff feed never fills with stale calls (the
    // note keeps the auto-close honest for the history view).
    const staleCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const stale = await db.serviceRequest.findMany({
      where: {
        status: { in: ["pending", "acknowledged"] },
        createdAt: { lt: staleCutoff },
      },
      select: { id: true, note: true },
      take: 50,
    });
    if (stale.length > 0) {
      await Promise.all(
        stale.map((r) =>
          db.serviceRequest.update({
            where: { id: r.id },
            data: {
              status: "done",
              note: r.note
                ? `${r.note} [auto-closed after 4h]`
                : "[auto-closed after 4h]",
            },
          })
        )
      );
    }

    const requests = await db.serviceRequest.findMany({
      where: branchId ? { branchId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: branchId
        ? undefined
        : { branch: { select: { id: true, name: true, nameAr: true } } },
    });
    return NextResponse.json({
      ok: true,
      requests: requests.map((r) => {
        // branch is only included in the all-branches scope (see include above)
        const branch = (
          r as { branch?: { name: string; nameAr: string | null } | null }
        ).branch;
        return {
          id: r.id,
          type: r.type,
          guestName: r.guestName,
          table: r.table,
          note: r.note,
          status: r.status,
          createdAt: r.createdAt,
          acknowledgedAt: r.acknowledgedAt,
          branchId: r.branchId,
          branchName: branch ? branch.name : null,
          branchNameAr: branch ? branch.nameAr : null,
        };
      }),
    });
  } catch (err) {
    console.error("requests list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load requests" },
      { status: 500 }
    );
  }
}

import { z } from "zod";

const CreateSchema = z.object({
  type: z.string().default("call_shisha_man"),
  guestName: z.string().trim().max(80).optional().or(z.literal("")),
  table: z.string().trim().max(40).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  branchId: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const { branchId } = await resolveBranchScope(data.branchId ?? null);
    const created = await db.serviceRequest.create({
      data: {
        type: data.type,
        guestName: data.guestName || null,
        table: data.table || null,
        note: data.note || null,
        status: "pending",
        branchId,
      },
    });
    return NextResponse.json({ ok: true, request: created });
  } catch (err) {
    console.error("create request error", err);
    return NextResponse.json(
      { ok: false, error: "Could not create request" },
      { status: 500 }
    );
  }
}
