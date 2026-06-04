import recommendationsData from "../../../data/tinylemon-xyz/visibility/recommendations.json";

type StatusArray = string[];

type SourceUsed = {
  domain: string;
  format: string;
};

type ProviderSignal = {
  provider: string;
  brandStatus: string;
  brandRecommendation: string;
  brandMentioned: boolean;
  brandCited: boolean;
  competitorsRecommended: StatusArray;
  citedDomains: StatusArray;
};

type PromptGap = {
  promptId: string;
  prompt: string;
  promptGroup: string;
  providers: StatusArray;
  brandStatus: string;
  brandRecommendation: string;
  brandMentioned: boolean;
  brandCited: boolean;
  competitorStatus: {
    mentioned: StatusArray;
    cited: StatusArray;
    recommended: StatusArray;
  };
  sourcesUsed: SourceUsed[];
  gapType: string;
  nextAction: string;
  why: string;
  providerSignals: ProviderSignal[];
};

type VisibilityRecommendations = {
  brand: string;
  providers: string[];
  generatedAt: string;
  basedOnRunDate: string;
  summary: {
    promptCount: number;
    brandRecommendedCount: number;
    brandTopPickCount: number;
    competitorRecommendedOnlyCount: number;
    citedButNotRecommendedCount: number;
  };
  promptGaps: PromptGap[];
};

const data = recommendationsData as unknown as VisibilityRecommendations;

const statusLabels: Record<string, string> = {
  absent: "Absent",
  mentioned: "Mentioned",
  cited: "Cited",
  recommended: "Recommended",
  top_pick: "Top pick",
  neutral: "Neutral",
  qualified: "Qualified",
  not_recommended: "Not recommended",
};

function label(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function statusTone(value: string) {
  if (value === "recommended" || value === "top_pick") return "positive";
  if (value === "cited" || value === "mentioned" || value === "qualified") {
    return "watch";
  }
  if (value === "absent" || value === "not_recommended") return "negative";
  return "neutral";
}

function joinList(items: StatusArray) {
  return items.length > 0 ? items.join(", ") : "None";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function RecommendationsPage() {
  const promptGaps = data.promptGaps;
  const topActions = promptGaps
    .filter((gap) =>
      ["competitor_recommended_gap", "recommendation_gap", "absent_gap"].includes(
        gap.gapType,
      ),
    )
    .slice(0, 3);

  return (
    <main className="recommendations-page">
      <header className="recommendations-hero">
        <a className="back-link" href="/">
          ContentDesk
        </a>
        <div>
          <p className="eyebrow">Recommendation page</p>
          <h1>{data.brand} prompt gaps</h1>
          <p className="recommendations-lede">
            Prompt-level view of where Tiny Lemon is absent, mentioned, cited,
            recommended, or losing to competitors.
          </p>
        </div>
        <div className="run-meta" aria-label="Run metadata">
          <span>Run {formatDate(data.basedOnRunDate)}</span>
          <span>Generated {formatDate(data.generatedAt)}</span>
        </div>
      </header>

      <section className="recommendation-summary" aria-label="Visibility summary">
        <MetricCard label="Prompts" value={data.summary.promptCount} />
        <MetricCard label="Providers" value={data.providers.length} />
        <MetricCard
          label="Recommended"
          value={data.summary.brandRecommendedCount}
          tone="positive"
        />
        <MetricCard
          label="Top pick"
          value={data.summary.brandTopPickCount}
          tone="neutral"
        />
        <MetricCard
          label="Competitor wins"
          value={data.summary.competitorRecommendedOnlyCount}
          tone="negative"
        />
        <MetricCard
          label="Cited, not chosen"
          value={data.summary.citedButNotRecommendedCount}
          tone="watch"
        />
      </section>

      <section className="next-actions" aria-label="Recommended next actions">
        <div>
          <p className="eyebrow">Next actions</p>
          <h2>Turn visibility into selection.</h2>
        </div>
        <div className="action-list">
          {topActions.map((gap) => (
            <article className="action-item" key={gap.promptId}>
              <span>{label(gap.gapType)}</span>
              <h3>{gap.nextAction}</h3>
              <p>{gap.prompt}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="prompt-gap-list" aria-label="Prompt gaps">
        {promptGaps.map((gap) => (
          <article className="prompt-gap-card" key={gap.promptId}>
            <div className="prompt-gap-topline">
              <span className="prompt-group">{label(gap.promptGroup)}</span>
              <StatusPill value={gap.gapType} />
            </div>

            <h2>{gap.prompt}</h2>

            <div className="signal-grid" aria-label="Prompt status">
              <SignalBox
                label="Tiny Lemon status"
                value={label(gap.brandStatus)}
                tone={statusTone(gap.brandStatus)}
              />
              <SignalBox
                label="Tiny Lemon recommendation"
                value={label(gap.brandRecommendation)}
                tone={statusTone(gap.brandRecommendation)}
              />
              <SignalBox
                label="Competitors mentioned"
                value={joinList(gap.competitorStatus.mentioned)}
                tone={gap.competitorStatus.mentioned.length > 0 ? "watch" : "neutral"}
              />
              <SignalBox
                label="Competitors recommended"
                value={joinList(gap.competitorStatus.recommended)}
                tone={
                  gap.competitorStatus.recommended.length > 0 ? "negative" : "neutral"
                }
              />
            </div>

            <div className="prompt-gap-detail">
              <div>
                <h3>Why</h3>
                <p>{gap.why}</p>
              </div>
              <div>
                <h3>Next action</h3>
                <p>{gap.nextAction}</p>
              </div>
            </div>

            <ProviderSignals signals={gap.providerSignals} />
            <SourceRail sources={gap.sourcesUsed} />
          </article>
        ))}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "positive" | "watch" | "negative" | "neutral";
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${statusTone(value)}`}>{label(value)}</span>;
}

function SignalBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`signal-box ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProviderSignals({ signals }: { signals: ProviderSignal[] }) {
  return (
    <div className="provider-signals">
      <h3>Provider evidence</h3>
      <div className="provider-grid">
        {signals.map((signal) => (
          <div className="provider-card" key={signal.provider}>
            <div className="provider-card-head">
              <strong>{signal.provider}</strong>
              <StatusPill value={signal.brandRecommendation} />
            </div>
            <div className="mini-signal-row">
              <span className={signal.brandMentioned ? "is-on" : ""}>Mentioned</span>
              <span className={signal.brandCited ? "is-on" : ""}>Cited</span>
            </div>
            <p>
              Competitor rec:{" "}
              <strong>{joinList(signal.competitorsRecommended)}</strong>
            </p>
            <p>Cites: {signal.citedDomains.slice(0, 5).join(", ") || "None"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceRail({ sources }: { sources: SourceUsed[] }) {
  const shownSources = sources.slice(0, 10);
  const hiddenCount = sources.length - shownSources.length;

  return (
    <div className="source-rail" aria-label="Sources used">
      <h3>Sources used</h3>
      <div>
        {shownSources.map((source) => (
          <span key={`${source.domain}-${source.format}`}>
            {source.domain}
            <small>{label(source.format)}</small>
          </span>
        ))}
        {hiddenCount > 0 ? <span>+{hiddenCount} more</span> : null}
      </div>
    </div>
  );
}
