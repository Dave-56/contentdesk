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
  brandStatus: string;
  brandRecommendation: string;
  competitorStatus: {
    mentioned: StatusArray;
    cited: StatusArray;
    recommended: StatusArray;
  };
  sourcesUsed: SourceUsed[];
  gapType: string;
  why: string;
  providerSignals: ProviderSignal[];
};

type PromptTask = {
  action: string;
  basedOn: string;
  reason: string;
};

type VisibilityRecommendation = {
  rank: number;
  title: string;
  taskType: string;
  priority: string;
  confidence: string;
  targetPromptId: string;
  targetPrompt: string;
  why: string[];
};

type VisibilityRecommendations = {
  brand: string;
  providers: string[];
  basedOnRunDate: string;
  summary: {
    promptCount: number;
    brandRecommendedCount: number;
    citedButNotRecommendedCount: number;
  };
  promptGaps: PromptGap[];
  recommendations: VisibilityRecommendation[];
};

type CommunityFit = {
  level: "strong" | "medium" | "weak";
  label: string;
  tone: "win" | "watch" | "plain";
  shouldMention: string;
  promoRisk: string;
  ctaStrength: string;
  angle: string;
  reason: string;
};

const data = recommendationsData as unknown as VisibilityRecommendations;

const statusLabels: Record<string, string> = {
  absent: "Absent",
  mentioned: "Mentioned",
  cited: "Cited",
  recommended: "Recommended",
  top_pick: "Top pick",
  neutral: "Neutral",
};

