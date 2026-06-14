"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Source {
  id: string;
  platform: string;
  kind: string;
  handle: string;
  url: string | null;
  rationale: string | null;
  status: string;
}

export function ApprovalPanel({
  approval,
  sources,
}: {
  approval: { id: string; stage: string; title: string; payload: any };
  sources: Source[];
}) {
  const router = useRouter();
  const isDiscovery = approval.stage === "discovery";
  const [selected, setSelected] = useState<Set<string>>(
    new Set(sources.map((s) => s.id)) // default: all approved
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    await fetch(`/api/approvals/${approval.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        approvedSourceIds: isDiscovery ? [...selected] : undefined,
        note,
      }),
    });
    router.refresh();
  }

  return (
    <section className="card p-5 border-warn">
      <div className="flex items-center gap-2 mb-1">
        <span className="chip border-warn text-warn">approval needed</span>
        <span className="text-xs text-muted uppercase">{approval.stage}</span>
      </div>
      <h2 className="text-lg font-semibold mb-3">{approval.title}</h2>

      {isDiscovery ? (
        <>
          <p className="text-muted text-sm mb-3">
            Select the sources to track. Unchecked ones are skipped.
          </p>
          <div className="space-y-2 mb-4 max-h-96 overflow-auto">
            {sources.map((s) => (
              <label
                key={s.id}
                className="flex items-start gap-3 bg-ink rounded-lg p-3 border border-edge cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="text-muted">{s.platform}</span>{" "}
                    <span className="font-medium">{s.handle}</span>{" "}
                    <span className="chip text-muted ml-1">{s.kind}</span>
                  </div>
                  {s.rationale && (
                    <div className="text-xs text-muted mt-0.5">{s.rationale}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted text-sm mb-4">
          The agent has fetched the items above and will now sample their engagement over
          the tracking window. Confirm to begin, or stop the run.
        </p>
      )}

      <input
        className="input mb-3"
        placeholder="Optional note / guidance for the agent"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn" onClick={() => decide("approved")} disabled={busy}>
          {busy ? "Saving…" : isDiscovery ? `Approve ${selected.size} & continue` : "Confirm & continue"}
        </button>
        <button className="btn-ghost" onClick={() => decide("rejected")} disabled={busy}>
          Stop run
        </button>
      </div>
    </section>
  );
}
