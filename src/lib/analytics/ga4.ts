import { googleAccessToken } from "@/lib/analytics/google-auth";
import { AnalyticsAuthError } from "@/lib/analytics/errors";
import { isAiReferrerSource } from "@/lib/analytics/schemas";
import type { Ga4Config } from "@/lib/analytics/config";

const ga4Scope = "https://www.googleapis.com/auth/analytics.readonly";

type Ga4ReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

export type Ga4DailyMetrics = {
  sessions: number;
  activeUsers: number;
  aiReferralSessions: number;
  aiReferralBySource: Record<string, number>;
  topSources: Array<{ source: string; sessions: number }>;
};

export async function fetchGa4Daily(input: {
  config: Ga4Config;
  metricDate: string;
}): Promise<Ga4DailyMetrics> {
  const token = await googleAccessToken({
    serviceAccountJson: input.config.serviceAccountJson,
    scopes: [ga4Scope],
  });
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${input.config.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: input.metricDate, endDate: input.metricDate }],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: 250,
      }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new AnalyticsAuthError(
      `GA4 runReport rejected the service account (${response.status}). Check Viewer access on property ${input.config.propertyId}.`,
    );
  }
  if (!response.ok) {
    throw new Error(`GA4 runReport failed (${response.status}): ${await response.text()}`);
  }

  return parseGa4Report((await response.json()) as Ga4ReportResponse);
}

export function parseGa4Report(report: Ga4ReportResponse): Ga4DailyMetrics {
  const bySource = (report.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? "(unknown)",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
    activeUsers: Number(row.metricValues?.[1]?.value ?? 0),
  }));
  const aiRows = bySource.filter((row) => isAiReferrerSource(row.source));
  const aiReferralBySource: Record<string, number> = {};
  for (const row of aiRows) {
    aiReferralBySource[row.source] = (aiReferralBySource[row.source] ?? 0) + row.sessions;
  }

  return {
    sessions: sum(bySource.map((row) => row.sessions)),
    activeUsers: sum(bySource.map((row) => row.activeUsers)),
    aiReferralSessions: sum(aiRows.map((row) => row.sessions)),
    aiReferralBySource,
    topSources: bySource
      .sort((left, right) => right.sessions - left.sessions)
      .slice(0, 10)
      .map(({ source, sessions }) => ({ source, sessions })),
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
