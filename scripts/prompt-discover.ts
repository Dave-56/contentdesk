import "@/lib/load-env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  discoverBuyerPrompts,
  fetchGoogleAutocomplete,
} from "@/lib/buyer-prompt-strategist/discovery";
import { buyerPromptStrategyInputSchema } from "@/lib/buyer-prompt-strategist/schemas";

const defaultInputPath = "data/tiny-lemon/visibility/strategy.json";
const defaultOutputDir = "data/tiny-lemon/visibility";

export async function discoverPrompts(input: {
  inputPath?: string;
  outputDir?: string;
  outputPath?: string;
  offline?: boolean;
} = {}) {
  const inputPath = input.inputPath ?? defaultInputPath;
  const strategy = buyerPromptStrategyInputSchema.parse(
    JSON.parse(await readFile(inputPath, "utf8")),
  );
  const outputDir = input.outputDir ?? defaultOutputDir;
  const outputPath = input.outputPath ?? path.join(outputDir, "prompts.discovered.json");
  const discovery = await discoverBuyerPrompts({
    strategy,
    strategySource: inputPath,
    fetchAutocomplete: input.offline ? undefined : safeAutocompleteFetcher,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(discovery, null, 2)}\n`);

  console.log(`[prompt:discover] wrote ${outputPath}`);
  console.log(
    `[prompt:discover] seed probes ${discovery.seedProbes.length}, evidence-backed candidates ${discovery.candidates.length}`,
  );
  if (input.offline) {
    console.log("[prompt:discover] offline mode: wrote seed probes only.");
  }

  return {
    discovery,
    outputPath,
    strategy,
  };
}

async function safeAutocompleteFetcher(query: string) {
  try {
    return await fetchGoogleAutocomplete(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[prompt:discover] autocomplete skipped for "${query}": ${message}`);
    return [];
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await discoverPrompts(args);
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
    outputPath?: string;
    offline?: boolean;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--url" || arg?.startsWith("http://") || arg?.startsWith("https://")) {
      throw new Error(
        "prompt:discover uses reviewed strategy files. Use npm run prompt:infer -- --url <url> first.",
      );
    }
    if (arg === "--out") {
      parsed.outputDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--output") {
      parsed.outputPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--offline") {
      parsed.offline = true;
      continue;
    }
    if (arg && !parsed.inputPath) parsed.inputPath = arg;
  }

  return parsed;
}
