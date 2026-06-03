import { normalizeAndValidatePublicUrl } from "@/lib/reddit-teardown/site-profiler";
import {
  siteProfileSchema,
  type ProfileWarning,
  type SiteProfile,
} from "@/lib/reddit-teardown/schemas";
import type { ResearchSource } from "@/lib/schemas";
import {
  perplexityBusinessReadSchema,
  type PerplexityBusinessRead,
} from "@/lib/buyer-prompt-strategist/schemas";

const FETCHED_AT_FALLBACK = "1970-01-01T00:00:00.000Z";
const FIRST_PARTY_FETCH_TIMEOUT_MS = 8000;
const FIRST_PARTY_HTML_MAX_CHARS = 120_000;
const FIRST_PARTY_ASSET_MAX_CHARS = 240_000;
const FIRST_PARTY_CONTEXT_MAX_CHARS = 18_000;
const MAX_FIRST_PARTY_SCRIPT_ASSETS = 3;

type FirstPartyContext = {
  targetUrl: string;
  htmlText: string;
  meta: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    canonical: string;
  };
  scriptUrls: string[];
  scriptText: string;
  contextText: string;
};

export type BuyerPromptBusinessProfile = {
  siteProfile: SiteProfile;
  businessRead: PerplexityBusinessRead;
  researchSources: ResearchSource[];
};

export class InsufficientSiteProfileEvidenceError extends Error {
  readonly siteProfile: SiteProfile;

  constructor(siteProfile: SiteProfile) {
    super(
      siteProfile.profileWarnings.find((item) => item.severity === "manual_review")
        ?.message ??
        siteProfile.profileWarnings.find((item) => item.field === "targetIdentity")
          ?.message ??
        siteProfile.profileWarnings.find((item) => item.field === "evidenceQuality")
          ?.message ??
        "Insufficient site-profile evidence. Review site-profile.json before selecting prompts.",
    );
    this.name = "InsufficientSiteProfileEvidenceError";
    this.siteProfile = siteProfile;
  }
}

export async function profileSiteForBuyerPrompts(input: {
  url: string;
}): Promise<SiteProfile> {
  return (await profileBusinessForBuyerPrompts(input)).siteProfile;
}

export async function profileBusinessForBuyerPrompts(input: {
  url: string;
}): Promise<BuyerPromptBusinessProfile> {
  return enrichSiteProfile({
    url: input.url,
    env: {
      perplexityApiKey: process.env.PERPLEXITY_API_KEY,
    },
  });
}

export async function enrichSiteProfile(input: {
  url: string;
  env?: {
    perplexityApiKey?: string;
  };
}): Promise<BuyerPromptBusinessProfile> {
  if (!input.env?.perplexityApiKey) {
    throw new Error("PERPLEXITY_API_KEY is required for prompt:infer.");
  }
  const targetUrl = await normalizeAndValidatePublicUrl(input.url);
  const firstPartyContext = await collectFirstPartyContext(targetUrl);

  const businessRead = await readBusinessWithPerplexity({
    apiKey: input.env.perplexityApiKey,
    targetUrl,
    firstPartyContext,
  });
  const warnings = profileWarningsFromBusinessRead(businessRead);
  const researchSources = researchSourcesFromBusinessRead(businessRead);
  const evidenceQuality = warnings.some((warning) => warning.severity === "manual_review")
    ? "insufficient"
    : "strong";

  const siteProfile = siteProfileSchema.parse({
    websiteUrl: targetUrl,
    companyName: businessRead.brandName,
    title: businessRead.brandName,
    metaDescription: businessRead.evidenceSummary.slice(0, 240),
    headline: businessRead.product,
    summary: businessRead.positioning,
    audienceGuess: businessRead.audience,
    problemSolved: businessRead.problemSolved,
    featuresUseCases: [
      businessRead.solution,
      ...businessRead.primaryUseCases,
    ].filter(uniqueText).slice(0, 6),
    existingContent: [
      {
        url: targetUrl,
        title: businessRead.brandName,
        kind: "homepage",
        excerpt: firstPartyContext.contextText || businessRead.evidenceSummary,
      },
    ],
    evidenceQuality,
    profileSources: researchSources,
    profileWarnings: warnings,
  });

  return {
    siteProfile,
    businessRead,
    researchSources,
  };
}

