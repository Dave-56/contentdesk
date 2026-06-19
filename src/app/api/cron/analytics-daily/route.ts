import "@/lib/load-env";
import { NextResponse } from "next/server";
import {
  isCronAuthorized,
  isCronForceAllowed,
  shouldRunAtPacificHour,
} from "@/lib/cron";
import {
  googleLagDays,
  laggingSources,
  runAnalyticsDaily,
} from "@/lib/analytics/runner";

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

  // Optional ?date=YYYY-MM-DD overrides the metric date (with force) so prod
  // can be backfilled over HTTP — the Neon URL is sensitive-scoped in Vercel,
  // so scripts/analytics-backfill.ts can't reach prod from a laptop.
  const dateParam = url.searchParams.get("date");
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return cronJson({ state: "invalid_date", date: dateParam }, 400);
  }

  const payload = await runAnalyticsDaily({
    metricDate: dateParam && force ? dateParam : yesterdayUtc(now),
    postToSlack: true,
    now,
  });

  // GA4/GSC rows pulled inside Google's ~48h lag window land provisional and
  // are often zero; without a second pass those zeros never get corrected.
  // Re-pull the date that just aged past the window so the upsert replaces
  // them with finalized numbers. Skipped on dated backfills, which target one
  // explicit date.
  const finalizePayload =
    dateParam && force
      ? null
      : await runAnalyticsDaily({
          metricDate: daysAgoUtc(now, 1 + googleLagDays),
          sources: laggingSources,
          postToSlack: true,
          slackHeading: "Analytics finalize",
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
    finalize: finalizePayload
      ? {
          metricDate: finalizePayload.metricDate,
          postedToSlack: finalizePayload.postedToSlack,
          results: finalizePayload.results.map((result) => ({
            source: result.source,
            status: result.status,
            provisional: result.provisional,
            error: result.error,
          })),
        }
      : null,
  });
}

function yesterdayUtc(now: Date) {
  return daysAgoUtc(now, 1);
}

function daysAgoUtc(now: Date, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function cronJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}
