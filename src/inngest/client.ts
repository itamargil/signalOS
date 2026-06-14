import { Inngest } from "inngest";

// Local dev needs no keys — the Inngest dev server handles auth and the SDK
// routes events to it automatically. Attaching an event key would flip the SDK
// into cloud mode and send events to Inngest Cloud, so we only set it in prod.
// In production, set INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY — or a single
// INNGEST_API_KEY which we fall back to for both.
const isProd = process.env.NODE_ENV === "production";
export const inngest = new Inngest({
  id: "signalos",
  ...(isProd
    ? { eventKey: process.env.INNGEST_EVENT_KEY || process.env.INNGEST_API_KEY }
    : {}),
});

/** Event names (typed-ish helpers). */
export const EVENTS = {
  runStart: "run/start",
  approvalDecided: "run/approval.decided",
} as const;
