import "@/lib/load-env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inferBuyerPromptStrategyFromWebsite } from "@/lib/buyer-prompt-strategist/infer";

export async function inferPrompts(input: {
  url: string;
  outputDir?: string;
}) {
  const inferred = await inferBuyerPromptStrategyFromWebsite({ url: input.url });
  const outputDir =
    input.outputDir ??
    path.join("data", slug(inferred.strategy.brand.name), "visibility");
  const strategyPath = path.join(outputDir, "strategy.json");
  const siteProfilePath = path.join(outputDir, "site-profile.json");
  const researchSourcesPath = path.join(outputDir, "research-sources.inferred.json");

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    strategyPath,
    `${JSON.stringify(inferred.strategy, null, 2)}\n`,
  );
  await writeFile(
    siteProfilePath,
    `${JSON.stringify(inferred.siteProfile, null, 2)}\n`,
  );
  await writeFile(
    researchSourcesPath,
    `${JSON.stringify(inferred.researchSources, null, 2)}\n`,
  );

  console.log(`[prompt:infer] wrote ${strategyPath}`);
  console.log(`[prompt:infer] wrote ${siteProfilePath}`);
  console.log(`[prompt:infer] wrote ${researchSourcesPath}`);
  if (inferred.strategy.competitors.length === 0) {
    console.warn(
      "[prompt:infer] warning: no competitors inferred. Review strategy.json before selecting prompts.",
    );
  }
  console.log(
    "[prompt:infer] draft only. Review strategy.json, then run prompt:select.",
  );

  return {
    ...inferred,
    strategyPath,
    siteProfilePath,
    researchSourcesPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) throw new Error("Usage: npm run prompt:infer -- --url https://example.com");
  await inferPrompts({ url: args.url, outputDir: args.outputDir });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function parseArgs(args: string[]) {
  const parsed: {
    url?: string;
    outputDir?: string;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--url") {
      parsed.url = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--out") {
      parsed.outputDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg?.startsWith("http://") || arg?.startsWith("https://")) {
      parsed.url = arg;
    }
  }

  return parsed;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "brand";
}
