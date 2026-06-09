import "@/lib/load-env";
import { NextResponse } from "next/server";
import { getLatestPromptLabDailyMetrics } from "@/lib/prompt-lab-store";

export const runtime = "nodejs";

export async function GET() {
  const metrics = await getLatestPromptLabDailyMetrics();

  return NextResponse.json({
    metrics,
  });
}
