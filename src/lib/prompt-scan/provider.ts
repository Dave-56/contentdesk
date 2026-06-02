import type { ProviderPromptResult } from "@/lib/prompt-scan/analyzer";
import { createAnthropicProvider } from "@/lib/prompt-scan/anthropic";
import { createOpenAiProvider } from "@/lib/prompt-scan/openai";
import { createPerplexityProvider } from "@/lib/prompt-scan/perplexity";
import type { PromptScanConfig } from "@/lib/prompt-scan/schemas";

export type PromptProvider = {
  id: PromptScanConfig["provider"];
  scanPrompt(input: {
    prompt: string;
    brand: PromptScanConfig["brand"];
    competitors: PromptScanConfig["competitors"];
  }): Promise<ProviderPromptResult>;
};

export type PromptProviderEnv = {
  perplexityApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
};

export function resolvePromptProvider(input: {
  provider: PromptScanConfig["provider"];
  env: PromptProviderEnv;
}): PromptProvider {
  if (input.provider === "perplexity") {
    if (!input.env.perplexityApiKey) {
      throw new Error("PERPLEXITY_API_KEY is required for perplexity prompt scans.");
    }

    return createPerplexityProvider({
      apiKey: input.env.perplexityApiKey,
    });
  }

  if (input.provider === "openai") {
    if (!input.env.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required for openai prompt scans.");
    }

    return createOpenAiProvider({
      apiKey: input.env.openaiApiKey,
    });
  }

  if (input.provider === "anthropic") {
    if (!input.env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for anthropic prompt scans.");
    }

    return createAnthropicProvider({
      apiKey: input.env.anthropicApiKey,
    });
  }

  const exhaustive: never = input.provider;
  throw new Error(`Unknown prompt provider: ${exhaustive}`);
}
