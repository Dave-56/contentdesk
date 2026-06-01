const surfaces = [
  {
    name: "Marketplace listings",
    signal: "Reviews, categories, feature clarity",
    examples: "Shopify App Store, partner directories",
    score: "High",
  },
  {
    name: "Community threads",
    signal: "Specific buyer objections and lived proof",
    examples: "Reddit, forums, Slack communities",
    score: "Rising",
  },
  {
    name: "Comparison assets",
    signal: "Decision-ready positioning and tradeoffs",
    examples: "Best X pages, alternatives, migration guides",
    score: "High",
  },
  {
    name: "Owned proof pages",
    signal: "Docs, screenshots, benchmarks, dated claims",
    examples: "Guides, use cases, product pages",
    score: "Gap",
  },
];

const steps = [
  {
    title: "Track buyer prompts",
    body: "Monitor how ChatGPT, Perplexity, Gemini, Google AI Overviews, and other answer engines respond when buyers ask about your category.",
  },
  {
    title: "Find the coverage gaps",
    body: "Identify missing mentions, weak citations, competitor wins, inaccurate answers, and the source types currently shaping AI search visibility.",
  },
  {
    title: "Queue the next task",
    body: "Turn each gap into an operator task: draft an article, update a listing, improve a product page, add schema, or prepare a Reddit response.",
  },
  {
    title: "Draft, publish, recheck",
    body: "Send drafts and publishing handoffs to Slack or Codex, then re-run the prompt set to see whether your brand is being cited and recommended.",
  },
];

const assetTypes = [
  "Comparison pages",
  "Marketplace listing rewrites",
  "Reddit and forum answers",
  "Buying guides",
  "Integration docs",
  "Benchmark reports",
  "FAQ and schema blocks",
  "Product proof pages",
];

const proofRows = [
  ["Shopify apps", "App store listings, reviews, category pages", "Queue listing updates, review asks, and comparison content"],
  ["B2B SaaS", "Comparison pages, docs, review sites, expert blogs", "Queue decision pages, integration guides, and proof updates"],
  ["Ecommerce", "Buying guides, reviews, community answers, product pages", "Queue buying guides, product education, and FAQ/schema fixes"],
];

export default function Home() {
  return (
    <main className="page-shell">
      <header className="site-header" aria-label="Primary navigation">
        <a className="brand" href="#hero" aria-label="ContentDesk home">
          <span className="brand-mark" aria-hidden="true" />
          ContentDesk
        </a>
        <nav className="nav-links" aria-label="Page sections">
          <a href="#coverage">Coverage</a>
          <a href="#workflow">Workflow</a>
          <a href="#surfaces">Surfaces</a>
        </nav>
        <a className="header-cta" href="mailto:hello@contentdesk.ai">
          Start coverage
        </a>
      </header>

      <section className="hero-section" id="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI search coverage for lean teams</p>
          <h1>Stay covered wherever buyers ask.</h1>
          <p className="hero-lede">
            ContentDesk monitors the prompts, pages, and source types shaping
            AI search, then drafts the content and updates your team needs to
            keep showing up.
          </p>
          <div className="hero-actions" aria-label="Primary actions">
            <a className="primary-button" href="mailto:hello@contentdesk.ai">
              Start coverage
            </a>
            <a className="secondary-button" href="#coverage">
              See how it works
            </a>
          </div>
        </div>

        <div className="hero-console" aria-label="AEO operator preview">
          <div className="console-topbar">
            <span />
            <span />
            <span />
          </div>
          <div className="console-body">
            <div>
              <p className="console-kicker">Buyer prompt</p>
              <p className="console-question">
                What are the best AI product photo tools for Shopify fashion
                brands?
              </p>
            </div>
            <div className="citation-map" aria-label="Citation source mix">
              <div style={{ width: "52%" }}>
                <span>Marketplace</span>
              </div>
              <div style={{ width: "28%" }}>
                <span>Reddit</span>
              </div>
              <div style={{ width: "20%" }}>
                <span>Blogs</span>
              </div>
            </div>
            <div className="diagnosis-grid">
              <div>
                <span>Answer engine</span>
                <strong>ChatGPT</strong>
              </div>
              <div>
                <span>Current winner</span>
                <strong>App listing</strong>
              </div>
              <div>
                <span>Operator task</span>
                <strong>Rewrite</strong>
              </div>
            </div>
            <div className="recommendation">
              <span>Next task queued</span>
              <p>
                Draft a stronger Shopify App Store listing, add review prompts,
                and prepare a comparison asset for approval in Slack.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="logo-strip" aria-label="Citation surfaces">
        <span>ChatGPT</span>
        <span>Perplexity</span>
        <span>Google AI</span>
        <span>Reddit</span>
        <span>Marketplaces</span>
        <span>Review sites</span>
      </section>

      <section className="section intro-section" id="coverage">
        <div className="section-heading">
          <p className="eyebrow">Not another dashboard</p>
          <h2>Coverage means the next action is already moving.</h2>
        </div>
        <div className="about-copy">
          <p>
            Buyers are asking ChatGPT, Perplexity, Gemini, Reddit, review
            sites, and marketplaces before they visit your site. ContentDesk
            watches those surfaces and turns what it finds into work your team
            can approve.
          </p>
          <p>
            No weekly staring at charts. You get the next article, listing
            update, comparison page, FAQ, schema fix, or community answer
            prepared for Slack, Codex, or your publishing workflow.
          </p>
        </div>
      </section>

      <section className="section surfaces-section" id="surfaces">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Answer engine optimization</p>
          <h2>Know which sources are carrying the answer.</h2>
        </div>
        <div className="surface-table" role="table" aria-label="Citation surface analysis">
          <div className="surface-row surface-head" role="row">
            <span>Surface</span>
            <span>Trust signal</span>
            <span>Examples</span>
            <span>Status</span>
          </div>
          {surfaces.map((surface) => (
            <div className="surface-row" role="row" key={surface.name}>
              <span>{surface.name}</span>
              <span>{surface.signal}</span>
              <span>{surface.examples}</span>
              <strong>{surface.score}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="workflow-section" id="workflow" aria-label="ContentDesk workflow">
        <div className="workflow-copy">
          <p className="eyebrow">The coverage loop</p>
          <h2>Find the gap, draft the fix, recheck the surface.</h2>
        </div>
        <ol className="workflow-list">
          {steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="section asset-section">
        <div className="section-heading">
          <p className="eyebrow">What gets created</p>
          <h2>Not every coverage gap needs a blog post.</h2>
        </div>
        <div className="asset-cloud" aria-label="Asset types">
          {assetTypes.map((asset) => (
            <span key={asset}>{asset}</span>
          ))}
        </div>
      </section>

      <section className="section proof-section" id="proof">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Generative engine optimization</p>
          <h2>The right play depends on where buyers are asking.</h2>
        </div>
        <div className="proof-grid">
          {proofRows.map(([market, cited, move]) => (
            <article className="proof-card" key={market}>
              <span>{market}</span>
              <h3>{cited}</h3>
              <p>{move}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">ContentDesk</p>
        <h2>Stay covered without turning into an AEO expert.</h2>
        <a className="primary-button" href="mailto:hello@contentdesk.ai">
          Start coverage
        </a>
      </section>
    </main>
  );
}
