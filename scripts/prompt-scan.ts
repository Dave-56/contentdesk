import "@/lib/load-env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPromptScanRun } from "@/lib/prompt-scan/analyzer";
import { runPerplexityPrompt } from "@/lib/prompt-scan/perplexity";
import { promptScanConfigSchema } from "@/lib/prompt-scan/schemas";

const inputPath = process.argv[2] ?? "data/tiny-lemon/visibility/prompts.all.json";
const outputDir = "data/tiny-lemon/visibility/runs";

export async function scanPrompts(input: {
  inputPath?: string;
  outputDir?: string;
  apiKey?: string;
} = {}) {
  const resolvedInputPath = input.inputPath ?? inputPath;
  const resolvedOutputDir = input.outputDir ?? outputDir;
  const apiKey = process.env.PERPLEXITY_API_KEY;
  const resolvedApiKey = input.apiKey ?? apiKey;
  if (!resolvedApiKey) {
    throw new Error("PERPLEXITY_API_KEY is required to run prompt:scan.");
  }

  const config = promptScanConfigSchema.parse(
    JSON.parse(await readFile(resolvedInputPath, "utf8")),
  );
  const runDate = new Date();
  const results = [];

  for (const prompt of config.prompts) {
    console.log(`[prompt:scan] ${prompt.id}`);
    const result = await runPerplexityPrompt({
      apiKey: resolvedApiKey,
      prompt: prompt.prompt,
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
    `${runDate.toISOString().slice(0, 10)}.json`,
  );
  await writeFile(outputPath, `${JSON.stringify(run, null, 2)}\n`);

  console.log(`[prompt:scan] wrote ${outputPath}`);
  console.log(
    `[prompt:scan] ${run.summary.tinyLemonMentionedCount}/${run.summary.promptCount} mentioned, ${run.summary.tinyLemonCitedCount}/${run.summary.promptCount} cited, average visibility ${run.summary.averageVisibilityScore}`,
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
