import { selectPrompts } from "./prompt-select";
import { scanPrompts } from "./prompt-scan";

const selectedScanConfigPath = "data/tiny-lemon/visibility/prompts.selected.json";

async function main() {
  console.log("[visibility:scan] selecting prompts");
  await selectPrompts({ selectedScanConfigPath });

  console.log("[visibility:scan] scanning selected prompts");
  const { outputPath, run } = await scanPrompts({
    inputPath: selectedScanConfigPath,
  });

  console.log(`[visibility:scan] wrote ${outputPath}`);
  console.log(
    `[visibility:scan] summary: ${run.summary.brandMentionedCount}/${run.summary.promptCount} mentioned, ${run.summary.brandCitedCount}/${run.summary.promptCount} cited, average visibility ${run.summary.averageVisibilityScore}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
