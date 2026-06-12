import "@/lib/load-env";
import { postPromptLabEngineFailureAlert } from "@/lib/prompt-lab-alerts";
import { loadPromptConfig } from "@/lib/prompt-lab-config";
import { summarizePromptAnswer } from "@/lib/prompt-answer-summary";
import { generateSmartSummary } from "@/lib/prompt-answer-summary-llm";
import { analyzePromptResult } from "@/lib/prompt-scan/analyzer";
import {
  claimPromptLabBatch,
  completePromptLabBatch,
  completePromptLabRun,
  createPromptLabRun,
  dailyPromptLabEngines,
  getPromptLabBatch,
  getPromptLabDailyStatus,
  getPromptLabQuestion,
  listPromptLabBatchEngineResults,
  listPromptLabQuestions,
  savePromptLabEngineResult,
  synthesizePromptLabDailyMetrics,
  upsertPromptLabQuestion,
  type PromptLabEngineName,
  type PromptLabEngineResult,
} from "@/lib/prompt-lab-store";
import { resolvePromptProvider } from "@/lib/prompt-scan/provider";
import {
  promptGroupSchema,
  type PromptGroup,
  type PromptInput,
  type PromptScanConfig,
  type PromptScanRecord,
} from "@/lib/prompt-scan/schemas";

const timeoutMs = 120_000;

export const promptLabEngineProvider = {
  ChatGPT: "openai",
  Perplexity: "perplexity",
  Gemini: "gemini",
} satisfies Record<PromptLabEngineName, PromptScanConfig["provider"]>;

type PromptLabQuestionInput = {
  id: string;
  question: string;
};

type EngineRunOutput = {
  result: PromptLabEngineResult;
  record?: PromptScanRecord;
};

export type PromptLabRunPayload = {
  questions: Array<{
    id: string;
    lastRun: string;
    engines: Partial<Record<PromptLabEngineName, PromptLabEngineResult>>;
  }>;
  daily?: Awaited<ReturnType<typeof getPromptLabDailyStatus>>;
};

export type PromptLabDailyRunPayload = PromptLabRunPayload & {
  skippedReason?: "already_running" | "already_completed" | "already_done";
};

export async function runPromptLabDaily(input: {
  force?: boolean;
  questions?: PromptLabQuestionInput[];
  runDate?: Date;
} = {}): Promise<PromptLabDailyRunPayload> {
  const baseConfig = await loadPromptConfig();
  const runDate = input.runDate ?? new Date();
  const date = runDate.toISOString().slice(0, 10);
  const questions =
    input.questions?.length
      ? input.questions
      : await listTrackedOrConfiguredQuestions(baseConfig);

  if (!questions.length) {
    throw new Error("No tracked questions found for daily prompt run.");
  }

  const existingBatch = await getPromptLabBatch({
    scope: "daily",
    runDate: date,
  });
  const existingResults = existingBatch
    ? await listPromptLabBatchEngineResults({ batchId: existingBatch.id })
    : [];
  const existingStatusByPair = new Map(
    existingResults.map((result) => [`${result.question_id}:${result.engine}`, result.status]),
  );
  const pendingByQuestion = questions
    .map((question) => {
      const engines = dailyPromptLabEngines.filter((engine) => {
        if (input.force) return true;
        const status = existingStatusByPair.get(`${question.id}:${engine}`);
        return status !== "mentioned" && status !== "missing";
      });
      return { ...question, engines };
    })
    .filter((question) => question.engines.length > 0);

  if (!pendingByQuestion.length && existingBatch) {
    if (existingBatch.status === "completed" || existingBatch.status === "partial") {
      await synthesizePromptLabDailyMetrics({ batchId: existingBatch.id });
    }

    return {
      questions: [],
      daily: await getPromptLabDailyStatus({ runDate: date }),
      skippedReason: "already_done",
    };
  }

  const claim = await claimPromptLabBatch({
    scope: "daily",
    runDate: date,
    force: input.force,
  });

  if (!claim.claimed) {
    return {
      questions: [],
      daily: await getPromptLabDailyStatus({ runDate: date }),
      skippedReason: claim.reason,
    };
  }

  for (const question of pendingByQuestion) {
    const savedQuestion = await getPromptLabQuestion({ id: question.id });
    const configPrompt = baseConfig.prompts.find((prompt) => prompt.id === question.id);
    await upsertPromptLabQuestion({
      id: question.id,
      question: question.question,
      topic: savedQuestion?.topic ?? topicFromGroup(configPrompt?.group) ?? inferTopic(question.question),
      stage: savedQuestion?.stage ?? stageFromGroup(configPrompt?.group) ?? inferStage(question.question),
      lastRun: "Queued",
    });
  }

  const runQuestions = await Promise.all(
    pendingByQuestion.map(async (question) => {
      const runId = await createPromptLabRun({
        batchId: claim.batch.id,
        scope: "daily",
        runDate: date,
        questionId: question.id,
        question: question.question,
        requestedEngines: question.engines,
      });
      const engineResults = await Promise.all(
        question.engines.map(async (engine) => {
          const output = await runEngine({
            baseConfig,
            engine,
            prompt: toPromptInput({ baseConfig, question }),
            runDate,
          });
          const { result, record } = output;
          await savePromptLabEngineResult({
            batchId: claim.batch.id,
            runId,
            questionId: question.id,
            engine,
            provider: promptLabEngineProvider[engine],
            result,
            visibilityScore: record?.visibilityScore,
            answerSignal: record?.answerSignal,
            competitorSignals: record?.competitorSignals,
          });

          return [engine, result] as const;
        }),
      );

      await completePromptLabRun({
        runId,
        status: engineResults.every(([, result]) => result.status === "error")
          ? "failed"
          : "completed",
      });

      return {
        id: question.id,
        lastRun: "Just now",
        engines: Object.fromEntries(engineResults),
      };
    }),
  );

  await completePromptLabBatch({
    batchId: claim.batch.id,
    status: await deriveDailyBatchStatus({
      batchId: claim.batch.id,
      questionCount: questions.length,
    }),
  });
  await synthesizePromptLabDailyMetrics({ batchId: claim.batch.id });
  await postPromptLabEngineFailureAlert({ batchId: claim.batch.id, runDate: date });

  return {
    questions: runQuestions,
    daily: await getPromptLabDailyStatus({ runDate: date }),
  };
}

