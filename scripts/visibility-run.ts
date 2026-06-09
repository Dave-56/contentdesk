import "@/lib/load-env";
import { scanPrompts } from "./prompt-scan";
import { recommendVisibility } from "./visibility-recommend";
import { synthesizeVisibility } from "./visibility-synthesize";
import type { PromptScanConfig } from "@/lib/prompt-scan/schemas";
import type { ProviderRunError } from "@/lib/visibility/synthesis";

const defaultInputPath = "data/tiny-lemon/visibility/prompts.selected.json";
const defaultOutputDir = "data/tiny-lemon/visibility/runs";
const providers: PromptScanConfig["provider"][] = ["perplexity", "openai", "anthropic", "gemini"];
const defaultConcurrencyByProvider = {
  perplexity: 3,
  openai: 2,
  anthropic: 3,
  gemini: 3,
} satisfies Record<PromptScanConfig["provider"], number>;
const defaultTimeoutMs = 120_000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDate = args.date ? new Date(`${args.date}T00:00:00.000Z`) : new Date();
  const date = runDate.toISOString().slice(0, 10);
  const inputPath = args.inputPath ?? defaultInputPath;
  const outputDir = args.outputDir ?? defaultOutputDir;

  console.log(`[visibility:run] input ${inputPath}`);
  console.log(`[visibility:run] date ${date}`);
  console.log(
    `[visibility:run] timeout ${args.timeoutMs ?? defaultTimeoutMs}ms, force ${args.force ? "yes" : "no"}`,
  );

  const providerErrors: ProviderRunError[] = [];

  for (const provider of providers) {
    const concurrency = args.concurrency ?? defaultConcurrencyByProvider[provider];
    console.log(`[visibility:run] scanning ${provider} with concurrency ${concurrency}`);
    try {
      await scanPrompts({
        inputPath,
        outputDir,
        providerOverride: provider,
        runDate,
        concurrency,
        timeoutMs: args.timeoutMs ?? defaultTimeoutMs,
        skipExisting: true,
        force: args.force,
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
    concurrency?: number;
    timeoutMs?: number;
    force?: boolean;
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
    if (arg === "--concurrency") {
      parsed.concurrency = positiveInt(Number(args[index + 1]), "concurrency");
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = positiveInt(Number(args[index + 1]), "timeout-ms");
      index += 1;
      continue;
    }
    if (arg === "--force") {
      parsed.force = true;
      continue;
    }
  }

  return parsed;
}

function positiveInt(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer.`);
  }

  return value;
}
