import Link from "next/link";
import { citations, hygiene } from "../visibility-data";

export default function CitationsPage() {
  const topGap = citations[0];
  const missingCount = citations.filter((citation) => citation.presence === "missing").length;
  const weakCount = citations.filter((citation) => citation.presence === "weak").length;
  const competitorCount = citations.filter((citation) => citation.presence === "competitor").length;

  return (
    <main className="ai-dashboard citations-page">
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
            <Link className="is-active" href="/citations">
              Citations
            </Link>
            <Link href="/recommendations">Recommendations</Link>
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
            <h1>Citations</h1>
            <p>Trusted sources shaping AI answers for Tiny Lemon.</p>
          </div>
          <div className="ai-controls">
            <Link className="ai-btn ai-btn-secondary" href="/prompt-lab">
              Test prompts
            </Link>
            <Link className="ai-btn ai-btn-primary" href="/recommendations">
              View actions
            </Link>
          </div>
        </div>

        <section className="ai-citation-metrics" aria-label="Citation summary">
          <article className="ai-card">
            <span>Tracked sources</span>
            <strong>{citations.length}</strong>
          </article>
          <article className="ai-card">
            <span>Missing</span>
            <strong>{missingCount}</strong>
          </article>
          <article className="ai-card">
            <span>Weak presence</span>
            <strong>{weakCount}</strong>
          </article>
          <article className="ai-card">
            <span>Competitor-owned</span>
            <strong>{competitorCount}</strong>
          </article>
        </section>

        <section className="ai-section">
          <div className="ai-section-head">
            <div>
              <h2>Fix first</h2>
              <p>{topGap.domain} has highest source weight and weak Tiny Lemon coverage.</p>
            </div>
          </div>
          <div className="ai-card ai-source-priority citations-priority">
            <span>{topGap.type}</span>
            <strong>{topGap.domain}</strong>
            <p>{topGap.nextMove}</p>
          </div>
        </section>

        <section className="ai-section">
          <div className="ai-section-head">
            <div>
              <h2>Source gaps</h2>
              <p>Where AI engines look, what they find, and the next source move.</p>
            </div>
          </div>
          <div className="ai-source-list citations-source-list">
            {citations.map((citation) => (
              <article className="ai-card ai-source-row" key={citation.domain}>
                <div>
                  <strong className="ai-domain">{citation.domain}</strong>
                  <small>
                    {citation.type} - {citation.cites.toLocaleString()} citations
                  </small>
                </div>
                <span className={`ai-present ${citation.presence}`}>
                  <i />
                  {citation.state}
                </span>
                <p>{citation.nextMove}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ai-section">
          <div className="ai-section-head">
            <div>
              <h2>Source hygiene</h2>
              <p>Canonical sources that should stay clean before chasing more mentions.</p>
            </div>
          </div>
          <div className="ai-card ai-hygiene">
            {hygiene.map((item) => (
              <div className="ai-hygiene-row" key={item.name}>
                <span className={`ai-hygiene-icon ${item.status}`}>
                  {item.status === "ok" ? "✓" : item.status === "redir" ? "↗" : "!"}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.url}</small>
                </div>
                <span className={`ai-status ${item.status}`}>
                  <i />
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
