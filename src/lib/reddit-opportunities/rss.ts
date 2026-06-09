import { XMLParser } from "fast-xml-parser";
import { redditPostSchema, type RedditPost } from "@/lib/reddit-opportunities/schemas";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function fetchSubredditRss(input: {
  subreddit: string;
  limit?: number;
}) {
  const subreddit = input.subreddit.replace(/^r\//i, "").trim();
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.rss`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "ContentDesk Reddit Radar/0.1 (+https://contentdesk.local)",
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit RSS failed for r/${subreddit}: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as {
    feed?: { entry?: unknown[] | unknown };
    rss?: { channel?: { item?: unknown[] | unknown } };
  };
  const entries = asArray(parsed.feed?.entry ?? parsed.rss?.channel?.item);
  const posts = entries
    .map((entry) => parseEntry(entry, subreddit))
    .filter((post): post is RedditPost => Boolean(post));

  return posts.slice(0, input.limit ?? posts.length);
}

function parseEntry(entry: unknown, subreddit: string) {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Record<string, unknown>;
  const title = stringValue(value.title);
  const url = entryUrl(value);
  const publishedAt = dateString(value.published ?? value.updated ?? value.pubDate);
  const redditPostId = redditPostIdFromEntry(value, url);
  if (!title || !url || !publishedAt || !redditPostId) return null;

  return redditPostSchema.parse({
    redditPostId,
    subreddit,
    title: stripHtml(title),
    url,
    publishedAt,
    content: stripHtml(stringValue(value.content ?? value.summary ?? value.description)),
  });
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
