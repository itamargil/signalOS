import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { researchRun } from "@/inngest/functions/research-run";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [researchRun],
  // Local dev ignores this; prod uses the signing key (or the single API key).
  ...(process.env.NODE_ENV === "production"
    ? { signingKey: process.env.INNGEST_SIGNING_KEY || process.env.INNGEST_API_KEY }
    : {}),
});
