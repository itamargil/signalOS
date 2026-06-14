"use client";

import { useEffect, useRef, useState } from "react";

interface Row {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

const COLOR: Record<string, string> = {
  llm: "text-accent",
  actor: "text-warn",
  fetch: "text-[#56b6c2]",
  sample: "text-ok",
  analysis: "text-accent",
  report: "text-ok",
  stage_change: "text-white font-semibold",
  approval_requested: "text-warn",
  approval_decided: "text-ok",
  error: "text-bad",
  info: "text-muted",
};

const DONE = new Set(["completed", "failed", "cancelled"]);

function time(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

export function LiveTail({
  runId,
  initial,
  initialStatus,
}: {
  runId: string;
  initial: Row[];
  initialStatus: string;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [status, setStatus] = useState(initialStatus);
  const boxRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set(initial.map((r) => r.id)));

  const active = !DONE.has(status);

  useEffect(() => {
    if (!active) return;
    let stop = false;

    async function poll() {
      const since = rows.length ? rows[rows.length - 1].created_at : "";
      try {
        const res = await fetch(
          `/api/runs/${runId}/activity?since=${encodeURIComponent(since)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        const fresh: Row[] = (json.activity || []).filter(
          (r: Row) => !seen.current.has(r.id)
        );
        if (fresh.length) {
          fresh.forEach((r) => seen.current.add(r.id));
          setRows((cur) => [...cur, ...fresh]);
        }
        if (json.status) setStatus(json.status);
      } catch {
        /* transient; try again next tick */
      }
    }

    const iv = setInterval(() => {
      if (!stop) poll();
    }, 1500);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [runId, active, rows]);

  // auto-scroll to bottom on new rows
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge bg-ink">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-bad/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
        </span>
        <span className="text-xs text-muted ml-1">agent activity</span>
        <span className="ml-auto text-xs flex items-center gap-1.5">
          {active ? (
            <>
              <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
              <span className="text-ok">live</span>
            </>
          ) : (
            <span className="text-muted">{status}</span>
          )}
        </span>
      </div>
      <div
        ref={boxRef}
        className="font-mono text-xs leading-relaxed p-3 max-h-96 overflow-auto bg-ink"
      >
        {rows.length === 0 && (
          <div className="text-muted">waiting for the agent to start…</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="whitespace-pre-wrap">
            <span className="text-edge select-none">{time(r.created_at)} </span>
            <span className={COLOR[r.type] || "text-muted"}>{r.message}</span>
          </div>
        ))}
        {active && (
          <div className="text-accent animate-pulse">▌</div>
        )}
      </div>
    </div>
  );
}
