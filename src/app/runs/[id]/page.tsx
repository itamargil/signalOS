import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { LiveTail } from "@/components/LiveTail";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: { id: string } }) {
  const runId = params.id;
  const { data: run } = await db().from("runs").select("*").eq("id", runId).single();
  if (!run) return <p className="text-muted">Run not found.</p>;

  const [{ data: idea }, { data: approvals }, { data: sources }, { data: activity }, { data: report }, { count: itemCount }, { count: llmCount }] =
    await Promise.all([
      db().from("ideas").select("*").eq("id", run.idea_id).single(),
      db().from("approvals").select("*").eq("run_id", runId).order("requested_at", { ascending: false }),
      db().from("sources").select("*").eq("run_id", runId).order("platform"),
      db().from("activity").select("id,type,message,created_at").eq("run_id", runId).order("created_at", { ascending: true }).limit(500),
      db().from("reports").select("*").eq("run_id", runId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db().from("tracked_items").select("id", { count: "exact", head: true }).eq("run_id", runId),
      db().from("llm_calls").select("id", { count: "exact", head: true }).eq("run_id", runId),
    ]);

  const pending = (approvals || []).find((a: any) => a.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-muted text-sm hover:text-white">← all runs</Link>
          <h1 className="text-xl font-semibold mt-1">
            {idea?.title || idea?.prompt?.slice(0, 80)}
          </h1>
          <p className="text-muted text-sm mt-1">
            stage: {run.stage} · {(sources || []).length} sources · {itemCount ?? 0} items ·{" "}
            <Link href={`/logs?run=${runId}`} className="underline hover:text-white">
              {llmCount ?? 0} LLM calls
            </Link>
          </p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      {run.error && (
        <div className="card p-3 border-bad text-bad text-sm">{run.error}</div>
      )}

      {pending && (
        <ApprovalPanel
          approval={pending}
          sources={(sources || []).filter((s: any) => s.status === "proposed" || pending.stage === "discovery")}
        />
      )}

      <LiveTail
        runId={runId}
        initial={(activity as any) || []}
        initialStatus={run.status}
      />

      {report && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Signal report</h2>
            {report.scorecard?.verdict && (
              <span className="chip border-accent text-accent uppercase">
                {report.scorecard.verdict} · {report.scorecard.overall}/100
              </span>
            )}
          </div>
          {report.summary && <p className="text-sm mb-4">{report.summary}</p>}
          <Scorecard sc={report.scorecard} />
          <pre className="whitespace-pre-wrap text-sm leading-relaxed mt-4 font-sans">
            {report.body_md}
          </pre>
        </section>
      )}

      <section className="card p-4">
        <h3 className="font-medium mb-3">Sources</h3>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {(sources || []).length === 0 && <p className="text-muted text-sm">none yet</p>}
          {(sources || []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                <span className="text-muted">{s.platform}</span> {s.handle}
              </span>
              <span
                className={`chip ${
                  s.status === "approved"
                    ? "border-ok text-ok"
                    : s.status === "rejected"
                    ? "border-edge text-muted"
                    : "border-warn text-warn"
                }`}
              >
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Scorecard({ sc }: { sc: any }) {
  if (!sc || typeof sc !== "object") return null;
  const rows = [
    ["Demand", sc.demand],
    ["Competition", sc.competition],
    ["Feasibility", sc.feasibility],
    ["Overall", sc.overall],
  ].filter(([, v]) => typeof v === "number");
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {rows.map(([label, v]) => (
        <div key={label as string} className="bg-ink rounded-lg p-3 border border-edge">
          <div className="text-xs text-muted">{label}</div>
          <div className="text-lg font-semibold">{v as number}</div>
        </div>
      ))}
    </div>
  );
}
