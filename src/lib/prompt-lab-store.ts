import { id } from "@/lib/repository";
import { query } from "@/lib/db";
import type {
  AnswerSignal,
  CitedSource,
  CompetitorAnswerSignal,
  VisibilityScore,
} from "@/lib/prompt-scan/schemas";

export type PromptLabEngineName = "ChatGPT" | "Perplexity" | "Gemini";
export type PromptLabEngineStatus =
  | "mentioned"
  | "missing"
  | "running"
  | "not_wired"
  | "not-run"
  | "error";

export type PromptLabEngineResult = {
  status: PromptLabEngineStatus;
  rank?: string;
  answer: string;
  smartSummary?: string;
  rawAnswer?: string;
  citations: string[];
  sourceCitations: CitedSource[];
};

export type PromptLabQuestion = {
  id: string;
  question: string;
  topic: string;
  stage: "Awareness" | "Consideration" | "Evaluation" | "Decision";
  lastRun: string;
  winner: string;
  engines: Partial<Record<PromptLabEngineName, PromptLabEngineResult>>;
};

export type PromptLabBatchStatus = "running" | "completed" | "partial" | "failed";
export type PromptLabBatchScope = "daily" | "spot_check";

export type PromptLabDailySummary = {
  batchId: string | null;
  runDate: string;
  status: PromptLabBatchStatus | "not_started";
  startedAt: string | null;
  completedAt: string | null;
  questionCount: number;
  tinyLemonQuestionCount: number;
  decisionGapCount: number;
  failedEngineCount: number;
  completedEngineCount: number;
  totalEngineCount: number;
};

export type PromptLabDailyHistoryItem = PromptLabDailySummary;

type QuestionRow = {
  id: string;
  question: string;
  topic: string;
  stage: PromptLabQuestion["stage"];
  last_run_label: string;
};

type ResultRow = {
  question_id: string;
  engine: PromptLabEngineName;
  status: PromptLabEngineStatus;
  rank: string | null;
  answer: string;
  smart_summary: string | null;
  raw_answer: string;
  citations: string[];
  source_citations: CitedSource[] | null;
};

type BatchRow = {
  id: string;
  run_date: string | Date;
  status: PromptLabBatchStatus;
  started_at: string | Date;
  completed_at: string | Date | null;
};

type BatchResultRow = {
  batch_id: string;
  run_date: string | Date;
  status: PromptLabBatchStatus;
  started_at: string | Date;
  completed_at: string | Date | null;
  question_id: string | null;
  stage: PromptLabQuestion["stage"] | null;
  engine: PromptLabEngineName | null;
  engine_status: PromptLabEngineStatus | null;
};

type BatchEngineResultRow = {
  question_id: string;
  engine: PromptLabEngineName;
  status: PromptLabEngineStatus;
};

type CountRow = {
  count: string;
};

type DailyMetricResultRow = {
  batch_id: string;
  brand_slug: string;
  run_date: string | Date;
  status: PromptLabBatchStatus;
  question_id: string | null;
  engine: PromptLabEngineName | null;
  engine_status: PromptLabEngineStatus | null;
  visibility_score: VisibilityScore | null;
  answer_signal: AnswerSignal | null;
  competitor_signals: CompetitorAnswerSignal[] | null;
  citations: string[] | null;
};

type DailyMetricsRow = {
  id: string;
  batch_id: string;
  brand_slug: string;
  run_date: string | Date;
  status: PromptLabBatchStatus;
  engine_count: number;
  completed_answer_count: number;
  failed_answer_count: number;
  brand_mentioned_count: number;
  brand_cited_count: number;
  brand_recommended_count: number;
  brand_top_pick_count: number;
  sentiment_answer_count: number;
  sentiment_score: string | number;
  visibility_pct: string | number;
  citation_pct: string | number;
  low_sample_size: boolean;
  competitor_share_of_voice: CompetitorShareOfVoiceRow[];
  source_mix: SourceMixRow[];
  updated_at: string | Date;
};

export type CompetitorShareOfVoiceRow = {
  name: string;
  mentions: number;
  sharePct: number;
  you?: boolean;
};

export type SourceMixRow = {
  domain: string;
  cites: number;
};

