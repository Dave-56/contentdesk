import "@/lib/load-env";
import { NextResponse } from "next/server";
import {
  isCronAuthorized,
  isCronForceAllowed,
  shouldRunAtPacificHour,
} from "@/lib/cron";
import { runAnalyticsDaily } from "@/lib/analytics/runner";

export const runtime = "nodejs";

// Runs after prompt-lab (8 PT) so the Slack channel reads scan-then-metrics.
const analyticsCronPacificHour = 9;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authorized = isCronAuthorized({
    authorization: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
  });

  if (!authorized) {
    return cronJson({ state: "unauthorized" }, 401);
  }

  const force = isCronForceAllowed({
    forceParam: url.searchParams.get("force"),
    testForceHeader: request.headers.get("x-cron-test-force"),
    nodeEnv: process.env.NODE_ENV,
  });
  const now = new Date();

  if (!shouldRunAtPacificHour({ hour: analyticsCronPacificHour, force, now })) {
    return cronJson({
      state: "skipped_wrong_hour",
      force,
      now: now.toISOString(),
    });
  }

  const payload = await runAnalyticsDaily({
    metricDate: yesterdayUtc(now),
    postToSlack: true,
    now,
  });

  return cronJson({
    state: payload.results.every((result) => result.status === "ok")
      ? "completed"
      : payload.results.some((result) => result.status === "ok")
        ? "partial"
        : "failed",
    force,
    brandSlug: payload.brandSlug,
    metricDate: payload.metricDate,
    postedToSlack: payload.postedToSlack,
    results: payload.results.map((result) => ({
      source: result.source,
      status: result.status,
      provisional: result.provisional,
      error: result.error,
    })),
  });
}

function yesterdayUtc(now: Date) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function cronJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}
