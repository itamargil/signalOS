import { complete } from "@/lib/llm/client";

/**
 * A prompt the user can review and edit at a gate. `system` and `user` are
 * editable; `lockedSuffix` (the output-format / JSON-shape instruction) is shown
 * read-only and always appended to the system prompt, so edits can't break
 * downstream parsing.
 */
export interface EditablePrompt {
  system: string;
  lockedSuffix: string;
  user: string;
}

export interface PromptCtx {
  runId: string;
  ideaId?: string | null;
  stage: string;
  purpose: string;
  maxTokens?: number;
}

/** Assemble the final prompt (system + locked suffix) and run it. */
export async function runPrompt(p: EditablePrompt, ctx: PromptCtx): Promise<string> {
  const system = p.lockedSuffix ? `${p.system}\n\n${p.lockedSuffix}` : p.system;
  const { text } = await complete({
    runId: ctx.runId,
    ideaId: ctx.ideaId,
    stage: ctx.stage,
    purpose: ctx.purpose,
    system,
    messages: [{ role: "user", content: p.user }],
    maxTokens: ctx.maxTokens ?? 4000,
  });
  return text;
}

/** Merge user edits onto a freshly-built prompt (locked suffix never changes). */
export function applyPromptEdits(
  base: EditablePrompt,
  edits?: { system?: string; user?: string } | null
): EditablePrompt {
  if (!edits) return base;
  return {
    system: typeof edits.system === "string" ? edits.system : base.system,
    user: typeof edits.user === "string" ? edits.user : base.user,
    lockedSuffix: base.lockedSuffix,
  };
}
