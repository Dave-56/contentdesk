import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGa4Report } from "@/lib/analytics/ga4";
import { parseGscReport } from "@/lib/analytics/gsc";
import { parsePosthogDaily } from "@/lib/analytics/posthog";
import {
  assertNoGraphqlErrors,
  partnerAppGid,
  summarizePartnerEvents,
} from "@/lib/analytics/shopify-partner";
import { isAiReferrerSource } from "@/lib/analytics/schemas";
import { AnalyticsAuthError } from "@/lib/analytics/errors";
import {
  brandTermsForSlug,
  isProvisional,
  runAnalyticsDaily,
  sourceStatusLine,
  utcDayWindow,
  type SourceRunResult,
} from "@/lib/analytics/runner";
import { dateRange } from "../../../scripts/analytics-backfill";

test("parseGa4Report splits AI referral sessions from total", () => {
  const metrics = parseGa4Report({
    rows: [
      { dimensionValues: [{ value: "google" }], metricValues: [{ value: "40" }, { value: "30" }] },
      { dimensionValues: [{ value: "chatgpt.com" }], metricValues: [{ value: "6" }, { value: "5" }] },
      { dimensionValues: [{ value: "perplexity.ai" }], metricValues: [{ value: "2" }, { value: "2" }] },
      { dimensionValues: [{ value: "(direct)" }], metricValues: [{ value: "10" }, { value: "9" }] },
    ],
  });

  assert.equal(metrics.sessions, 58);
  assert.equal(metrics.activeUsers, 46);
  assert.equal(metrics.aiReferralSessions, 8);
  assert.deepEqual(metrics.aiReferralBySource, { "chatgpt.com": 6, "perplexity.ai": 2 });
  assert.equal(metrics.topSources[0].source, "google");
});

test("parseGa4Report handles empty report", () => {
  const metrics = parseGa4Report({});

  assert.equal(metrics.sessions, 0);
  assert.equal(metrics.aiReferralSessions, 0);
  assert.deepEqual(metrics.topSources, []);
});

test("isAiReferrerSource matches hosts case-insensitively and as substrings", () => {
  assert.equal(isAiReferrerSource("ChatGPT.com"), true);
  assert.equal(isAiReferrerSource("www.perplexity.ai / referral"), true);
  assert.equal(isAiReferrerSource("google"), false);
});

test("parseGscReport splits branded and non-branded queries", () => {
  const metrics = parseGscReport({
    report: {
      rows: [
        { keys: ["tiny lemon reviews"], clicks: 3, impressions: 20 },
        { keys: ["tinylemon shopify"], clicks: 1, impressions: 5 },
        { keys: ["best upsell app"], clicks: 2, impressions: 50 },
      ],
    },
    brandTerms: ["tiny lemon", "tinylemon"],
  });

  assert.equal(metrics.clicks, 6);
  assert.equal(metrics.impressions, 75);
  assert.equal(metrics.brandedClicks, 4);
  assert.equal(metrics.brandedImpressions, 25);
  assert.equal(metrics.nonBrandedClicks, 2);
  assert.equal(metrics.nonBrandedImpressions, 50);
  assert.equal(metrics.topQueries[0].query, "best upsell app");
});

test("summarizePartnerEvents maps event types and totals charges", () => {
  const metrics = summarizePartnerEvents({
    RELATIONSHIP_INSTALLED: 3,
    RELATIONSHIP_UNINSTALLED: 1,
    SUBSCRIPTION_CHARGE_ACCEPTED: 2,
    USAGE_CHARGE_APPLIED: 1,
  });

  assert.equal(metrics.installs, 3);
  assert.equal(metrics.uninstalls, 1);
  assert.equal(metrics.reactivations, 0);
  assert.equal(metrics.chargeEvents, 3);
});

test("assertNoGraphqlErrors throws on errors inside HTTP 200 body", () => {
  assert.throws(
    () => assertNoGraphqlErrors({ errors: [{ message: "Access denied" }] }),
    /Access denied/,
  );
  assert.doesNotThrow(() => assertNoGraphqlErrors({ data: {} }));
});

test("partnerAppGid prefixes bare ids and passes gids through", () => {
  assert.equal(partnerAppGid("123"), "gid://partners/App/123");
  assert.equal(partnerAppGid("gid://partners/App/123"), "gid://partners/App/123");
});

test("parsePosthogDaily maps the single result row", () => {
  assert.deepEqual(parsePosthogDaily({ results: [[120, 80, 35]] }), {
    eventCount: 120,
    pageviews: 80,
    uniqueUsers: 35,
  });
  assert.deepEqual(parsePosthogDaily({}), { eventCount: 0, pageviews: 0, uniqueUsers: 0 });
});

