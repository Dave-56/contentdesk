import "@/lib/load-env";
import { scanPrompts } from "./prompt-scan";
import { recommendVisibility } from "./visibility-recommend";
import { synthesizeVisibility } from "./visibility-synthesize";
import type { PromptScanConfig } from "@/lib/prompt-scan/schemas";
import type { ProviderRunError } from "@/lib/visibility/synthesis";

const defaultInputPath = "data/tiny-lemon/visibility/prompts.selected.json";
const defaultOutputDir = "data/tiny-lemon/visibility/runs";
const providers: PromptScanConfig["provider"][] = ["perplexity", "openai", "anthropic"];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDate = args.date ? new Date(`${args.date}T00:00:00.000Z`) : new Date();
  const date = runDate.toISOString().slice(0, 10);
  const inputPath = args.inputPath ?? defaultInputPath;
  const outputDir = args.outputDir ?? defaultOutputDir;

  console.log(`[visibility:run] input ${inputPath}`);
  console.log(`[visibility:run] date ${date}`);

  const providerErrors: ProviderRunError[] = [];

  for (const provider of providers) {
    console.log(`[visibility:run] scanning ${provider}`);
    try {
      await scanPrompts({
        inputPath,
        outputDir,
        providerOverride: provider,
        runDate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerErrors.push({ provider, error: message });
      console.error(`[visibility:run] ${provider} failed: ${message}`);
    }
  }

  console.log("[visibility:run] synthesizing provider runs");
  const { outputPath: summaryPath } = await synthesizeVisibility({
    date,
    runsDir: outputDir,
    allowPartial: true,
    providerErrors,
  });

  if (args.recommend) {
    console.log("[visibility:run] recommending from synthesis");
    await recommendVisibility({
      summaryPath,
      outputPath: args.recommendOutputPath,
    });
  }

  console.log(`[visibility:run] complete ${summaryPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function parseArgs(args: string[]) {
  const parsed: {
    inputPath?: string;
    outputDir?: string;
    date?: string;
    recommend?: boolean;
    recommendOutputPath?: string;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") {
      parsed.inputPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--out-dir") {
      parsed.outputDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--date") {
      parsed.date = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--recommend") {
      parsed.recommend = true;
      continue;
    }
    if (arg === "--recommend-out") {
      parsed.recommendOutputPath = args[index + 1];
      index += 1;
      continue;
    }
  }

  return parsed;
}
