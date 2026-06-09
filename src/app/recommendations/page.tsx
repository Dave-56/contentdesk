import Link from "next/link";

type RecommendationAction = {
  id: string;
  stage: "Decision" | "Evaluation" | "Awareness" | "Consideration";
  type: string;
  recommendationType: "Outreach" | "Owned content" | "Social amplification" | "New content";
  contentType: "Article" | "Listing" | "Social post" | "Comparison page" | "Guide";
  channel: "Affiliate" | "Shopify App Store" | "Reddit" | "Website";
  workState: "Ready to review" | "Drafting" | "Recommended" | "Done";
  artifactLabel: string;
  artifactSummary: string;
  artifactPreview: string[];
  primaryCta: string;
  title: string;
  reason: string;
  prompt: string;
  impact: "High" | "Medium" | "Low";
  effort: string;
  status: "Ready" | "Needs review" | "Backlog";
};

const actions: RecommendationAction[] = [
  {
    id: "a1",
    stage: "Decision",
    type: "Pitch source",
    recommendationType: "Outreach",
    contentType: "Article",
    channel: "Affiliate",
    workState: "Ready to review",
    artifactLabel: "Outreach email ready",
    artifactSummary: "AI drafted the source pitch, subject line, and proof bullets for listicle owners.",
    artifactPreview: [
      "Subject: Tiny Lemon for your Shopify AI product photo tools roundup",
      "Angle: Shopify-native apparel photos from one rough product image.",
      "Proof: Decision prompts prefer listicles where Photoroom currently wins.",
    ],
    primaryCta: "Review outreach",
    title: "Get Tiny Lemon into Shopify AI product photo listicles",
    reason:
      "Decision prompts have the clearest buyer intent, and Tiny Lemon is absent while Photoroom wins.",
    prompt: "best AI product photo app for Shopify",
    impact: "High",
    effort: "~1 day",
    status: "Ready",
  },
  {
    id: "a4",
    stage: "Decision",
    type: "Improve listing",
    recommendationType: "Owned content",
    contentType: "Listing",
    channel: "Shopify App Store",
    workState: "Ready to review",
    artifactLabel: "Listing edits ready",
    artifactSummary: "AI drafted tighter App Store copy for Shopify product-photo buyer language.",
    artifactPreview: [
      "Lead with Shopify apparel use case.",
      "Add AI product-photo wording buyers use in decision prompts.",
      "Keep claims focused on speed, store fit, and product-image output.",
    ],
    primaryCta: "Review edits",
    title: "Strengthen Shopify App Store listing language",
    reason:
      "The marketplace is cited often, but Tiny Lemon coverage is weak for exact Shopify product-photo wording.",
    prompt: "cheapest AI product photography tool for Shopify",
    impact: "Medium",
    effort: "~2 hrs",
    status: "Ready",
  },
  {
    id: "a2",
    stage: "Evaluation",
    type: "Answer Reddit",
    recommendationType: "Social amplification",
    contentType: "Social post",
    channel: "Reddit",
    workState: "Ready to review",
    artifactLabel: "Reddit reply ready",
    artifactSummary: "AI drafted a disclosed, low-pressure reply with promo risk notes.",
    artifactPreview: [
      "Tone: helpful founder reply, no hard sell.",
      "Mention: Tiny Lemon only after acknowledging Pebblely and Photoroom tradeoffs.",
      "CTA: offer example output instead of asking users to install.",
    ],
    primaryCta: "Review reply",
    title: "Add Tiny Lemon to Pebblely vs Photoroom discussions",
    reason:
      "Comparison prompts name competitors only. A useful disclosed reply can put Tiny Lemon into consideration.",
    prompt: "Pebblely vs Photoroom for fashion ecommerce",
    impact: "Medium",
    effort: "~30 min",
    status: "Needs review",
  },
  {
    id: "a5",
    stage: "Evaluation",
    type: "Publish page",
    recommendationType: "New content",
    contentType: "Comparison page",
    channel: "Website",
    workState: "Drafting",
    artifactLabel: "Page draft in progress",
    artifactSummary: "AI has the outline and competitor proof. Draft body is still being assembled.",
    artifactPreview: [
      "Outline complete: Tiny Lemon vs Botika for Shopify apparel photos.",
      "Needs: feature comparison, use-case fit, and proof section.",
      "Next: finish draft before review.",
    ],
    primaryCta: "Open draft",
    title: "Create Tiny Lemon vs Botika comparison page",
    reason:
      "Botika appears in AI model-photo alternatives. Tiny Lemon needs a citable comparison asset.",
    prompt: "Botika alternatives for AI model photos",
    impact: "Medium",
    effort: "~half day",
    status: "Backlog",
  },
  {
    id: "a3",
    stage: "Awareness",
    type: "Publish guide",
    recommendationType: "New content",
    contentType: "Guide",
    channel: "Website",
    workState: "Recommended",
    artifactLabel: "No draft yet",
    artifactSummary: "Agent found the opportunity. Draft can be generated after higher-intent work is reviewed.",
    artifactPreview: [
      "Proposed guide: studio-looking product photos without a photographer.",
      "Audience: Shopify founders with low shoot budget.",
      "Useful after outreach and listing edits are reviewed.",
    ],
    primaryCta: "Generate draft",
    title: "Publish studio product photos without a photographer guide",
    reason:
      "Top-funnel how-tos send buyers to rival blogs. A clear guide can become the source AI assistants cite.",
    prompt: "how to get studio product photos without a photographer",
    impact: "Medium",
    effort: "~half day",
    status: "Backlog",
  },
];