function label(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function unique(items: StatusArray) {
  return Array.from(new Set(items.filter(Boolean)));
}

function isNamedTinyLemonPrompt(gap: PromptGap) {
  return gap.prompt.toLowerCase().includes("tiny lemon");
}

function hasRedditCitation(gap: PromptGap) {
  return gap.sourcesUsed.some(
    (source) => source.format === "reddit_thread" || source.domain.includes("reddit"),
  );
}

function getCommunityFit(gap: PromptGap): CommunityFit | null {
  if (!hasRedditCitation(gap)) return null;

  const prompt = gap.prompt.toLowerCase();
  const exactProductPrompt = prompt.includes("tiny lemon");
  const directShopifyWorkflow =
    prompt.includes("shopify") &&
    (prompt.includes("flat-lay") ||
      prompt.includes("product images") ||
      prompt.includes("product photos") ||
      prompt.includes("model photos") ||
      prompt.includes("directly to shopify"));
  const buyerPain =
    prompt.includes("no shoot budget") ||
    prompt.includes("studio-quality") ||
    prompt.includes("what should i check") ||
    prompt.includes("installing");

  if (exactProductPrompt && directShopifyWorkflow) {
    return {
      level: "strong",
      label: "Strong mention fit",
      tone: "win",
      shouldMention: "Yes, disclose affiliation.",
      promoRisk: "Low",
      ctaStrength: "Soft mention",
      angle:
        "Answer the workflow question first, then mention Tiny Lemon as one Shopify-native option.",
      reason: "Prompt maps directly to Tiny Lemon's Shopify flat-lay workflow.",
    };
  }

  if (directShopifyWorkflow || buyerPain) {
    return {
      level: "medium",
      label: "Review before mention",
      tone: "watch",
      shouldMention: "Maybe, only if thread rules and context fit.",
      promoRisk: "Medium",
      ctaStrength: "None or soft mention",
      angle:
        "Give a practical checklist. Mention Tiny Lemon only if examples/tools are welcome.",
      reason:
        "Buyer pain fits Tiny Lemon, but exact thread context is needed before product mention.",
    };
  }

  return {
    level: "weak",
    label: "No promo by default",
    tone: "plain",
    shouldMention: "No.",
    promoRisk: "High",
    ctaStrength: "None",
    angle: "Use as learning source, not visibility comment target.",
    reason: "Reddit is cited, but product mention would likely feel forced.",
  };
}

function getCommunityOpportunities(promptGaps: PromptGap[]) {
  return promptGaps
    .map((gap) => ({ gap, fit: getCommunityFit(gap) }))
    .filter((item): item is { gap: PromptGap; fit: CommunityFit } => item.fit !== null);
}

function getAction(gap: PromptGap) {
  const prompt = gap.prompt.toLowerCase();
  const competitors = gap.competitorStatus.recommended;

  if (competitors.some((name) => name.toLowerCase().includes("botika"))) {
    return "Create Botika vs Tiny Lemon page";
  }
  if (competitors.some((name) => name.toLowerCase().includes("lalaland"))) {
    return "Create Lalaland.ai alternatives page";
  }
  if (prompt.includes("no shoot budget")) return "Rewrite Shopify App Store listing";
  if (prompt.includes("flat-lay")) return "Publish flat-lay buyer guide";
  if (prompt.includes("worth trying")) return "Add proof to Tiny Lemon use-case page";
  if (prompt.includes("apps are best for indie fashion")) {
    return "Publish indie Shopify AI photo apps guide";
  }
  if (prompt.includes("what should i check")) {
    return "Publish AI photo app buyer checklist";
  }
  if (prompt.includes("studio-quality")) return "Publish no-shoot-budget guide";
  if (prompt.includes("front, side, and back")) {
    return "Publish multi-angle use-case page";
  }
  if (prompt.includes("directly to shopify")) {
    return "Create Shopify publishing guide";
  }

  return "Improve proof for this buyer question";
}

function getPromptStatus(gap: PromptGap) {
  if (gap.competitorStatus.recommended.length > 0) return "Competitor won";
  if (gap.brandRecommendation === "recommended") return "Recommended";
  if (gap.brandStatus === "cited") return "Cited, not chosen";
  if (gap.brandStatus === "mentioned") return "Mentioned";
  return "Absent";
}

function statusTone(status: string) {
  if (status === "Recommended") return "win";
  if (status === "Competitor won") return "miss";
  if (status === "Cited, not chosen") return "watch";
  return "plain";
}

function getPromptReason(gap: PromptGap) {
  const competitors = gap.competitorStatus.recommended;
  if (competitors.length > 0) {
    return `${competitors.join(" and ")} recommended while Tiny Lemon stayed neutral.`;
  }
  if (gap.brandRecommendation === "recommended") {
    return "Tiny Lemon was recommended, but not yet the strongest/top-pick answer.";
  }
  if (gap.brandStatus === "cited") {
    return "Tiny Lemon was cited, but answer did not choose it.";
  }
  return "Tiny Lemon did not enter the answer.";
}

function getTopTasks(promptGaps: PromptGap[]) {
  const competitorTasks = promptGaps
    .filter((gap) => gap.competitorStatus.recommended.length > 0)
    .map((gap) => ({
      action: getAction(gap),
      basedOn: gap.prompt,
      reason: `${getPromptReason(gap)} This was a named comparison prompt.`,
    }));

  const unbrandedTask = promptGaps.find(
    (gap) =>
      !isNamedTinyLemonPrompt(gap) &&
      gap.prompt.toLowerCase().includes("no shoot budget"),
  );
  const tasks: PromptTask[] = [...competitorTasks];

  if (unbrandedTask) {
    tasks.push({
      action: getAction(unbrandedTask),
      basedOn: unbrandedTask.prompt,
      reason: "Tiny Lemon was absent from an unbranded buyer-discovery prompt.",
    });
  }

  return tasks.slice(0, 3);
}

export default function RecommendationsPage() {
  const promptGaps = data.promptGaps;
  const topRecommendation = data.recommendations
    .slice()
    .sort((left, right) => left.rank - right.rank)[0];
  const namedPrompts = promptGaps.filter(isNamedTinyLemonPrompt);
  const unbrandedPrompts = promptGaps.filter((gap) => !isNamedTinyLemonPrompt(gap));
  const namedCitedCount = namedPrompts.filter(
    (gap) => gap.brandStatus === "cited" || gap.brandStatus === "recommended",
  ).length;
  const unbrandedMentionedCount = unbrandedPrompts.filter(
    (gap) => gap.brandStatus !== "absent",
  ).length;
  const unbrandedRecommendedCount = unbrandedPrompts.filter(
    (gap) => gap.brandRecommendation === "recommended",
  ).length;
  const competitorPrompts = promptGaps.filter(
    (gap) => gap.competitorStatus.recommended.length > 0,
  );
  const competitorWinners = unique(
    competitorPrompts.flatMap((gap) => gap.competitorStatus.recommended),
  );
  const topTasks = getTopTasks(promptGaps);
  const communityOpportunities = getCommunityOpportunities(promptGaps);
  const mentionableCommunityCount = communityOpportunities.filter(
    ({ fit }) => fit.level === "strong",
  ).length;
  const reviewCommunityCount = communityOpportunities.filter(
    ({ fit }) => fit.level === "medium",
  ).length;

  return (
    <main className="founder-report">
      <header className="founder-header">
        <a className="back-link" href="/">
          ContentDesk
        </a>
        <span>
          {formatDate(data.basedOnRunDate)} · {data.summary.promptCount} prompts ·{" "}
          {data.providers.length} providers
        </span>
      </header>

      <section className="founder-hero" aria-label="What happened">
        <p className="eyebrow">Weekly AI search summary</p>
        <h1>{data.brand} is not showing up when buyers ask for the category.</h1>
        <p>
          In {unbrandedPrompts.length} unbranded buyer prompts, Tiny Lemon appeared{" "}
          {unbrandedMentionedCount} times. The only visibility came from prompts that
          already named Tiny Lemon. Next move: win category discovery before worrying
          about branded prompts.
        </p>
        {topRecommendation ? (
          <div className="recommended-move">
            <span>Recommended asset</span>
            <strong>{topRecommendation.title}</strong>
            <p>{topRecommendation.why[0]}</p>
          </div>
        ) : null}
      </section>

      <section className="founder-section" aria-label="What should I do next">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">What should I do next?</p>
            <h2>Next 3 moves</h2>
          </div>
          <span>{competitorWinners.join(" + ") || "Tiny Lemon"}</span>
        </div>

        <div className="task-stack">
          {topTasks.map((task, index) => (
            <article className="task-card" key={task.action}>
              <span>{index + 1}</span>
              <div>
                <h3>{task.action}</h3>
                <p>{task.reason}</p>
                <small>Based on: {task.basedOn}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="founder-section" aria-label="Why">
        <p className="eyebrow">Why?</p>
        <div className="why-grid">
          <StatCard
            label="Named prompts"
            value={namedPrompts.length}
            detail="These prompts already said Tiny Lemon, so citation here is not natural discovery."
            tone="watch"
          />
          <StatCard
            label="Unbranded mentions"
            value={unbrandedMentionedCount}
            detail="Times Tiny Lemon appeared when buyer did not name the brand."
            tone="miss"
          />
          <StatCard
            label="Competitor wins"
            value={competitorPrompts.length}
            detail="Direct buyer-comparison prompts favored Botika or Lalaland.ai."
            tone="miss"
          />
          <StatCard
            label="Unbranded recs"
            value={unbrandedRecommendedCount}
            detail="Times Tiny Lemon was recommended without being named first."
            tone={unbrandedRecommendedCount > 0 ? "win" : "miss"}
          />
        </div>
      </section>

      <section className="founder-section" aria-label="Reddit opportunities">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Reddit opportunities</p>
            <h2>Comment only where product mention fits</h2>
          </div>
          <span>
            {mentionableCommunityCount} strong · {reviewCommunityCount} review
          </span>
        </div>

        <div className="community-summary">
          <article>
            <span>Rule</span>
            <p>
              Reddit citation is not enough. Tiny Lemon should be mentioned only when the
              thread pain maps to Shopify apparel photos and a helpful disclosed reply
              would not feel forced.
            </p>
          </article>
          <article>
            <span>Current read</span>
            <p>
              {communityOpportunities.length} scanned prompts include Reddit-thread
              evidence. {mentionableCommunityCount} look naturally mentionable from prompt
              context alone; the rest need exact thread review.
            </p>
          </article>
        </div>

        <div className="community-list">
          {communityOpportunities.slice(0, 4).map(({ gap, fit }) => (
            <article className={`community-item ${fit.tone}`} key={gap.promptId}>
              <div>
                <span>{fit.label}</span>
                <strong>{gap.prompt}</strong>
              </div>
              <dl>
                <div>
                  <dt>Mention</dt>
                  <dd>{fit.shouldMention}</dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd>{fit.promoRisk}</dd>
                </div>
                <div>
                  <dt>CTA</dt>
                  <dd>{fit.ctaStrength}</dd>
                </div>
              </dl>
              <p>{fit.angle}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="founder-section" aria-label="Proof">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Here is proof</p>
            <h2>Prompts scanned</h2>
          </div>
          <span>Click any prompt</span>
        </div>

        <div className="prompt-table">
          <div className="prompt-group-label">Named Tiny Lemon prompts</div>
          {namedPrompts.map((gap) => (
            <PromptRow gap={gap} key={gap.promptId} />
          ))}

          <div className="prompt-group-label">Unbranded buyer prompts</div>
          {unbrandedPrompts.map((gap) => (
            <PromptRow gap={gap} key={gap.promptId} />
          ))}
        </div>
      </section>
    </main>
  );
}

function PromptRow({ gap }: { gap: PromptGap }) {
  return (
    <details className="prompt-row">
      <summary>
        <span className={`status-dot ${statusTone(getPromptStatus(gap))}`} />
        <strong>{gap.prompt}</strong>
        <span>{getPromptStatus(gap)}</span>
        <em>{getAction(gap)}</em>
      </summary>
      <div className="prompt-proof">
        <p>{getPromptReason(gap)}</p>
        <CommunityFitNote fit={getCommunityFit(gap)} />
        <ProviderList signals={gap.providerSignals} />
        <SourceList sources={gap.sourcesUsed} />
      </div>
    </details>
  );
}

function CommunityFitNote({ fit }: { fit: CommunityFit | null }) {
  if (!fit) return null;

  return (
    <div className={`community-fit-note ${fit.tone}`}>
      <strong>{fit.label}</strong>
      <span>{fit.reason}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "miss" | "watch" | "plain" | "win";
}) {
  return (
    <article className={`founder-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function ProviderList({ signals }: { signals: ProviderSignal[] }) {
  return (
    <div className="provider-list">
      {signals.map((signal) => (
        <span key={signal.provider}>
          {signal.provider}: {signal.brandCited ? "cited" : signal.brandStatus},{" "}
          {label(signal.brandRecommendation)}
        </span>
      ))}
    </div>
  );
}

function SourceList({ sources }: { sources: SourceUsed[] }) {
  return (
    <div className="source-list">
      {sources.slice(0, 6).map((source) => (
        <span key={`${source.domain}-${source.format}`}>
          {source.domain} - {label(source.format)}
        </span>
      ))}
    </div>
  );
}