export type PromptLabDailyMetrics = {
  id: string;
  batchId: string;
  brandSlug: string;
  runDate: string;
  status: PromptLabBatchStatus;
  engineCount: number;
  completedAnswerCount: number;
  failedAnswerCount: number;
  brandMentionedCount: number;
  brandCitedCount: number;
  brandRecommendedCount: number;
  brandTopPickCount: number;
  sentimentAnswerCount: number;
  sentimentScore: number;
  visibilityPct: number;
  citationPct: number;
  lowSampleSize: boolean;
  competitorShareOfVoice: CompetitorShareOfVoiceRow[];
  sourceMix: SourceMixRow[];
  updatedAt: string;
};

const defaultBrandSlug = "tinylemon-xyz";
export const dailyPromptLabEngines = ["ChatGPT", "Perplexity", "Gemini"] as const satisfies PromptLabEngineName[];
type DailyPromptLabEngine = (typeof dailyPromptLabEngines)[number];
let sourceCitationsColumnReady: Promise<void> | undefined;
let smartSummaryColumnReady: Promise<void> | undefined;
export const excludedDailyPromptLabEngines = [
  { engine: "Claude", reason: "wired, excluded from daily v1 for cost/speed" },
] as const;

export async function listPromptLabQuestions(input: {
  brandSlug?: string;
} = {}): Promise<PromptLabQuestion[]> {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const questions = await query<QuestionRow>(
    `select id, question, topic, stage, last_run_label
     from prompt_lab_questions
     where brand_slug = $1
     order by updated_at desc, created_at desc`,
    [brandSlug],
  );

  if (!questions.rowCount) return [];

  await ensurePromptLabSourceCitationsColumn();
  await ensurePromptLabSmartSummaryColumn();

  const questionIds = questions.rows.map((question) => question.id);
  const results = await query<ResultRow>(
    `select distinct on (question_id, engine)
       question_id,
       engine,
       status,
       rank,
       answer,
       smart_summary,
       raw_answer,
       citations,
       source_citations
     from prompt_lab_engine_results
     where question_id = any($1::text[])
     order by question_id, engine, created_at desc`,
    [questionIds],
  );
  const resultsByQuestion = new Map<string, Partial<Record<PromptLabEngineName, PromptLabEngineResult>>>();

  for (const result of results.rows) {
    const current = resultsByQuestion.get(result.question_id) ?? {};
    current[result.engine] = {
      status: result.status,
      ...(result.rank ? { rank: result.rank } : {}),
      answer: result.answer,
      ...(result.smart_summary ? { smartSummary: result.smart_summary } : {}),
      rawAnswer: result.raw_answer,
      citations: normalizeJsonArray<string>(result.citations),
      sourceCitations: normalizeJsonArray<CitedSource>(result.source_citations),
    };
    resultsByQuestion.set(result.question_id, current);
  }

  return questions.rows.map((question) => ({
    id: question.id,
    question: question.question,
    topic: question.topic,
    stage: question.stage,
    lastRun: question.last_run_label,
    winner: "Unknown",
    engines: resultsByQuestion.get(question.id) ?? {},
  }));
}

export async function getPromptLabQuestion(input: {
  brandSlug?: string;
  id: string;
}): Promise<PromptLabQuestion | null> {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const result = await query<QuestionRow>(
    `select id, question, topic, stage, last_run_label
     from prompt_lab_questions
     where brand_slug = $1
       and id = $2
     limit 1`,
    [brandSlug, input.id],
  );
  const question = result.rows[0];

  if (!question) return null;

  return {
    id: question.id,
    question: question.question,
    topic: question.topic,
    stage: question.stage,
    lastRun: question.last_run_label,
    winner: "Unknown",
    engines: {},
  };
}

export async function upsertPromptLabQuestion(input: {
  brandSlug?: string;
  id: string;
  question: string;
  topic: string;
  stage: string;
  lastRun?: string;
}) {
  await query(
    `insert into prompt_lab_questions
      (id, brand_slug, question, topic, stage, last_run_label)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update
     set question = excluded.question,
       topic = excluded.topic,
       stage = excluded.stage,
       last_run_label = excluded.last_run_label,
       updated_at = now()`,
    [
      input.id,
      input.brandSlug ?? defaultBrandSlug,
      input.question,
      input.topic,
      input.stage,
      input.lastRun ?? "Not run",
    ],
  );
}

