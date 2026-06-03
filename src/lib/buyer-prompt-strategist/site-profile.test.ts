import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProfileEvidence,
  enrichSiteProfile,
  InsufficientSiteProfileEvidenceError,
} from "@/lib/buyer-prompt-strategist/site-profile";

test("Perplexity-confirmed exact-domain identity becomes strong site profile", async () => {
  let sawFirstPartyContext = false;
  await withMockedPerplexity(businessReadFixture(), async () => {
    const result = await enrichSiteProfile({
      url: "https://vanishing.example/",
      env: {
        perplexityApiKey: "test-key",
      },
    });

    assert.equal(result.siteProfile.evidenceQuality, "strong");
    assert.equal(result.businessRead.targetIdentityConfirmed, true);
    assert.equal(result.siteProfile.companyName, "Vanishing");
    assert.equal(result.researchSources[0]?.provider, "perplexity");
    assert.doesNotThrow(() => assertProfileEvidence(result.siteProfile));
  }, {
    inspectRequest(body) {
      const prompt = body.messages?.map((message) => message.content).join("\n") ?? "";
      assert.match(prompt, /First-party context from the target site/);
      assert.match(prompt, /End-to-end encrypted messages with a limited lifespan/);
      assert.match(prompt, /delete it after it has been read/);
      sawFirstPartyContext = true;
    },
  });
  assert.equal(sawFirstPartyContext, true);
});

test("unclear exact-domain identity stops prompt inference for manual review", async () => {
  await withMockedPerplexity({
    ...businessReadFixture(),
    targetIdentityConfirmed: false,
    targetIdentityReason:
      "The target domain only shows a vague title and public sources point to unrelated same-name brands.",
    confidence: {
      targetIdentity: 2,
      product: 3,
      category: 3,
      audience: 3,
      buyerLanguage: 3,
    },
    warnings: [
      {
        field: "targetIdentity",
        message: "Exact target-domain identity is ambiguous.",
        severity: "manual_review",
      },
    ],
  }, async () => {
    const result = await enrichSiteProfile({
      url: "https://xenith.life/",
      env: {
        perplexityApiKey: "test-key",
      },
    });

    assert.equal(result.siteProfile.evidenceQuality, "insufficient");
    assert.ok(
      result.siteProfile.profileWarnings.some(
        (warning) => warning.field === "targetIdentity" && warning.severity === "manual_review",
      ),
    );
    assert.throws(
      () => assertProfileEvidence(result.siteProfile),
      InsufficientSiteProfileEvidenceError,
    );
  });
});

test("weak buyerLanguage nouns are normalized from stronger strategy fields", async () => {
  await withMockedPerplexity({
    ...businessReadFixture(),
    audience: "Creators and teams recording demos",
    category: "browser-based screen recording software",
    product: "browser screen recorder",
    problemSolved: "recording friction",
    conversionGoal: "purchase",
    primaryUseCases: ["recording product demos"],
    buyerLanguage: {
      buyerNoun: "buyer",
      categoryNoun: "screen recording tool buyer",
      productNoun: "screen recorder",
      useCaseNoun: "recording workflow",
      painNoun: "recording friction",
      conversionNoun: "purchase",
      comparisonNoun: "alternative",
    },
  }, async () => {
    const result = await enrichSiteProfile({
      url: "https://vanishing.example/",
      env: {
        perplexityApiKey: "test-key",
      },
    });

    assert.equal(result.businessRead.buyerLanguage.buyerNoun, "Creators and teams recording demos");
    assert.equal(result.businessRead.buyerLanguage.categoryNoun, "browser-based screen recording software");
    assert.equal(
      result.businessRead.buyerLanguage.comparisonNoun,
      "browser-based screen recording software alternatives",
    );
  });
});

test("prompt inference requires Perplexity API key", async () => {
  await assert.rejects(
    () => enrichSiteProfile({
      url: "https://vanishing.example/",
      env: {},
    }),
    /PERPLEXITY_API_KEY/,
  );
});

async function withMockedPerplexity(
  businessRead: Record<string, unknown>,
  run: () => Promise<void>,
  options: {
    inspectRequest?: (body: {
      messages?: Array<{ role?: string; content?: string }>;
    }) => void;
  } = {},
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    if (url === "https://api.perplexity.ai/v1/sonar") {
      options.inspectRequest?.(JSON.parse(String(init?.body ?? "{}")));
      return jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify(businessRead),
          },
        },
      ],
      citations: ["https://vanishing.example/"],
      search_results: [{ url: "https://vanishing.example/" }],
      });
    }
    if (url.endsWith("/assets/app.js")) {
      return textResponse(`
        const homepage = \`
          End-to-end encrypted messages with a limited lifespan.
          This will save a message to a database, then delete it after it has been read some number of times.
        \`;
      `);
    }
    return textResponse(`
      <!doctype html>
      <html>
        <head>
          <title>vanishing.example</title>
          <meta name="description" content="End-to-end encrypted messages with a limited lifespan">
          <script type="module" src="/assets/app.js"></script>
        </head>
        <body><div id="root"></div></body>
      </html>
    `);
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function businessReadFixture() {
  return {
    targetUrl: "https://vanishing.example/",
    targetDomain: "vanishing.example",
    targetIdentityConfirmed: true,
    targetIdentityReason:
      "The public site and answer context both describe Vanishing at vanishing.example.",
    brandName: "Vanishing",
    market: "saas",
    product: "visual regression testing platform",
    category: "visual regression testing tool",
    audience: "frontend engineering teams",
    positioning:
      "Vanishing helps frontend teams catch visual regressions before deployment.",
    problemSolved: "UI regressions slip into production because visual review is manual.",
    solution: "Automated screenshot comparison and visual approval workflows.",
    conversionGoal: "starting a product trial",
    primaryUseCases: ["catching UI regressions", "reviewing visual diffs"],
    buyerLanguage: {
      buyerNoun: "frontend engineering teams",
      categoryNoun: "visual regression testing tool",
      productNoun: "visual testing tool",
      useCaseNoun: "catching UI regressions",
      painNoun: "manual visual QA",
      conversionNoun: "starting a visual testing trial",
      comparisonNoun: "visual regression testing tools",
    },
    competitors: [
      {
        name: "Percy",
        aliases: [],
        domains: ["percy.io"],
        clearAlternative: true,
        confidence: 5,
        reason: "Percy is a direct visual regression testing alternative.",
      },
      {
        name: "Unclear Same Name",
        aliases: [],
        domains: ["same-name.example"],
        clearAlternative: false,
        confidence: 2,
        reason: "Same-name result but not clearly a visual testing product.",
      },
    ],
    confidence: {
      targetIdentity: 5,
      product: 5,
      category: 5,
      audience: 5,
      buyerLanguage: 5,
    },
    warnings: [],
    citations: ["https://vanishing.example/"],
    evidenceSummary:
      "Vanishing is identified as a visual regression testing product at vanishing.example.",
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function textResponse(value: string) {
  return new Response(value, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });
}
