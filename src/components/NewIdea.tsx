"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLATFORMS = ["reddit", "x", "instagram"] as const;

export function NewIdea() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([...PLATFORMS]);
  const [trackingDays, setTrackingDays] = useState(3);
  const [samples, setSamples] = useState(6);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, title, platforms, trackingDays, samples }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      router.push(`/runs/${json.runId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <input
        className="input"
        placeholder="Short title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input min-h-[120px]"
        placeholder="Describe the product idea. The more specific the audience and problem, the sharper the signal."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={`chip cursor-pointer ${
                platforms.includes(p) ? "border-accent text-accent" : "text-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="text-xs text-muted flex items-center gap-2">
          window (days)
          <input
            type="number"
            min={1}
            className="input w-16 py-1"
            value={trackingDays}
            onChange={(e) => setTrackingDays(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-muted flex items-center gap-2">
          samples
          <input
            type="number"
            min={1}
            className="input w-16 py-1"
            value={samples}
            onChange={(e) => setSamples(Number(e.target.value))}
          />
        </label>
      </div>
      {err && <p className="text-bad text-sm">{err}</p>}
      <button className="btn" onClick={submit} disabled={busy || !prompt.trim()}>
        {busy ? "Starting…" : "Start research"}
      </button>
    </div>
  );
}
