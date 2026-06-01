import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPromptScanRun } from "@/lib/prompt-scan/analyzer";
import { runPerplexityPrompt } from "@/lib/prompt-scan/perplexity";
import { promptScanConfigSchema } from "@/lib/prompt-scan/schemas";

const inputPath = process.argv[2] ?? "data/tiny-lemon-prompts.json";
const outputDir = "data/prompt-runs";

async function main() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is required to run prompt:scan.");
  }

  const config = promptScanConfigSchema.parse(
    JSON.parse(await readFile(inputPath, "utf8")),
  );
  const runDate = new Date();
  const results = [];

  for (const prompt of config.prompts) {
    console.log(`[prompt:scan] ${prompt.id}`);
    const result = await runPerplexityPrompt({
      apiKey,
      prompt: prompt.prompt,
    });
    results.push({ prompt, result });
  }

  const run = buildPromptScanRun({
    config,
    results,
    runDate,
  });

  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `${runDate.toISOString().slice(0, 10)}-tiny-lemon.json`,
  );
  await writeFile(outputPath, `${JSON.stringify(run, null, 2)}\n`);

  console.log(`[prompt:scan] wrote ${outputPath}`);
  console.log(
    `[prompt:scan] ${run.summary.tinyLemonMentionedCount}/${run.summary.promptCount} mentioned, ${run.summary.tinyLemonCitedCount}/${run.summary.promptCount} cited, average visibility ${run.summary.averageVisibilityScore}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
