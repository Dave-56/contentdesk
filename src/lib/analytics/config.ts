import { getEnv } from "@/lib/env";
import type { AnalyticsSource } from "@/lib/analytics/schemas";

export const defaultAnalyticsBrandSlug = "tiny-lemon";
export const defaultShopifyPartnerApiVersion = "2026-04";
export const defaultPosthogHost = "https://us.posthog.com";

export type Ga4Config = {
  serviceAccountJson: string;
  propertyId: string;
};

export type GscConfig = {
  serviceAccountJson: string;
  siteUrl: string;
};

export type ShopifyPartnerConfig = {
  token: string;
  organizationId: string;
  appId: string;
  apiVersion: string;
};

export type PosthogConfig = {
  apiKey: string;
  projectId: string;
  host: string;
};

export type SourceConfigResult<T> =
  | { config: T; missing: [] }
  | { config: null; missing: string[] };

export function analyticsBrandSlug() {
  return getEnv().ANALYTICS_BRAND_SLUG ?? defaultAnalyticsBrandSlug;
}

export function ga4Config(): SourceConfigResult<Ga4Config> {
  const env = getEnv();
  const missing = missingVars({
    GOOGLE_SERVICE_ACCOUNT_JSON: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    GA4_PROPERTY_ID: env.GA4_PROPERTY_ID,
  });
  if (missing.length > 0) return { config: null, missing };

  return {
    config: {
      serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON!,
      propertyId: env.GA4_PROPERTY_ID!,
    },
    missing: [],
  };
}

export function gscConfig(): SourceConfigResult<GscConfig> {
  const env = getEnv();
  const missing = missingVars({
    GOOGLE_SERVICE_ACCOUNT_JSON: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    GSC_SITE_URL: env.GSC_SITE_URL,
  });
  if (missing.length > 0) return { config: null, missing };

  return {
    config: {
      serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON!,
      siteUrl: env.GSC_SITE_URL!,
    },
    missing: [],
  };
}

export function shopifyPartnerConfig(): SourceConfigResult<ShopifyPartnerConfig> {
  const env = getEnv();
  const missing = missingVars({
    SHOPIFY_PARTNER_TOKEN: env.SHOPIFY_PARTNER_TOKEN,
    SHOPIFY_PARTNER_ORG_ID: env.SHOPIFY_PARTNER_ORG_ID,
    SHOPIFY_PARTNER_APP_ID: env.SHOPIFY_PARTNER_APP_ID,
  });
  if (missing.length > 0) return { config: null, missing };

  return {
    config: {
      token: env.SHOPIFY_PARTNER_TOKEN!,
      organizationId: env.SHOPIFY_PARTNER_ORG_ID!,
      appId: env.SHOPIFY_PARTNER_APP_ID!,
      apiVersion: env.SHOPIFY_PARTNER_API_VERSION ?? defaultShopifyPartnerApiVersion,
    },
    missing: [],
  };
}

export function posthogConfig(): SourceConfigResult<PosthogConfig> {
  const env = getEnv();
  const missing = missingVars({
    POSTHOG_API_KEY: env.POSTHOG_API_KEY,
    POSTHOG_PROJECT_ID: env.POSTHOG_PROJECT_ID,
  });
  if (missing.length > 0) return { config: null, missing };

  return {
    config: {
      apiKey: env.POSTHOG_API_KEY!,
      projectId: env.POSTHOG_PROJECT_ID!,
      host: env.POSTHOG_HOST ?? defaultPosthogHost,
    },
    missing: [],
  };
}

export function sourceConfigResult(source: AnalyticsSource) {
  if (source === "ga4") return ga4Config();
  if (source === "gsc") return gscConfig();
  if (source === "shopify_partner") return shopifyPartnerConfig();
  return posthogConfig();
}

function missingVars(vars: Record<string, string | undefined>) {
  return Object.entries(vars)
    .filter(([, value]) => !value || value.trim() === "")
    .map(([name]) => name);
}
