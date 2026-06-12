import { getEnv } from "@/lib/env";
import type { AnalyticsSource } from "@/lib/analytics/schemas";
import type { GoogleAuthConfig } from "@/lib/analytics/google-auth";

export const defaultAnalyticsBrandSlug = "tiny-lemon";
export const defaultShopifyPartnerApiVersion = "2026-04";
export const defaultPosthogHost = "https://us.posthog.com";

export type Ga4Config = {
  auth: GoogleAuthConfig;
  propertyId: string;
};

export type GscConfig = {
  auth: GoogleAuthConfig;
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

// Prefers the OAuth refresh-token trio (what's provisioned in Vercel today),
// falls back to a service-account JSON if that's set instead.
export function googleAuthConfig(): SourceConfigResult<GoogleAuthConfig> {
  const env = getEnv();

  if (env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    const missing = missingVars({
      GOOGLE_OAUTH_CLIENT_ID: env.GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET: env.GOOGLE_OAUTH_CLIENT_SECRET,
      GOOGLE_OAUTH_REFRESH_TOKEN: env.GOOGLE_OAUTH_REFRESH_TOKEN,
    });
    if (missing.length > 0) return { config: null, missing };

    return {
      config: {
        kind: "oauth_refresh",
        clientId: env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN!,
      },
      missing: [],
    };
  }

  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      config: { kind: "service_account", serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON },
      missing: [],
    };
  }

  return {
    config: null,
    missing: ["GOOGLE_OAUTH_CLIENT_ID+GOOGLE_OAUTH_CLIENT_SECRET+GOOGLE_OAUTH_REFRESH_TOKEN (or GOOGLE_SERVICE_ACCOUNT_JSON)"],
  };
}

export function ga4Config(): SourceConfigResult<Ga4Config> {
  const env = getEnv();
  const auth = googleAuthConfig();
  const missing = [
    ...auth.missing,
    ...missingVars({ GA4_PROPERTY_ID: env.GA4_PROPERTY_ID }),
  ];
  if (!auth.config || missing.length > 0) return { config: null, missing };

  return {
    config: { auth: auth.config, propertyId: env.GA4_PROPERTY_ID! },
    missing: [],
  };
}

export function gscConfig(): SourceConfigResult<GscConfig> {
  const env = getEnv();
  const auth = googleAuthConfig();
  const missing = [
    ...auth.missing,
    ...missingVars({ GSC_SITE_URL: env.GSC_SITE_URL }),
  ];
  if (!auth.config || missing.length > 0) return { config: null, missing };

  return {
    config: { auth: auth.config, siteUrl: env.GSC_SITE_URL! },
    missing: [],
  };
}

export function shopifyPartnerConfig(): SourceConfigResult<ShopifyPartnerConfig> {
  const env = getEnv();
  const missing = missingVars({
    SHOPIFY_PARTNER_ACCESS_TOKEN: env.SHOPIFY_PARTNER_ACCESS_TOKEN,
    SHOPIFY_PARTNER_ORG_ID: env.SHOPIFY_PARTNER_ORG_ID,
    SHOPIFY_PARTNER_APP_ID: env.SHOPIFY_PARTNER_APP_ID,
  });
  if (missing.length > 0) return { config: null, missing };

  return {
    config: {
      token: env.SHOPIFY_PARTNER_ACCESS_TOKEN!,
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
    POSTHOG_PERSONAL_API_KEY: env.POSTHOG_PERSONAL_API_KEY,
    POSTHOG_PROJECT_ID: env.POSTHOG_PROJECT_ID,
  });
  if (missing.length > 0) return { config: null, missing };

  return {
    config: {
      apiKey: env.POSTHOG_PERSONAL_API_KEY!,
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
