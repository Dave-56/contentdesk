import "@/lib/load-env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPromptScanRun } from "@/lib/prompt-scan/analyzer";
import { resolvePromptProvider } from "@/lib/prompt-scan/provider";
import { promptScanConfigSchema, type PromptScanConfig } from "@/lib/prompt-scan/schemas";

const inputPath = process.argv[2] ?? "data/tiny-lemon/visibility/prompts.all.json";
const outputDir = "data/tiny-lemon/visibility/runs";

export async function scanPrompts(input: {
  inputPath?: string;
  outputDir?: string;
  apiKey?: string;
  providerOverride?: PromptScanConfig["provider"];
  runDate?: Date;
} = {}) {
  const resolvedInputPath = input.inputPath ?? inputPath;
  const resolvedOutputDir = input.outputDir ?? outputDir;
  const parsedConfig = promptScanConfigSchema.parse(
    JSON.parse(await readFile(resolvedInputPath, "utf8")),
  );
  const config = {
    ...parsedConfig,
    provider: input.providerOverride ?? parsedConfig.provider,
  };
  const provider = resolvePromptProvider({
    provider: config.provider,
    env: {
      perplexityApiKey: input.apiKey ?? process.env.PERPLEXITY_API_KEY,
      openaiApiKey: input.apiKey ?? process.env.OPENAI_API_KEY,
      anthropicApiKey: input.apiKey ?? process.env.ANTHROPIC_API_KEY,
    },
  });
  const runDate = input.runDate ?? new Date();
  const results = [];

  for (const prompt of config.prompts) {
    console.log(`[prompt:scan] ${prompt.id}`);
    const result = await provider.scanPrompt({
      prompt: prompt.prompt,
      brand: config.brand,
      competitors: config.competitors,
    });
    results.push({ prompt, result });
  }

  const run = buildPromptScanRun({
    config,
    results,
    runDate,
  });

  await mkdir(resolvedOutputDir, { recursive: true });
  const outputPath = path.join(
    resolvedOutputDir,
    `${runDate.toISOString().slice(0, 10)}.${config.provider}.json`,
  );
  await writeFile(outputPath, `${JSON.stringify(run, null, 2)}\n`);

  console.log(`[prompt:scan] wrote ${outputPath}`);
  console.log(
    `[prompt:scan] ${run.summary.brandMentionedCount}/${run.summary.promptCount} mentioned, ${run.summary.brandCitedCount}/${run.summary.promptCount} cited, average visibility ${run.summary.averageVisibilityScore}`,
  );

  return {
    run,
    outputPath,
  };
}

async function main() {
  await scanPrompts();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