export function assertProfileEvidence(profile: SiteProfile) {
  const parsed = siteProfileSchema.parse(profile);
  if (parsed.evidenceQuality === "insufficient") {
    throw new InsufficientSiteProfileEvidenceError(parsed);
  }
}

async function readBusinessWithPerplexity(input: {
  apiKey: string;
  targetUrl: string;
  firstPartyContext: FirstPartyContext;
}) {
  const fetchedAt = new Date().toISOString();
  const targetDomain = new URL(input.targetUrl).hostname.replace(/^www\./, "");
  const response = await fetch("https://api.perplexity.ai/v1/sonar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: [
            "You identify the exact business behind a URL for buyer-prompt strategy.",
            "Return only valid JSON matching the requested shape.",
            "Do not confuse same-name brands, products, domains, or companies.",
            "If the target URL/domain cannot be tied clearly to the product you describe, set targetIdentityConfirmed false and add a manual_review warning.",
          ].join(" "),
        },
        {
          role: "user",
          content: businessReadPrompt({
            targetUrl: input.targetUrl,
            targetDomain,
            firstPartyContext: input.firstPartyContext,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Perplexity business read failed with ${response.status}: ${body}`);
  }

  const parsed = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };
  const answer = parsed.choices?.[0]?.message?.content?.trim() ?? "";
  const json = parseJsonObject(answer);
  const normalizedJson = normalizeBusinessReadJson(json);
  const citationUrls = [
    ...new Set([
      ...(parsed.citations ?? []),
      ...(Array.isArray(normalizedJson.citations) ? normalizedJson.citations : []),
    ].filter(isUrl)),
  ];
  const businessRead = perplexityBusinessReadSchema.parse({
    ...normalizedJson,
    targetUrl: normalizedJson.targetUrl || input.targetUrl,
    targetDomain: normalizedJson.targetDomain || targetDomain,
    citations: citationUrls,
  });

  return {
    ...businessRead,
    citations: businessRead.citations.length > 0 ? businessRead.citations : [input.targetUrl],
    evidenceSummary:
      businessRead.evidenceSummary ||
      `Perplexity business read generated at ${fetchedAt}.`,
  };
}

function businessReadPrompt(input: {
  targetUrl: string;
  targetDomain: string;
  firstPartyContext: FirstPartyContext;
}) {
  return [
    `Analyze this exact URL/domain: ${input.targetUrl}`,
    `Target domain: ${input.targetDomain}`,
    "",
    "Goal: understand this exact business before buyer prompts are generated.",
    "Confirm whether the product/business you describe maps to this target URL/domain, not merely the same brand name elsewhere.",
    "Use first-party context from the target site as primary evidence. Use current public web context only to fill gaps and find clear competitors.",
    "",
    "First-party context from the target site:",
    input.firstPartyContext.contextText || "(No readable first-party context extracted.)",
    "",
    "Return JSON with this exact shape:",
    JSON.stringify({
      targetUrl: input.targetUrl,
      targetDomain: input.targetDomain,
      targetIdentityConfirmed: true,
      targetIdentityReason: "Why this product/business is tied to the exact URL/domain.",
      brandName: "Brand name",
      market: "shopify_app or saas",
      product: "What product/business this is",
      category: "Buyer-search category",
      audience: "Who buys/uses it",
      positioning: "Concise positioning",
      problemSolved: "Buyer pain",
      solution: "Solution offered",
      conversionGoal: "Trial, install, demo, purchase, signup, etc.",
      primaryUseCases: ["Use case"],
      buyerLanguage: {
        buyerNoun: "Specific audience phrase from the target site's actual buyer/user audience, max 8 words. Preserve meaningful qualifiers. Never 'buyer' or 'users'.",
        categoryNoun: "Concrete category noun phrase buyers would search for this product.",
        productNoun: "Concrete product noun phrase for what this product is.",
        useCaseNoun: "Concrete use-case noun phrase from the target site's primary workflows.",
        painNoun: "Concrete pain noun phrase the product solves.",
        conversionNoun: "Concrete next-action noun or verb phrase from the site/business model.",
        comparisonNoun: "Concrete alternatives/comparison noun phrase for this exact category.",
      },
      competitors: [
        {
          name: "Competitor",
          aliases: [],
          domains: [],
          clearAlternative: true,
          confidence: 4,
          reason: "Why this is a clear alternative for this exact product/category.",
        },
      ],
      confidence: {
        targetIdentity: 5,
        product: 5,
        category: 5,
        audience: 5,
        buyerLanguage: 5,
      },
      warnings: [
        {
          field: "targetIdentity",
          message: "Use manual_review if exact URL identity is unclear.",
          severity: "info",
        },
      ],
      citations: [input.targetUrl],
      evidenceSummary: "Short summary of evidence and uncertainty.",
    }, null, 2),
    "",
    "Rules:",
    "- Start from the target URL/domain and identify that exact business.",
    "- Treat first-party target-site copy as stronger evidence than generic search results.",
    "- Do not describe another company with the same brand name unless it is clearly the same business as target domain.",
    "- If the domain cannot be tied clearly to the product/business you describe, set targetIdentityConfirmed false and add a manual_review warning.",
    "- If product is not software or Shopify app, choose saas only to satisfy schema and add manual_review warning.",
    "- buyerLanguage must be derived from the target site's own audience, category, use cases, pain, and conversion goal.",
    "- buyerLanguage must use concrete nouns a real buyer would type; never use filler like buyer, users, tool buyer, or alternative.",
    "- Include competitors only when they are clear alternatives for this exact product/category.",
    "- Leave competitors empty when alternatives are unclear.",
  ].join("\n");
}

async function collectFirstPartyContext(targetUrl: string): Promise<FirstPartyContext> {
  const html = await fetchText(targetUrl, FIRST_PARTY_HTML_MAX_CHARS).catch(() => "");
  const meta = extractHtmlMeta(html);
  const htmlText = htmlToReadableText(html);
  const scriptUrls = extractSameOriginScriptUrls(html, targetUrl).slice(0, MAX_FIRST_PARTY_SCRIPT_ASSETS);
  const scriptBodies = await Promise.all(
    scriptUrls.map(async (url) => ({
      url,
      text: await fetchText(url, FIRST_PARTY_ASSET_MAX_CHARS).catch(() => ""),
    })),
  );
  const scriptText = extractScriptProductText(scriptBodies.map((item) => item.text).join("\n"));
  const contextText = [
    `TARGET_URL: ${targetUrl}`,
    meta.title ? `TITLE: ${meta.title}` : "",
    meta.description ? `META_DESCRIPTION: ${meta.description}` : "",
    meta.ogTitle ? `OG_TITLE: ${meta.ogTitle}` : "",
    meta.ogDescription ? `OG_DESCRIPTION: ${meta.ogDescription}` : "",
    meta.canonical ? `CANONICAL: ${meta.canonical}` : "",
    htmlText ? `HTML_TEXT:\n${htmlText}` : "",
    scriptText ? `SAME_ORIGIN_JS_PRODUCT_TEXT:\n${scriptText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, FIRST_PARTY_CONTEXT_MAX_CHARS);

  return {
    targetUrl,
    htmlText,
    meta,
    scriptUrls,
    scriptText,
    contextText,
  };
}

async function fetchText(url: string, maxChars: number) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FIRST_PARTY_FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "ContentDesk-BuyerPromptInfer/0.1",
      Accept: "text/html,application/xhtml+xml,application/javascript,text/javascript,text/plain;q=0.8,*/*;q=0.5",
    },
  });
  if (!response.ok) return "";
  return (await response.text()).slice(0, maxChars);
}

