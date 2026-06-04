import "@/lib/load-env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPromptScanRun, type ProviderPromptResult } from "@/lib/prompt-scan/analyzer";
import { resolvePromptProvider, type PromptProvider } from "@/lib/prompt-scan/provider";
import {
  promptScanConfigSchema,
  promptScanRunSchema,
  type PromptInput,
  type PromptScanConfig,
} from "@/lib/prompt-scan/schemas";

const defaultInputPath = "data/tiny-lemon/visibility/prompts.all.json";
const outputDir = "data/tiny-lemon/visibility/runs";
const defaultTimeoutMs = 120_000;

export async function scanPrompts(input: {
  inputPath?: string;
  outputDir?: string;
  apiKey?: string;
  providerOverride?: PromptScanConfig["provider"];
  runDate?: Date;
  concurrency?: number;
  timeoutMs?: number;
  skipExisting?: boolean;
  force?: boolean;
  provider?: PromptProvider;
} = {}) {
  const resolvedInputPath = input.inputPath ?? defaultInputPath;
  const resolvedOutputDir = input.outputDir ?? outputDir;
  const parsedConfig = promptScanConfigSchema.parse(
    JSON.parse(await readFile(resolvedInputPath, "utf8")),
  );
  const config = {
    ...parsedConfig,
    provider: input.providerOverride ?? parsedConfig.provider,
  };
  const runDate = input.runDate ?? new Date();
  const outputPath = path.join(
    resolvedOutputDir,
    `${runDate.toISOString().slice(0, 10)}.${config.provider}.json`,
  );

  if (input.skipExisting && !input.force) {
    const existing = await readExistingRun(outputPath);
    if (existing) {
      console.log(`[prompt:scan] skip existing ${outputPath}`);
      return {
        run: existing,
        outputPath,
        skipped: true,
      };
    }
  }

  const provider = input.provider ?? resolvePromptProvider({
    provider: config.provider,
    env: {
      perplexityApiKey: input.apiKey ?? process.env.PERPLEXITY_API_KEY,
      openaiApiKey: input.apiKey ?? process.env.OPENAI_API_KEY,
      anthropicApiKey: input.apiKey ?? process.env.ANTHROPIC_API_KEY,
    },
  });
  const concurrency = positiveInt(input.concurrency ?? 1, "concurrency");
  const timeoutMs = positiveInt(input.timeoutMs ?? defaultTimeoutMs, "timeout-ms");

  console.log(
    `[prompt:scan] provider ${config.provider}, prompts ${config.prompts.length}, concurrency ${concurrency}, timeout ${timeoutMs}ms`,
  );
  const results = await mapWithConcurrency(config.prompts, concurrency, async (prompt) => {
    console.log(`[prompt:scan] ${prompt.id}`);
    const result = await scanPromptWithTimeout({
      provider,
      config,
      prompt,
      timeoutMs,
    });
    return { prompt, result };
  });

  const run = buildPromptScanRun({
    config,
    results,
    runDate,
  });

  await mkdir(resolvedOutputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(run, null, 2)}\n`);

  console.log(`[prompt:scan] wrote ${outputPath}`);
  console.log(
    `[prompt:scan] ${run.summary.brandMentionedCount}/${run.summary.promptCount} mentioned, ${run.summary.brandCitedCount}/${run.summary.promptCount} cited, ${run.summary.brandRecommendedCount}/${run.summary.promptCount} recommended, ${run.summary.brandTopPickCount}/${run.summary.promptCount} top pick`,
  );

  return {
    run,
    outputPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await scanPrompts({
    inputPath: args.inputPath,
    concurrency: args.concurrency,
    timeoutMs: args.timeoutMs,
    force: args.force,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

async function scanPromptWithTimeout(input: {
  provider: PromptProvider;
  config: PromptScanConfig;
  prompt: PromptInput;
  timeoutMs: number;
}): Promise<ProviderPromptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    return await input.provider.scanPrompt({
      prompt: input.prompt.prompt,
      brand: input.config.brand,
      competitors: input.config.competitors,
      signal: controller.signal,
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error(`[prompt:scan] ${input.prompt.id} failed: ${message}`);
    return {
      answerText: `[prompt:scan:error] ${message}`,
      citedUrls: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

async function readExistingRun(outputPath: string) {
  try {
    return promptScanRunSchema.parse(JSON.parse(await readFile(outputPath, "utf8")));
  } catch (error) {
    const cause = error as { code?: string };
    if (cause.code === "ENOENT") return null;
    throw error;
  }
}

function parseArgs(args: string[]) {
  const parsed: {
    inputPath?: string;
    concurrency?: number;
    timeoutMs?: number;
    force?: boolean;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--concurrency") {
      parsed.concurrency = Number(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = Number(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--force") {
      parsed.force = true;
      continue;
    }
    if (!arg.startsWith("--") && !parsed.inputPath) {
      parsed.inputPath = arg;
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

function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Prompt scan timed out.";
  }

  return error instanceof Error ? error.message : String(error);
}
