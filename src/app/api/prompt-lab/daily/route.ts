import "@/lib/load-env";
import { NextResponse } from "next/server";
import { getPromptLabDailyStatus } from "@/lib/prompt-lab-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getPromptLabDailyStatus());
}
