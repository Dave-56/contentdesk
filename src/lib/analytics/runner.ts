import "@/lib/load-env";
import { getEnv } from "@/lib/env";
import { postManagerMessage } from "@/lib/slack";
import { AnalyticsAuthError } from "@/lib/analytics/errors";
import {
  analyticsBrandSlug,
  ga4Config,
  gscConfig,
  posthogConfig,
  shopifyPartnerConfig,
} from "@/lib/analytics/config";
import { fetchGa4Daily } from "@/lib/analytics/ga4";
import { fetchGscDaily } from "@/lib/analytics/gsc";
import { fetchPosthogDaily } from "@/lib/analytics/posthog";
import { fetchShopifyPartnerDaily } from "@/lib/analytics/shopify-partner";
import { upsertAnalyticsDailyMetric } from "@/lib/analytics/store";
import type {
  AnalyticsSource,
  AnalyticsSourceStatus,
  SourceFetchResult,
} from "@/lib/analytics/schemas";

export const analyticsSources: AnalyticsSource[] = [
  "ga4",
  "gsc",
  "shopify_partner",
  "posthog",
];

// GA4 and GSC daily data can lag up to ~48h; rows pulled inside that window
// are marked provisional so the growth brief can label them.
export const googleLagDays = 2;
export const laggingSources: AnalyticsSource[] = ["ga4", "gsc"];

export type SourceRunResult = {
  source: AnalyticsSource;
  status: AnalyticsSourceStatus;
  provisional: boolean;
  metrics: Record<string, unknown>;
  error?: string;
};

export type AnalyticsDailyRunPayload = {
  brandSlug: string;
  metricDate: string;
  results: SourceRunResult[];
  postedToSlack: boolean;
};

export type SourceFetcher = (input: {
  metricDate: string;
  windowStart: string;
  windowEnd: string;
}) => Promise<SourceFetchResult>;

export async function runAnalyticsDaily(input: {
  metricDate: string;
  brandSlug?: string;
  sources?: AnalyticsSource[];
  postToSlack?: boolean;
  slackHeading?: string;
  now?: Date;
  fetchers?: Partial<Record<AnalyticsSource, SourceFetcher>>;
  persist?: typeof upsertAnalyticsDailyMetric;
}): Promise<AnalyticsDailyRunPayload> {
  const brandSlug = input.brandSlug ?? analyticsBrandSlug();
  const sources = input.sources ?? analyticsSources;
  const now = input.now ?? new Date();
  const persist = input.persist ?? upsertAnalyticsDailyMetric;
  const { windowStart, windowEnd } = utcDayWindow(input.metricDate);
  const results: SourceRunResult[] = [];

  for (const source of sources) {
    const fetcher = input.fetchers?.[source] ?? defaultFetchers(brandSlug)[source];
    const fetched = await runSource({
      fetcher,
      metricDate: input.metricDate,
      windowStart,
      windowEnd,
    });
    const result: SourceRunResult = {
      source,
      ...fetched,
      provisional:
        fetched.status === "ok" &&
        isProvisional({ source, metricDate: input.metricDate, now }),
    };
    results.push(result);

    await persist({
      brandSlug,
      metricDate: input.metricDate,
      source,
      status: result.status,
      provisional: result.provisional,
      metrics: result.metrics,
      error: result.error,
      windowStart,
      windowEnd,
    });
  }

  const postedToSlack = input.postToSlack
    ? await postRunStatusToSlack({
        brandSlug,
        metricDate: input.metricDate,
        results,
        heading: input.slackHeading,
      })
    : false;

  return { brandSlug, metricDate: input.metricDate, results, postedToSlack };
}

