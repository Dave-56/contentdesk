import { getEnv } from "@/lib/env";
import {
  listPromptLabBatchEngineFailureSummaries,
  type PromptLabEngineFailureSummary,
} from "@/lib/prompt-lab-store";
import { postManagerMessage } from "@/lib/slack";

const sampleErrorMaxLength = 180;

// Engine errors silently shrink the visibility denominator (failed answers are
// excluded from daily metrics), so a quota or auth failure looks like 0%
// visibility until someone inspects the database. Alert the moment a daily
// batch has any engine error. Returns null when every engine completed.
export function engineFailureAlertText(input: {
  runDate: string;
  engines: PromptLabEngineFailureSummary[];
}): string | null {
  const failing = input.engines.filter((engine) => engine.failed > 0);
  if (!failing.length) return null;

  const brandSlug = input.engines[0]?.brandSlug ?? "unknown-brand";
  const lines = input.engines.map((engine) => {
    if (engine.failed > 0) {
      const detail = engine.sampleError ? ` — ${singleLine(engine.sampleError)}` : "";
      return `❌ ${engine.engine}: ${engine.failed}/${engine.total} failed${detail}`;
    }
    return `✅ ${engine.engine}: ${engine.total}/${engine.total} ok`;
  });

  return [
    `⚠️ Prompt Lab engine failures · ${brandSlug} · ${input.runDate}`,
    ...lines,
    "Failed answers drop out of the visibility denominator, so today's metrics undercount until the engine is fixed and re-run.",
  ].join("\n");
}

// Fail-soft like the analytics status post: results are already persisted by
// the time this runs, so a Slack error must not fail the batch.
export async function postPromptLabEngineFailureAlert(input: {
  batchId: string;
  runDate: string;
}): Promise<boolean> {
  const channelId = getEnv().ANALYTICS_SLACK_CHANNEL_ID;
  if (!channelId) return false;

  try {
    const engines = await listPromptLabBatchEngineFailureSummaries({
      batchId: input.batchId,
    });
    const text = engineFailureAlertText({ runDate: input.runDate, engines });
    if (!text) return false;

    await postManagerMessage({ channelId, text });
    return true;
  } catch (error) {
    console.error(
      `[prompt-lab] engine failure alert post failed: ${error instanceof Error ? error.message : error}`,
    );
    return false;
  }
}

function singleLine(text: string) {
  const flattened = text.replace(/\s+/g, " ").trim();
  return flattened.length > sampleErrorMaxLength
    ? `${flattened.slice(0, sampleErrorMaxLength)}…`
    : flattened;
}
