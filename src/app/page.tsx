"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { citations } from "./visibility-data";

type CompetitorRow = {
  name: string;
  sov: number;
  mentions: number;
  status: "Leading" | "Tracked" | "You";
  you?: boolean;
};

type DashboardMetrics = {
  runDate: string;
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
  competitorShareOfVoice: Array<{
    name: string;
    mentions: number;
    sharePct: number;
    you?: boolean;
  }>;
};

type DashboardMetricsResponse = {
  metrics: DashboardMetrics | null;
};

const initialCompetitors: CompetitorRow[] = [
  { name: "Botika", sov: 85, mentions: 5220, status: "Leading" },
  { name: "PixUp AI", sov: 8, mentions: 491, status: "Tracked" },
  { name: "Snaproom", sov: 5, mentions: 307, status: "Tracked" },
  { name: "Tiny Lemon", sov: 2, mentions: 122, status: "You", you: true },
];

const discoveredCompetitors = [
  { name: "Botika", host: "botika.io" },
  { name: "Claid.ai", host: "claid.ai" },
  { name: "Lensia", host: "lensia.ai" },
];

const logoColors: Record<string, string> = {
  Botika: "#2E3A59",
  "PixUp AI": "#6E7378",
  Snaproom: "#8A7048",
  "Tiny Lemon": "#C9A227",
  "Claid.ai": "#475569",
  Lensia: "#5E6B5A",
};

export default function Home() {
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityPct = metrics?.visibilityPct ?? 0.6;
  const sentimentScore = metrics?.sentimentScore ?? 36.25;
  const completedAnswerCount = metrics?.completedAnswerCount ?? 6140;
  const brandMentionedCount = metrics?.brandMentionedCount ?? 37;
  const sentimentAnswerCount = metrics?.sentimentAnswerCount ?? 37;
  const sentimentBadge =
    metrics?.sentimentAnswerCount === 0
      ? "No mentions yet"
      : metrics?.lowSampleSize ?? true
        ? "Low sample size"
        : undefined;

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      try {
        const response = await fetch("/api/dashboard/metrics");
        if (!response.ok) return;

        const payload = (await response.json()) as DashboardMetricsResponse;
        if (cancelled || !payload.metrics) return;

        setMetrics(payload.metrics);
        if (payload.metrics.competitorShareOfVoice.length) {
          setCompetitors(toCompetitorRows(payload.metrics.competitorShareOfVoice));
        }
      } catch {
        // Keep static dashboard values when local database is unavailable.
      }
    }

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }

  function trackCompetitor(competitor: CompetitorRow) {
    setCompetitors((rows) => {
      if (rows.some((row) => row.name.toLowerCase() === competitor.name.toLowerCase())) {
        return rows;
      }

      const youIndex = rows.findIndex((row) => row.you);
      const nextRows = [...rows];
      nextRows.splice(youIndex === -1 ? rows.length : youIndex, 0, competitor);
      return nextRows;
    });
    showToast(`Now tracking ${competitor.name}`);
  }

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
            <Link className="is-active" href="/">
              Dashboard
            </Link>
            <Link href="/prompt-lab">Prompts</Link>
            <Link href="/citations">Citations</Link>
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
            <h1>AI Visibility Dashboard</h1>
            <p>How Tiny Lemon shows up across tracked AI answers.</p>
          </div>
          <div className="ai-controls">
            <Dropdown value="Last 30 days" options={["Last 7 days", "Last 30 days", "Last 90 days", "Year to date"]} />
            <Dropdown value="All engines" options={["All engines", "ChatGPT", "Perplexity", "Gemini", "Claude"]} />
            <button className="ai-icon-btn" title="Settings" type="button">
              <GearIcon />
            </button>
          </div>
        </div>

        <section className="ai-section">
          <div className="ai-section-head">
            <h2>Brand metrics</h2>
          </div>
          <div className="ai-metrics">
            <GaugeCard
              footer={`${brandMentionedCount.toLocaleString()} of ${completedAnswerCount.toLocaleString()} answers`}
              help="How often Tiny Lemon is mentioned in tracked AI answers."
              label="Brand visibility"
              tooltip={{
                title: "Visibility score",
                formula: "Tiny Lemon mentions / completed AI answers.",
                detail: `Based on ${completedAnswerCount.toLocaleString()} completed answers in the latest synthesized run.`,
              }}
              value={visibilityPct / 100}
              valueLabel={formatMetric(visibilityPct)}
            />
            <GaugeCard
              badge={sentimentBadge}
              footer={
                sentimentAnswerCount > 0
                  ? `${sentimentAnswerCount.toLocaleString()} Tiny Lemon mentions scored`
                  : "Sentiment starts once Tiny Lemon appears."
              }
              help="How positively or negatively AI describes Tiny Lemon when mentioned."
              label="Sentiment score"
              tooltip={{
                title: "Sentiment score",
                formula: "Average recommendation strength when Tiny Lemon is mentioned.",
                detail:
                  `Current sample: ${sentimentAnswerCount.toLocaleString()} Tiny Lemon mentions out of ${completedAnswerCount.toLocaleString()} completed answers. Neutral = 50, recommended = 85, top pick = 100.`,
              }}
              value={sentimentScore / 100}
              valueLabel={formatMetric(sentimentScore)}
            />
          </div>
          <p className="ai-metrics-note">
            <InfoCircleIcon />
            <span>
              Visibility tells you <strong>if</strong> AI mentions the brand. Sentiment tells you{" "}
              <strong>how</strong> AI talks about the brand when it appears.
              {metrics ? ` Latest synthesized run: ${metrics.runDate}.` : ""}
            </span>
          </p>
        </section>

        <section className="ai-section">
          <div className="ai-section-head">
            <div>
              <h2>Competitor landscape</h2>
              <p>Share of voice across tracked AI answers.</p>
            </div>
            <button className="ai-btn" onClick={() => setModalOpen(true)} type="button">
              <PlusIcon /> Add competitor
            </button>
          </div>
          <CompetitorTable rows={competitors} />
        </section>

        <section className="ai-section" id="citation-analysis">
          <div className="ai-section-head">
            <div>
              <h2>Source gaps</h2>
              <p>Quick read. Full source diagnosis lives in Citations.</p>
            </div>
          </div>
          <CitationSnapshot />
        </section>
      </div>

      {modalOpen ? (
        <AddCompetitorModal
          existing={competitors.map((competitor) => competitor.name)}
          onClose={() => setModalOpen(false)}
          onTrack={trackCompetitor}
        />
      ) : null}
      <div className={`ai-toast ${toast ? "is-visible" : ""}`} role="status">
        <CheckIcon />
        {toast}
      </div>
    </main>
  );
}

