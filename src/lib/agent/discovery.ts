import { complete, extractJson } from "@/lib/llm/client";
import type { Platform, ProposedSource } from "@/lib/types";

/**
 * Stage 1 — the agent reads the idea and proposes which subreddits,
 * accounts, hashtags and search terms to track on each platform.
 * Output is reviewed/approved by the human before any tracking starts.
 */
export async function proposeSources(args: {
  runId: string;
  ideaId: string;
  prompt: string;
  platforms: Platform[];
}): Promise<ProposedSource[]> {
  const system = `You are a market-signal research strategist. Given a product idea,
you propose the best places to listen for genuine demand signal on the requested platforms.

For each platform pick a focused, high-signal set (quality over quantity):
- reddit: subreddits (kind "subreddit", handle like "r/homelab") and search_term queries
- x: accounts (kind "account", handle like "@username") and search_term / hashtag
- instagram: accounts (kind "account", handle like "@username") and hashtag (handle like "#tag")

Favor communities where the target user actually complains, asks for help, or shows buying intent.
Avoid generic mega-subreddits unless clearly relevant. Give a one-sentence rationale each.

Return ONLY JSON of this shape:
{"sources":[{"platform":"reddit","kind":"subreddit","handle":"r/...","url":"https://...","rationale":"..."}]}
Aim for 4-8 sources per requested platform.`;

  const user = `Product idea:
"""
${args.prompt}
"""

Requested platforms: ${args.platforms.join(", ")}.
Propose the sources.`;

  const { text } = await complete({
    runId: args.runId,
    ideaId: args.ideaId,
    stage: "discovery",
    purpose: "propose_sources",
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 2000,
  });

  const parsed = extractJson<{ sources: ProposedSource[] }>(text);
  return (parsed.sources || []).filter((s) =>
    args.platforms.includes(s.platform)
  );
}
