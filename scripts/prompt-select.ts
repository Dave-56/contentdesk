import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBuyerPromptPortfolio } from "@/lib/buyer-prompt-strategist";
import { buyerPromptStrategyInputSchema } from "@/lib/buyer-prompt-strategist/schemas";
import { promptScanConfigSchema } from "@/lib/prompt-scan/schemas";

const inputPath = process.argv[2] ?? "data/tiny-lemon/visibility/strategy.json";
const portfolioPath = "data/tiny-lemon/visibility/portfolio.json";
const selectedScanConfigPath = "data/tiny-lemon/visibility/prompts.selected.json";

export async function selectPrompts(input: {
  inputPath?: string;
  portfolioPath?: string;
  selectedScanConfigPath?: string;
} = {}) {
  const resolvedInputPath = input.inputPath ?? inputPath;
  const resolvedPortfolioPath = input.portfolioPath ?? portfolioPath;
  const resolvedSelectedScanConfigPath =
    input.selectedScanConfigPath ?? selectedScanConfigPath;
  const strategy = buyerPromptStrategyInputSchema.parse(
    JSON.parse(await readFile(resolvedInputPath, "utf8")),
  );
  const portfolio = buildBuyerPromptPortfolio({ strategy });
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
    portfolioPath: resolvedPortfolioPath,
    selectedScanConfigPath: resolvedSelectedScanConfigPath,
  };
}

async function main() {
  await selectPrompts();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