function GaugeCard({
  badge,
  footer,
  help,
  label,
  tooltip,
  value,
  valueLabel,
}: {
  badge?: string;
  footer: string;
  help: string;
  label: string;
  tooltip: {
    title: string;
    formula: string;
    detail: string;
  };
  value: number;
  valueLabel: string;
}) {
  return (
    <article className="ai-card ai-gauge-card">
      <div className="ai-gauge-top">
        <span className="ai-gauge-label">
          {label}
          <InfoTooltip {...tooltip} />
        </span>
        {badge ? <span className="ai-badge">{badge}</span> : null}
      </div>
      <div className="ai-gauge-wrap">
        <Gauge value={value} />
      </div>
      <div className="ai-gauge-value">
        {valueLabel}
        <small>%</small>
      </div>
      <p className="ai-gauge-help">{help}</p>
      <p className="ai-gauge-foot">{footer}</p>
    </article>
  );
}

function Gauge({ value }: { value: number }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setAnimated(1), 80);
    return () => clearTimeout(id);
  }, []);

  const v = Math.max(0, Math.min(1, value)) * animated;
  const cx = 140;
  const cy = 138;
  const radius = 108;
  const angle = Math.PI * (1 - v);
  const needleX = cx + (radius - 16) * Math.cos(angle);
  const needleY = cy - (radius - 16) * Math.sin(angle);
  const arcLength = Math.PI * radius;

  return (
    <svg aria-hidden="true" height="172" viewBox="0 0 280 172" width="280">
      {Array.from({ length: 11 }).map((_, index) => {
        const tickAngle = Math.PI * (1 - index / 10);
        const inner = radius + 4;
        const outer = radius + (index % 5 === 0 ? 12 : 8);
        return (
          <line
            key={index}
            stroke={index % 5 === 0 ? "#c9c5bc" : "#e0dcd4"}
            strokeLinecap="round"
            strokeWidth={index % 5 === 0 ? 1.6 : 1}
            x1={cx + inner * Math.cos(tickAngle)}
            x2={cx + outer * Math.cos(tickAngle)}
            y1={cy - inner * Math.sin(tickAngle)}
            y2={cy - outer * Math.sin(tickAngle)}
          />
        );
      })}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#ece9e2"
        strokeLinecap="round"
        strokeWidth="10"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="var(--ai-accent)"
        strokeDasharray={arcLength}
        strokeDashoffset={arcLength * (1 - v)}
        strokeLinecap="round"
        strokeWidth="10"
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }}
      />
      <line
        stroke="var(--ai-accent)"
        strokeLinecap="round"
        strokeWidth="2.4"
        x1={cx}
        x2={needleX}
        y1={cy}
        y2={needleY}
      />
      <circle cx={cx} cy={cy} fill="#fff" r="6.5" stroke="var(--ai-accent)" strokeWidth="2.2" />
    </svg>
  );
}

