import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";

/**
 * Incremental activity feed for the live tail. Returns rows after `since`
 * (exclusive) plus the run's current status/stage so the client knows when
 * to stop polling.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const since = new URL(req.url).searchParams.get("since");
  let q = db()
    .from("activity")
    .select("id,type,message,created_at")
    .eq("run_id", params.id)
    .order("created_at", { ascending: true })
    .limit(300);
  if (since) q = q.gt("created_at", since);

  const [{ data: activity }, { data: run }] = await Promise.all([
    q,
    db().from("runs").select("status,stage").eq("id", params.id).single(),
  ]);

  return NextResponse.json(
    {
      activity: activity ?? [],
      status: run?.status ?? null,
      stage: run?.stage ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
