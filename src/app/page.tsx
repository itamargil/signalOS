import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { NewIdea } from "@/components/NewIdea";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: runs } = await db()
    .from("runs")
    .select("id,status,stage,created_at,ideas(title,prompt)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold mb-1">New idea</h1>
        <p className="text-muted text-sm mb-4">
          Feed a product idea. The agent proposes sources, waits for your approval,
          tracks engagement over a few days, then writes a signal report.
        </p>
        <NewIdea />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Runs</h2>
        <div className="space-y-2">
          {(runs || []).length === 0 && (
            <p className="text-muted text-sm">No runs yet — start one above.</p>
          )}
          {(runs || []).map((r: any) => (
            <Link
              key={r.id}
              href={`/runs/${r.id}`}
              className="card px-4 py-3 flex items-center justify-between hover:border-muted transition"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {r.ideas?.title || r.ideas?.prompt?.slice(0, 80) || "Untitled"}
                </div>
                <div className="text-xs text-muted">
                  stage: {r.stage} · {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
