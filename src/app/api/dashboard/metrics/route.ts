import "@/lib/load-env";
import { NextResponse } from "next/server";
import {
  getLatestPromptLabDailyMetrics,
  getPromptLabRollingVisibility,
} from "@/lib/prompt-lab-store";

export const runtime = "nodejs";

export async function GET() {
  const [metrics, rolling] = await Promise.all([
    getLatestPromptLabDailyMetrics(),
    getPromptLabRollingVisibility(),
  ]);

  return NextResponse.json({
    metrics,
    rolling,
  });
}
