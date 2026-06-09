import "@/lib/load-env";
import { NextResponse } from "next/server";
import {
  isCronAuthorized,
  isPromptLabCronForceAllowed,
  shouldRunAtPacificEight,
  type PromptLabCronState,
} from "@/lib/prompt-lab-cron";
import { runPromptLabDaily } from "@/lib/prompt-lab-runner";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authorized = isCronAuthorized({
    authorization: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
  });

  if (!authorized) {
    return cronJson({ state: "unauthorized" }, 401);
  }

  const force = isPromptLabCronForceAllowed({
    forceParam: url.searchParams.get("force"),
    testForceHeader: request.headers.get("x-cron-test-force"),
    nodeEnv: process.env.NODE_ENV,
  });
  const now = new Date();

  if (!shouldRunAtPacificEight({ force, now })) {
    return cronJson({
      state: "skipped_wrong_hour",
      force,
      now: now.toISOString(),
    });
  }

  const payload = await runPromptLabDaily({ force, runDate: now });
  const dailyStatus = payload.daily?.today.status ?? "failed";
  const state = cronStateFromRun({
    dailyStatus,
    skippedReason: payload.skippedReason,
  });

  return cronJson({
    state,
    force,
    daily: payload.daily,
    questions: payload.questions,
  });
}

function cronStateFromRun(input: {
  dailyStatus: "not_started" | "running" | "completed" | "partial" | "failed";
  skippedReason?: "already_running" | "already_completed" | "already_done";
}): PromptLabCronState {
  if (input.skippedReason === "already_running") return "skipped_already_running";
  if (input.skippedReason === "already_completed" || input.skippedReason === "already_done") {
    return "skipped_already_completed";
  }
  if (input.dailyStatus === "completed") return "completed";
  if (input.dailyStatus === "partial") return "partial";
  if (input.dailyStatus === "failed") return "failed";
  return "started";
}

function cronJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}
