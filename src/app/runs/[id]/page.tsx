import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { LiveTail } from "@/components/LiveTail";
import { Section } from "@/components/Section";
import { Markdown } from "@/components/Markdown";
import { NextStepPlan } from "@/components/NextStepPlan";
import { AutoRefresh } from "@/components/AutoRefresh";
import { nextStepPlan } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: { id: string } }) {
  const runId = params.id;
  const { data: run } = await db().from("runs").select("*").eq("id", runId).single();
  if (!run) return <p className="text-muted">Run not found.</p>;

  const [
    { data: idea },
    { data: approvals },
    { data: sources },
    { data: activity },
    { data: report },
    { count: itemCount },
    { data: llmCalls },
    { data: costEvents },
  ] = await Promise.all([
    db().from("ideas").select("*").eq("id", run.idea_id).single(),
    db().from("approvals").select("*").eq("run_id", runId).order("requested_at", { ascending: false }),
    db().from("sources").select("*").eq("run_id", runId).order("platform"),
    db().from("activity").select("id,type,message,created_at").eq("run_id", runId).order("created_at", { ascending: true }).limit(500),
    db().from("reports").select("*").eq("run_id", runId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db().from("tracked_items").select("id", { count: "exact", head: true }).eq("run_id", runId),
    db().from("llm_calls").select("*").eq("run_id", runId).order("created_at", { ascending: true }),
    db().from("cost_events").select("provider,category,description,amount_usd,created_at").eq("run_id", runId).order("created_at", { ascending: true }),
  ]);

  const pending = (approvals || []).find((a: any) => a.status === "pending");
  const plan = nextStepPlan(run as any, (sources || []) as any, pending?.stage);
  const terminal = ["completed", "failed", "cancelled"].includes(run.status);
  // Poll while the agent is working toward the next gate. When a gate is waiting
  // on you, nothing changes server-side until you act, so we pause.
  const calls = llmCalls || [];
  const costs = costEvents || [];
  const totalCost = costs.reduce((s, c: any) => s + Number(c.amount_usd || 0), 0);

  return (
    <div className="space-y-4">
      <AutoRefresh active={!pending && !terminal} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-muted text-sm hover:text-white">← all runs</Link>
          <h1 className="text-xl font-semibold mt-1">
            {idea?.title || idea?.prompt?.slice(0, 80)}
          </h1>
          <p className="text-muted text-sm mt-1">
            stage: {run.stage} · {(sources || []).length} sources · {itemCount ?? 0} items ·{" "}
            {calls.length} LLM calls · ${totalCost.toFixed(4)}
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
          sources={(sources || []).filter((s: any) => s.status === "proposed")}
          plan={plan}
        />
      )}

      {!pending && plan && <NextStepPlan plan={plan} />}

      <LiveTail runId={runId} initial={(activity as any) || []} initialStatus={run.status} />

      {report && (
        <Section
          title="Signal report"
          defaultOpen
          badge={
            report.scorecard?.verdict ? (
              <span className="chip border-accent text-accent uppercase">
                {report.scorecard.verdict} · {report.scorecard.overall}/100
              </span>
            ) : undefined
          }
        >
          {report.summary && <p className="text-sm mb-4">{report.summary}</p>}
          <Scorecard sc={report.scorecard} />
          <div className="mt-4">
            <Markdown>{report.body_md || ""}</Markdown>
          </div>
        </Section>
      )}

      <Section title="Sources" subtitle={`${(sources || []).length}`} defaultOpen>
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
      </Section>

      <Section title="LLM calls" subtitle={`${calls.length} · every prompt & response`}>
        <div className="space-y-2">
          {calls.length === 0 && <p className="text-muted text-sm">none yet</p>}
          {calls.map((c: any) => (
            <details key={c.id} className="bg-ink border border-edge rounded-lg">
              <summary className="px-3 py-2 cursor-pointer flex items-center gap-2 text-sm list-none">
                <span className="text-muted text-xs whitespace-nowrap font-mono">{fmtDateTime(c.created_at)}</span>
                <span className={`chip ${c.status === "error" ? "border-bad text-bad" : "border-edge text-muted"}`}>
                  {c.stage}
                </span>
                <span className="font-medium">{c.purpose}</span>
                <span className="ml-auto text-muted text-xs">
                  {c.input_tokens ?? "–"}/{c.output_tokens ?? "–"} tok ·{" "}
                  {c.cost_usd != null ? `$${Number(c.cost_usd).toFixed(4)}` : "–"} · {c.latency_ms}ms
                </span>
              </summary>
              <div className="border-t border-edge px-3 py-2 space-y-2 text-xs">
                {c.error && <div className="text-bad">error: {c.error}</div>}
                {c.system_prompt && <Block label="System">{c.system_prompt}</Block>}
                <Block label="Input">{JSON.stringify(c.input, null, 2)}</Block>
                <Block label="Output">{c.output_text || "(no text)"}</Block>
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Costs" subtitle={`$${totalCost.toFixed(4)} total`}>
        <CostBreakdown costs={costs} total={totalCost} />
      </Section>
    </div>
  );
}

function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted mb-1">{label}</div>
      <pre className="whitespace-pre-wrap bg-panel border border-edge rounded-lg p-2 overflow-auto max-h-64">
        {children}
      </pre>
    </div>
  );
}

function CostBreakdown({ costs, total }: { costs: any[]; total: number }) {
  if (costs.length === 0) return <p className="text-muted text-sm">no costs yet</p>;
  const byProvider = new Map<string, number>();
  for (const c of costs) byProvider.set(c.provider, (byProvider.get(c.provider) || 0) + Number(c.amount_usd || 0));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[...byProvider.entries()].map(([p, amt]) => (
          <div key={p} className="bg-ink rounded-lg p-3 border border-edge">
            <div className="text-xs text-muted">{p}</div>
            <div className="text-base font-semibold">${amt.toFixed(4)}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {costs.map((c: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-muted truncate">
              <span className="text-edge">{c.provider}</span> · {c.description}
            </span>
            <span>${Number(c.amount_usd || 0).toFixed(4)}</span>
          </div>
        ))}
      </div>
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
