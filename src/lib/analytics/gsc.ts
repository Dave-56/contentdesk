import { googleAccessToken } from "@/lib/analytics/google-auth";
import { AnalyticsAuthError } from "@/lib/analytics/errors";
import type { GscConfig } from "@/lib/analytics/config";

const gscScope = "https://www.googleapis.com/auth/webmasters.readonly";

type GscQueryResponse = {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
  }>;
};

export type GscDailyMetrics = {
  clicks: number;
  impressions: number;
  brandedClicks: number;
  brandedImpressions: number;
  nonBrandedClicks: number;
  nonBrandedImpressions: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; branded: boolean }>;
};

export async function fetchGscDaily(input: {
  config: GscConfig;
  metricDate: string;
  brandTerms: string[];
}): Promise<GscDailyMetrics> {
  const token = await googleAccessToken({
    serviceAccountJson: input.config.serviceAccountJson,
    scopes: [gscScope],
  });
  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      input.config.siteUrl,
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startDate: input.metricDate,
        endDate: input.metricDate,
        dimensions: ["query"],
        rowLimit: 250,
      }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new AnalyticsAuthError(
      `GSC query rejected the service account (${response.status}). Check the account is added as a user on ${input.config.siteUrl}.`,
    );
  }
  if (!response.ok) {
    throw new Error(`GSC query failed (${response.status}): ${await response.text()}`);
  }

  return parseGscReport({
    report: (await response.json()) as GscQueryResponse,
    brandTerms: input.brandTerms,
  });
}

// GSC smoke check used by scripts/analytics-smoke.ts: lists properties the
// service account can see, so a wrong/missing property surfaces before any
// deeper query code runs.
export async function listGscSites(config: GscConfig) {
  const token = await googleAccessToken({
    serviceAccountJson: config.serviceAccountJson,
    scopes: [gscScope],
  });
  const response = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new AnalyticsAuthError(`GSC sites.list failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
  };

  return (body.siteEntry ?? []).map((entry) => ({
    siteUrl: entry.siteUrl ?? "",
    permissionLevel: entry.permissionLevel ?? "unknown",
  }));
}

export function parseGscReport(input: {
  report: GscQueryResponse;
  brandTerms: string[];
}): GscDailyMetrics {
  const brandTerms = input.brandTerms.map((term) => term.toLowerCase()).filter(Boolean);
  const rows = (input.report.rows ?? []).map((row) => {
    const query = row.keys?.[0] ?? "";
    return {
      query,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      branded: brandTerms.some((term) => query.toLowerCase().includes(term)),
    };
  });
  const branded = rows.filter((row) => row.branded);
  const nonBranded = rows.filter((row) => !row.branded);

  return {
    clicks: sum(rows.map((row) => row.clicks)),
    impressions: sum(rows.map((row) => row.impressions)),
    brandedClicks: sum(branded.map((row) => row.clicks)),
    brandedImpressions: sum(branded.map((row) => row.impressions)),
    nonBrandedClicks: sum(nonBranded.map((row) => row.clicks)),
    nonBrandedImpressions: sum(nonBranded.map((row) => row.impressions)),
    topQueries: rows
      .sort((left, right) => right.impressions - left.impressions)
      .slice(0, 15),
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