export async function createPromptLabRun(input: {
  brandSlug?: string;
  batchId?: string;
  scope?: PromptLabBatchScope;
  runDate?: string;
  questionId: string;
  question: string;
  requestedEngines: PromptLabEngineName[];
}) {
  const runId = id("prompt_run");

  await query(
    `insert into prompt_lab_runs
      (id, brand_slug, batch_id, scope, run_date, question_id, question, requested_engines, status)
     values ($1, $2, $3, $4, $5::date, $6, $7, $8, 'running')`,
    [
      runId,
      input.brandSlug ?? defaultBrandSlug,
      input.batchId ?? null,
      input.scope ?? "spot_check",
      input.runDate ?? null,
      input.questionId,
      input.question,
      JSON.stringify(input.requestedEngines),
    ],
  );

  return runId;
}

export async function completePromptLabRun(input: {
  runId: string;
  status: "completed" | "failed";
}) {
  await query(
    `update prompt_lab_runs
     set status = $2, completed_at = now()
     where id = $1`,
    [input.runId, input.status],
  );
}

export async function savePromptLabEngineResult(input: {
  brandSlug?: string;
  runId: string;
  batchId?: string;
  questionId: string;
  engine: PromptLabEngineName;
  provider?: string;
  result: PromptLabEngineResult;
  visibilityScore?: VisibilityScore;
  answerSignal?: AnswerSignal;
  competitorSignals?: CompetitorAnswerSignal[];
}) {
  await ensurePromptLabSourceCitationsColumn();
  await ensurePromptLabSmartSummaryColumn();

  await query(
    `insert into prompt_lab_engine_results
      (id, run_id, batch_id, question_id, brand_slug, engine, provider, status, rank, answer, smart_summary, raw_answer, citations, source_citations, visibility_score, answer_signal, competitor_signals)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     on conflict (run_id, engine) do update
     set status = excluded.status,
       rank = excluded.rank,
       answer = excluded.answer,
       smart_summary = excluded.smart_summary,
       raw_answer = excluded.raw_answer,
       citations = excluded.citations,
       source_citations = excluded.source_citations,
       visibility_score = excluded.visibility_score,
       answer_signal = excluded.answer_signal,
       competitor_signals = excluded.competitor_signals`,
    [
      id("prompt_result"),
      input.runId,
      input.batchId ?? null,
      input.questionId,
      input.brandSlug ?? defaultBrandSlug,
      input.engine,
      input.provider ?? null,
      input.result.status,
      input.result.rank ?? null,
      input.result.answer,
      input.result.smartSummary ?? "",
      input.result.rawAnswer ?? "",
      JSON.stringify(input.result.citations),
      JSON.stringify(input.result.sourceCitations),
      input.visibilityScore ? JSON.stringify(input.visibilityScore) : null,
      input.answerSignal ? JSON.stringify(input.answerSignal) : null,
      JSON.stringify(input.competitorSignals ?? []),
    ],
  );

  await query(
    `update prompt_lab_questions
     set last_run_label = 'Just now',
       last_run_at = now(),
       updated_at = now()
     where id = $1`,
    [input.questionId],
  );
}

async function ensurePromptLabSourceCitationsColumn() {
  sourceCitationsColumnReady ??= query(
    `alter table prompt_lab_engine_results
       add column if not exists source_citations jsonb not null default '[]'::jsonb`,
  ).then(() => undefined);

  await sourceCitationsColumnReady;
}

async function ensurePromptLabSmartSummaryColumn() {
  smartSummaryColumnReady ??= query(
    `alter table prompt_lab_engine_results
       add column if not exists smart_summary text not null default ''`,
  ).then(() => undefined);

  await smartSummaryColumnReady;
}

export async function getPromptLabBatch(input: {
  brandSlug?: string;
  scope: PromptLabBatchScope;
  runDate: string;
}) {
  const result = await query<BatchRow>(
    `select id, run_date, status, started_at, completed_at
     from prompt_lab_batches
     where brand_slug = $1
       and scope = $2
       and run_date = $3::date
     limit 1`,
    [input.brandSlug ?? defaultBrandSlug, input.scope, input.runDate],
  );

  return result.rows[0] ?? null;
}

export async function createPromptLabBatch(input: {
  brandSlug?: string;
  scope: PromptLabBatchScope;
  runDate: string;
}) {
  const batchId = id("prompt_batch");
  const result = await query<BatchRow>(
    `insert into prompt_lab_batches
      (id, brand_slug, scope, run_date, status)
     values ($1, $2, $3, $4::date, 'running')
     on conflict (brand_slug, scope, run_date) do update
     set status = 'running',
       completed_at = null
     returning id, run_date, status, started_at, completed_at`,
    [batchId, input.brandSlug ?? defaultBrandSlug, input.scope, input.runDate],
  );

  return result.rows[0];
}

