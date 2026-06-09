import { promptScanConfigSchema, type PromptScanConfig } from "@/lib/prompt-scan/schemas";
import promptConfig from "../../data/tinylemon-xyz/visibility/prompts.selected.json";

// The selected-prompts config lives under the gitignored data/ tree but is
// required at runtime. Import it statically (rather than fs.readFile) so the
// compiler bundles it into the serverless function — a runtime file read is not
// traced by Next and 500s in production with ENOENT.
let cached: PromptScanConfig | undefined;

export function loadPromptConfig(): PromptScanConfig {
  cached ??= promptScanConfigSchema.parse(promptConfig);
  return cached;
}
