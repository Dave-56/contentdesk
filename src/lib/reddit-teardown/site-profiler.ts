import dns from "node:dns/promises";
import net from "node:net";
import type { DiscoveredPage, SiteProfile } from "@/lib/reddit-teardown/schemas";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 750_000;
const MAX_REDIRECTS = 3;

const PAGE_CANDIDATES: Array<{ path: string; kind: DiscoveredPage["kind"] }> = [
  { path: "/", kind: "homepage" },
  { path: "/about", kind: "about" },
  { path: "/pricing", kind: "pricing" },
  { path: "/blog", kind: "blog" },
  { path: "/resources", kind: "resources" },
  { path: "/docs", kind: "docs" },
  { path: "/faq", kind: "faq" },
];

export class UnsafeTeardownUrlError extends Error {}

export async function profileSite(rawUrl: string): Promise<SiteProfile> {
  const websiteUrl = await normalizeAndValidatePublicUrl(rawUrl);
  const baseUrl = new URL(websiteUrl);
  const discoveredPages: DiscoveredPage[] = [];

  for (const candidate of PAGE_CANDIDATES) {
    const url = new URL(candidate.path, baseUrl).toString();
    const page = await fetchHtmlPage(url, candidate.kind).catch(() => null);
    if (page?.excerpt) discoveredPages.push(page);
  }

  const homepage = discoveredPages.find((page) => page.kind === "homepage") ?? discoveredPages[0];
  const combinedText = compactText(discoveredPages.map((page) => page.excerpt).join(" "));
  const homepageTitle = homepage?.title ?? "";
  const companyName = inferCompanyName({
    title: homepageTitle,
    hostname: baseUrl.hostname,
  });

  return {
    websiteUrl,
    companyName,
    title: homepageTitle,
    metaDescription: extractMetaDescription(homepage?.excerpt ?? ""),
    headline: inferHeadline(homepage?.excerpt ?? "", homepageTitle),
    summary: summarizeText(combinedText),
    audienceGuess: inferAudience(combinedText),
    problemSolved: inferProblem(combinedText),
    featuresUseCases: inferFeatures(combinedText),
    existingContent: discoveredPages,
    evidenceQuality: "thin",
    profileSources: [],
    profileWarnings: [
      {
        field: "profileSources",
        severity: "info",
        message:
          "Static site profiler only. Use buyer-prompt site-profile enrichment for visibility inference.",
      },
    ],
  };
}

export async function normalizeAndValidatePublicUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new UnsafeTeardownUrlError("Please include a website URL.");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new UnsafeTeardownUrlError("That does not look like a valid website URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new UnsafeTeardownUrlError("Only http and https URLs are supported.");
  }

  if (!parsed.hostname || parsed.hostname.endsWith(".local")) {
    throw new UnsafeTeardownUrlError("Local network URLs are not supported.");
  }

  await assertPublicHostname(parsed.hostname);
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}

async function fetchHtmlPage(url: string, kind: DiscoveredPage["kind"]): Promise<DiscoveredPage | null> {
  const finalUrl = await normalizeAndValidatePublicUrl(url);
  const response = await safeFetch(finalUrl);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return null;
  }

  const html = await readCappedText(response, MAX_RESPONSE_BYTES);
  const title = extractTitle(html);
  const text = htmlToText(html);

  return {
    url: response.url,
    title,
    kind,
    excerpt: text.slice(0, 5000),
  };
}

async function safeFetch(url: string, redirects = 0): Promise<Response> {
  if (redirects > MAX_REDIRECTS) {
    throw new UnsafeTeardownUrlError("Too many redirects while fetching the website.");
  }

  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "ContentDesk-Reddit-Teardown/0.1",
      Accept: "text/html,application/xhtml+xml,text/xml;q=0.9,*/*;q=0.1",
    },
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect missing location header.");
    const nextUrl = new URL(location, url).toString();
    await normalizeAndValidatePublicUrl(nextUrl);
    return safeFetch(nextUrl, redirects + 1);
  }

  if (!response.ok) throw new Error(`Fetch failed with ${response.status}`);
  await normalizeAndValidatePublicUrl(response.url);
  return response;
}

async function readCappedText(response: Response, byteLimit: number) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > byteLimit) {
      throw new Error("Response exceeded size limit.");
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function assertPublicHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(lower)) {
    throw new UnsafeTeardownUrlError("Localhost URLs are not supported.");
  }

  if (net.isIP(lower)) {
    if (!isPublicIp(lower)) {
      throw new UnsafeTeardownUrlError("Private or local IP addresses are not supported.");
    }
    return;
  }

  const records = await dns.lookup(lower, { all: true }).catch(() => []);
  for (const record of records) {
    if (!isPublicIp(record.address)) {
      throw new UnsafeTeardownUrlError("Private or local network hosts are not supported.");
    }
  }
}

function isPublicIp(address: string) {
  const version = net.isIP(address);
  if (version === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    return true;
  }

  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
      return false;
    }
    return true;
  }

  return false;
}

function extractTitle(html: string) {
  return decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim());
}

function extractMetaDescription(text: string) {
  return text.split(/[.!?]\s/).find((sentence) => sentence.length > 80)?.slice(0, 240) ?? "";
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function inferCompanyName(input: { title: string; hostname: string }) {
  return brandNameFromHostname(input.hostname);
}

function brandNameFromHostname(hostname: string) {
  const base = hostname
    .replace(/^www\./, "")
    .split(".")[0]
    ?.replace(/[-_]+/g, " ")
    .trim();

  if (!base) return hostname;

  return base
    .split(/\s+/)
    .map(formatBrandToken)
    .join(" ");
}

function formatBrandToken(token: string) {
  const lower = token.toLowerCase();
  if (["ai", "api", "seo", "crm", "cms"].includes(lower)) {
    return lower.toUpperCase();
  }

  return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}

function inferHeadline(text: string, fallback: string) {
  const firstSentence = text.split(/[.!?]\s/)[0]?.trim();
  return firstSentence?.slice(0, 180) || fallback || "Homepage headline unavailable";
}

function summarizeText(text: string) {
  return text.slice(0, 700) || "Could not extract much public page text from the site.";
}

function inferAudience(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("shopify")) return "Shopify merchants or ecommerce teams";
  if (lower.includes("developer")) return "developers or technical teams";
  if (lower.includes("sales")) return "sales teams";
  if (lower.includes("founder")) return "founders or small teams";
  if (lower.includes("marketer") || lower.includes("marketing")) return "marketing teams";
  return "buyers evaluating this product category";
}

function inferProblem(text: string) {
  const sentence = text
    .split(/[.!?]\s/)
    .find((part) => /\b(help|save|automate|manage|create|build|track|improve|reduce|increase)\b/i.test(part));
  return sentence?.slice(0, 220) ?? "The core buyer problem needs manual review from the site copy.";
}

function inferFeatures(text: string) {
  const matches = text
    .split(/[.!?]\s/)
    .filter((part) => /\b(feature|integrat|automate|dashboard|workflow|analytics|report|generate|manage|sync)\b/i.test(part))
    .map((part) => part.trim().slice(0, 120))
    .filter(Boolean);

  return [...new Set(matches)].slice(0, 6);
}
