import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
import { inngest, EVENTS } from "@/inngest/client";
import { logActivity } from "@/lib/activity";

/**
 * Decide a gate and resume the parked workflow. Handles three gate types:
 *   - prompt gates (stage ends "_prompt"): action "run", carries editedPrompt
 *   - discovery source gate (stage "discovery"): action "approve" (with
 *     approvedSourceIds) or "regenerate" (with editedPrompt to re-run discovery)
 *   - tracking gate (stage "tracking"): action "approve"
 * action "stop" cancels the run.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action: "run" | "regenerate" | "sample_again" | "proceed" | "stop" =
    body.action || "run";
  const approvedSourceIds: string[] | undefined = body.approvedSourceIds;
  const editedPrompt: { system?: string; user?: string } | undefined = body.editedPrompt;
  const scrapeSettings: { limit?: number; sort?: string; time?: string } | undefined = body.scrapeSettings;
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

  // Fetch gate, running with a chosen subset: flip selected sources to approved.
  if (approval.stage === "fetch" && action === "run" && Array.isArray(approvedSourceIds)) {
    const approvedSet = new Set(approvedSourceIds);
    const { data: all } = await db().from("sources").select("id").eq("run_id", approval.run_id);
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
      status: action === "stop" ? "rejected" : "approved",
      decision: { action, approvedSourceIds, editedPrompt, scrapeSettings, note },
      note: note ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  await logActivity(
    approval.run_id,
    "approval_decided",
    `${approval.stage}: ${action}` +
      (approvedSourceIds ? ` (${approvedSourceIds.length} sources)` : "") +
      (editedPrompt && (editedPrompt.system || editedPrompt.user) ? " · prompt edited" : "")
  );

  await inngest.send({
    name: EVENTS.approvalDecided,
    data: {
      runId: approval.run_id,
      stage: approval.stage,
      action,
      approvedSourceIds: approvedSourceIds ?? null,
      editedPrompt: editedPrompt ?? null,
      scrapeSettings: scrapeSettings ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
