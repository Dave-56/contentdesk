import "@/lib/load-env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBuyerPromptPortfolio } from "@/lib/buyer-prompt-strategist";
import { buyerPromptStrategyInputSchema } from "@/lib/buyer-prompt-strategist/schemas";
import { promptScanConfigSchema } from "@/lib/prompt-scan/schemas";

const defaultInputPath = "data/tiny-lemon/visibility/strategy.json";
const defaultOutputDir = "data/tiny-lemon/visibility";

export async function selectPrompts(input: {
  inputPath?: string;
  outputDir?: string;
  portfolioPath?: string;
  selectedScanConfigPath?: string;
  allowManualReview?: boolean;
} = {}) {
  const strategy = buyerPromptStrategyInputSchema.parse(
    JSON.parse(await readFile(input.inputPath ?? defaultInputPath, "utf8")),
  );
  const outputDir = input.outputDir ?? defaultOutputDir;
  const resolvedPortfolioPath =
    input.portfolioPath ?? path.join(outputDir, "portfolio.json");
  const resolvedSelectedScanConfigPath =
    input.selectedScanConfigPath ?? path.join(outputDir, "prompts.selected.json");
  const portfolio = await buildBuyerPromptPortfolio({
    strategy,
    allowManualReview: input.allowManualReview,
  });
  const selectedScanConfig = promptScanConfigSchema.parse({
    brand: strategy.brand,
    provider: strategy.provider,
    defaultRecheckDays: strategy.defaultRecheckDays,
    experimentWindowDays: strategy.experimentWindowDays,
    competitors: strategy.competitors,
    assetInventory: strategy.assetInventory,
    prompts: portfolio.selectedPrompts,
  });

  await mkdir(path.dirname(resolvedPortfolioPath), { recursive: true });
  await writeFile(
    resolvedPortfolioPath,
    `${JSON.stringify(portfolio, null, 2)}\n`,
  );
  await writeFile(
    resolvedSelectedScanConfigPath,
    `${JSON.stringify(selectedScanConfig, null, 2)}\n`,
  );

  console.log(`[prompt:select] wrote ${resolvedPortfolioPath}`);
  console.log(`[prompt:select] wrote ${resolvedSelectedScanConfigPath}`);
  console.log(
    `[prompt:select] selected ${portfolio.selectedPrompts.length}/${portfolio.candidates.length} prompts`,
  );

  return {
    portfolio,
    selectedScanConfig,
    strategy,
    portfolioPath: resolvedPortfolioPath,
    selectedScanConfigPath: resolvedSelectedScanConfigPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await selectPrompts(args);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function parseArgs(args: string[]) {
  const parsed: {
    inputPath?: string;
    outputDir?: string;
    allowManualReview?: boolean;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--url" || arg?.startsWith("http://") || arg?.startsWith("https://")) {
      throw new Error(
        "prompt:select only uses reviewed strategy files. Use npm run prompt:infer -- --url <url> first.",
      );
    }
    if (arg === "--out") {
      parsed.outputDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--force") {
      parsed.allowManualReview = true;
      continue;
    }
    if (arg && !parsed.inputPath) parsed.inputPath = arg;
  }

  return parsed;
}