export async function claimPromptLabBatch(input: {
  brandSlug?: string;
  scope: PromptLabBatchScope;
  runDate: string;
  force?: boolean;
}): Promise<
  | { claimed: true; batch: BatchRow; reason?: never }
  | { claimed: false; batch: BatchRow | null; reason: "already_running" | "already_completed" }
> {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const batchId = id("prompt_batch");

  if (input.force) {
    const result = await query<BatchRow>(
      `insert into prompt_lab_batches
        (id, brand_slug, scope, run_date, status)
       values ($1, $2, $3, $4::date, 'running')
       on conflict (brand_slug, scope, run_date) do update
       set status = 'running',
         completed_at = null
       returning id, run_date, status, started_at, completed_at`,
      [batchId, brandSlug, input.scope, input.runDate],
    );

    return { claimed: true, batch: result.rows[0] };
  }

  const inserted = await query<BatchRow>(
    `insert into prompt_lab_batches
      (id, brand_slug, scope, run_date, status)
     values ($1, $2, $3, $4::date, 'running')
     on conflict (brand_slug, scope, run_date) do nothing
     returning id, run_date, status, started_at, completed_at`,
    [batchId, brandSlug, input.scope, input.runDate],
  );

  if (inserted.rows[0]) return { claimed: true, batch: inserted.rows[0] };

  const existing = await getPromptLabBatch({
    brandSlug,
    scope: input.scope,
    runDate: input.runDate,
  });

  if (!existing) {
    throw new Error("Prompt lab batch conflict occurred but existing batch was not found.");
  }

  if (existing.status === "running") {
    return { claimed: false, batch: existing, reason: "already_running" };
  }

  if (existing.status === "completed") {
    return { claimed: false, batch: existing, reason: "already_completed" };
  }

  const claimedExisting = await query<BatchRow>(
    `update prompt_lab_batches
     set status = 'running',
       completed_at = null
     where id = $1
       and status in ('partial', 'failed')
     returning id, run_date, status, started_at, completed_at`,
    [existing.id],
  );

  if (claimedExisting.rows[0]) {
    return { claimed: true, batch: claimedExisting.rows[0] };
  }

  const latest = await getPromptLabBatch({
    brandSlug,
    scope: input.scope,
    runDate: input.runDate,
  });

  if (latest?.status === "completed") {
    return { claimed: false, batch: latest, reason: "already_completed" };
  }

  return { claimed: false, batch: latest, reason: "already_running" };
}

export async function completePromptLabBatch(input: {
  batchId: string;
  status: PromptLabBatchStatus;
}) {
  await query(
    `update prompt_lab_batches
     set status = $2, completed_at = now()
     where id = $1`,
    [input.batchId, input.status],
  );
}

export async function listPromptLabBatchEngineResults(input: {
  batchId: string;
}) {
  const result = await query<BatchEngineResultRow>(
    `select distinct on (question_id, engine)
       question_id,
       engine,
       status
     from prompt_lab_engine_results
     where batch_id = $1
     order by question_id, engine, created_at desc`,
    [input.batchId],
  );

  return result.rows;
}

export type PromptLabEngineFailureSummary = {
  engine: PromptLabEngineName;
  brandSlug: string;
  total: number;
  failed: number;
  sampleError: string | null;
};

export async function listPromptLabBatchEngineFailureSummaries(input: {
  batchId: string;
}): Promise<PromptLabEngineFailureSummary[]> {
  const result = await query<{
    engine: PromptLabEngineName;
    brand_slug: string;
    total: number;
    failed: number;
    sample_error: string | null;
  }>(
    `select
       engine,
       max(brand_slug) as brand_slug,
       count(*)::int as total,
       count(*) filter (where status = 'error')::int as failed,
       (array_agg(answer order by created_at desc) filter (where status = 'error'))[1] as sample_error
     from (
       select distinct on (question_id, engine)
         engine, brand_slug, status, answer, created_at
       from prompt_lab_engine_results
       where batch_id = $1
       order by question_id, engine, created_at desc
     ) latest
     group by engine
     order by engine`,
    [input.batchId],
  );

  return result.rows.map((row) => ({
    engine: row.engine,
    brandSlug: row.brand_slug,
    total: row.total,
    failed: row.failed,
    sampleError: row.sample_error,
  }));
}