export async function runPromptLabSpotCheck(input: {
  engines: PromptLabEngineName[];
  questions: PromptLabQuestionInput[];
  runDate?: Date;
}): Promise<PromptLabRunPayload> {
  const baseConfig = await loadPromptConfig();
  const runDate = input.runDate ?? new Date();
  const questions = await Promise.all(
    input.questions.map(async (question) => {
      const savedQuestion = await getPromptLabQuestion({ id: question.id });
      const configPrompt = baseConfig.prompts.find((prompt) => prompt.id === question.id);
      const topic = savedQuestion?.topic ?? topicFromGroup(configPrompt?.group) ?? inferTopic(question.question);
      const stage = savedQuestion?.stage ?? stageFromGroup(configPrompt?.group) ?? inferStage(question.question);
      await upsertPromptLabQuestion({
        id: question.id,
        question: question.question,
        topic,
        stage,
        lastRun: "Testing",
      });
      const runId = await createPromptLabRun({
        questionId: question.id,
        question: question.question,
        requestedEngines: input.engines,
      });
      const engineResults = await Promise.all(
        input.engines.map(async (engine) => {
          const output = await runEngine({
            baseConfig,
            engine,
            prompt: toPromptInput({ baseConfig, question }),
            runDate,
          });
          const { result, record } = output;
          await savePromptLabEngineResult({
            runId,
            questionId: question.id,
            engine,
            provider: promptLabEngineProvider[engine],
            result,
            visibilityScore: record?.visibilityScore,
            answerSignal: record?.answerSignal,
            competitorSignals: record?.competitorSignals,
          });

          return [engine, result] as const;
        }),
      );
      await completePromptLabRun({
        runId,
        status: engineResults.every(([, result]) => result.status === "error")
          ? "failed"
          : "completed",
      });

      return {
        id: question.id,
        lastRun: "Just now",
        engines: Object.fromEntries(engineResults),
      };
    }),
  );

  return { questions };
}

async function listTrackedOrConfiguredQuestions(baseConfig: PromptScanConfig) {
  const questions = await listPromptLabQuestions();
  if (questions.length) {
    return questions.map((question) => ({
      id: question.id,
      question: question.question,
    }));
  }

  return baseConfig.prompts.map((prompt) => ({
    id: prompt.id,
    question: prompt.prompt,
  }));
}

async function deriveDailyBatchStatus(input: {
  batchId: string;
  questionCount: number;
}) {
  const rows = await listPromptLabBatchEngineResults({ batchId: input.batchId });
  const statuses = rows.filter((row) => isDailyEngine(row.engine));
  const failed = statuses.filter((row) => row.status === "error").length;
  const completed = statuses.filter(
    (row) => row.status === "mentioned" || row.status === "missing",
  ).length;
  const total = input.questionCount * dailyPromptLabEngines.length;

  if (failed > 0 && completed === 0) return "failed";
  if (failed > 0 || completed < total) return "partial";
  return "completed";
}

function isDailyEngine(engine: PromptLabEngineName): engine is (typeof dailyPromptLabEngines)[number] {
  return dailyPromptLabEngines.some((dailyEngine) => dailyEngine === engine);
}

