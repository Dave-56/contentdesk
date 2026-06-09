import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildTopicBriefFromVisibilityRecommendation,
  getLatestVisibilityRecommendationForSlack,
  getSlackDefaultMode,
  isVisibilityRecommendationStale,
} from "@/lib/visibility/slack-adapter";
import type { BrandProfile } from "@/lib/schemas";

test("getSlackDefaultMode defaults to topics and accepts visibility", () => {
  const previous = process.env.CONTENTDESK_SLACK_DEFAULT;
  delete process.env.CONTENTDESK_SLACK_DEFAULT;
  assert.equal(getSlackDefaultMode(), "topics");

  process.env.CONTENTDESK_SLACK_DEFAULT = "visibility";
  assert.equal(getSlackDefaultMode(), "visibility");

  process.env.CONTENTDESK_SLACK_DEFAULT = "bogus";
  assert.equal(getSlackDefaultMode(), "topics");
  if (previous === undefined) {
    delete process.env.CONTENTDESK_SLACK_DEFAULT;
  } else {
    process.env.CONTENTDESK_SLACK_DEFAULT = previous;
  }
});

test("latest visibility recommendation returns null when file is missing", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "contentdesk-empty-"));
  const recommendation = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brandProfileFixture(),
    dataDir,
  });

  assert.equal(recommendation, null);
});

test("latest visibility recommendation validates malformed JSON", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "contentdesk-bad-json-"));
  await mkdir(path.join(dataDir, "tiny-lemon", "visibility"), { recursive: true });
  await writeFile(
    path.join(dataDir, "tiny-lemon", "visibility", "recommendations.json"),
    "{ nope",
  );

  await assert.rejects(
    getLatestVisibilityRecommendationForSlack({
      brandProfile: brandProfileFixture(),
      dataDir,
    }),
    /Unexpected token|JSON/,
  );
});

test("latest visibility recommendation sorts by generatedAt", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "contentdesk-latest-"));
  await writeRecommendationFile({
    dataDir,
    slug: "tiny-lemon",
    generatedAt: "2026-06-01T00:00:00.000Z",
    title: "Old recommendation",
    taskType: "guide",
  });
  await writeRecommendationFile({
    dataDir,
    slug: "tinylemon-xyz",
    generatedAt: "2026-06-03T00:00:00.000Z",
    title: "New recommendation",
    taskType: "alternative_page",
  });

  const recommendation = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brandProfileFixture(),
    dataDir,
  });

  assert.equal(recommendation?.title, "New recommendation");
  assert.equal(recommendation?.taskType, "alternative_page");
  assert.equal(recommendation?.productionSupported, true);
});

test("unsupported task types fail closed for production support", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "contentdesk-unsupported-"));
  await writeRecommendationFile({
    dataDir,
    slug: "tiny-lemon",
    taskType: "shopify_app_store_listing",
  });

  const recommendation = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brandProfileFixture(),
    dataDir,
  });

  assert.equal(recommendation?.productionSupported, false);
});

test("stale check catches changed recommendation hash", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "contentdesk-stale-"));
  await writeRecommendationFile({
    dataDir,
    slug: "tiny-lemon",
    title: "Original recommendation",
  });
  const rendered = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brandProfileFixture(),
    dataDir,
  });
  assert.ok(rendered);

  await writeRecommendationFile({
    dataDir,
    slug: "tiny-lemon",
    title: "Changed recommendation",
  });
  const current = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brandProfileFixture(),
    dataDir,
  });

  assert.equal(
    isVisibilityRecommendationStale({
      rendered,
      current,
      actionHash: rendered.hash,
      actionRunId: rendered.runId,
    }),
    true,
  );
});

