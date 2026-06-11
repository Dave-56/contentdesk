import "@/lib/load-env";
import {
  analyticsSources,
  runAnalyticsDaily,
  sourceStatusLine,
} from "@/lib/analytics/runner";
import { analyticsSourceSchema, type AnalyticsSource } from "@/lib/analytics/schemas";

// Backfill analytics_daily_metrics over a date range. Rerunnable: rows upsert
// on (brand_slug, metric_date, source). First growth brief needs 7+ days.
//
// Usage:
//   npm run analytics:backfill -- --from 2026-06-01 --to 2026-06-08
//   npm run analytics:backfill -- --from 2026-06-01 --to 2026-06-08 --source ga4,gsc
//   npm run analytics:backfill -- --from 2026-06-01 --to 2026-06-08 --brand tiny-lemon --slack

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dates = dateRange(args.from, args.to);

  console.log(
    `[analytics:backfill] ${dates.length} day(s) ${args.from}..${args.to}, sources ${
      args.sources?.join(",") ?? analyticsSources.join(",")
    }, slack ${args.slack ? "yes" : "no"}`,
  );

  let failures = 0;

  for (const metricDate of dates) {
    const payload = await runAnalyticsDaily({
      metricDate,
      brandSlug: args.brand,
      sources: args.sources,
      postToSlack: args.slack,
    });

    for (const result of payload.results) {
      if (result.status !== "ok") failures += 1;
      console.log(`[analytics:backfill] ${metricDate} ${sourceStatusLine(result)}`);
    }
  }

  console.log(`[analytics:backfill] done, ${failures} non-ok source-day(s)`);
  process.exit(failures > 0 ? 1 : 0);
}

function parseArgs(argv: string[]) {
  let from: string | undefined;
  let to: string | undefined;
  let brand: string | undefined;
  let sources: AnalyticsSource[] | undefined;
  let slack = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--from") from = requireDateArg(argv[++index], "--from");
    else if (arg === "--to") to = requireDateArg(argv[++index], "--to");
    else if (arg === "--brand") brand = argv[++index];
    else if (arg === "--source") sources = parseSources(argv[++index]);
    else if (arg === "--slack") slack = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!from || !to) {
    throw new Error("Required: --from YYYY-MM-DD --to YYYY-MM-DD");
  }
  if (from > to) throw new Error(`--from ${from} is after --to ${to}`);

  return { from, to, brand, sources, slack };
}

function requireDateArg(value: string | undefined, flag: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${flag} requires a YYYY-MM-DD date, got: ${value ?? "(missing)"}`);
  }
  return value;
}

function parseSources(value: string | undefined): AnalyticsSource[] {
  if (!value) throw new Error("--source requires a comma-separated list");
  return value.split(",").map((source) => analyticsSourceSchema.parse(source.trim()));
}

export function dateRange(from: string, to: string) {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

const isDirectRun = process.argv[1]?.includes("analytics-backfill");
if (isDirectRun) {
  main().catch((error) => {
    console.error(`[analytics:backfill] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