async function runSource(input: {
  fetcher: SourceFetcher;
  metricDate: string;
  windowStart: string;
  windowEnd: string;
}): Promise<SourceFetchResult> {
  try {
    return await input.fetcher({
      metricDate: input.metricDate,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
    });
  } catch (error) {
    if (error instanceof AnalyticsAuthError) {
      return { status: "failed_auth", metrics: {}, error: error.message };
    }
    return {
      status: "failed",
      metrics: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function defaultFetchers(brandSlug: string): Record<AnalyticsSource, SourceFetcher> {
  return {
    ga4: async ({ metricDate }) => {
      const resolved = ga4Config();
      if (!resolved.config) return missingConfigResult(resolved.missing);
      const metrics = await fetchGa4Daily({ config: resolved.config, metricDate });
      return { status: "ok", metrics };
    },
    gsc: async ({ metricDate }) => {
      const resolved = gscConfig();
      if (!resolved.config) return missingConfigResult(resolved.missing);
      const metrics = await fetchGscDaily({
        config: resolved.config,
        metricDate,
        brandTerms: brandTermsForSlug(brandSlug),
      });
      return { status: "ok", metrics };
    },
    shopify_partner: async ({ windowStart, windowEnd }) => {
      const resolved = shopifyPartnerConfig();
      if (!resolved.config) return missingConfigResult(resolved.missing);
      const metrics = await fetchShopifyPartnerDaily({
        config: resolved.config,
        windowStart,
        windowEnd,
      });
      return { status: "ok", metrics };
    },
    posthog: async ({ metricDate }) => {
      const resolved = posthogConfig();
      if (!resolved.config) return missingConfigResult(resolved.missing);
      const metrics = await fetchPosthogDaily({ config: resolved.config, metricDate });
      return { status: "ok", metrics };
    },
  };
}

function missingConfigResult(missing: string[]): SourceFetchResult {
  return {
    status: "missing_config",
    metrics: {},
    error: `Missing env: ${missing.join(", ")}`,
  };
}

export function brandTermsForSlug(brandSlug: string) {
  const spaced = brandSlug.replace(/[-_]+/g, " ").trim();
  const joined = spaced.replace(/\s+/g, "");
  return [...new Set([spaced, joined])].filter(Boolean);
}

export function isProvisional(input: {
  source: AnalyticsSource;
  metricDate: string;
  now: Date;
}) {
  if (!laggingSources.includes(input.source)) return false;
  const metricMs = Date.parse(`${input.metricDate}T00:00:00.000Z`);
  const ageDays = (input.now.getTime() - metricMs) / (24 * 60 * 60 * 1000);
  return ageDays < googleLagDays + 1;
}

export function utcDayWindow(metricDate: string) {
  const start = new Date(`${metricDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { windowStart: start.toISOString(), windowEnd: end.toISOString() };
}

// No silent zeros: every source posts its status, and failures carry the
// error line so the fix is visible from Slack. Fail-soft: rows are already
// persisted by the time this runs, so a Slack error (bot not invited,
// channel archived) must not fail the run.
export async function postRunStatusToSlack(input: {
  brandSlug: string;
  metricDate: string;
  results: SourceRunResult[];
  heading?: string;
}) {
  const channelId = getEnv().ANALYTICS_SLACK_CHANNEL_ID;
  if (!channelId) return false;

  try {
    await postManagerMessage({
      channelId,
      text: `${input.heading ?? "Analytics daily pull"} · ${input.brandSlug} · ${input.metricDate}\n${input.results
        .map((result) => sourceStatusLine(result))
        .join("\n")}`,
    });
  } catch (error) {
    console.error(
      `[analytics] Slack status post failed: ${error instanceof Error ? error.message : error}`,
    );
    return false;
  }

  return true;
}

export function sourceStatusLine(result: SourceRunResult) {
  const icon =
    result.status === "ok" ? "✅" : result.status === "missing_config" ? "⚪" : "❌";
  const headline = result.status === "ok" ? headlineForSource(result) : result.error ?? "";
  const provisional = result.provisional ? " (provisional)" : "";

  return `${icon} ${result.source}: ${result.status}${provisional}${headline ? ` — ${headline}` : ""}`;
}

function headlineForSource(result: SourceRunResult) {
  const metrics = result.metrics as Record<string, number>;
  if (result.source === "ga4") {
    return `${metrics.sessions ?? 0} sessions, ${metrics.aiReferralSessions ?? 0} AI-referral`;
  }
  if (result.source === "gsc") {
    return `${metrics.impressions ?? 0} impressions (${metrics.brandedImpressions ?? 0} branded), ${metrics.clicks ?? 0} clicks`;
  }
  if (result.source === "shopify_partner") {
    return `${metrics.installs ?? 0} installs, ${metrics.uninstalls ?? 0} uninstalls`;
  }
  return `${metrics.eventCount ?? 0} events, ${metrics.uniqueUsers ?? 0} users`;
}