function extractHtmlMeta(html: string): FirstPartyContext["meta"] {
  return {
    title: compactText(matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    description: compactText(matchMetaContent(html, "description")),
    ogTitle: compactText(matchPropertyContent(html, "og:title")),
    ogDescription: compactText(matchPropertyContent(html, "og:description")),
    canonical: compactText(matchFirst(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)),
  };
}

function matchMetaContent(html: string, name: string) {
  return matchFirst(
    html,
    new RegExp(`<meta[^>]+name=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']+)["']`, "i"),
  ) || matchFirst(
    html,
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegExp(name)}["']`, "i"),
  );
}

function matchPropertyContent(html: string, property: string) {
  return matchFirst(
    html,
    new RegExp(`<meta[^>]+property=["']${escapeRegExp(property)}["'][^>]+content=["']([^"']+)["']`, "i"),
  ) || matchFirst(
    html,
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegExp(property)}["']`, "i"),
  );
}

function matchFirst(text: string, pattern: RegExp) {
  return decodeHtmlEntities(pattern.exec(text)?.[1] ?? "");
}

function htmlToReadableText(html: string) {
  return compactText(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  ).slice(0, 5000);
}

function extractSameOriginScriptUrls(html: string, targetUrl: string) {
  const origin = new URL(targetUrl).origin;
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const rawUrl = match[1];
    if (!rawUrl) continue;
    const url = new URL(rawUrl, targetUrl);
    if (url.origin !== origin) continue;
    const value = url.toString();
    if (seen.has(value)) continue;
    seen.add(value);
    urls.push(value);
  }
  return urls;
}

