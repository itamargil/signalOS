import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { researchRun } from "@/inngest/functions/research-run";

// Each Inngest step runs as one invocation of this route. Apify scrapes can
// take a while, so request the max duration. Vercel caps this by plan
// (Hobby 60s, Pro 300s); steps are split per-source to stay within bounds.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [researchRun],
  // Local dev ignores this; prod uses the signing key (or the single API key).
  ...(process.env.NODE_ENV === "production"
    ? { signingKey: process.env.INNGEST_SIGNING_KEY || process.env.INNGEST_API_KEY }
    : {}),
});
