import "@/lib/load-env";
import {
  ga4Config,
  gscConfig,
  posthogConfig,
  shopifyPartnerConfig,
} from "@/lib/analytics/config";
import { fetchGa4Daily } from "@/lib/analytics/ga4";
import { listGscSites } from "@/lib/analytics/gsc";
import { posthogQuery } from "@/lib/analytics/posthog";
import { partnerAppGid, partnerGraphql } from "@/lib/analytics/shopify-partner";
import { analyticsSources } from "@/lib/analytics/runner";
import type { AnalyticsSource } from "@/lib/analytics/schemas";

// Per-source config + auth smoke. Run before the first cron/backfill so a bad
// key or missing grant surfaces here, not as failed_auth rows at 9 PT.
//
// Usage: npm run analytics:smoke

type SmokeResult = { source: AnalyticsSource; ok: boolean; detail: string };

async function main() {
  const results: SmokeResult[] = [];
  for (const source of analyticsSources) {
    results.push(await smokeSource(source));
  }

  for (const result of results) {
    console.log(`[analytics:smoke] ${result.ok ? "✅" : "❌"} ${result.source}: ${result.detail}`);
  }

  process.exit(results.every((result) => result.ok) ? 0 : 1);
}

async function smokeSource(source: AnalyticsSource): Promise<SmokeResult> {
  try {
    if (source === "ga4") return await smokeGa4();
    if (source === "gsc") return await smokeGsc();
    if (source === "shopify_partner") return await smokeShopifyPartner();
    return await smokePosthog();
  } catch (error) {
    return {
      source,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function smokeGa4(): Promise<SmokeResult> {
  const resolved = ga4Config();
  if (!resolved.config) return missingConfig("ga4", resolved.missing);

  // 3 days back clears the GA4 data lag; an empty day still proves auth.
  const metrics = await fetchGa4Daily({
    config: resolved.config,
    metricDate: daysAgoUtc(3),
  });

  return {
    source: "ga4",
    ok: true,
    detail: `runReport ok for ${daysAgoUtc(3)} (${metrics.sessions} sessions)`,
  };
}

async function smokeGsc(): Promise<SmokeResult> {
  const resolved = gscConfig();
  if (!resolved.config) return missingConfig("gsc", resolved.missing);

  const sites = await listGscSites(resolved.config);
  const target = resolved.config.siteUrl;
  const match = sites.find((site) => site.siteUrl === target);

  if (!match) {
    return {
      source: "gsc",
      ok: false,
      detail: `service account sees ${sites.length} site(s) [${sites
        .map((site) => site.siteUrl)
        .join(", ")}] but not GSC_SITE_URL=${target}. Add the account as a user on that property.`,
    };
  }

  return {
    source: "gsc",
    ok: true,
    detail: `sites.list ok, ${target} visible (${match.permissionLevel})`,
  };
}

async function smokeShopifyPartner(): Promise<SmokeResult> {
  const resolved = shopifyPartnerConfig();
  if (!resolved.config) return missingConfig("shopify_partner", resolved.missing);

  const body = await partnerGraphql({
    config: resolved.config,
    query: "query AppSmoke($appId: ID!) { app(id: $appId) { id name } }",
    variables: { appId: partnerAppGid(resolved.config.appId) },
  });
  const app = body.data?.app as { id?: string; name?: string } | null | undefined;

  if (!app) {
    return {
      source: "shopify_partner",
      ok: false,
      detail: `token accepted but app ${partnerAppGid(resolved.config.appId)} not found. Check SHOPIFY_PARTNER_APP_ID and org access.`,
    };
  }

  return {
    source: "shopify_partner",
    ok: true,
    detail: `app query ok (${app.name ?? app.id})`,
  };
}

async function smokePosthog(): Promise<SmokeResult> {
  const resolved = posthogConfig();
  if (!resolved.config) return missingConfig("posthog", resolved.missing);

  await posthogQuery({ config: resolved.config, query: "select 1" });

  return { source: "posthog", ok: true, detail: "HogQL query ok" };
}

function missingConfig(source: AnalyticsSource, missing: string[]): SmokeResult {
  return { source, ok: false, detail: `missing env: ${missing.join(", ")}` };
}

function daysAgoUtc(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error(`[analytics:smoke] failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