function extractScriptProductText(scriptText: string) {
  const segments = [
    ...scriptText.matchAll(/`([^`]{20,1000})`|"([^"\\]{20,500})"|'([^'\\]{20,500})'/g),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .map(cleanScriptString)
    .flatMap(splitReadableSegments)
    .filter(isProductTextSegment)
    .sort((left, right) => productTextPriority(left) - productTextPriority(right));
  const seen = new Set<string>();
  return segments
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50)
    .join("\n")
    .slice(0, 10_000);
}

function cleanScriptString(value: string) {
  return compactText(
    decodeHtmlEntities(
      value
        .replace(/\$\{[^}]+}/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\\n|\\r|\\t/g, " ")
        .replace(/\\u[0-9a-fA-F]{4}/g, " "),
    ),
  );
}

function splitReadableSegments(value: string) {
  return value
    .split(/(?<=[.!?])\s+|\s{2,}/)
    .map((segment) => segment.replace(/^>\s*/, "").trim())
    .filter(Boolean);
}

function isProductTextSegment(value: string) {
  if (value.length < 20 || value.length > 280) return false;
  if (!/\s/.test(value)) return false;
  if (/^(could not|passkey|content-disposition|onchange=)|expected uint8array|failed: this site|form-data/i.test(value)) {
    return false;
  }
  if (/assets\/|\.js\b|\.css\b|querySelector|addEventListener|MutationObserver|HTMLElement|CustomEvent|ReadableStream|function|return|const |let |=>|__vite|Object\.|document\.|window\./i.test(value)) {
    return false;
  }
  if ((value.match(/[{}[\]();=<>]/g)?.length ?? 0) > 2) return false;
  return /\b(account|content|create|delete|document|encrypt|file|key|lifespan|limit|login|message|private|read|secure|sensitive|server|signup|subscription|upload)\b/i.test(value);
}

function productTextPriority(value: string) {
  if (/\b(end-to-end|encrypted|lifespan|database|read|aes key|servers?|decryption key|fragment|sensitive|expires?|expiration)\b/i.test(value)) {
    return 0;
  }
  if (/\b(message|delete|time limit|private|secure)\b/i.test(value)) return 1;
  return 2;
}

function profileWarningsFromBusinessRead(read: PerplexityBusinessRead): ProfileWarning[] {
  const warnings: ProfileWarning[] = [...read.warnings];
  const lowConfidence = [
    ["targetIdentity", read.confidence.targetIdentity],
    ["product", read.confidence.product],
    ["category", read.confidence.category],
    ["audience", read.confidence.audience],
    ["buyerLanguage", read.confidence.buyerLanguage],
  ].filter(([, value]) => Number(value) < 3);

  if (!read.targetIdentityConfirmed || read.confidence.targetIdentity < 4) {
    warnings.push({
      field: "targetIdentity",
      severity: "manual_review",
      message:
        `Perplexity did not clearly confirm that ${read.targetDomain} maps to the described product. ${read.targetIdentityReason}`,
    });
  }

  for (const [field] of lowConfidence) {
    warnings.push({
      field: String(field),
      severity: "manual_review",
      message: `Perplexity confidence for ${field} is too low for automatic buyer-prompt inference.`,
    });
  }

  if (read.competitors.some((competitor) => !competitor.clearAlternative)) {
    warnings.push({
      field: "competitors",
      severity: "warning",
      message: "Some Perplexity competitor hints were not clear alternatives and were omitted from strategy.",
    });
  }

  return dedupeWarnings(warnings);
}

function researchSourcesFromBusinessRead(read: PerplexityBusinessRead): ResearchSource[] {
  const fetchedAt = new Date().toISOString();
  const urls = read.citations.length > 0 ? read.citations : [read.targetUrl];

  return urls.map((url) => ({
    provider: "perplexity",
    query: `Perplexity exact-domain business read for ${read.targetUrl}`,
    url,
    title: url === read.targetUrl ? read.brandName : "",
    excerpt: read.evidenceSummary,
    extractedMarkdown: [
      read.evidenceSummary,
      read.targetIdentityReason,
      read.positioning,
      read.problemSolved,
      read.solution,
    ].join(" "),
    fetchedAt: fetchedAt || FETCHED_AT_FALLBACK,
  }));
}

function parseJsonObject(text: string) {
  const stripped = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Perplexity business read did not return JSON.");
  }

  return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeBusinessReadJson(json: Record<string, unknown>) {
  const normalized = { ...json };
  const warnings = Array.isArray(normalized.warnings)
    ? [...normalized.warnings]
    : [];

  if (!Array.isArray(normalized.primaryUseCases) || normalized.primaryUseCases.length === 0) {
    const buyerLanguage = isRecord(normalized.buyerLanguage) ? normalized.buyerLanguage : {};
    normalized.primaryUseCases = [
      stringOrFallback(buyerLanguage.useCaseNoun, stringOrFallback(normalized.category, "manual review required")),
    ];
    warnings.push({
      field: "primaryUseCases",
      severity: "manual_review",
      message:
        "Perplexity did not return clear primary use cases for this exact URL; review business understanding before selecting prompts.",
    });
  }

  normalized.buyerLanguage = normalizeBuyerLanguage(normalized);
  normalized.warnings = warnings;
  return normalized;
}

function normalizeBuyerLanguage(read: Record<string, unknown>) {
  const buyerLanguage = isRecord(read.buyerLanguage) ? { ...read.buyerLanguage } : {};
  const primaryUseCases = Array.isArray(read.primaryUseCases) ? read.primaryUseCases : [];
  const replacements: Record<string, string> = {
    buyerNoun: stringOrFallback(read.audience, "target buyers"),
    categoryNoun: stringOrFallback(read.category, "software category"),
    productNoun: stringOrFallback(read.product, stringOrFallback(read.category, "product")),
    useCaseNoun: stringOrFallback(primaryUseCases[0], stringOrFallback(read.category, "core workflow")),
    painNoun: stringOrFallback(read.problemSolved, "core pain"),
    conversionNoun: stringOrFallback(read.conversionGoal, "signup"),
    comparisonNoun: `${stringOrFallback(read.category, "product")} alternatives`,
  };

  for (const [field, fallback] of Object.entries(replacements)) {
    const current = stringOrFallback(buyerLanguage[field], "");
    buyerLanguage[field] = isWeakBuyerLanguage(field, current) ? fallback : current;
  }

  return buyerLanguage;
}

function isWeakBuyerLanguage(field: string, value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return true;
  if (["buyer", "buyers", "user", "users", "customer", "customers", "tool buyer", "tool buyers"].includes(normalized)) {
    return true;
  }
  if (field === "buyerNoun" && /\bbuyers?$/.test(normalized)) return true;
  if (field === "categoryNoun" && /\bbuyers?$/.test(normalized)) return true;
  if (field === "comparisonNoun" && ["alternative", "alternatives", "comparison"].includes(normalized)) return true;
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function uniqueText(value: string, index: number, all: string[]) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalized.length > 0 && all.findIndex((item) =>
    item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalized
  ) === index;
}

function dedupeWarnings(warnings: ProfileWarning[]) {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.field}:${warning.severity}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
