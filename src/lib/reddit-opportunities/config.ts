export const tinyLemonRedditConfig = {
  subreddits: [
    "shopify",
    "ecommerce",
    "Entrepreneur",
    "smallbusiness",
    "streetwearstartup",
  ],
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
} as const;

export function redditScoutSubreddits() {
  return envList("CONTENTDESK_REDDIT_SUBREDDITS") ?? [...tinyLemonRedditConfig.subreddits];
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
