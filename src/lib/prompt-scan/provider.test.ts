import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnthropicProvider,
  extractAnthropicAnswerText,
  extractAnthropicCitedUrls,
} from "@/lib/prompt-scan/anthropic";
import {
  createOpenAiProvider,
  extractOpenAiAnswerText,
  extractOpenAiCitedUrls,
} from "@/lib/prompt-scan/openai";
import { createPerplexityProvider } from "@/lib/prompt-scan/perplexity";
import { resolvePromptProvider } from "@/lib/prompt-scan/provider";

test("resolves perplexity provider when key exists", () => {
  const provider = resolvePromptProvider({
    provider: "perplexity",
    env: {
      perplexityApiKey: "test-key",
    },
  });

  assert.equal(provider.id, "perplexity");
  assert.equal(typeof provider.scanPrompt, "function");
});

test("perplexity provider calls injected prompt runner", async () => {
  const calls: Array<{ apiKey: string; prompt: string }> = [];
  const provider = createPerplexityProvider({
    apiKey: "test-key",
    async runPrompt(input) {
      calls.push(input);
      return {
        answerText: "Tiny Lemon is mentioned.",
        citedUrls: ["https://tinylemon.xyz/"],
      };
    },
  });

  const result = await provider.scanPrompt({
    prompt: "Best AI model photo app?",
    brand: {
      name: "Tiny Lemon",
      aliases: [],
      domains: ["tinylemon.xyz"],
    },
    competitors: [],
  });

  assert.deepEqual(calls, [
    {
      apiKey: "test-key",
      prompt: "Best AI model photo app?",
    },
  ]);
  assert.deepEqual(result, {
    answerText: "Tiny Lemon is mentioned.",
    citedUrls: ["https://tinylemon.xyz/"],
  });
});

test("missing perplexity key throws clear error", () => {
  assert.throws(
    () =>
      resolvePromptProvider({
        provider: "perplexity",
        env: {},
      }),
    /PERPLEXITY_API_KEY is required for perplexity prompt scans/,
  );
});

test("resolves openai provider when key exists", () => {
  const provider = resolvePromptProvider({
    provider: "openai",
    env: {
      openaiApiKey: "test-key",
    },
  });

  assert.equal(provider.id, "openai");
  assert.equal(typeof provider.scanPrompt, "function");
});

test("resolves anthropic provider when key exists", () => {
  const provider = resolvePromptProvider({
    provider: "anthropic",
    env: {
      anthropicApiKey: "test-key",
    },
  });

  assert.equal(provider.id, "anthropic");
  assert.equal(typeof provider.scanPrompt, "function");
});

test("openai provider requires only openai key", () => {
  assert.throws(
    () =>
      resolvePromptProvider({
        provider: "openai",
        env: {},
      }),
    /OPENAI_API_KEY is required for openai prompt scans/,
  );
});

test("anthropic provider requires only anthropic key", () => {
  assert.throws(
    () =>
      resolvePromptProvider({
        provider: "anthropic",
        env: {},
      }),
    /ANTHROPIC_API_KEY is required for anthropic prompt scans/,
  );
});

test("openai provider calls injected prompt runner", async () => {
  const calls: Array<{ apiKey: string; prompt: string }> = [];
  const provider = createOpenAiProvider({
    apiKey: "openai-key",
    async runPrompt(input) {
      calls.push(input);
      return {
        answerText: "Tiny Lemon is mentioned.",
        citedUrls: ["https://tinylemon.xyz/"],
      };
    },
  });

  const result = await provider.scanPrompt({
    prompt: "Best AI model photo app?",
    brand: {
      name: "Tiny Lemon",
      aliases: [],
      domains: ["tinylemon.xyz"],
    },
    competitors: [],
  });

  assert.deepEqual(calls, [
    {
      apiKey: "openai-key",
      prompt: "Best AI model photo app?",
    },
  ]);
  assert.deepEqual(result, {
    answerText: "Tiny Lemon is mentioned.",
    citedUrls: ["https://tinylemon.xyz/"],
  });
});

test("anthropic provider calls injected prompt runner", async () => {
  const calls: Array<{ apiKey: string; prompt: string }> = [];
  const provider = createAnthropicProvider({
    apiKey: "anthropic-key",
    async runPrompt(input) {
      calls.push(input);
      return {
        answerText: "Tiny Lemon is mentioned.",
        citedUrls: ["https://tinylemon.xyz/"],
      };
    },
  });

  const result = await provider.scanPrompt({
    prompt: "Best AI model photo app?",
    brand: {
      name: "Tiny Lemon",
      aliases: [],
      domains: ["tinylemon.xyz"],
    },
    competitors: [],
  });

  assert.deepEqual(calls, [
    {
      apiKey: "anthropic-key",
      prompt: "Best AI model photo app?",
    },
  ]);
  assert.deepEqual(result, {
    answerText: "Tiny Lemon is mentioned.",
    citedUrls: ["https://tinylemon.xyz/"],
  });
});

test("extracts openai answer text and web search urls", () => {
  const response = {
    output_text: "Tiny Lemon appears in some Shopify app discussions.",
    output: [
      {
        type: "web_search_call",
        action: {
          sources: [{ url: "https://example.com/source" }],
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Tiny Lemon appears in some Shopify app discussions.",
            annotations: [
              {
                type: "url_citation",
                url: "https://tinylemon.xyz/",
              },
            ],
          },
        ],
      },
    ],
  };

  assert.equal(
    extractOpenAiAnswerText(response),
    "Tiny Lemon appears in some Shopify app discussions.",
  );
  assert.deepEqual(extractOpenAiCitedUrls(response), [
    "https://tinylemon.xyz/",
    "https://example.com/source",
  ]);
});

test("openai citation extraction falls back to empty url list", () => {
  assert.deepEqual(
    extractOpenAiCitedUrls({
      output_text: "No citations here.",
      output: [],
    }),
    [],
  );
});

test("extracts anthropic answer text and web search urls", () => {
  const response = {
    content: [
      {
        type: "server_tool_use",
        name: "web_search",
        input: {
          query: "Tiny Lemon Shopify AI model photos",
        },
      },
      {
        type: "web_search_tool_result",
        content: [
          {
            type: "web_search_result",
            url: "https://example.com/search-result",
            title: "Search result",
          },
        ],
      },
      {
        type: "text",
        text: "Tiny Lemon appears in Shopify AI photo discussions.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://tinylemon.xyz/",
            title: "Tiny Lemon",
          },
        ],
      },
    ],
  };

  assert.equal(
    extractAnthropicAnswerText(response),
    "Tiny Lemon appears in Shopify AI photo discussions.",
  );
  assert.deepEqual(extractAnthropicCitedUrls(response), [
    "https://tinylemon.xyz/",
    "https://example.com/search-result",
  ]);
});

test("anthropic citation extraction falls back to empty url list", () => {
  assert.deepEqual(
    extractAnthropicCitedUrls({
      content: [
        {
          type: "text",
          text: "No citations here.",
        },
      ],
    }),
    [],
  );
});
