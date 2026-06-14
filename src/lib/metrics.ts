/** Engagement velocity helpers — the real signal lives in the deltas. */

export interface SamplePoint {
  captured_at: string;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  views?: number | null;
  score?: number | null;
  followers?: number | null;
}

const FIELDS = ["likes", "comments", "shares", "views", "score", "followers"] as const;

/** Change per hour between first and last sample, per metric. */
export function velocity(samples: SamplePoint[]): Record<string, number> {
  if (samples.length < 2) return {};
  const sorted = [...samples].sort(
    (a, b) => +new Date(a.captured_at) - +new Date(b.captured_at)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const hours =
    (+new Date(last.captured_at) - +new Date(first.captured_at)) / 3_600_000;
  if (hours <= 0) return {};
  const out: Record<string, number> = {};
  for (const f of FIELDS) {
    const a = first[f];
    const b = last[f];
    if (a != null && b != null) out[f] = +((b - a) / hours).toFixed(2);
  }
  return out;
}

export function latest(samples: SamplePoint[]): Record<string, number | undefined> {
  if (samples.length === 0) return {};
  const last = [...samples].sort(
    (a, b) => +new Date(a.captured_at) - +new Date(b.captured_at)
  )[samples.length - 1];
  const out: Record<string, number | undefined> = {};
  for (const f of FIELDS) out[f] = last[f] ?? undefined;
  return out;
}

export function first(samples: SamplePoint[]): Record<string, number | undefined> {
  if (samples.length === 0) return {};
  const f0 = [...samples].sort(
    (a, b) => +new Date(a.captured_at) - +new Date(b.captured_at)
  )[0];
  const out: Record<string, number | undefined> = {};
  for (const f of FIELDS) out[f] = f0[f] ?? undefined;
  return out;
}