test("runAnalyticsDaily is fail-soft: every source persists a row", async () => {
  const persisted: Array<{ source: string; status: string; error?: string }> = [];
  const payload = await runAnalyticsDaily({
    metricDate: "2026-06-01",
    brandSlug: "tiny-lemon",
    now: new Date("2026-06-09T16:00:00.000Z"),
    postToSlack: false,
    fetchers: {
      ga4: async () => ({ status: "ok", metrics: { sessions: 12, aiReferralSessions: 2 } }),
      gsc: async () => ({ status: "missing_config", metrics: {}, error: "Missing env: GSC_SITE_URL" }),
      shopify_partner: async () => {
        throw new AnalyticsAuthError("Partner API rejected the token (401).");
      },
      posthog: async () => {
        throw new Error("PostHog query failed (500)");
      },
    },
    persist: async (input) => {
      persisted.push({ source: input.source, status: input.status, error: input.error });
      return {
        id: `analytics_${input.source}`,
        brandSlug: input.brandSlug,
        metricDate: input.metricDate,
        source: input.source,
        status: input.status,
        provisional: input.provisional,
        metrics: input.metrics,
        error: input.error ?? null,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        pulledAt: new Date().toISOString(),
      };
    },
  });

  assert.equal(payload.results.length, 4);
  assert.equal(persisted.length, 4);

  const bySource = Object.fromEntries(payload.results.map((result) => [result.source, result]));
  assert.equal(bySource.ga4.status, "ok");
  assert.equal(bySource.gsc.status, "missing_config");
  assert.equal(bySource.shopify_partner.status, "failed_auth");
  assert.match(bySource.shopify_partner.error ?? "", /rejected the token/);
  assert.equal(bySource.posthog.status, "failed");
  assert.match(bySource.posthog.error ?? "", /500/);
  assert.equal(payload.postedToSlack, false);
});

test("runAnalyticsDaily marks recent GA4/GSC ok rows provisional", async () => {
  const payload = await runAnalyticsDaily({
    metricDate: "2026-06-08",
    brandSlug: "tiny-lemon",
    sources: ["ga4", "posthog"],
    now: new Date("2026-06-09T16:00:00.000Z"),
    postToSlack: false,
    fetchers: {
      ga4: async () => ({ status: "ok", metrics: {} }),
      posthog: async () => ({ status: "ok", metrics: {} }),
    },
    persist: async (input) => ({
      id: "analytics_test",
      brandSlug: input.brandSlug,
      metricDate: input.metricDate,
      source: input.source,
      status: input.status,
      provisional: input.provisional,
      metrics: input.metrics,
      error: input.error ?? null,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      pulledAt: new Date().toISOString(),
    }),
  });

  const bySource = Object.fromEntries(payload.results.map((result) => [result.source, result]));
  assert.equal(bySource.ga4.provisional, true);
  assert.equal(bySource.posthog.provisional, false);
});

test("isProvisional applies only to lagging sources within the lag window", () => {
  const now = new Date("2026-06-09T16:00:00.000Z");

  assert.equal(isProvisional({ source: "ga4", metricDate: "2026-06-08", now }), true);
  assert.equal(isProvisional({ source: "gsc", metricDate: "2026-06-07", now }), true);
  assert.equal(isProvisional({ source: "ga4", metricDate: "2026-06-05", now }), false);
  assert.equal(isProvisional({ source: "posthog", metricDate: "2026-06-08", now }), false);
  assert.equal(isProvisional({ source: "shopify_partner", metricDate: "2026-06-08", now }), false);
});

test("brandTermsForSlug derives spaced and joined variants", () => {
  assert.deepEqual(brandTermsForSlug("tiny-lemon"), ["tiny lemon", "tinylemon"]);
  assert.deepEqual(brandTermsForSlug("acme"), ["acme"]);
});

test("utcDayWindow is the half-open UTC day", () => {
  assert.deepEqual(utcDayWindow("2026-06-01"), {
    windowStart: "2026-06-01T00:00:00.000Z",
    windowEnd: "2026-06-02T00:00:00.000Z",
  });
});

test("sourceStatusLine formats status, provisional flag, and headline", () => {
  const ok: SourceRunResult = {
    source: "ga4",
    status: "ok",
    provisional: true,
    metrics: { sessions: 58, aiReferralSessions: 8 },
  };
  assert.equal(sourceStatusLine(ok), "✅ ga4: ok (provisional) — 58 sessions, 8 AI-referral");

  const missing: SourceRunResult = {
    source: "posthog",
    status: "missing_config",
    provisional: false,
    metrics: {},
    error: "Missing env: POSTHOG_PERSONAL_API_KEY",
  };
  assert.equal(
    sourceStatusLine(missing),
    "⚪ posthog: missing_config — Missing env: POSTHOG_PERSONAL_API_KEY",
  );

  const failedAuth: SourceRunResult = {
    source: "shopify_partner",
    status: "failed_auth",
    provisional: false,
    metrics: {},
    error: "Partner API rejected the token (401).",
  };
  assert.equal(
    sourceStatusLine(failedAuth),
    "❌ shopify_partner: failed_auth — Partner API rejected the token (401).",
  );
});

test("dateRange is inclusive of both endpoints", () => {
  assert.deepEqual(dateRange("2026-06-01", "2026-06-03"), [
    "2026-06-01",
    "2026-06-02",
    "2026-06-03",
  ]);
  assert.deepEqual(dateRange("2026-06-01", "2026-06-01"), ["2026-06-01"]);
});
