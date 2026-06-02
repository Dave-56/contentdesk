import { generateText, Output } from "ai";
import type { SiteProfile } from "@/lib/reddit-teardown/schemas";
import {
  buyerPromptMarketClassificationSchema,
  type BuyerPromptMarketClassification,
} from "@/lib/buyer-prompt-strategist/schemas";

export async function classifyBuyerPromptMarket(input: {
  siteProfile: SiteProfile;
  model?: string;
}): Promise<BuyerPromptMarketClassification | null> {
  if (!isAiGatewayConfigured()) return null;

  const { output } = await generateText({
    model: input.model ?? process.env.CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4",
    output: Output.object({
      schema: buyerPromptMarketClassificationSchema,
    }),
    prompt: classificationPrompt(input.siteProfile),
  });

  return buyerPromptMarketClassificationSchema.parse(output);
}

function classificationPrompt(siteProfile: SiteProfile) {
  return [
    "You classify buyer-prompt language for ContentDesk.",
    "Return only fields in the requested schema.",
    "",
    "Rules:",
    "- Choose market only from shopify_app or saas.",
    "- Use shopify_app only when the product is clearly for Shopify merchants, Shopify apps, Shopify stores, product pages, catalogs, or Shopify workflows.",
    "- Use saas for all other software products, including browser-based tools.",
    "- Do not invent competitors. This task classifies language only.",
    "- Write buyerLanguage as short buyer-natural nouns, not marketing clauses.",
    "- categoryNoun should name the product category a buyer would search.",
    "- productNoun should be shorter than categoryNoun when possible.",
    "- useCaseNoun, painNoun, and conversionNoun must be noun phrases or gerund phrases, not full sentences.",
    "- If evidence is thin or ambiguous, add a manual_review warning.",
    "- categoryNoun must match the product described by site facts, not an adjacent or generic category.",
    "",
    "Website facts:",
    JSON.stringify(siteProfile, null, 2),
  ].join("\n");
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}
