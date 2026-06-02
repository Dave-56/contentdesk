import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buyerPromptStrategyInputSchema } from "@/lib/buyer-prompt-strategist/schemas";
import { promptScanRunSchema } from "@/lib/prompt-scan/schemas";
import { siteProfileSchema } from "@/lib/reddit-teardown/schemas";
import { buildVisibilityRecommendations } from "@/lib/visibility/recommender";

const defaultStrategyPath = "data/tiny-lemon/visibility/strategy.json";
const defaultRunPath = "data/tiny-lemon/visibility/runs/2026-06-01.json";
const defaultSiteProfilePath = "data/tiny-lemon/visibility/site-profile.json";
const defaultOutputPath = "data/tiny-lemon/visibility/recommendations.json";

export async function recommendVisibility(input: {
  strategyPath?: string;
  runPath?: string;
  siteProfilePath?: string;
  outputPath?: string;
} = {}) {
  const strategyPath = input.strategyPath ?? defaultStrategyPath;
  const runPath = input.runPath ?? defaultRunPath;
  const siteProfilePath = input.siteProfilePath ?? defaultSiteProfilePath;
  const outputPath = input.outputPath ?? defaultOutputPath;
  const strategy = buyerPromptStrategyInputSchema.parse(
    JSON.parse(await readFile(strategyPath, "utf8")),
  );
  const run = promptScanRunSchema.parse(JSON.parse(await readFile(runPath, "utf8")));
  const siteProfile = await readOptionalJson(siteProfilePath, siteProfileSchema);
  const recommendations = buildVisibilityRecommendations({ strategy, run, siteProfile });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(recommendations, null, 2)}\n`);

  const top = recommendations.recommendations[0];
  console.log(`[visibility:recommend] wrote ${outputPath}`);
  if (top) {
    console.log(`[visibility:recommend] #1 ${top.title}`);
    console.log(`[visibility:recommend] recheck ${top.recheck.promptIds.join(", ")}`);
  } else {
    console.log("[visibility:recommend] no recommendations");
  }

  return {
    recommendations,
    outputPath,
  };
}

async function main() {
  await recommendVisibility(parseArgs(process.argv.slice(2)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function parseArgs(args: string[]) {
  const parsed: {
    strategyPath?: string;
    runPath?: string;
    siteProfilePath?: string;
    outputPath?: string;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--strategy") {
      parsed.strategyPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--run") {
      parsed.runPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--site-profile") {
      parsed.siteProfilePath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--out") {
      parsed.outputPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg && !parsed.runPath) parsed.runPath = arg;
  }

  return parsed;
}

async function readOptionalJson<T>(
  filePath: string,
  schema: { parse(value: unknown): T },
) {
  try {
    return schema.parse(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
}