export async function getPromptLabDailyStatus(input: {
  brandSlug?: string;
  runDate?: string;
} = {}) {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const runDate = input.runDate ?? todayIsoDate();
  const batch = await getPromptLabBatch({ brandSlug, scope: "daily", runDate });
  const questionCount = await countPromptLabQuestions({ brandSlug });

  if (!batch) {
    return {
      today: emptyDailySummary({ runDate, questionCount }),
      history: await listPromptLabDailyHistory({ brandSlug }),
      engines: [...dailyPromptLabEngines],
      excludedEngines: excludedDailyPromptLabEngines,
    };
  }

  return {
    today: await summarizePromptLabBatch({ brandSlug, batch, questionCount }),
    history: await listPromptLabDailyHistory({ brandSlug }),
    engines: [...dailyPromptLabEngines],
    excludedEngines: excludedDailyPromptLabEngines,
  };
}

export async function synthesizePromptLabDailyMetrics(input: {
  brandSlug?: string;
  batchId: string;
}): Promise<PromptLabDailyMetrics> {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const rows = await query<DailyMetricResultRow>(
    `select
       b.id as batch_id,
       b.brand_slug,
       b.run_date,
       b.status,
       r.question_id,
       r.engine,
       r.status as engine_status,
       r.visibility_score,
       r.answer_signal,
       r.competitor_signals,
       r.citations
     from prompt_lab_batches b
     left join (
       select
         question_id,
         engine,
         status,
         visibility_score,
         answer_signal,
         competitor_signals,
         citations
       from prompt_lab_engine_results
       where batch_id = $2
     ) r on true
     where b.brand_slug = $1
       and b.id = $2`,
    [brandSlug, input.batchId],
  );
  const firstRow = rows.rows[0];

  if (!firstRow) {
    throw new Error(`Prompt lab batch not found: ${input.batchId}`);
  }

  const metric = calculateDailyMetrics(rows.rows);
  const metricId = id("prompt_metric");
  const saved = await query<DailyMetricsRow>(
    `insert into prompt_lab_daily_metrics
      (
        id,
        batch_id,
        brand_slug,
        run_date,
        status,
        engine_count,
        completed_answer_count,
        failed_answer_count,
        brand_mentioned_count,
        brand_cited_count,
        brand_recommended_count,
        brand_top_pick_count,
        sentiment_answer_count,
        sentiment_score,
        visibility_pct,
        citation_pct,
        low_sample_size,
        competitor_share_of_voice,
        source_mix
      )
     values
      ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     on conflict (batch_id) do update
     set status = excluded.status,
       engine_count = excluded.engine_count,
       completed_answer_count = excluded.completed_answer_count,
       failed_answer_count = excluded.failed_answer_count,
       brand_mentioned_count = excluded.brand_mentioned_count,
       brand_cited_count = excluded.brand_cited_count,
       brand_recommended_count = excluded.brand_recommended_count,
       brand_top_pick_count = excluded.brand_top_pick_count,
       sentiment_answer_count = excluded.sentiment_answer_count,
       sentiment_score = excluded.sentiment_score,
       visibility_pct = excluded.visibility_pct,
       citation_pct = excluded.citation_pct,
       low_sample_size = excluded.low_sample_size,
       competitor_share_of_voice = excluded.competitor_share_of_voice,
       source_mix = excluded.source_mix,
       updated_at = now()
     returning *`,
    [
      metricId,
      input.batchId,
      firstRow.brand_slug,
      isoDate(firstRow.run_date),
      firstRow.status,
      metric.engineCount,
      metric.completedAnswerCount,
      metric.failedAnswerCount,
      metric.brandMentionedCount,
      metric.brandCitedCount,
      metric.brandRecommendedCount,
      metric.brandTopPickCount,
      metric.sentimentAnswerCount,
      metric.sentimentScore,
      metric.visibilityPct,
      metric.citationPct,
      metric.lowSampleSize,
      JSON.stringify(metric.competitorShareOfVoice),
      JSON.stringify(metric.sourceMix),
    ],
  );

  return normalizeDailyMetricsRow(saved.rows[0]);
}

