import "@/lib/load-env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { profileOwnedSiteInventory } from "@/lib/visibility/site-inventory";

export async function profileVisibilitySite(input: {
  url: string;
  outputDir?: string;
}) {
  const { siteProfile, inventory } = await profileOwnedSiteInventory({
    url: input.url,
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
    `[visibility:profile] assets ${inventory.counts.total}: ${inventory.counts.siteProfilePages} profile pages, ${inventory.counts.blogArticles} blog articles`,
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
  if (!args.url) throw new Error("Usage: npm run visibility:profile -- --url https://example.com");
  await profileVisibilitySite({ url: args.url, outputDir: args.outputDir });
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
    if (arg?.startsWith("http://") || arg?.startsWith("https://")) {
      parsed.url = arg;
    }
  }

  return parsed;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "brand";
}
