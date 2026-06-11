import { AnalyticsAuthError } from "@/lib/analytics/errors";
import type { ShopifyPartnerConfig } from "@/lib/analytics/config";

// Partner API (https://shopify.dev/docs/api/partner/latest): versioned
// GraphQL at partners.shopify.com/{org}/api/{version}/graphql.json with
// X-Shopify-Access-Token. Requires a Partner API client with the
// "Manage apps" permission. GraphQL errors arrive in HTTP 200 bodies, so an
// errors array is always treated as failure.

const installEventTypes = [
  "RELATIONSHIP_INSTALLED",
  "RELATIONSHIP_UNINSTALLED",
  "RELATIONSHIP_REACTIVATED",
  "RELATIONSHIP_DEACTIVATED",
] as const;
const chargeEventTypes = [
  "ONE_TIME_CHARGE_ACCEPTED",
  "SUBSCRIPTION_CHARGE_ACCEPTED",
  "USAGE_CHARGE_APPLIED",
] as const;

const appEventsQuery = `
query AppEvents($appId: ID!, $occurredAtMin: DateTime, $occurredAtMax: DateTime, $types: [AppEventTypes!], $after: String) {
  app(id: $appId) {
    id
    events(first: 100, occurredAtMin: $occurredAtMin, occurredAtMax: $occurredAtMax, types: $types, after: $after) {
      edges {
        cursor
        node {
          type
          occurredAt
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
}
`;

type PartnerGraphqlBody = {
  data?: {
    app?: {
      events?: {
        edges?: Array<{
          cursor?: string;
          node?: { type?: string; occurredAt?: string };
        }>;
        pageInfo?: { hasNextPage?: boolean };
      };
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

export type ShopifyPartnerDailyMetrics = {
  installs: number;
  uninstalls: number;
  reactivations: number;
  deactivations: number;
  chargeEvents: number;
  eventsByType: Record<string, number>;
};

export async function fetchShopifyPartnerDaily(input: {
  config: ShopifyPartnerConfig;
  windowStart: string;
  windowEnd: string;
}): Promise<ShopifyPartnerDailyMetrics> {
  const eventsByType: Record<string, number> = {};
  let after: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const body = await partnerGraphql({
      config: input.config,
      query: appEventsQuery,
      variables: {
        appId: partnerAppGid(input.config.appId),
        occurredAtMin: input.windowStart,
        occurredAtMax: input.windowEnd,
        types: [...installEventTypes, ...chargeEventTypes],
        after: after ?? null,
      },
    });
    const events = body.data?.app?.events;
    if (!body.data?.app) {
      throw new Error(
        `Partner API returned no app for ${partnerAppGid(input.config.appId)}. Check SHOPIFY_PARTNER_APP_ID.`,
      );
    }

    for (const edge of events?.edges ?? []) {
      const type = edge.node?.type ?? "UNKNOWN";
      eventsByType[type] = (eventsByType[type] ?? 0) + 1;
      after = edge.cursor ?? after;
    }
    if (!events?.pageInfo?.hasNextPage) break;
  }

  return summarizePartnerEvents(eventsByType);
}

export async function partnerGraphql(input: {
  config: ShopifyPartnerConfig;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<PartnerGraphqlBody> {
  const response = await fetch(
    `https://partners.shopify.com/${input.config.organizationId}/api/${input.config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": input.config.token,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: input.query, variables: input.variables ?? {} }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new AnalyticsAuthError(
      `Partner API rejected the token (${response.status}). Check the API client has the "Manage apps" permission.`,
    );
  }
  if (!response.ok) {
    throw new Error(`Partner API request failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as PartnerGraphqlBody;
  assertNoGraphqlErrors(body);

  return body;
}

export function assertNoGraphqlErrors(body: PartnerGraphqlBody) {
  if (body.errors && body.errors.length > 0) {
    const messages = body.errors.map((error) => error.message ?? "unknown error");
    throw new Error(`Partner API GraphQL errors: ${messages.join("; ")}`);
  }
}

export function summarizePartnerEvents(
  eventsByType: Record<string, number>,
): ShopifyPartnerDailyMetrics {
  return {
    installs: eventsByType.RELATIONSHIP_INSTALLED ?? 0,
    uninstalls: eventsByType.RELATIONSHIP_UNINSTALLED ?? 0,
    reactivations: eventsByType.RELATIONSHIP_REACTIVATED ?? 0,
    deactivations: eventsByType.RELATIONSHIP_DEACTIVATED ?? 0,
    chargeEvents: chargeEventTypes.reduce(
      (total, type) => total + (eventsByType[type] ?? 0),
      0,
    ),
    eventsByType,
  };
}

export function partnerAppGid(appId: string) {
  return appId.startsWith("gid://") ? appId : `gid://partners/App/${appId}`;
}
