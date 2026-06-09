import "@/lib/load-env";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runPromptLabDaily,
  runPromptLabSpotCheck,
} from "@/lib/prompt-lab-runner";

const requestSchema = z.object({
  scope: z.enum(["spot_check", "daily"]).default("spot_check"),
  force: z.boolean().default(false),
  questions: z.array(
    z.object({
      id: z.string().trim().min(1),
      question: z.string().trim().min(1),
    }),
  ).min(1).optional(),
  engines: z.array(z.enum(["ChatGPT", "Perplexity", "Gemini"])).default([
    "ChatGPT",
    "Perplexity",
  ]),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid prompt-lab run request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const requestedQuestions = parsed.data.questions ?? [];

  if (parsed.data.scope === "daily") {
    try {
      const payload = await runPromptLabDaily({
        force: parsed.data.force,
        questions: requestedQuestions,
      });
      return NextResponse.json(
        {
          questions: payload.questions,
          daily: payload.daily,
        },
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  }

  if (!requestedQuestions.length) {
    return NextResponse.json(
      { error: "Spot checks require at least one question." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    await runPromptLabSpotCheck({
      engines: parsed.data.engines,
      questions: requestedQuestions,
    }),
  );
}
