import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promptScanRunSchema, type PromptScanConfig } from "@/lib/prompt-scan/schemas";
import {
  buildCrossProviderSynthesis,
  type ProviderRunError,
} from "@/lib/visibility/synthesis";

const defaultRunsDir = "data/tiny-lemon/visibility/runs";
const providers = ["perplexity", "openai", "anthropic"] as const;

type LoadedProviderRun =
  | { run: ReturnType<typeof promptScanRunSchema.parse>; error?: never }
  | { run?: never; error: ProviderRunError }
  | { run?: never; error?: never };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await synthesizeVisibility(args);
}

export async function synthesizeVisibility(input: {
  date?: string;
  runsDir?: string;
  outputPath?: string;
  allowPartial?: boolean;
  providerErrors?: ProviderRunError[];
} = {}) {
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const runsDir = input.runsDir ?? defaultRunsDir;
  const outputPath = input.outputPath ?? path.join(runsDir, `${date}.summary.json`);
  const failedProviders = new Set((input.providerErrors ?? []).map((error) => error.provider));
  const loaded: LoadedProviderRun[] = await Promise.all(
    providers.map((provider) =>
      failedProviders.has(provider)
        ? Promise.resolve<LoadedProviderRun>({})
        : readProviderRun({
            provider,
            date,
            runsDir,
            allowPartial: input.allowPartial ?? false,
          }),
    ),
  );
  const runs = loaded.flatMap((item) => item.run ? [item.run] : []);
  const missingErrors = loaded.flatMap((item) => item.error ? [item.error] : []);
  const synthesis = buildCrossProviderSynthesis({
    runs,
    providerErrors: [...(input.providerErrors ?? []), ...missingErrors],
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(synthesis, null, 2)}\n`);

  console.log(`[visibility:synthesize] wrote ${outputPath}`);
  console.log(
    `[visibility:synthesize] ${synthesis.summary.promptCount} prompts, ${synthesis.summary.providerCount} providers, ${synthesis.summary.repeatedGapCount} repeated gaps`,
  );

  return {
    synthesis,
    outputPath,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function parseArgs(args: string[]) {
  const parsed: {
    date?: string;
    runsDir?: string;
    outputPath?: string;
    allowPartial?: boolean;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--date") {
      parsed.date = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--runs-dir") {
      parsed.runsDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--out") {
      parsed.outputPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--allow-partial") {
      parsed.allowPartial = true;
      continue;
    }
    if (arg && !parsed.date) parsed.date = arg;
  }

  return parsed;
}

async function readProviderRun(input: {
  provider: PromptScanConfig["provider"];
  date: string;
  runsDir: string;
  allowPartial: boolean;
}): Promise<LoadedProviderRun> {
  const runPath = path.join(input.runsDir, `${input.date}.${input.provider}.json`);

  try {
    return {
      run: promptScanRunSchema.parse(JSON.parse(await readFile(runPath, "utf8"))),
    };
  } catch (error) {
    if (!input.allowPartial) throw error;

    return {
      error: {
        provider: input.provider,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