export async function getLatestPromptLabDailyMetrics(input: {
  brandSlug?: string;
} = {}): Promise<PromptLabDailyMetrics | null> {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const metrics = await query<DailyMetricsRow>(
    `select *
     from prompt_lab_daily_metrics
     where brand_slug = $1
     order by run_date desc, updated_at desc
     limit 1`,
    [brandSlug],
  );

  if (metrics.rows[0]) return normalizeDailyMetricsRow(metrics.rows[0]);

  const batches = await query<BatchRow>(
    `select id, run_date, status, started_at, completed_at
     from prompt_lab_batches
     where brand_slug = $1
       and scope = 'daily'
       and status in ('completed', 'partial')
     order by run_date desc, started_at desc
     limit 1`,
    [brandSlug],
  );

  if (!batches.rows[0]) return null;

  return synthesizePromptLabDailyMetrics({
    brandSlug,
    batchId: batches.rows[0].id,
  });
}

export type PromptLabRollingVisibility = {
  windowDays: number;
  dayCount: number;
  windowStart: string;
  windowEnd: string;
  brandMentionedCount: number;
  completedAnswerCount: number;
  visibilityPct: number;
};

export async function getPromptLabRollingVisibility(input: {
  brandSlug?: string;
  windowDays?: number;
} = {}): Promise<PromptLabRollingVisibility | null> {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const windowDays = input.windowDays ?? 7;
  const result = await query<{
    day_count: number;
    window_start: string | Date | null;
    window_end: string | Date | null;
    brand_mentioned_count: number;
    completed_answer_count: number;
  }>(
    `with latest as (
       select max(run_date) as max_date
       from prompt_lab_daily_metrics
       where brand_slug = $1
     )
     select
       count(*)::int as day_count,
       min(m.run_date) as window_start,
       max(m.run_date) as window_end,
       coalesce(sum(m.brand_mentioned_count), 0)::int as brand_mentioned_count,
       coalesce(sum(m.completed_answer_count), 0)::int as completed_answer_count
     from prompt_lab_daily_metrics m, latest
     where m.brand_slug = $1
       and m.run_date > latest.max_date - $2::int`,
    [brandSlug, windowDays],
  );
  const row = result.rows[0];

  if (!row || !row.day_count || !row.window_start || !row.window_end) {
    return null;
  }

  return {
    windowDays,
    dayCount: row.day_count,
    windowStart: isoDate(row.window_start),
    windowEnd: isoDate(row.window_end),
    brandMentionedCount: row.brand_mentioned_count,
    completedAnswerCount: row.completed_answer_count,
    visibilityPct: percent(row.brand_mentioned_count, row.completed_answer_count),
  };
}

export async function listPromptLabDailyHistory(input: {
  brandSlug?: string;
  limit?: number;
} = {}): Promise<PromptLabDailyHistoryItem[]> {
  const brandSlug = input.brandSlug ?? defaultBrandSlug;
  const limit = input.limit ?? 7;
  const questionCount = await countPromptLabQuestions({ brandSlug });
  const batches = await query<BatchRow>(
    `select id, run_date, status, started_at, completed_at
     from prompt_lab_batches
     where brand_slug = $1
       and scope = 'daily'
     order by run_date desc, started_at desc
     limit $2`,
    [brandSlug, limit],
  );

  return Promise.all(
    batches.rows.map((batch) => summarizePromptLabBatch({ brandSlug, batch, questionCount })),
  );
}

