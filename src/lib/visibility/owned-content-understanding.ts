import { generateText, Output } from "ai";
import { z } from "zod";
import type { OwnedContentPage } from "@/lib/visibility/site-inventory";

const understandingSchema = z.object({
  summary: z.string().trim().min(1),
  primaryTopic: z.string().trim().min(1),
  secondaryTopics: z.array(z.string().trim().min(1)).max(8),
  contentRole: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  keyClaims: z.array(z.string().trim().min(1)).max(8),
});

type PageUnderstanding = z.infer<typeof understandingSchema>;

export type OwnedContentUnderstandingProgress = {
  phase: "understand_page";
  status: "start" | "complete" | "failed" | "skipped";
  url: string;
  index: number;
  total: number;
  failureReason?: string | null;
};

export async function addOwnedContentUnderstanding(input: {
  pages: OwnedContentPage[];
  brand: string;
  model?: string;
  onProgress?: (event: OwnedContentUnderstandingProgress) => void;
}) {
  if (!isAiGatewayConfigured()) {
    return input.pages.map((page, index) => {
      const next = {
        ...page,
        understandingStatus:
          page.crawlStatus === "success" ? "skipped" as const : page.understandingStatus,
      };
      if (page.crawlStatus === "success") {
        input.onProgress?.({
          phase: "understand_page",
          status: "skipped",
          url: page.url,
          index: index + 1,
          total: input.pages.length,
          failureReason: "AI Gateway not configured.",
        });
      }
      return next;
    });
  }

  const pages: OwnedContentPage[] = [];

  for (const [index, page] of input.pages.entries()) {
    if (page.crawlStatus !== "success") {
      pages.push(page);
      continue;
    }

    try {
      input.onProgress?.({
        phase: "understand_page",
        status: "start",
        url: page.url,
        index: index + 1,
        total: input.pages.length,
      });
      const understanding = await understandOwnedContentPage({
        page,
        brand: input.brand,
        model: input.model,
      });

      pages.push({
        ...page,
        ...understanding,
        understandingStatus: "complete",
        understandingFailureReason: null,
      });
      input.onProgress?.({
        phase: "understand_page",
        status: "complete",
        url: page.url,
        index: index + 1,
        total: input.pages.length,
      });
    } catch (error) {
      const failureReason = error instanceof Error ? error.message.slice(0, 500) : String(error);
      pages.push({
        ...page,
        understandingStatus: "failed",
        understandingFailureReason: failureReason,
      });
      input.onProgress?.({
        phase: "understand_page",
        status: "failed",
        url: page.url,
        index: index + 1,
        total: input.pages.length,
        failureReason,
      });
    }
  }

  return pages;
}

async function understandOwnedContentPage(input: {
  page: OwnedContentPage;
  brand: string;
  model?: string;
}): Promise<PageUnderstanding> {
  const { output } = await generateText({
    model: input.model ?? process.env.CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4",
    output: Output.object({
      schema: understandingSchema,
    }),
    prompt: pageUnderstandingPrompt(input),
  });

  return understandingSchema.parse(output);
}

function pageUnderstandingPrompt(input: {
  page: OwnedContentPage;
  brand: string;
}) {
  const page = input.page;

  return [
    "You label one owned website page for ContentDesk inventory.",
    "Use only the page facts provided. Do not use outside knowledge.",
    "Do not recommend content. Do not infer content gaps. Do not write buyer prompts.",
    "Return only the requested JSON shape.",
    "",
    `Brand: ${input.brand}`,
    "",
    "Page facts:",
    JSON.stringify(
      {
        url: page.url,
        title: page.title,
        h1: page.h1,
        metaDescription: page.metaDescription,
        headings: page.headings.slice(0, 16),
        pageType: page.pageType,
        excerpt: page.excerpt.slice(0, 6000),
      },
      null,
      2,
    ),
  ].join("\n");
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}
