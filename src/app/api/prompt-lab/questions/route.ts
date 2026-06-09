import "@/lib/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listPromptLabQuestions,
  upsertPromptLabQuestion,
} from "@/lib/prompt-lab-store";
import { promptScanConfigSchema } from "@/lib/prompt-scan/schemas";

const questionSchema = z.object({
  id: z.string().trim().min(1),
  question: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  stage: z.string().trim().min(1),
  lastRun: z.string().trim().min(1).optional(),
});

const saveQuestionsSchema = z.object({
  questions: z.array(questionSchema).min(1),
});

export const runtime = "nodejs";

export async function GET() {
  let questions = await listPromptLabQuestions();
  if (!questions.length) {
    await seedSelectedTinyLemonQuestions();
    questions = await listPromptLabQuestions();
  }

  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  const parsed = saveQuestionsSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid prompt-lab questions request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await Promise.all(
    parsed.data.questions.map((question) =>
      upsertPromptLabQuestion({
        id: question.id,
        question: question.question,
        topic: question.topic,
        stage: question.stage,
        lastRun: question.lastRun,
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}

async function seedSelectedTinyLemonQuestions() {
  const configPath = path.join(process.cwd(), "data/tinylemon-xyz/visibility/prompts.selected.json");
  const config = promptScanConfigSchema.parse(JSON.parse(await readFile(configPath, "utf8")));

  await Promise.all(
    config.prompts.map((prompt) =>
      upsertPromptLabQuestion({
        id: prompt.id,
        question: prompt.prompt,
        topic: topicLabel(prompt.group),
        stage: stageLabel(prompt.group),
        lastRun: "Not run",
      }),
    ),
  );
}

function topicLabel(group: string) {
  if (group === "competitor_comparison") return "Competitor comparison";
  if (group === "category_search") return "Category search";
  if (group === "high_intent_purchase") return "High-intent purchase";
  if (group === "problem_aware") return "Problem aware";
  if (group === "integration_use_case") return "Integration use case";
  return "Solution aware";
}

function stageLabel(group: string) {
  if (group === "competitor_comparison") return "Evaluation";
  if (group === "high_intent_purchase") return "Decision";
  if (group === "problem_aware") return "Awareness";
  return "Consideration";
}
