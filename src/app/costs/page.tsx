import Link from "next/link";
import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (LLM)",
  apify: "Apify (X + IG)",
  reddit: "Reddit",
  resend: "Email",
};

function usd(n: number) {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export default async function CostsPage() {
  const { data: events } = await db()
    .from("cost_events")
    .select("provider,amount_usd,idea_id,created_at,ideas(title,prompt)")
    .order("created_at", { ascending: false })
    .limit(10000);

  const rows = events || [];
  const grand = rows.reduce((s, e: any) => s + Number(e.amount_usd || 0), 0);

  // by provider
  const byProvider = new Map<string, number>();
  for (const e of rows as any[]) {
    byProvider.set(e.provider, (byProvider.get(e.provider) || 0) + Number(e.amount_usd || 0));
  }

  // by idea (+ provider breakdown)
  type IdeaAgg = { title: string; total: number; providers: Map<string, number> };
  const byIdea = new Map<string, IdeaAgg>();
  for (const e of rows as any[]) {
    const key = e.idea_id || "_unattributed";
    const title = e.ideas?.title || e.ideas?.prompt?.slice(0, 60) || "Unattributed";
    const agg = byIdea.get(key) || { title, total: 0, providers: new Map() };
    agg.total += Number(e.amount_usd || 0);
    agg.providers.set(e.provider, (agg.providers.get(e.provider) || 0) + Number(e.amount_usd || 0));
    byIdea.set(key, agg);
  }

  const providers = [...byProvider.entries()].sort((a, b) => b[1] - a[1]);
  const ideas = [...byIdea.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Costs</h1>
          <p className="text-muted text-sm">
            Every third-party charge — LLM tokens and Apify runs — by provider and by idea.
          </p>
        </div>
        <div className="text-right">
          <div className="text-muted text-xs">total spend</div>
          <div className="text-2xl font-semibold">{usd(grand)}</div>
        </div>
      </div>

      {/* By provider */}
      <section>
        <h2 className="text-sm text-muted mb-2">By provider</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {providers.length === 0 && (
            <p className="text-muted text-sm col-span-full">No costs recorded yet.</p>
          )}
          {providers.map(([p, amt]) => (
            <div key={p} className="card p-4">
              <div className="text-xs text-muted">{PROVIDER_LABEL[p] || p}</div>
              <div className="text-lg font-semibold">{usd(amt)}</div>
              <div className="text-xs text-muted">
                {grand > 0 ? Math.round((amt / grand) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* By idea */}
      <section>
        <h2 className="text-sm text-muted mb-2">By idea</h2>
        <div className="card divide-y divide-edge">
          {ideas.length === 0 && <p className="text-muted text-sm p-4">Nothing yet.</p>}
          {ideas.map(([key, agg]) => (
            <div key={key} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{agg.title}</div>
                <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-3">
                  {[...agg.providers.entries()].map(([p, amt]) => (
                    <span key={p}>
                      {PROVIDER_LABEL[p] || p}: {usd(amt)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="font-semibold whitespace-nowrap">{usd(agg.total)}</div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted">
        LLM pricing is estimated from the rate map in{" "}
        <code>src/lib/llm/client.ts</code>; Apify amounts are reported by each actor run.
        For per-call LLM detail see <Link href="/logs" className="underline">LLM Logs</Link>.
      </p>
    </div>
  );
}