async function runEngine(input: {
  baseConfig: PromptScanConfig;
  engine: PromptLabEngineName;
  prompt: PromptInput;
  runDate: Date;
}): Promise<EngineRunOutput> {
  const providerId = promptLabEngineProvider[input.engine];
  const config = {
    ...input.baseConfig,
    provider: providerId,
    prompts: [input.prompt],
  };

  try {
    const provider = resolvePromptProvider({
      provider: providerId,
      env: {
        perplexityApiKey: process.env.PERPLEXITY_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY,
      },
    });
    const result = await scanWithTimeout({
      provider,
      prompt: input.prompt.prompt,
      config,
    });
    const record = analyzePromptResult({
      prompt: input.prompt,
      result,
      config,
      runDate: input.runDate,
    });
    const brandRank = record.answerSignal?.brandRank;
    const status = record.visibilityScore.brandMentioned ? "mentioned" : "missing";
    const smartSummary = await generateSmartSummary({
      question: input.prompt.prompt,
      brandName: config.brand.name,
      rawAnswer: record.answerText,
      group: record.promptGroup,
      ...(record.answerSignal ? { answerSignal: record.answerSignal } : {}),
    });

    return {
      result: {
        status,
        ...(brandRank ? { rank: `#${brandRank}` } : {}),
        answer: summarizePromptAnswer(record.answerText),
        smartSummary,
        rawAnswer: record.answerText,
        citations: record.citedDomains.slice(0, 6),
        sourceCitations: record.citedSources,
      },
      record,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      result: {
        status: "error",
        answer: `${input.engine} run failed. ${message}`,
        rawAnswer: message,
        citations: [],
        sourceCitations: [],
      },
    };
  }
}

async function scanWithTimeout(input: {
  provider: ReturnType<typeof resolvePromptProvider>;
  prompt: string;
  config: PromptScanConfig;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await input.provider.scanPrompt({
      prompt: input.prompt,
      brand: input.config.brand,
      competitors: input.config.competitors,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Prompt scan timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toPromptInput(input: {
  baseConfig: PromptScanConfig;
  question: PromptLabQuestionInput;
}): PromptInput {
  const configPrompt = input.baseConfig.prompts.find((prompt) => prompt.id === input.question.id);
  return {
    id: input.question.id,
    group: configPrompt?.group ?? inferPromptGroup(input.question.question),
    prompt: input.question.question,
  };
}

function inferPromptGroup(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (/\b(vs|versus|compare|comparison|alternatives?)\b/.test(normalized)) {
    return promptGroupSchema.parse("competitor_comparison");
  }
  if (/\b(best|top|cheapest|price|pricing|recommend|which|should i use)\b/.test(normalized)) {
    return promptGroupSchema.parse("high_intent_purchase");
  }
  if (/\b(how|what is|guide|tips|without)\b/.test(normalized)) {
    return promptGroupSchema.parse("problem_aware");
  }
  if (/\b(shopify|integrat|workflow|product page)\b/.test(normalized)) {
    return promptGroupSchema.parse("integration_use_case");
  }

  return promptGroupSchema.parse("solution_aware");
}

function topicFromGroup(group: PromptGroup | undefined) {
  if (!group) return null;
  if (group === "competitor_comparison") return "Competitor comparison";
  if (group === "category_search") return "Category search";
  if (group === "high_intent_purchase") return "High-intent purchase";
  if (group === "problem_aware") return "Problem aware";
  if (group === "integration_use_case") return "Integration use case";
  return "Solution aware";
}

function stageFromGroup(group: PromptGroup | undefined) {
  if (!group) return null;
  if (group === "competitor_comparison") return "Evaluation";
  if (group === "high_intent_purchase") return "Decision";
  if (group === "problem_aware") return "Awareness";
  return "Consideration";
}

function inferTopic(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("shopify")) return "Shopify";
  if (normalized.includes("alternative") || normalized.includes(" vs ")) return "Competitor alternatives";
  if (normalized.includes("price") || normalized.includes("cheap") || normalized.includes("cost")) return "Pricing";
  if (normalized.includes("model")) return "AI model photos";
  if (normalized.includes("how") || normalized.includes("without")) return "How-to";
  return "General";
}

function inferStage(question: string) {
  const normalized = question.toLowerCase();

  if (/\b(vs|versus|compare|comparison|alternatives?|reviews?)\b/.test(normalized)) {
    return "Evaluation";
  }

  if (/\b(best|top|cheapest|price|pricing|recommend|which|should i use)\b/.test(normalized)) {
    return "Decision";
  }

  if (/\b(how|what is|examples?|ideas?|guide|tips|without)\b/.test(normalized)) {
    return "Awareness";
  }

  return "Consideration";
}
