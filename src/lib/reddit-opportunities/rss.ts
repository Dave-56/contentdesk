import { XMLParser } from "fast-xml-parser";
import { redditPostSchema, type RedditPost } from "@/lib/reddit-opportunities/schemas";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export type RedditFeedSort = "new" | "rising";

type RedditTokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: RedditTokenCache | null = null;

export async function fetchSubredditRss(input: {
  subreddit: string;
  sort?: RedditFeedSort;
  limit?: number;
}) {
  const subreddit = normalizeSubreddit(input.subreddit);
  const sort = input.sort ?? "new";

  if (hasRedditOAuthConfig()) {
    return fetchRedditJsonListing({
      path: `/r/${encodeURIComponent(subreddit)}/${sort}.json`,
      label: `r/${subreddit}/${sort}`,
      fallbackSubreddit: subreddit,
      limit: input.limit,
    });
  }

  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort}.rss`;

  return fetchRedditFeed({
    url,
    label: `r/${subreddit}/${sort}`,
    fallbackSubreddit: subreddit,
    limit: input.limit,
  });
}

export async function fetchRedditSearchRss(input: {
  query: string;
  subreddit?: string;
  limit?: number;
}) {
  // relevance + recent window beats sort=new for multi-word queries, which
  // otherwise return loosely-matched noise; the freshness filter downstream
  // still applies.
  const params = new URLSearchParams({ q: input.query, sort: "relevance", t: "week" });

  if (input.subreddit) {
    const subreddit = normalizeSubreddit(input.subreddit);
    params.set("restrict_sr", "1");

    if (hasRedditOAuthConfig()) {
      return fetchRedditJsonListing({
        path: `/r/${encodeURIComponent(subreddit)}/search.json`,
        label: `r/${subreddit} search "${input.query}"`,
        fallbackSubreddit: subreddit,
        limit: input.limit,
        params,
      });
    }

    return fetchRedditFeed({
      url: `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.rss?${params}`,
      label: `r/${subreddit} search "${input.query}"`,
      fallbackSubreddit: subreddit,
      limit: input.limit,
    });
  }

  if (hasRedditOAuthConfig()) {
    return fetchRedditJsonListing({
      path: "/search.json",
      label: `search "${input.query}"`,
      limit: input.limit,
      params,
    });
  }

  return fetchRedditFeed({
    url: `https://www.reddit.com/search.rss?${params}`,
    label: `search "${input.query}"`,
    limit: input.limit,
  });
}

async function fetchRedditFeed(input: {
  url: string;
  label: string;
  fallbackSubreddit?: string;
  limit?: number;
}) {
  const response = await fetch(input.url, {
    headers: {
      "user-agent": redditUserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit RSS failed for ${input.label}: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as {
    feed?: { entry?: unknown[] | unknown };
    rss?: { channel?: { item?: unknown[] | unknown } };
  };
  const entries = asArray(parsed.feed?.entry ?? parsed.rss?.channel?.item);
  const posts = entries
    .map((entry) => parseEntry(entry, input.fallbackSubreddit))
    .filter((post): post is RedditPost => Boolean(post));

  return posts.slice(0, input.limit ?? posts.length);
}

async function fetchRedditJsonListing(input: {
  path: string;
  label: string;
  fallbackSubreddit?: string;
  limit?: number;
  params?: URLSearchParams;
}) {
  const params = new URLSearchParams(input.params);
  if (input.limit) params.set("limit", String(input.limit));

  const accessToken = await getRedditAccessToken();
  const url = `https://oauth.reddit.com${input.path}${params.size ? `?${params}` : ""}`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "user-agent": redditUserAgent(),
    },
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const rateLimitUsed = response.headers.get("x-ratelimit-used");
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const suffix = [
      retryAfter ? `retry_after=${retryAfter}` : "",
      rateLimitUsed ? `used=${rateLimitUsed}` : "",
      rateLimitRemaining ? `remaining=${rateLimitRemaining}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Reddit API failed for ${input.label}: ${response.status} ${response.statusText}${suffix ? ` (${suffix})` : ""}`,
    );
  }

  const payload = await response.json();
  const children = listingChildren(payload);
  const posts = children
    .map((child) => parseJsonChild(child, input.fallbackSubreddit))
    .filter((post): post is RedditPost => Boolean(post));

  return posts.slice(0, input.limit ?? posts.length);
}

async function getRedditAccessToken() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.accessToken;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET");
  }

  const body = new URLSearchParams();
  if (process.env.REDDIT_REFRESH_TOKEN) {
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", process.env.REDDIT_REFRESH_TOKEN);
  } else {
    body.set("grant_type", "client_credentials");
  }

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": redditUserAgent(),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Reddit OAuth failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const accessToken = stringValue(payload?.access_token);
  const expiresIn = Number(payload?.expires_in ?? 3600);
  if (!accessToken) throw new Error("Reddit OAuth response did not include access_token");

  tokenCache = {
    accessToken,
    expiresAt: now + Math.max(60, expiresIn) * 1000,
  };

  return accessToken;
}