test("TopicBrief builder preserves visibility evidence", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "contentdesk-builder-"));
  await writeRecommendationFile({
    dataDir,
    slug: "tiny-lemon",
    taskType: "comparison_page",
  });
  const recommendation = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brandProfileFixture(),
    dataDir,
  });
  assert.ok(recommendation);

  const topic = buildTopicBriefFromVisibilityRecommendation({
    recommendation,
    brandProfile: brandProfileFixture(),
  });

  assert.equal(topic.strategyType, "comparison");
  assert.equal(topic.assetIntent, "customer_winning_comparison");
  assert.equal(topic.brandInclusion?.required, true);
  assert.equal(topic.brandInclusion?.fit, "strong");
  assert.equal(topic.brandInclusion?.targetCompetitor, "Botika");
  assert.equal(topic.brandInclusion?.ctaRequired, true);
  assert.ok(topic.brandInclusion?.aliases.includes("Tiny Lemon"));
  assert.ok(topic.brandInclusion?.comparisonSet.includes("Tiny Lemon"));
  assert.match(topic.workingTitle, /Build Botika comparison page/);
  assert.match(topic.strategyEvidence.join(" "), /Dominant source format/);
  assert.match(topic.strategyEvidence.join(" "), /Brand inclusion required/);
  assert.match(topic.strategyEvidence.join(" "), /Botika/);
  assert.match(topic.proofAngle, /tinylemon.xyz/);
  assert.deepEqual(topic.sourceLinks[0], "https://tinylemon.xyz/blog/modelia-alternatives");
});

test("comparison recommendation without product fit fails closed for production", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "contentdesk-fit-gate-"));
  await writeRecommendationFile({
    dataDir,
    slug: "tiny-lemon",
    taskType: "comparison_page",
    brandFit: "weak",
  });

  const recommendation = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brandProfileFixture(),
    dataDir,
  });

  assert.equal(recommendation?.productionSupported, false);
});

async function writeRecommendationFile(input: {
  dataDir: string;
  slug: string;
  generatedAt?: string;
  title?: string;
  taskType?: string;
  brandFit?: "strong" | "medium" | "weak" | "none";
}) {
  const outputDir = path.join(input.dataDir, input.slug, "visibility");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "recommendations.json"),
    `${JSON.stringify(recommendationsFixture(input), null, 2)}\n`,
  );
}

function brandProfileFixture(): BrandProfile {
  return {
    appName: "Tiny Lemon",
    targetMerchant: "Shopify fashion brands",
    positioning: "AI model photos for Shopify fashion stores.",
    featuresUseCases: ["Create model photos from flat-lay product images"],
    competitors: ["Botika"],
    preferredVoice: "clear",
    preferredVisuals: [],
    visualsToAvoid: [],
    forbiddenClaims: [],
    ctaStyle: "Try Tiny Lemon on Shopify.",
    existingBlogDocsUrls: ["https://tinylemon.xyz/blog"],
  };
}

function recommendationsFixture(input: {
  generatedAt?: string;
  title?: string;
  taskType?: string;
  brandFit?: "strong" | "medium" | "weak" | "none";
}) {
  return {
    brand: "Tiny Lemon",
    provider: "synthesis",
    providers: ["perplexity", "openai", "anthropic"],
    generatedAt: input.generatedAt ?? "2026-06-02T00:00:00.000Z",
    basedOnRunDate: "2026-06-02T00:00:00.000Z",
    summary: {
      promptCount: 1,
      brandMentionedCount: 0,
      brandCitedCount: 0,
      competitorOnlyCount: 1,
      averageVisibilityScore: 0,
    },
    recommendations: [
      {
        rank: 1,
        title: input.title ?? "Build Botika comparison page",
        taskType: input.taskType ?? "comparison_page",
        priority: "high",
        confidence: "high",
        targetPromptId: "competitor-botika-comparison",
        targetPrompt:
          "How does Tiny Lemon compare with Botika for Shopify fashion brands?",
        why: [
          "Competitor-only answers cite comparison pages.",
          "Tiny Lemon is not cited for this buyer prompt.",
        ],
        evidence: {
          promptGroup: "competitor_comparison",
          brandMentioned: false,
          brandCited: false,
          competitorsMentioned: ["Botika"],
          citedDomains: ["tinylemon.xyz", "botika.io"],
          dominantSourceFormat: "comparison_page",
          missingOrWeakAssetType: "comparison_page",
          targetCompetitor: "Botika",
          targetCompetitorAssetStatus: "missing",
          brandFit: input.brandFit ?? "strong",
          brandFitAngle:
            "Tiny Lemon fits Shopify fashion brands evaluating AI model photos when they need flat-lay to model images.",
          relatedAssets: [
            {
              title: "Modelia alternatives",
              url: "https://tinylemon.xyz/blog/modelia-alternatives",
              matchedCompetitors: ["Modelia"],
            },
          ],
        },
        recheck: {
          promptIds: ["competitor-botika-comparison"],
          afterPublish: true,
          cadenceDays: 1,
        },
      },
    ],
  };
}
