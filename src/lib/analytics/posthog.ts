import { AnalyticsAuthError } from "@/lib/analytics/errors";
import type { PosthogConfig } from "@/lib/analytics/config";

type PosthogQueryResponse = {
  results?: Array<Array<number | string | null>>;
};

export type PosthogDailyMetrics = {
  eventCount: number;
  pageviews: number;
  uniqueUsers: number;
};

export async function fetchPosthogDaily(input: {
  config: PosthogConfig;
  metricDate: string;
}): Promise<PosthogDailyMetrics> {
  const body = await posthogQuery({
    config: input.config,
    // HogQL; date filter is inclusive day window in project timezone.
    query: [
      "select count(), countIf(event = '$pageview'), count(distinct person_id)",
      "from events",
      `where toDate(timestamp) = toDate('${input.metricDate}')`,
    ].join(" "),
  });

  return parsePosthogDaily(body);
}

export async function posthogQuery(input: {
  config: PosthogConfig;
  query: string;
}): Promise<PosthogQueryResponse> {
  const response = await fetch(
    `${input.config.host.replace(/\/$/, "")}/api/projects/${input.config.projectId}/query/`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: input.query } }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new AnalyticsAuthError(
      `PostHog query rejected the API key (${response.status}). Check POSTHOG_PERSONAL_API_KEY and project access.`,
    );
  }
  if (!response.ok) {
    throw new Error(`PostHog query failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as PosthogQueryResponse;
}

export function parsePosthogDaily(body: PosthogQueryResponse): PosthogDailyMetrics {
  const row = body.results?.[0] ?? [];

  return {
    eventCount: Number(row[0] ?? 0),
    pageviews: Number(row[1] ?? 0),
    uniqueUsers: Number(row[2] ?? 0),
  };
}
