export const tinyLemonRedditConfig = {
  subreddits: [
    "shopify",
    "ecommerce",
    "Entrepreneur",
    "smallbusiness",
    "streetwearstartup",
    "printondemand",
    "EtsySellers",
    "ClothingStartups",
    "ProductPhotography",
  ],
  // Reddit-wide search.rss queries — these catch buying-intent posts in
  // subreddits we don't watch. Phrased the way merchants ask, not the way
  // the product describes itself.
  searchQueries: [
    '"product photos" clothing',
    '"on model" photos clothing',
    '"product photography" apparel shopify',
    'ai "product photos" brand',
    '"flat lay" clothing',
  ],
  feedSorts: ["new", "rising"],
  keywords: [
    "apparel",
    "clothing",
    "fashion",
    "model photo",
    "model photos",
    "on model",
    "on-model",
    "product photo",
    "product photos",
    "product photography",
    "flat lay",
    "flat-lay",
    "supplier photo",
    "supplier photos",
    "shopify photos",
    "catalog photos",
    "lookbook",
    "mockup",
    "photoshoot",
  ],
  muteTerms: [
    "dropshipping supplier",
    "seo",
    "fulfillment",
    "shipping rates",
    "tax",
    "chargeback",
    "payment processor",
    "theme bug",
    "domain",
    "ads manager",
    "facebook ads",
    "google ads",
    "promo code",
    "discount code",
  ],
  maxPostsPerSubreddit: 15,
  maxPostAgeDays: 7,
  maxSurfacedPerRun: 8,
  maxPrefilterPostsPerRun: 150,
  prefilterBatchSize: 20,
} as const;

export function redditScoutSubreddits() {
  return envList("CONTENTDESK_REDDIT_SUBREDDITS") ?? [...tinyLemonRedditConfig.subreddits];
}

export function redditScoutSearchQueries() {
  return envList("CONTENTDESK_REDDIT_SEARCH_QUERIES") ?? [...tinyLemonRedditConfig.searchQueries];
}

export function redditScoutKeywords() {
  return envList("CONTENTDESK_REDDIT_KEYWORDS") ?? [...tinyLemonRedditConfig.keywords];
}

export function redditScoutMuteTerms() {
  return [
    ...tinyLemonRedditConfig.muteTerms,
    ...(envList("CONTENTDESK_REDDIT_MUTE_TERMS") ?? []),
  ];
}

function envList(name: string) {
  const raw = process.env[name];
  if (!raw) return null;

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
