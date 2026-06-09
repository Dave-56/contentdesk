export type CitationPresence = "strong" | "weak" | "missing" | "competitor";
export type HygieneStatus = "ok" | "redir" | "check";

export const citations: Array<{
  domain: string;
  type: string;
  cites: number;
  presence: CitationPresence;
  state: string;
  nextMove: string;
}> = [
  {
    domain: "shopify.com",
    type: "Marketplace",
    cites: 654,
    presence: "weak",
    state: "Present, weak",
    nextMove: "Strengthen Shopify listing proof, pricing, examples, and flat-lay workflow language.",
  },
  {
    domain: "wearview.co",
    type: "Review site",
    cites: 137,
    presence: "missing",
    state: "Missing",
    nextMove: "Pursue inclusion or create content that review pages can cite.",
  },
  {
    domain: "youtube.com",
    type: "YouTube",
    cites: 113,
    presence: "missing",
    state: "Missing",
    nextMove: "Publish a short demo/proof video for Shopify apparel photo workflows.",
  },
  {
    domain: "claid.ai",
    type: "Competitor",
    cites: 111,
    presence: "competitor",
    state: "Competitor-owned",
    nextMove: "Counter with owned comparison content and stronger marketplace proof.",
  },
  {
    domain: "rewarx.com",
    type: "Review site",
    cites: 62,
    presence: "missing",
    state: "Missing",
    nextMove: "Target review/listicle inclusion for AI product photography tools.",
  },
];

export const hygiene: Array<{ name: string; url: string; status: HygieneStatus; label: string }> = [
  { name: "Canonical site", url: "tinylemon.xyz", status: "ok", label: "OK" },
  { name: "Shopify listing", url: "apps.shopify.com/tiny-lemon", status: "ok", label: "OK" },
  { name: "Staging domain", url: "tinylemon.vercel.app", status: "redir", label: "Redirected" },
  { name: "llms.txt includes priority guides", url: "tinylemon.xyz/llms.txt", status: "check", label: "Needs check" },
];