function parseJsonChild(child: unknown, fallbackSubreddit?: string) {
  if (!child || typeof child !== "object") return null;
  const data = (child as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  const redditPostId = stringValue(value.id);
  const title = stringValue(value.title);
  const permalink = stringValue(value.permalink);
  const url = permalink ? `https://www.reddit.com${permalink}` : stringValue(value.url);
  const subreddit = stringValue(value.subreddit) || fallbackSubreddit || subredditFromUrl(url);
  const createdUtc = Number(value.created_utc);
  const publishedAt = Number.isFinite(createdUtc)
    ? new Date(createdUtc * 1000).toISOString()
    : dateString(value.created);

  if (!redditPostId || !title || !url || !publishedAt || !subreddit) return null;

  return redditPostSchema.parse({
    redditPostId,
    subreddit,
    title: stripHtml(title),
    url,
    publishedAt,
    content: stripHtml(stringValue(value.selftext)),
  });
}

function listingChildren(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return [];
  const children = (data as { children?: unknown }).children;

  return Array.isArray(children) ? children : [];
}

function parseEntry(entry: unknown, fallbackSubreddit?: string) {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Record<string, unknown>;
  const title = stringValue(value.title);
  const url = entryUrl(value);
  const publishedAt = dateString(value.published ?? value.updated ?? value.pubDate);
  const redditPostId = redditPostIdFromEntry(value, url);
  // Search feeds mix subreddits, so the post URL is the source of truth.
  const subreddit = subredditFromUrl(url) || fallbackSubreddit || "";
  if (!title || !url || !publishedAt || !redditPostId || !subreddit) return null;

  return redditPostSchema.parse({
    redditPostId,
    subreddit,
    title: stripHtml(title),
    url,
    publishedAt,
    content: stripHtml(stringValue(value.content ?? value.summary ?? value.description)),
  });
}

export function subredditFromUrl(url: string) {
  const match = url.match(/reddit\.com\/r\/([^/]+)\/comments\//i);
  return match?.[1] ?? "";
}

function normalizeSubreddit(value: string) {
  return value.replace(/^r\//i, "").trim();
}

function hasRedditOAuthConfig() {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

function redditUserAgent() {
  return (
    process.env.REDDIT_USER_AGENT ||
    "web:contentdesk-reddit-radar:v0.1 by u/Over-Excitement-6324"
  );
}

function entryUrl(value: Record<string, unknown>) {
  const link = value.link;
  if (typeof link === "string") return link;

  const links = asArray(link);
  for (const item of links) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rel = stringValue(record["@_rel"]);
    const href = stringValue(record["@_href"]);
    if (href && (!rel || rel === "alternate")) return href;
  }

  return "";
}

function redditPostIdFromEntry(value: Record<string, unknown>, url: string) {
  const id = stringValue(value.id ?? value.guid);
  const urlMatch = url.match(/\/comments\/([^/]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];

  const idMatch = id.match(/(?:t3_)?([a-z0-9]+)$/i);
  return idMatch?.[1] ?? "";
}

function dateString(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return "";
  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stringValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) {
    return stringValue((value as { "#text"?: unknown })["#text"]);
  }

  return "";
}

function asArray(value: unknown) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
