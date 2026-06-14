import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
import { inngest, EVENTS } from "@/inngest/client";
import { logActivity } from "@/lib/activity";

/**
 * Decide an approval gate. For discovery, the body carries which source
 * ids are approved (the rest are rejected). Sending the event resumes the
 * parked workflow.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const decision: "approved" | "rejected" = body.decision === "rejected" ? "rejected" : "approved";
  const approvedSourceIds: string[] | undefined = body.approvedSourceIds;
  const note: string | undefined = body.note;

  const { data: approval } = await db()
    .from("approvals")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!approval) return NextResponse.json({ error: "approval not found" }, { status: 404 });
  if (approval.status !== "pending") {
    return NextResponse.json({ error: "already decided" }, { status: 409 });
  }

  // Discovery gate: flip selected sources to approved, others to rejected.
  if (approval.stage === "discovery" && Array.isArray(approvedSourceIds)) {
    const { data: all } = await db()
      .from("sources")
      .select("id")
      .eq("run_id", approval.run_id);
    const approvedSet = new Set(approvedSourceIds);
    for (const s of all || []) {
      await db()
        .from("sources")
        .update({ status: approvedSet.has(s.id) ? "approved" : "rejected" })
        .eq("id", s.id);
    }
  }

  await db()
    .from("approvals")
    .update({
      status: decision,
      decision: { approvedSourceIds, note },
      note: note ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  await logActivity(
    approval.run_id,
    "approval_decided",
    `${approval.stage} ${decision}` +
      (approvedSourceIds ? ` (${approvedSourceIds.length} approved)` : "")
  );

  // Resume the workflow.
  await inngest.send({
    name: EVENTS.approvalDecided,
    data: { runId: approval.run_id, stage: approval.stage, decision },
  });

  return NextResponse.json({ ok: true });
}