const primaryAction = actions[0];

const evidence = [
  ["Buyer intent", "Decision prompt", "Highest conversion path: buyer is choosing a Shopify product photo app."],
  ["Current winner", "Photoroom", "AI answers recommend a broader competitor before Tiny Lemon appears."],
  ["Source gap", "Review/listicle inclusion", "Trusted source pages influence the answer more than another generic blog post."],
] as const;

const filters = [
  { label: "All work", value: "all" },
  { label: "Ready to review", value: "ready-to-review" },
  { label: "Drafting", value: "drafting" },
  { label: "Recommended", value: "recommended" },
  { label: "Done", value: "done" },
] as const;

type FilterValue = (typeof filters)[number]["value"];

function toFilterValue(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-") as FilterValue;
}

function isFilterValue(value: string | undefined): value is FilterValue {
  return filters.some((filter) => filter.value === value);
}

function matchesFilter(action: RecommendationAction, filter: FilterValue) {
  if (filter === "all") return true;

  return toFilterValue(action.workState) === filter;
}

function actionCountLabel(count: number) {
  return `${count} ranked ${count === 1 ? "action" : "actions"}`;
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = isFilterValue(params?.filter) ? params.filter : "all";
  const visibleActions = actions.filter((action) => matchesFilter(action, activeFilter));
  const firstVisibleAction = visibleActions[0];
  const reviewCount = actions.filter((action) => action.workState === "Ready to review").length;
  const draftingCount = actions.filter((action) => action.workState === "Drafting").length;

  return (
    <main className="ai-dashboard">
      <header className="ai-topbar">
        <div className="ai-topbar-inner">
          <Link className="ai-brand" href="/" aria-label="ContentDesk dashboard">
            <span className="ai-brand-mark">C</span>
            <span>ContentDesk</span>
            <span className="ai-brand-sub">/ Tiny Lemon</span>
          </Link>
          <nav className="ai-nav" aria-label="Product navigation">
            <Link href="/">Dashboard</Link>
            <Link href="/prompt-lab">Prompts</Link>
            <Link href="/citations">Citations</Link>
            <Link className="is-active" href="/recommendations">
              Recommendations
            </Link>
          </nav>
          <div className="ai-user-pill" aria-label="Signed in as David">
            <span>D</span>
            <strong>David</strong>
          </div>
        </div>
      </header>

      <div className="ai-page">
        <div className="ai-page-head">
          <div>
            <h1>Recommendations</h1>
            <p>Agent-prepared work from the highest-value visibility gaps.</p>
          </div>
          <div className="rec-page-stats" aria-label="Recommendation summary">
            <span>{reviewCount} ready to review</span>
            <span>{draftingCount} drafting</span>
          </div>
        </div>

        <nav className="rec-filter-bar" aria-label="Recommendation filters">
          {filters.map((filter) => (
            <Link
              className={filter.value === activeFilter ? "is-active" : ""}
              href={filter.value === "all" ? "/recommendations" : `/recommendations?filter=${filter.value}`}
              key={filter.value}
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        <section className="ai-section">
          <div className="ai-section-head">
            <div>
              <h2>Action queue</h2>
              <p>{actionCountLabel(visibleActions.length)}. Review prepared work, then approve or keep drafting.</p>
            </div>
          </div>

          <div className="rec-action-list">
            {visibleActions.length === 0 ? (
              <article className="ai-card rec-empty-state">
                <strong>No work in this state.</strong>
                <p>When the agent finishes or archives work, it will show up here.</p>
              </article>
            ) : null}

            {visibleActions.map((action, index) => (
              <details
                className="ai-card rec-action-row"
                key={action.id}
                name="recommendations"
                open={action.id === firstVisibleAction?.id}
              >
                <summary>
                  <span className="rec-rank">{index + 1}</span>
                  <div className="rec-action-main">
                    <small>
                      {action.stage} - {action.type}
                    </small>
                    <strong>{action.title}</strong>
                    <span className="rec-classification">
                      {action.recommendationType} · {action.contentType} · {action.channel}
                    </span>
                    <span className="rec-artifact-summary">{action.artifactSummary}</span>
                  </div>
                  <div className="rec-action-side">
                    <span className={`rec-work-state ${toFilterValue(action.workState)}`}>{action.workState}</span>
                    <span className={`rec-impact ${action.impact.toLowerCase()}`}>{action.impact}</span>
                    <span>{action.effort}</span>
                  </div>
                  <span className="rec-expand-label">
                    {action.id === firstVisibleAction?.id ? "Why ranked first" : "View details"}
                  </span>
                </summary>

                <div className="rec-action-detail">
                  <p>{action.reason}</p>
                  <em>Decision prompt: {action.prompt}</em>

                  <div className="rec-artifact-card" aria-label={`${action.artifactLabel} preview`}>
                    <span>{action.artifactLabel}</span>
                    <strong>{action.primaryCta}</strong>
                    <ul>
                      {action.artifactPreview.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {action.id === primaryAction.id ? (
                    <div className="rec-proof-list" aria-label="Why this action is ranked first">
                      {evidence.map(([label, value, detail]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                          <p>{detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="rec-row-actions">
                    <button className="ai-btn ai-btn-primary" type="button">
                      {action.primaryCta}
                    </button>
                    <Link className="ai-btn ai-btn-secondary" href="/prompt-lab">
                      View prompt
                    </Link>
                    <Link className="ai-btn ai-btn-secondary" href="/citations">
                      View sources
                    </Link>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
