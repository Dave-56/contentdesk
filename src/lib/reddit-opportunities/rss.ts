import { XMLParser } from "fast-xml-parser";
import { redditPostSchema, type RedditPost } from "@/lib/reddit-opportunities/schemas";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export type RedditFeedSort = "new" | "rising";

export async function fetchSubredditRss(input: {
  subreddit: string;
  sort?: RedditFeedSort;
  limit?: number;
}) {
  const subreddit = normalizeSubreddit(input.subreddit);
  const sort = input.sort ?? "new";
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
    return fetchRedditFeed({
      url: `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.rss?${params}`,
      label: `r/${subreddit} search "${input.query}"`,
      fallbackSubreddit: subreddit,
      limit: input.limit,
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
      "user-agent": "ContentDesk Reddit Radar/0.2 (+https://contentdesk.local)",
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