async function summarizePromptLabBatch(input: {
  brandSlug: string;
  batch: BatchRow;
  questionCount: number;
}): Promise<PromptLabDailySummary> {
  const rows = await query<BatchResultRow>(
    `select
       b.id as batch_id,
       b.run_date,
       b.status,
       b.started_at,
       b.completed_at,
       q.id as question_id,
       q.stage,
       r.engine,
       r.status as engine_status
     from prompt_lab_batches b
     left join (
       select distinct on (question_id, engine)
         question_id,
         engine,
         status
       from prompt_lab_engine_results
       where batch_id = $2
       order by question_id, engine, created_at desc
     ) r on true
     left join prompt_lab_questions q on q.id = r.question_id
     where b.brand_slug = $1
       and b.id = $2`,
    [input.brandSlug, input.batch.id],
  );

  const byQuestion = new Map<
    string,
    { stage: PromptLabQuestion["stage"]; statuses: Partial<Record<PromptLabEngineName, PromptLabEngineStatus>> }
  >();

  for (const row of rows.rows) {
    if (!row.question_id || !row.engine || !row.engine_status) continue;
    if (!isDailyPromptLabEngine(row.engine)) continue;

    const current = byQuestion.get(row.question_id) ?? {
      stage: row.stage ?? "Consideration",
      statuses: {},
    };
    current.statuses[row.engine] = row.engine_status;
    byQuestion.set(row.question_id, current);
  }

  let tinyLemonQuestionCount = 0;
  let decisionGapCount = 0;
  let failedEngineCount = 0;
  let completedEngineCount = 0;

  for (const question of byQuestion.values()) {
    const statuses = dailyPromptLabEngines.map((engine) => question.statuses[engine]);
    const hasMention = statuses.some((status) => status === "mentioned");
    const hasError = statuses.some((status) => status === "error");
    const completedAllWired = statuses.every((status) => status === "mentioned" || status === "missing");

    failedEngineCount += statuses.filter((status) => status === "error").length;
    completedEngineCount += statuses.filter(
      (status) => status === "mentioned" || status === "missing",
    ).length;

    if (hasMention) tinyLemonQuestionCount += 1;
    if (question.stage === "Decision" && completedAllWired && !hasMention && !hasError) {
      decisionGapCount += 1;
    }
  }

  return {
    batchId: input.batch.id,
    runDate: isoDate(input.batch.run_date),
    status: input.batch.status,
    startedAt: isoDateTime(input.batch.started_at),
    completedAt: input.batch.completed_at ? isoDateTime(input.batch.completed_at) : null,
    questionCount: input.questionCount,
    tinyLemonQuestionCount,
    decisionGapCount,
    failedEngineCount,
    completedEngineCount,
    totalEngineCount: input.questionCount * dailyPromptLabEngines.length,
  };
}

function isDailyPromptLabEngine(engine: PromptLabEngineName): engine is DailyPromptLabEngine {
  return (dailyPromptLabEngines as readonly PromptLabEngineName[]).includes(engine);
}

export function calculateDailyMetrics(rows: DailyMetricResultRow[]) {
  const engineSet = new Set<string>();
  const competitorMentionCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  // Every completed result is a sample: reruns of the same (question, engine)
  // pair add to the day's sample instead of replacing earlier answers.
  const completedPairs = new Set<string>();
  const erroredPairs = new Set<string>();
  let completedAnswerCount = 0;
  let brandMentionedCount = 0;
  let brandCitedCount = 0;
  let brandRecommendedCount = 0;
  let brandTopPickCount = 0;
  let sentimentAnswerCount = 0;
  let sentimentScoreTotal = 0;

  for (const row of rows) {
    if (!row.engine || !row.engine_status || !isDailyPromptLabEngine(row.engine)) {
      continue;
    }

    engineSet.add(row.engine);
    const pairKey = `${row.question_id}:${row.engine}`;
    if (row.engine_status === "error") erroredPairs.add(pairKey);

    const completed =
      row.engine_status === "mentioned" || row.engine_status === "missing";
    if (!completed) continue;

    completedPairs.add(pairKey);
    completedAnswerCount += 1;
    const visibilityScore = normalizeJson<VisibilityScore>(row.visibility_score);
    const answerSignal = normalizeJson<AnswerSignal>(row.answer_signal);
    const competitorSignals = normalizeJsonArray<CompetitorAnswerSignal>(
      row.competitor_signals,
    );
    const citations = normalizeJsonArray<string>(row.citations);
    const brandMentioned =
      visibilityScore?.brandMentioned ?? row.engine_status === "mentioned";
    const brandCited = visibilityScore?.brandCited ?? false;
    const brandRecommendation =
      answerSignal?.brandRecommendation ?? (brandMentioned ? "neutral" : "absent");

    if (brandMentioned) {
      brandMentionedCount += 1;
      sentimentAnswerCount += 1;
      sentimentScoreTotal += recommendationSentimentScore(brandRecommendation);
    }
    if (brandCited) brandCitedCount += 1;
    if (isRecommended(brandRecommendation)) brandRecommendedCount += 1;
    if (brandRecommendation === "top_pick") brandTopPickCount += 1;

    for (const competitor of competitorSignals) {
      if (!competitor.mentioned) continue;
      competitorMentionCounts.set(
        competitor.name,
        (competitorMentionCounts.get(competitor.name) ?? 0) + 1,
      );
    }

    for (const domain of citations) {
      if (!domain) continue;
      sourceCounts.set(domain, (sourceCounts.get(domain) ?? 0) + 1);
    }
  }

  // A pair only counts as failed when no attempt for it completed that day.
  const failedAnswerCount = [...erroredPairs].filter(
    (pair) => !completedPairs.has(pair),
  ).length;
  const visibilityPct = percent(brandMentionedCount, completedAnswerCount);
  const citationPct = percent(brandCitedCount, Math.max(brandMentionedCount, 1));
  const sentimentScore = sentimentAnswerCount
    ? roundMetric(sentimentScoreTotal / sentimentAnswerCount)
    : 0;
  const shareBase =
    brandMentionedCount +
    [...competitorMentionCounts.values()].reduce((sum, count) => sum + count, 0);
  const competitorShareOfVoice = [
    {
      name: "Tiny Lemon",
      mentions: brandMentionedCount,
      sharePct: percent(brandMentionedCount, shareBase),
      you: true,
    },
    ...[...competitorMentionCounts.entries()].map(([name, mentions]) => ({
      name,
      mentions,
      sharePct: percent(mentions, shareBase),
    })),
  ].sort((left, right) => right.mentions - left.mentions || left.name.localeCompare(right.name));
  const sourceMix = [...sourceCounts.entries()]
    .map(([domain, cites]) => ({ domain, cites }))
    .sort((left, right) => right.cites - left.cites || left.domain.localeCompare(right.domain))
    .slice(0, 12);

  return {
    engineCount: engineSet.size,
    completedAnswerCount,
    failedAnswerCount,
    brandMentionedCount,
    brandCitedCount,
    brandRecommendedCount,
    brandTopPickCount,
    sentimentAnswerCount,
    sentimentScore,
    visibilityPct,
    citationPct,
    lowSampleSize: sentimentAnswerCount < 30 || visibilityPct < 5,
    competitorShareOfVoice,
    sourceMix,
  };
}

