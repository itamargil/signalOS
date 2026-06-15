import { extractJson } from "@/lib/llm/client";
import type { EditablePrompt } from "./prompt";
import type { Platform, ProposedSource } from "@/lib/types";

/**
 * Stage 1 — the agent proposes which subreddits, accounts, hashtags and search
 * terms to track on each platform. Output is reviewed/approved by the human.
 */
export function buildDiscoveryPrompt(
  prompt: string,
  platforms: Platform[]
): EditablePrompt {
  const system = `You are a market-signal research strategist. Given a product idea,
you propose the best places to listen for genuine demand signal on the requested platforms.

For each platform pick a focused, high-signal set (quality over quantity):
- reddit: subreddits (kind "subreddit", handle like "r/homelab") and search_term queries
- x: accounts (kind "account", handle like "@username") and search_term / hashtag
- instagram: accounts (kind "account", handle like "@username") and hashtag (handle like "#tag")

Favor communities where the target user actually complains, asks for help, or shows buying intent.
Avoid generic mega-subreddits unless clearly relevant. Give a one-sentence rationale each.`;

  const lockedSuffix = `Return ONLY JSON of this shape:
{"sources":[{"platform":"reddit","kind":"subreddit","handle":"r/...","url":"https://...","rationale":"..."}]}
Aim for 4-8 sources per requested platform.`;

  const user = `Product idea:
"""
${prompt}
"""

Requested platforms: ${platforms.join(", ")}.
Propose the sources.`;

  return { system, lockedSuffix, user };
}

export function parseDiscovery(text: string, platforms: Platform[]): ProposedSource[] {
  const parsed = extractJson<{ sources: ProposedSource[] }>(text);
  return (parsed.sources || []).filter((s) => platforms.includes(s.platform));
}
