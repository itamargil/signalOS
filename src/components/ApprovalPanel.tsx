"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StepPlan } from "@/lib/plan";

interface Source {
  id: string;
  platform: string;
  kind: string;
  handle: string;
  url: string | null;
  rationale: string | null;
  status: string;
}

interface EditablePrompt {
  system: string;
  lockedSuffix: string;
  user: string;
}

interface Approval {
  id: string;
  stage: string;
  title: string;
  payload: any;
}

function dur(sec: number) {
  if (sec <= 0) return "—";
  if (sec < 90) return `~${Math.round(sec)}s`;
  if (sec < 5400) return `~${Math.round(sec / 60)} min`;
  if (sec < 172800) return `~${(sec / 3600).toFixed(1)} hr`;
  return `~${(sec / 86400).toFixed(1)} days`;
}

const KIND_ICON: Record<string, string> = { scraper: "⚙️", model: "🧠", api: "🔌" };
const RUN_LABEL: Record<string, string> = {
  discovery_prompt: "Run discovery",
  analysis_prompt: "Run analysis",
  report_prompt: "Run report",
};

function Consequence({ plan, prefix }: { plan: StepPlan | null; prefix: string }) {
  if (!plan) return null;
  return (
    <div className="bg-ink border border-edge rounded-lg p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">
          {prefix} <span className="text-white font-medium">{plan.title}</span>
        </span>
        <span className="text-muted whitespace-nowrap">
          ⏱ {dur(plan.estSeconds)}
          {plan.estCostUsd > 0 && <> · ≈ ${plan.estCostUsd.toFixed(2)}</>}
        </span>
      </div>
      {plan.tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {plan.tools.map((t, i) => (
            <span key={i} className="chip border-edge text-muted">
              {KIND_ICON[t.kind] || "•"} {t.label}
              {t.runs > 1 && <span className="ml-1 opacity-70">×{t.runs}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PromptEditor({
  prompt, system, setSystem, user, setUser,
}: {
  prompt: EditablePrompt;
  system: string; setSystem: (v: string) => void;
  user: string; setUser: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-muted mb-1">System prompt (editable)</div>
        <textarea className="input font-mono text-xs min-h-[140px]" value={system} onChange={(e) => setSystem(e.target.value)} />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">User message (editable)</div>
        <textarea className="input font-mono text-xs min-h-[160px]" value={user} onChange={(e) => setUser(e.target.value)} />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">🔒 Output format (locked — keeps the result parseable)</div>
        <pre className="bg-ink border border-edge rounded-lg p-2 text-[11px] text-muted whitespace-pre-wrap max-h-32 overflow-auto">
          {prompt.lockedSuffix}
        </pre>
      </div>
    </div>
  );
}

export function ApprovalPanel({
  approval, sources, plan,
}: {
  approval: Approval;
  sources: Source[];
  plan: StepPlan | null;
}) {
  const router = useRouter();
  const isPrompt = approval.stage.endsWith("_prompt");
  const isFetch = approval.stage === "fetch";
  const isSample = approval.stage === "sample";

  const prompt: EditablePrompt | undefined = approval.payload?.prompt;
  const initSettings = approval.payload?.scrapeSettings || { limit: 40, sort: "top", time: "month" };

  const [system, setSystem] = useState(prompt?.system ?? "");
  const [user, setUser] = useState(prompt?.user ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(sources.map((s) => s.id)));
  const [limit, setLimit] = useState<number>(initSettings.limit ?? 40);
  const [sort, setSort] = useState<string>(initSettings.sort ?? "top");
  const [time, setTime] = useState<string>(initSettings.time ?? "month");
  const [showRegen, setShowRegen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function post(body: any) {
    setBusy(true);
    await fetch(`/api/approvals/${approval.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, ...body }),
    });
    router.refresh();
  }

  return (
    <section className="card p-5 border-warn space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="chip border-warn text-warn">next step</span>
          <span className="text-xs text-muted uppercase">{approval.stage.replace(/_/g, " ")}</span>
        </div>
        <h2 className="text-lg font-semibold">{approval.title}</h2>
      </div>

      {/* ── PROMPT STEP ── */}
      {isPrompt && prompt && (
        <>
          <p className="text-muted text-sm">Review and edit the prompt. Your version runs when you click Run.</p>
          <PromptEditor prompt={prompt} system={system} setSystem={setSystem} user={user} setUser={setUser} />
          <Consequence plan={plan} prefix="On run:" />
          <div className="flex gap-2">
            <button className="btn" disabled={busy} onClick={() => post({ action: "run", editedPrompt: { system, user } })}>
              {busy ? "Running…" : `${RUN_LABEL[approval.stage] || "Run"} →`}
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => post({ action: "stop" })}>Stop run</button>
          </div>
        </>
      )}

      {/* ── FETCH STEP ── */}
      {isFetch && (
        <>
          <p className="text-muted text-sm">Pick the sources to scrape and set the scrape parameters, then run the fetch.</p>
          <div className="space-y-2 max-h-80 overflow-auto">
            {sources.map((s) => (
              <label key={s.id} className="flex items-start gap-3 bg-ink rounded-lg p-3 border border-edge cursor-pointer">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="mt-1" />
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="text-muted">{s.platform}</span> <span className="font-medium">{s.handle}</span>{" "}
                    <span className="chip text-muted ml-1">{s.kind}</span>
                  </div>
                  {s.rationale && <div className="text-xs text-muted mt-0.5">{s.rationale}</div>}
                </div>
              </label>
            ))}
          </div>

          {/* scrape settings */}
          <div className="bg-ink border border-edge rounded-lg p-3 flex flex-wrap items-center gap-4">
            <span className="text-xs text-muted">⚙️ scrape settings</span>
            <label className="text-xs text-muted flex items-center gap-2">
              items/source
              <input type="number" min={1} max={100} className="input w-16 py-1" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            </label>
            <label className="text-xs text-muted flex items-center gap-2">
              sort
              <select className="input w-24 py-1" value={sort} onChange={(e) => setSort(e.target.value)}>
                {["top", "hot", "new", "relevance", "latest"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted flex items-center gap-2">
              window
              <select className="input w-24 py-1" value={time} onChange={(e) => setTime(e.target.value)}>
                {["day", "week", "month", "year", "all"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>

          {/* regenerate */}
          {prompt && (
            <details className="bg-ink border border-edge rounded-lg" open={showRegen}>
              <summary className="px-3 py-2 cursor-pointer text-sm list-none text-muted hover:text-white" onClick={() => setShowRegen((v) => !v)}>
                ↻ Not happy with these sources? Adjust the prompt & regenerate
              </summary>
              <div className="px-3 pb-3 pt-1">
                <PromptEditor prompt={prompt} system={system} setSystem={setSystem} user={user} setUser={setUser} />
                <button className="btn-ghost mt-3" disabled={busy} onClick={() => post({ action: "regenerate", editedPrompt: { system, user } })}>
                  {busy ? "Regenerating…" : "↻ Regenerate sources"}
                </button>
              </div>
            </details>
          )}

          <Consequence plan={plan} prefix="On run:" />
          <div className="flex gap-2">
            <button className="btn" disabled={busy || selected.size === 0} onClick={() => post({ action: "run", approvedSourceIds: [...selected], scrapeSettings: { limit, sort, time } })}>
              {busy ? "Fetching…" : `Run fetch (${selected.size}) →`}
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => post({ action: "stop" })}>Stop run</button>
          </div>
        </>
      )}

      {/* ── SAMPLE STEP ── */}
      {isSample && (
        <>
          <p className="text-muted text-sm">
            {approval.payload?.snapshotsCaptured ?? 1} engagement snapshot(s) captured. Capture another to
            measure velocity, or proceed to analysis.
          </p>
          <Consequence plan={plan} prefix="Sample again:" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" disabled={busy} onClick={() => post({ action: "sample_again" })}>
              {busy ? "Sampling…" : "⚙️ Sample again"}
            </button>
            <button className="btn" disabled={busy} onClick={() => post({ action: "proceed" })}>
              Proceed to analysis →
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => post({ action: "stop" })}>Stop run</button>
          </div>
        </>
      )}
    </section>
  );
}
