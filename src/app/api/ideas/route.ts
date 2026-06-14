import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
import { inngest, EVENTS } from "@/inngest/client";
import { logActivity } from "@/lib/activity";
import type { Platform } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt: string = (body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const title: string | null = body.title?.trim() || null;
  const platforms: Platform[] = Array.isArray(body.platforms) && body.platforms.length
    ? body.platforms
    : ["reddit", "x", "instagram"];
  const trackingDays = Number(body.trackingDays) || 3;
  const samples = Number(body.samples) || 6;

  // 1. idea
  const { data: idea, error: ideaErr } = await db()
    .from("ideas")
    .insert({ prompt, title, status: "researching" })
    .select()
    .single();
  if (ideaErr || !idea) {
    return NextResponse.json({ error: ideaErr?.message || "insert failed" }, { status: 500 });
  }

  // 2. run
  const { data: run, error: runErr } = await db()
    .from("runs")
    .insert({
      idea_id: idea.id,
      status: "pending",
      stage: "created",
      config: { platforms, trackingDays, samples },
    })
    .select()
    .single();
  if (runErr || !run) {
    return NextResponse.json({ error: runErr?.message || "run insert failed" }, { status: 500 });
  }

  await logActivity(run.id, "info", "Run created", { platforms, trackingDays, samples });

  // 3. kick off the durable workflow
  await inngest.send({ name: EVENTS.runStart, data: { runId: run.id } });

  return NextResponse.json({ ideaId: idea.id, runId: run.id });
}
