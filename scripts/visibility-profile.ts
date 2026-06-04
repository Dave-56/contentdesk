import "@/lib/load-env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OwnedContentCrawlLimits } from "@/lib/visibility/site-inventory";
import { profileOwnedSiteInventory } from "@/lib/visibility/site-inventory";

export async function profileVisibilitySite(input: {
  url: string;
  outputDir?: string;
  limits?: Partial<OwnedContentCrawlLimits>;
  includeUnderstanding?: boolean;
}) {
  const { siteProfile, inventory } = await profileOwnedSiteInventory({
    url: input.url,
    limits: input.limits,
    includeUnderstanding: input.includeUnderstanding,
    onProgress: (event) => {
      if (event.phase === "crawl_page") {
        console.log(
          `[visibility:profile] crawl ${event.index}/${event.maxPages} ${event.status} ${event.url}${event.pageType ? ` (${event.pageType})` : ""}`,
        );
      }
      if (event.phase === "understand_page") {
        console.log(
          `[visibility:profile] understand ${event.index}/${event.total} ${event.status} ${event.url}`,
        );
      }
    },
  });
  const outputDir =
    input.outputDir ??
    path.join("data", slug(inventory.brand), "visibility");
  const siteProfilePath = path.join(outputDir, "site-profile.json");
  const inventoryPath = path.join(outputDir, "owned-content-inventory.json");

  await mkdir(outputDir, { recursive: true });
  await writeFile(siteProfilePath, `${JSON.stringify(siteProfile, null, 2)}\n`);
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

  console.log(`[visibility:profile] wrote ${siteProfilePath}`);
  console.log(`[visibility:profile] wrote ${inventoryPath}`);
  console.log(
    `[visibility:profile] pages ${inventory.counts.totalPages}: ${inventory.counts.successfulPages} crawled, ${inventory.counts.failedPages} failed, ${inventory.counts.blogArticles} blog articles`,
  );

  return {
    siteProfile,
    inventory,
    siteProfilePath,
    inventoryPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) throw new Error("Usage: npm run visibility:profile -- --url https://example.com [--max-pages 20] [--no-understanding]");
  await profileVisibilitySite({
    url: args.url,
    outputDir: args.outputDir,
    limits: args.limits,
    includeUnderstanding: args.includeUnderstanding,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function parseArgs(args: string[]) {
  const parsed: {
    url?: string;
    outputDir?: string;
    limits?: Partial<OwnedContentCrawlLimits>;
    includeUnderstanding?: boolean;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--url") {
      parsed.url = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--out") {
      parsed.outputDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--max-pages") {
      parsed.limits = { ...parsed.limits, maxPages: positiveInteger(args[index + 1], "--max-pages") };
      index += 1;
      continue;
    }
    if (arg === "--max-depth") {
      parsed.limits = { ...parsed.limits, maxDepth: nonNegativeInteger(args[index + 1], "--max-depth") };
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.limits = { ...parsed.limits, timeoutMs: positiveInteger(args[index + 1], "--timeout-ms") };
      index += 1;
      continue;
    }
    if (arg === "--max-bytes") {
      parsed.limits = { ...parsed.limits, maxBytes: positiveInteger(args[index + 1], "--max-bytes") };
      index += 1;
      continue;
    }
    if (arg === "--no-understanding") {
      parsed.includeUnderstanding = false;
      continue;
    }
    if (arg?.startsWith("http://") || arg?.startsWith("https://")) {
      parsed.url = arg;
    }
  }

  return parsed;
}

function positiveInteger(value: string | undefined, flag: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value: string | undefined, flag: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "brand";
}