function normalizeDailyMetricsRow(row: DailyMetricsRow): PromptLabDailyMetrics {
  return {
    id: row.id,
    batchId: row.batch_id,
    brandSlug: row.brand_slug,
    runDate: isoDate(row.run_date),
    status: row.status,
    engineCount: row.engine_count,
    completedAnswerCount: row.completed_answer_count,
    failedAnswerCount: row.failed_answer_count,
    brandMentionedCount: row.brand_mentioned_count,
    brandCitedCount: row.brand_cited_count,
    brandRecommendedCount: row.brand_recommended_count,
    brandTopPickCount: row.brand_top_pick_count,
    sentimentAnswerCount: row.sentiment_answer_count,
    sentimentScore: Number(row.sentiment_score),
    visibilityPct: Number(row.visibility_pct),
    citationPct: Number(row.citation_pct),
    lowSampleSize: row.low_sample_size,
    competitorShareOfVoice: normalizeJsonArray<CompetitorShareOfVoiceRow>(
      row.competitor_share_of_voice,
    ),
    sourceMix: normalizeJsonArray<SourceMixRow>(row.source_mix),
    updatedAt: isoDateTime(row.updated_at),
  };
}

function recommendationSentimentScore(
  recommendation: AnswerSignal["brandRecommendation"],
) {
  if (recommendation === "top_pick") return 100;
  if (recommendation === "recommended") return 85;
  if (recommendation === "qualified") return 65;
  if (recommendation === "neutral") return 50;
  if (recommendation === "not_recommended") return 0;
  return 0;
}

function isRecommended(recommendation: AnswerSignal["brandRecommendation"]) {
  return (
    recommendation === "recommended" ||
    recommendation === "top_pick" ||
    recommendation === "qualified"
  );
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return roundMetric((numerator / denominator) * 100);
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeJson<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value !== "string") return value as T;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeJsonArray<T>(value: unknown): T[] {
  const parsed = normalizeJson<T[]>(value);
  return Array.isArray(parsed) ? parsed : [];
}

async function countPromptLabQuestions(input: { brandSlug: string }) {
  const result = await query<CountRow>(
    `select count(*)::text as count
     from prompt_lab_questions
     where brand_slug = $1`,
    [input.brandSlug],
  );

  return Number(result.rows[0]?.count ?? 0);
}

function emptyDailySummary(input: {
  runDate: string;
  questionCount: number;
}): PromptLabDailySummary {
  return {
    batchId: null,
    runDate: input.runDate,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    questionCount: input.questionCount,
    tinyLemonQuestionCount: 0,
    decisionGapCount: 0,
    failedEngineCount: 0,
    completedEngineCount: 0,
    totalEngineCount: input.questionCount * dailyPromptLabEngines.length,
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function isoDateTime(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}
