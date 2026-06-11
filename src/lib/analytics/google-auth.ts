import crypto from "node:crypto";
import { AnalyticsAuthError } from "@/lib/analytics/errors";

// Service-account JWT bearer flow (RFC 7523) against Google's token endpoint.
// Dep-free on purpose: the repo avoids heavy SDK installs and the flow is two
// requests. Auth failures throw AnalyticsAuthError so the runner can write a
// failed_auth row instead of a generic failure.

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export async function googleAccessToken(input: {
  serviceAccountJson: string;
  scopes: string[];
}) {
  const key = parseServiceAccountJson(input.serviceAccountJson);
  const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    header: { alg: "RS256", typ: "JWT" },
    payload: {
      iss: key.client_email,
      scope: input.scopes.join(" "),
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    },
    privateKey: key.private_key,
  });

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new AnalyticsAuthError(
      `Google token request failed (${response.status}): ${
        body.error_description ?? body.error ?? "no access token returned"
      }`,
    );
  }

  return body.access_token;
}

function parseServiceAccountJson(serviceAccountJson: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serviceAccountJson);
  } catch {
    throw new AnalyticsAuthError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  const key = parsed as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key) {
    throw new AnalyticsAuthError(
      "GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.",
    );
  }

  return key as ServiceAccountKey;
}

function signJwt(input: {
  header: Record<string, string>;
  payload: Record<string, string | number>;
  privateKey: string;
}) {
  const headerPart = base64UrlEncode(JSON.stringify(input.header));
  const payloadPart = base64UrlEncode(JSON.stringify(input.payload));
  const signingInput = `${headerPart}.${payloadPart}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .sign(input.privateKey);

  return `${signingInput}.${base64UrlEncodeBuffer(signature)}`;
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBuffer(Buffer.from(value, "utf8"));
}

function base64UrlEncodeBuffer(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
