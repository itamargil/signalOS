import { Resend } from "resend";

let _resend: Resend | null = null;
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export async function sendEmail(subject: string, html: string) {
  const r = resend();
  const to = process.env.NOTIFY_EMAIL_TO;
  const from = process.env.NOTIFY_EMAIL_FROM || "SignalOS <onboarding@resend.dev>";
  if (!r || !to) {
    console.warn("[email] RESEND_API_KEY/NOTIFY_EMAIL_TO not set; skipping:", subject);
    return;
  }
  try {
    await r.emails.send({ from, to, subject, html });
  } catch (e) {
    console.error("[email] send failed:", e);
  }
}

export async function notifyApproval(args: {
  runId: string;
  ideaTitle: string;
  stage: string;
  count: number;
}) {
  const url = `${process.env.APP_URL || "http://localhost:3000"}/runs/${args.runId}`;
  await sendEmail(
    `SignalOS · approval needed (${args.stage}) — ${args.ideaTitle}`,
    `<div style="font-family:system-ui;max-width:520px">
      <h2 style="margin:0 0 8px">Approval needed: ${args.stage}</h2>
      <p style="color:#555">The research agent for <b>${args.ideaTitle}</b> has
      ${args.count} item(s) waiting for your review before it continues.</p>
      <p><a href="${url}" style="background:#5b8cff;color:#fff;padding:10px 16px;
      border-radius:8px;text-decoration:none;display:inline-block">Review in dashboard →</a></p>
      <p style="color:#999;font-size:12px">${url}</p>
    </div>`
  );
}

export async function notifyReport(args: { runId: string; ideaTitle: string }) {
  const url = `${process.env.APP_URL || "http://localhost:3000"}/runs/${args.runId}`;
  await sendEmail(
    `SignalOS · report ready — ${args.ideaTitle}`,
    `<div style="font-family:system-ui;max-width:520px">
      <h2 style="margin:0 0 8px">Signal report ready</h2>
      <p style="color:#555">Research for <b>${args.ideaTitle}</b> is complete.</p>
      <p><a href="${url}" style="background:#3fb950;color:#fff;padding:10px 16px;
      border-radius:8px;text-decoration:none;display:inline-block">Read the report →</a></p>
    </div>`
  );
}