function Dropdown({ value, options }: { value: string; options: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div className="ai-dropdown" ref={ref}>
      <button className="ai-dropdown-button" onClick={() => setOpen((next) => !next)} type="button">
        <span>{selected}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <div className="ai-dropdown-menu">
          {options.map((option) => (
            <button
              className={option === selected ? "is-selected" : ""}
              key={option}
              onClick={() => {
                setSelected(option);
                setOpen(false);
              }}
              type="button"
            >
              {option}
              {option === selected ? <CheckIcon /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InfoTooltip({
  detail,
  formula,
  title,
}: {
  detail: string;
  formula: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`ai-info ${open ? "is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-expanded={open}
        aria-label={`How ${title.toLowerCase()} is calculated`}
        onClick={() => setOpen((next) => !next)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        type="button"
      >
        <InfoCircleIcon />
      </button>
      <span className="ai-info-popover" role="tooltip">
        <strong>{title}</strong>
        <em>{formula}</em>
        <small>{detail}</small>
      </span>
    </span>
  );
}

function CompetitorTable({ rows }: { rows: CompetitorRow[] }) {
  return (
    <div className="ai-card ai-table-card">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Share of voice</th>
            <th>Mention count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={row.you ? "is-you" : ""} key={row.name}>
              <td>
                <div className="ai-company">
                  <span style={{ background: logoColors[row.name] ?? "#7a7f84" }}>
                    {initials(row.name)}
                  </span>
                  <strong>{row.name}</strong>
                </div>
              </td>
              <td>
                <div className="ai-sov">
                  <span>
                    <i
                      style={{
                        width: `${row.sov}%`,
                        background: row.you ? "#c9a227" : undefined,
                      }}
                    />
                  </span>
                  <strong>{row.sov}%</strong>
                </div>
              </td>
              <td>{row.mentions.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CitationSnapshot() {
  const topGap = citations[0];
  const missingCount = citations.filter((citation) => citation.presence === "missing").length;
  const weakCount = citations.filter((citation) => citation.presence === "weak").length;

  return (
    <article className="ai-card ai-source-summary">
      <div>
        <span>Fix first</span>
        <strong>{topGap.domain}</strong>
        <p>{topGap.nextMove}</p>
      </div>
      <div className="ai-source-summary-stats" aria-label="Citation summary">
        <span>
          <strong>{missingCount}</strong>
          Missing
        </span>
        <span>
          <strong>{weakCount}</strong>
          Weak
        </span>
      </div>
      <Link className="ai-btn ai-btn-primary" href="/citations">
        Open Citations
      </Link>
    </article>
  );
}

function AddCompetitorModal({
  existing,
  onClose,
  onTrack,
}: {
  existing: string[];
  onClose: () => void;
  onTrack: (competitor: CompetitorRow) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [discovered, setDiscovered] = useState(
    discoveredCompetitors.map((competitor) => ({
      ...competitor,
      state: existing.includes(competitor.name) ? "added" : "open",
    })),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submit() {
    if (!name.trim()) {
      inputRef.current?.focus();
      return;
    }
    onTrack({ name: name.trim(), sov: 1, mentions: 0, status: "Tracked" });
    onClose();
  }

  function trackDiscovered(competitor: (typeof discoveredCompetitors)[number]) {
    setDiscovered((items) =>
      items.map((item) =>
        item.name === competitor.name ? { ...item, state: "added" } : item,
      ),
    );
    onTrack({
      name: competitor.name,
      sov: 1,
      mentions: Math.floor(20 + Math.random() * 60),
      status: "Tracked",
    });
  }

  return (
    <div
      className="ai-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ai-modal" role="dialog" aria-modal="true" aria-labelledby="add-competitor-title">
        <header>
          <div>
            <h3 id="add-competitor-title">Add a competitor</h3>
            <p>Track another brand&apos;s share of voice across your AI answers.</p>
          </div>
          <button className="ai-close" onClick={onClose} type="button">
            <CloseIcon />
          </button>
        </header>
        <div className="ai-modal-body">
          <label className="ai-field">
            <span>Competitor name</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Botika"
              ref={inputRef}
              value={name}
            />
          </label>
          <label className="ai-field">
            <span>Website URL</span>
            <input
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://botika.io"
              value={url}
            />
          </label>
          <label className="ai-field">
            <span>
              Notes <em>- optional</em>
            </span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Why are you tracking them?"
              value={notes}
            />
          </label>

          <div className="ai-discovered">
            <h4>
              <SearchIcon />
              Discovered competitors
            </h4>
            <p>Brands we noticed appearing alongside Tiny Lemon in AI answers.</p>
            {discovered.map((competitor) => (
              <div className="ai-discovered-row" key={competitor.name}>
                <span style={{ background: logoColors[competitor.name] ?? "#7a7f84" }}>
                  {initials(competitor.name)}
                </span>
                <strong>
                  {competitor.name}
                  <small> - {competitor.host}</small>
                </strong>
                {competitor.state === "added" ? (
                  <b>
                    <CheckIcon /> Tracking
                  </b>
                ) : (
                  <div>
                    <button
                      className="ai-btn ai-btn-small ai-btn-ghost"
                      onClick={() =>
                        setDiscovered((items) =>
                          items.filter((item) => item.name !== competitor.name),
                        )
                      }
                      type="button"
                    >
                      Ignore
                    </button>
                    <button
                      className="ai-btn ai-btn-small"
                      onClick={() => trackDiscovered(competitor)}
                      type="button"
                    >
                      Track
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <footer>
          <button className="ai-btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="ai-btn ai-btn-primary" onClick={submit} type="button">
            Track competitor
          </button>
        </footer>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .replace(/[^a-zA-Z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 1)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function toCompetitorRows(
  rows: DashboardMetrics["competitorShareOfVoice"],
): CompetitorRow[] {
  return rows.map((row, index) => ({
    name: row.name,
    sov: Math.round(row.sharePct),
    mentions: row.mentions,
    status: row.you ? "You" : index === 0 ? "Leading" : "Tracked",
    you: row.you,
  }));
}

function formatMetric(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) < 10 && value % 1 !== 0) return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  if (value % 1 !== 0) return value.toFixed(1).replace(/0$/, "").replace(/\.$/, "");
  return String(value);
}

function ChevronIcon() {
  return (
    <svg fill="none" height="13" viewBox="0 0 24 24" width="13">
      <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg fill="none" height="17" viewBox="0 0 24 24" width="17">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" x1="12" x2="12" y1="5" y2="19" />
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg fill="none" height="17" viewBox="0 0 24 24" width="17">
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" x1="18" x2="6" y1="6" y2="18" />
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg fill="none" height="13" viewBox="0 0 24 24" width="13">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

function InfoCircleIcon() {
  return (
    <svg fill="none" height="15" viewBox="0 0 24 24" width="15">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" x1="12" x2="12" y1="11" y2="16" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" x1="12" x2="12" y1="8" y2="8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  );
}
