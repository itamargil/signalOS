import Link from "next/link";
import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LogsPage({
  searchParams,
}: {
  searchParams: { run?: string };
}) {
  const runId = searchParams.run;
  let q = db()
    .from("llm_calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (runId) q = q.eq("run_id", runId);
  const { data: calls } = await q;

  const totalCost = (calls || []).reduce((s, c: any) => s + Number(c.cost_usd || 0), 0);
  const totalIn = (calls || []).reduce((s, c: any) => s + (c.input_tokens || 0), 0);
  const totalOut = (calls || []).reduce((s, c: any) => s + (c.output_tokens || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">LLM logs</h1>
          <p className="text-muted text-sm">
            Every model call is recorded — discovery, internal loops, analysis, report.
            {runId && (
              <>
                {" "}Filtered to one run ·{" "}
                <Link href="/logs" className="underline">show all</Link>
              </>
            )}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted">{calls?.length ?? 0} calls</div>
          <div className="font-semibold">${totalCost.toFixed(4)}</div>
          <div className="text-muted text-xs">
            {totalIn.toLocaleString()} in / {totalOut.toLocaleString()} out tok
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {(calls || []).length === 0 && <p className="text-muted text-sm">No calls yet.</p>}
        {(calls || []).map((c: any) => (
          <details key={c.id} className="card p-0 overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 text-sm list-none">
              <span className={`chip ${c.status === "error" ? "border-bad text-bad" : "border-edge text-muted"}`}>
                {c.stage}
              </span>
              <span className="font-medium">{c.purpose}</span>
              <span className="text-muted text-xs ml-auto">
                {c.model} · {c.input_tokens ?? "–"}/{c.output_tokens ?? "–"} tok ·{" "}
                {c.cost_usd != null ? `$${Number(c.cost_usd).toFixed(4)}` : "–"} ·{" "}
                {c.latency_ms}ms
              </span>
            </summary>
            <div className="border-t border-edge px-4 py-3 space-y-3 text-xs">
              {c.error && <div className="text-bad">error: {c.error}</div>}
              {c.system_prompt && (
                <Block label="System">{c.system_prompt}</Block>
              )}
              <Block label="Input (messages)">
                {JSON.stringify(c.input, null, 2)}
              </Block>
              <Block label="Output">{c.output_text || "(no text)"}</Block>
              <details>
                <summary className="text-muted cursor-pointer">Raw response JSON</summary>
                <Block label="">{JSON.stringify(c.output_raw, null, 2)}</Block>
              </details>
              <div className="text-muted">
                {new Date(c.created_at).toLocaleString()} · stop: {c.stop_reason ?? "–"}
                {c.run_id && (
                  <>
                    {" · "}
                    <Link href={`/runs/${c.run_id}`} className="underline">run</Link>
                  </>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <div className="text-muted mb-1">{label}</div>}
      <pre className="whitespace-pre-wrap bg-ink border border-edge rounded-lg p-3 overflow-auto max-h-72">
        {children}
      </pre>
    </div>
  );
}
