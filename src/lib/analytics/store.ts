import { query } from "@/lib/db";
import { id } from "@/lib/repository";
import {
  analyticsDailyMetricSchema,
  attributionActionSchema,
  type AnalyticsDailyMetric,
  type AnalyticsSource,
  type AnalyticsSourceStatus,
  type AttributionAction,
  type AttributionActionType,
} from "@/lib/analytics/schemas";

type MetricRow = {
  id: string;
  brand_slug: string;
  metric_date: string | Date;
  source: AnalyticsSource;
  status: AnalyticsSourceStatus;
  provisional: boolean;
  metrics: Record<string, unknown>;
  error: string | null;
  window_start: Date;
  window_end: Date;
  pulled_at: Date;
};

type ActionRow = {
  id: string;
  brand_slug: string;
  action_type: AttributionActionType;
  occurred_at: Date;
  source_ref: Record<string, unknown>;
};

// Upsert keyed on (brand_slug, metric_date, source) so the daily cron and
// backfill runs are rerunnable: a rerun overwrites the row in place.
export async function upsertAnalyticsDailyMetric(input: {
  brandSlug: string;
  metricDate: string;
  source: AnalyticsSource;
  status: AnalyticsSourceStatus;
  provisional: boolean;
  metrics: Record<string, unknown>;
  error?: string;
  windowStart: string;
  windowEnd: string;
}): Promise<AnalyticsDailyMetric> {
  const result = await query<MetricRow>(
    `insert into analytics_daily_metrics
       (id, brand_slug, metric_date, source, status, provisional, metrics, error,
        window_start, window_end, pulled_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, now())
     on conflict (brand_slug, metric_date, source) do update set
       status = excluded.status,
       provisional = excluded.provisional,
       metrics = excluded.metrics,
       error = excluded.error,
       window_start = excluded.window_start,
       window_end = excluded.window_end,
       pulled_at = now(),
       updated_at = now()
     returning id, brand_slug, metric_date, source, status, provisional, metrics,
       error, window_start, window_end, pulled_at`,
    [
      id("analytics"),
      input.brandSlug,
      input.metricDate,
      input.source,
      input.status,
      input.provisional,
      JSON.stringify(input.metrics),
      input.error ?? null,
      input.windowStart,
      input.windowEnd,
    ],
  );

  return metricFromRow(result.rows[0]);
}

export async function listAnalyticsDailyMetrics(input: {
  brandSlug: string;
  fromDate: string;
  toDate: string;
}): Promise<AnalyticsDailyMetric[]> {
  const result = await query<MetricRow>(
    `select id, brand_slug, metric_date, source, status, provisional, metrics,
       error, window_start, window_end, pulled_at
     from analytics_daily_metrics
     where brand_slug = $1 and metric_date between $2 and $3
     order by metric_date desc, source asc`,
    [input.brandSlug, input.fromDate, input.toDate],
  );

  return result.rows.map(metricFromRow);
}

export async function recordAttributionAction(input: {
  brandSlug: string;
  actionType: AttributionActionType;
  occurredAt: string;
  sourceRef: Record<string, unknown>;
}): Promise<AttributionAction> {
  const result = await query<ActionRow>(
    `insert into analytics_action_log (id, brand_slug, action_type, occurred_at, source_ref)
     values ($1, $2, $3, $4, $5::jsonb)
     returning id, brand_slug, action_type, occurred_at, source_ref`,
    [
      id("action"),
      input.brandSlug,
      input.actionType,
      input.occurredAt,
      JSON.stringify(input.sourceRef),
    ],
  );

  return actionFromRow(result.rows[0]);
}

export async function listAttributionActions(input: {
  brandSlug: string;
  fromDate: string;
  toDate: string;
}): Promise<AttributionAction[]> {
  const result = await query<ActionRow>(
    `select id, brand_slug, action_type, occurred_at, source_ref
     from analytics_action_log
     where brand_slug = $1 and occurred_at >= $2 and occurred_at < ($3::date + 1)
     order by occurred_at desc`,
    [input.brandSlug, input.fromDate, input.toDate],
  );

  return result.rows.map(actionFromRow);
}

function metricFromRow(row: MetricRow): AnalyticsDailyMetric {
  return analyticsDailyMetricSchema.parse({
    id: row.id,
    brandSlug: row.brand_slug,
    metricDate: dateOnly(row.metric_date),
    source: row.source,
    status: row.status,
    provisional: row.provisional,
    metrics: row.metrics,
    error: row.error,
    windowStart: row.window_start.toISOString(),
    windowEnd: row.window_end.toISOString(),
    pulledAt: row.pulled_at.toISOString(),
  });
}

function actionFromRow(row: ActionRow): AttributionAction {
  return attributionActionSchema.parse({
    id: row.id,
    brandSlug: row.brand_slug,
    actionType: row.action_type,
    occurredAt: row.occurred_at.toISOString(),
    sourceRef: row.source_ref,
  });
}

function dateOnly(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}
