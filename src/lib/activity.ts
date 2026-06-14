import { db } from "@/lib/supabase/server";

/** Human-readable audit trail — one row per meaningful workflow step. */
export async function logActivity(
  runId: string,
  type: string,
  message: string,
  data: Record<string, unknown> = {}
) {
  try {
    await db().from("activity").insert({ run_id: runId, type, message, data });
  } catch (e) {
    console.error("[activity] failed:", e);
  }
}
