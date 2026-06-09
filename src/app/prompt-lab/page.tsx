"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { summarizePromptAnswer } from "@/lib/prompt-answer-summary";
import {
  citationUrl,
  domainFromCitation,
  parseRawAnswerCitationMarkers,
  sourceRefsForDisplay,
  type PromptLabSourceCitation,
  type PromptLabSourceRef,
} from "@/lib/prompt-lab-citations";

type EngineName = "ChatGPT" | "Perplexity" | "Gemini";
type Stage = "Awareness" | "Consideration" | "Evaluation" | "Decision";
type EngineStatus = "mentioned" | "missing" | "running" | "not_wired" | "not-run" | "error";
type AgentResponseState =
  | "no_gap"
  | "deciding"
  | "drafting"
  | "ready"
  | "approved"
  | "recheck_scheduled";

type EngineResult = {
  status: EngineStatus;
  rank?: string;
  answer: string;
  rawAnswer?: string;
  citations: string[];
  sourceCitations: PromptLabSourceCitation[];
};

type TestQuestion = {
  id: string;
  question: string;
  topic: string;
  stage: Stage;
  lastRun: string;
  winner: string;
  engines: Record<EngineName, EngineResult>;
};

type AgentResponse = {
  state: AgentResponseState;
  label: string;
  title: string;
  summary: string;
  artifactLabel: string;
  artifactTitle: string;
  artifactSummary: string;
  includes: string[];
  evidence: Array<{
    label: string;
    value: string;
  }>;
  primaryCta: string;
  secondaryCta: string;
};

type PromptRunResponse = {
  questions: Array<{
    id: string;
    lastRun: string;
    engines: Partial<Record<EngineName, EngineResult>>;
  }>;
};

type PromptQuestionsResponse = {
  questions: Array<{
    id: string;
    question: string;
    topic: string;
    stage: Stage;
    lastRun: string;
    winner: string;
    engines: Partial<Record<EngineName, EngineResult>>;
  }>;
};

const engineNames: EngineName[] = ["ChatGPT", "Perplexity", "Gemini"];
const wiredEngineNames: EngineName[] = ["ChatGPT", "Perplexity", "Gemini"];

const selectedTinyLemonQuestions = [
  {
    id: "competitor-comparison-is-lalaland-ai-a-good-option-for-indie-fashion-brands-on-shopify",
    question: "Is Lalaland.ai a good option for indie fashion brands on Shopify?",
    topic: "Competitor comparison",
    stage: "Evaluation",
  },
  {
    id: "competitor-comparison-what-are-the-best-alternatives-to-botika-for-flat-lay-to-studio-conversion",
    question: "What are the best alternatives to Botika for flat-lay to studio conversion?",
    topic: "Competitor comparison",
    stage: "Evaluation",
  },
  {
    id: "category-search-what-is-the-best-ai-product-photography-app-for-indie-fashion-brands-on-shopify",
    question: "What is the best AI product photography app for indie fashion brands on Shopify?",
    topic: "Category search",
    stage: "Consideration",
  },
  {
    id: "category-search-which-ai-product-photography-apps-help-indie-fashion-brands-on-shopify-with-flat-lay-to-studio-conversion",
    question:
      "Which AI product photography apps help indie fashion brands on Shopify with flat-lay to studio conversion?",
    topic: "Category search",
    stage: "Consideration",
  },
  {
    id: "high-intent-purchase-what-is-the-easiest-shopify-app-for-generating-ai-model-photos-and-short-product-videos",
    question: "What is the easiest Shopify app for generating AI model photos and short product videos?",
    topic: "High-intent purchase",
    stage: "Decision",
  },
  {
    id: "category-search-which-ai-product-photography-apps-are-actually-good-for-apparel-brands-on-shopify",
    question: "Which AI product photography apps are actually good for apparel brands on Shopify?",
    topic: "Category search",
    stage: "Consideration",
  },
  {
    id: "problem-aware-how-can-an-indie-fashion-brand-on-shopify-get-better-apparel-product-photos-without-a-shoot-budget",
    question: "How can an indie fashion brand on Shopify get better apparel product photos without a shoot budget?",
    topic: "Problem aware",
    stage: "Awareness",
  },
  {
    id: "problem-aware-how-can-indie-fashion-brands-on-shopify-get-professional-product-photos-without-a-shoot-budget",
    question: "How can indie fashion brands on Shopify get professional product photos without a shoot budget?",
    topic: "Problem aware",
    stage: "Awareness",
  },
  {
    id: "integration-use-case-how-should-indie-fashion-brands-on-shopify-use-flat-lay-to-studio-conversion-on-shopify-product-pages",
    question:
      "How should indie fashion brands on Shopify use flat-lay to studio conversion on Shopify product pages?",
    topic: "Integration use case",
    stage: "Consideration",
  },
  {
    id: "solution-aware-how-do-ai-product-photography-apps-handle-flat-lay-to-studio-conversion",
    question: "How do AI product photography apps handle flat-lay to studio conversion?",
    topic: "Solution aware",
    stage: "Consideration",
  },
] as const satisfies Array<{
  id: string;
  question: string;
  topic: string;
  stage: Stage;
}>;

const initialQuestions: TestQuestion[] = selectedTinyLemonQuestions.map(createStarterQuestion);

export default function PromptLabPage() {
  const [questions, setQuestions] = useState(initialQuestions);
  const [activeId, setActiveId] = useState(initialQuestions[0].id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([initialQuestions[0].id]));
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeQuestion = questions.find((question) => question.id === activeId) ?? questions[0];

  const runningCount = questions.filter((question) =>
    wiredEngineNames.some((engine) => question.engines[engine].status === "running"),
  ).length;

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }

  const loadSavedQuestions = useCallback(async (cancelled?: () => boolean) => {
    try {
      const response = await fetch("/api/prompt-lab/questions");
      if (!response.ok) return false;

      const payload = (await response.json()) as PromptQuestionsResponse;
      if (cancelled?.() || !payload.questions.length) return false;

      const savedQuestions = payload.questions.map(normalizeSavedQuestion);
      setQuestions(savedQuestions);
      setActiveId(savedQuestions[0].id);
      setSelectedIds(new Set([savedQuestions[0].id]));
      return true;
    } catch {
      // Keep static starter state if local database is unavailable.
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadSavedQuestions(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadSavedQuestions]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runQuestions(ids: string[]) {
    const runnableIds = ids.length ? ids : [activeId];
    const questionsToRun = questions.filter((question) => runnableIds.includes(question.id));

    setQuestions((current) =>
      current.map((question) =>
        runnableIds.includes(question.id)
          ? {
              ...question,
              lastRun: "Testing",
              engines: markWiredEnginesRunning(question.engines),
            }
          : question,
      ),
    );
    showToast(`Testing ${runnableIds.length} ${runnableIds.length === 1 ? "question" : "questions"}`);

    try {
      const response = await fetch("/api/prompt-lab/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questions: questionsToRun.map((question) => ({
            id: question.id,
            question: question.question,
          })),
          engines: engineNames,
        }),
      });

      if (!response.ok) {
        throw new Error(`Prompt run failed with ${response.status}`);
      }

      const payload = (await response.json()) as PromptRunResponse;
      const resultsById = new Map(payload.questions.map((question) => [question.id, question]));

      setQuestions((current) =>
        current.map((question) => {
          const result = resultsById.get(question.id);
          if (!result) return question;

          const engines = {
            ...question.engines,
            ...result.engines,
          };
          const mentioned = wiredEngineNames.some((engine) => engines[engine].status === "mentioned");
          return {
            ...question,
            lastRun: result.lastRun,
            winner: mentioned ? "Tiny Lemon in set" : question.winner,
            engines,
          };
        }),
      );
      showToast("Results updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setQuestions((current) =>
        current.map((question) =>
          runnableIds.includes(question.id)
            ? {
                ...question,
                lastRun: "Failed",
                engines: errorEngines(question.engines, message),
              }
            : question,
        ),
      );
      showToast("Prompt run failed");
    }
  }

function errorEngines(
  engines: Record<EngineName, EngineResult>,
  message: string,
): Record<EngineName, EngineResult> {
  return {
    ChatGPT: errorEngine(engines.ChatGPT, message),
    Perplexity: errorEngine(engines.Perplexity, message),
    Gemini: errorEngine(engines.Gemini, message),
  };
}

function errorEngine(engine: EngineResult, message: string): EngineResult {
  return {
    ...engine,
    status: "error",
    answer: message,
    rawAnswer: message,
    citations: [],
    sourceCitations: [],
  };
}

  function addQuestions(input: { questions: string[] }, runNow: boolean) {
    const nextQuestions = input.questions.map<TestQuestion>((question, index) => ({
      id: `q${Date.now()}-${index}`,
      question,
      topic: inferTopic(question),
      stage: inferStage(question),
      lastRun: "Not run",
      winner: "Unknown",
      engines: {
        ChatGPT: notRunEngine("ChatGPT"),
        Perplexity: notRunEngine("Perplexity"),
        Gemini: notRunEngine("Gemini"),
      },
    }));
    const nextIds = nextQuestions.map((question) => question.id);

    setQuestions((current) => [...nextQuestions, ...current]);
    setActiveId(nextIds[0]);
    setSelectedIds(new Set(nextIds));
    setModalOpen(false);
    showToast(
      `${nextQuestions.length} ${nextQuestions.length === 1 ? "question" : "questions"} added`,
    );
    void saveQuestions(nextQuestions);
    if (runNow) setTimeout(() => runQuestions(nextIds), 80);
  }

  return (
    <main className="ai-dashboard ai-prompt-lab">
      <header className="ai-topbar">
        <div className="ai-topbar-inner">
          <Link className="ai-brand" href="/" aria-label="ContentDesk dashboard">
            <span className="ai-brand-mark">C</span>
            <span>ContentDesk</span>
            <span className="ai-brand-sub">/ Tiny Lemon</span>
          </Link>
          <nav className="ai-nav" aria-label="Product navigation">
            <Link href="/">Dashboard</Link>
            <Link className="is-active" href="/prompt-lab">
              Prompts
            </Link>
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
            <h1>Prompt investigation</h1>
            <p>Pick one buyer question, see why Tiny Lemon wins or loses, then decide what to fix.</p>
          </div>
          <div className="ai-controls">
            <Dropdown value="Last 30 days" options={["Last 7 days", "Last 30 days", "Last 90 days"]} />
            <Dropdown value="All engines" options={["All engines", "ChatGPT", "Perplexity", "Gemini"]} />
            <button className="ai-btn ai-btn-primary" onClick={() => setModalOpen(true)} type="button">
              <PlusIcon /> Add questions
            </button>
          </div>
        </div>

        <section className="ai-prompt-workbench" aria-label="Prompt investigation workspace">
          <div className="ai-card ai-prompt-list-panel">
            <div className="ai-prompt-list-head">
              <div>
                <h2>Buyer questions</h2>
                <p>{selectedIds.size} selected</p>
              </div>
              <div className="ai-test-actions">
                <button
                  className="ai-btn ai-btn-primary ai-btn-small"
                  disabled={runningCount > 0}
                  onClick={() => runQuestions(Array.from(selectedIds))}
                  type="button"
                >
                  <PlayIcon /> Test selected
                </button>
              </div>
            </div>

            <div className="ai-prompt-list">
              {questions.map((question) => {
                const coverage = getCoverage(question);
                const hasRun = getHasRun(question);
                const response = getAgentResponse(question);
                return (
                  <div
                    className={`ai-prompt-row ${question.id === activeId ? "is-active" : ""}`}
                    key={question.id}
                  >
                    <label className="ai-test-check" aria-label={`Select ${question.question}`}>
                      <input
                        checked={selectedIds.has(question.id)}
                        onChange={() => toggleSelected(question.id)}
                        type="checkbox"
                      />
                      <span />
                    </label>
                    <button
                      className="ai-question-button"
                      onClick={() => setActiveId(question.id)}
                      type="button"
                    >
                      <strong>{question.question}</strong>
                      <small>{question.stage}</small>
                    </button>
                    <span
                      className={`ai-prompt-result ${coverage > 0 ? "has-mention" : hasRun ? "is-gap" : ""}`}
                    >
                      {coverage > 0
                        ? `${coverage}/${wiredEngineNames.length}`
                        : hasRun
                          ? "Gap"
                          : "Not tested"}
                    </span>
                    <span className={`ai-agent-state ${response.state}`}>{response.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <AnswerPanel question={activeQuestion} onRun={() => runQuestions([activeQuestion.id])} />
        </section>
      </div>

      {modalOpen ? (
        <AddQuestionModal onAdd={addQuestions} onClose={() => setModalOpen(false)} />
      ) : null}

      <div className={`ai-toast ${toast ? "is-visible" : ""}`} role="status">
        <CheckIcon />
        {toast}
      </div>
    </main>
  );
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

function inferStage(question: string): Stage {
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

  if (/\b(tools?|apps?|software|solutions?|options?) for\b/.test(normalized)) {
    return "Consideration";
  }

  return "Consideration";
}

function getCoverage(question: TestQuestion) {
  return wiredEngineNames.filter((engine) => question.engines[engine].status === "mentioned").length;
}

function getHasRun(question: TestQuestion) {
  return wiredEngineNames.some((engine) =>
    ["mentioned", "missing", "error"].includes(question.engines[engine].status),
  );
}

function getAgentResponse(question: TestQuestion): AgentResponse {
  const coverage = getCoverage(question);
  const hasRunningEngine = wiredEngineNames.some((engine) => question.engines[engine].status === "running");
  const hasRun = getHasRun(question);
  const normalized = question.question.toLowerCase();

  if (hasRunningEngine) {
    return {
      state: "drafting",
      label: "Drafting",
      title: "ContentDesk is preparing response",
      summary: "Engines are still running. Once answers land, agent will decide best fix and prepare work.",
      artifactLabel: "Work in progress",
      artifactTitle: "Waiting on fresh prompt evidence",
      artifactSummary: "No artifact yet. Prompt answers and citations are still being collected.",
      includes: ["engine answers", "citation scan", "gap classification"],
      evidence: [
        { label: "Coverage", value: "Testing" },
        { label: "Artifact", value: "Pending" },
        { label: "Next", value: "Classify gap" },
      ],
      primaryCta: "Open progress",
      secondaryCta: "View raw answers",
    };
  }

  if (coverage === wiredEngineNames.length) {
    return {
      state: "no_gap",
      label: "Watching",
      title: "Tiny Lemon already appears here",
      summary: "No new work needed for this prompt. ContentDesk will keep monitoring rank, citations, and sentiment.",
      artifactLabel: "Monitoring active",
      artifactTitle: "Recheck scheduled for this buyer question",
      artifactSummary: "Agent is watching whether Tiny Lemon stays present across engines.",
      includes: ["daily recheck", "rank movement", "citation changes"],
      evidence: [
        { label: "Coverage", value: `${coverage}/${wiredEngineNames.length}` },
        { label: "Artifact", value: "None needed" },
        { label: "Next", value: "Monitor" },
      ],
      primaryCta: "View trend",
      secondaryCta: "Open recommendations",
    };
  }

  if (!hasRun) {
    return {
      state: "deciding",
      label: "Needs test",
      title: "Test prompt to get agent response",
      summary: "ContentDesk needs current engine answers before it can prepare the right fix.",
      artifactLabel: "No artifact yet",
      artifactTitle: "Run question first",
      artifactSummary: "After testing, this area will show what ContentDesk drafted or queued.",
      includes: ["gap type", "best fix", "prepared artifact"],
      evidence: [
        { label: "Coverage", value: "Not run" },
        { label: "Artifact", value: "None" },
        { label: "Next", value: "Test question" },
      ],
      primaryCta: "Test question",
      secondaryCta: "Open recommendations",
    };
  }

  if (normalized.includes("lalaland")) {
    return {
      state: "ready",
      label: "Ready",
      title: "Comparison page drafted",
      summary:
        "Lalaland.ai is being evaluated while Tiny Lemon is weak or absent. ContentDesk prepared a comparison asset for review.",
      artifactLabel: "Page draft ready",
      artifactTitle: "Tiny Lemon vs Lalaland.ai for Shopify apparel brands",
      artifactSummary: "Comparison page draft, buyer-fit table, and positioning notes are ready to review.",
      includes: ["competitor fit comparison", "Shopify apparel use-case copy", "AI citation target section"],
      evidence: [
        { label: "Gap", value: "Competitor comparison" },
        { label: "Artifact", value: "Comparison page" },
        { label: "Next", value: "Review draft" },
      ],
      primaryCta: "Review draft",
      secondaryCta: "View why",
    };
  }

  if (normalized.includes("reddit") || normalized.includes("discussion")) {
    return {
      state: "ready",
      label: "Ready",
      title: "Community reply drafted",
      summary: "ContentDesk found a discussion where Tiny Lemon can be mentioned naturally with disclosure.",
      artifactLabel: "Reply ready",
      artifactTitle: "Helpful founder reply with promo-risk notes",
      artifactSummary: "Draft reply, mention guidance, and CTA strength are ready to review.",
      includes: ["disclosed founder reply", "promo-risk notes", "soft CTA"],
      evidence: [
        { label: "Gap", value: "Community answer" },
        { label: "Artifact", value: "Reddit reply" },
        { label: "Next", value: "Review reply" },
      ],
      primaryCta: "Review reply",
      secondaryCta: "View thread",
    };
  }

  if (normalized.includes("app store") || normalized.includes("cheapest")) {
    return {
      state: "ready",
      label: "Ready",
      title: "Listing edits prepared",
      summary: "The gap points to Shopify marketplace language. ContentDesk drafted tighter App Store copy.",
      artifactLabel: "Listing edits ready",
      artifactTitle: "Shopify App Store copy updates for AI product-photo buyers",
      artifactSummary: "Lead copy, keyword phrasing, and proof bullets are ready to review.",
      includes: ["buyer-language rewrite", "feature proof bullets", "category wording"],
      evidence: [
        { label: "Gap", value: "Listing language" },
        { label: "Artifact", value: "App Store edits" },
        { label: "Next", value: "Review edits" },
      ],
      primaryCta: "Review edits",
      secondaryCta: "View why",
    };
  }

  return {
    state: coverage > 0 ? "drafting" : "ready",
    label: coverage > 0 ? "Drafting" : "Ready",
    title: coverage > 0 ? "ContentDesk is expanding winning context" : "Guide draft prepared",
    summary:
      coverage > 0
        ? "Tiny Lemon appears in some engines, but answer context is thin. ContentDesk is preparing support work."
        : "Tiny Lemon is missing for this buyer question. ContentDesk prepared a guide draft to close the gap.",
    artifactLabel: coverage > 0 ? "Draft in progress" : "Guide ready",
    artifactTitle: titleForGuideResponse(question),
    artifactSummary:
      coverage > 0
        ? "Agent is turning partial visibility into a stronger owned-content asset."
        : "Guide draft, source targets, and Tiny Lemon positioning block are ready to review.",
    includes: [
      "phone-shot workflow",
      "flat-lay to studio conversion section",
      "Tiny Lemon positioning block",
    ],
    evidence: [
      { label: "Coverage", value: `${coverage}/${wiredEngineNames.length}` },
      { label: "Artifact", value: "Website guide" },
      { label: "Next", value: coverage > 0 ? "Finish draft" : "Review draft" },
    ],
    primaryCta: coverage > 0 ? "Open draft" : "Review draft",
    secondaryCta: "Open in recommendations",
  };
}

function titleForGuideResponse(question: TestQuestion) {
  const normalized = question.question.toLowerCase();
  if (normalized.includes("without a shoot budget")) {
    return "How Shopify apparel brands can get studio-style photos without shoot budget";
  }
  if (normalized.includes("flat-lay")) {
    return "Flat-lay to studio conversion guide for Shopify apparel brands";
  }
  if (normalized.includes("model photos")) {
    return "AI model photos and short product videos for Shopify apparel stores";
  }
  return "AI product photography guide for indie Shopify apparel brands";
}

function markWiredEnginesRunning(
  engines: Record<EngineName, EngineResult>,
): Record<EngineName, EngineResult> {
  return {
    ChatGPT: { ...engines.ChatGPT, status: "running" },
    Perplexity: { ...engines.Perplexity, status: "running" },
    Gemini: { ...engines.Gemini, status: "running" },
  };
}

function notRunEngine(engine: EngineName): EngineResult {
  return {
    status: "not-run",
    answer: `Test this question to see how ${engine} answers it.`,
    citations: [],
    sourceCitations: [],
  };
}

function createStarterQuestion(question: {
  id: string;
  question: string;
  topic: string;
  stage: Stage;
}): TestQuestion {
  return {
    ...question,
    lastRun: "Not run",
    winner: "Unknown",
    engines: {
      ChatGPT: notRunEngine("ChatGPT"),
      Perplexity: notRunEngine("Perplexity"),
      Gemini: notRunEngine("Gemini"),
    },
  };
}

function normalizeSavedQuestion(
  question: PromptQuestionsResponse["questions"][number],
): TestQuestion {
  return {
    id: question.id,
    question: question.question,
    topic: question.topic,
    stage: question.stage,
    lastRun: question.lastRun,
    winner: question.winner,
    engines: {
      ChatGPT: question.engines.ChatGPT ?? notRunEngine("ChatGPT"),
      Perplexity: question.engines.Perplexity ?? notRunEngine("Perplexity"),
      Gemini: question.engines.Gemini ?? notRunEngine("Gemini"),
    },
  };
}

async function saveQuestions(questions: TestQuestion[]) {
  await fetch("/api/prompt-lab/questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      questions: questions.map((question) => ({
        id: question.id,
        question: question.question,
        topic: question.topic,
        stage: question.stage,
        lastRun: question.lastRun,
      })),
    }),
  }).catch(() => null);
}

function AnswerPanel({ onRun, question }: { onRun: () => void; question: TestQuestion }) {
  const [selectedEngine, setSelectedEngine] = useState<EngineName>("ChatGPT");
  const [copied, setCopied] = useState(false);
  const isRunning = engineNames.some((engine) => question.engines[engine].status === "running");
  const selectedResult = question.engines[selectedEngine];
  const rawAnswer = getRawAnswer(question, selectedEngine, selectedResult);
  const sourceRefs = sourceRefsForDisplay(selectedResult.sourceCitations);
  const agentResponse = getAgentResponse(question);

  async function copyRawAnswer() {
    await navigator.clipboard.writeText(rawAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="ai-card ai-answer-panel">
      <header>
        <div>
          <span className="ai-stage-tag">{question.stage}</span>
          <h2>{question.question}</h2>
        </div>
        <div className="ai-answer-actions">
          <span>{question.lastRun}</span>
          <button className="ai-btn ai-btn-primary" disabled={isRunning} onClick={onRun} type="button">
            {isRunning ? <SpinnerIcon /> : <PlayIcon />}
            {isRunning ? "Testing question" : "Test this question"}
          </button>
        </div>
      </header>

      <section className={`ai-agent-response ${agentResponse.state}`} aria-label="ContentDesk response">
        <div className="ai-agent-compact-copy">
          <div className="ai-agent-kicker">
            <span>ContentDesk response</span>
            <strong>{agentResponse.label}</strong>
          </div>
          <p>
            <strong>Problem:</strong> {agentProblemLine(question, agentResponse)}
          </p>
          <p>
            <strong>Prepared:</strong> {agentPreparedLine(agentResponse)}
          </p>
        </div>

        <Link className="ai-btn ai-btn-primary ai-agent-response-cta" href="/recommendations">
          View prepared draft
        </Link>
      </section>

      <div className="ai-answer-grid">
        {engineNames.map((engine) => {
          const result = question.engines[engine];
          const engineRunning = result.status === "running";

          return (
            <div className={`ai-answer-card ${engineRunning ? "is-running" : ""}`} key={engine}>
              <div className="ai-answer-top">
                <strong>{engine}</strong>
                <EnginePill result={result} />
              </div>
              {engineRunning ? (
                <div className="ai-engine-loading" role="status">
                  <SpinnerIcon />
                  <strong>Running {engine}</strong>
                  <span>Collecting fresh answer and citations.</span>
                </div>
              ) : (
                <>
                  {result.status === "error" ? (
                    <EngineErrorSummary result={result} />
                  ) : (
                    <EngineSummary result={result} />
                  )}
                  <CitationChips
                    result={result}
                    label={`${engine} citations`}
                    onMore={() => setSelectedEngine(engine)}
                  />
                  <div className="ai-answer-card-actions">
                    <button
                      className="ai-btn ai-btn-small ai-btn-secondary"
                      onClick={() => setSelectedEngine(engine)}
                      type="button"
                    >
                      <TextIcon /> View raw
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {isRunning ? (
        <section className="ai-run-progress" aria-label="Prompt test progress" aria-live="polite">
          <SpinnerIcon />
          <div>
            <strong>Testing engines</strong>
            <p>Raw answers and source chips will appear after the run finishes.</p>
          </div>
        </section>
      ) : (
        <section className="ai-raw-inspector" aria-label="Raw engine answer">
          <div className="ai-raw-tabs" role="tablist" aria-label="Raw answer engines">
            {engineNames.map((engine) => (
              <button
                aria-selected={selectedEngine === engine}
                className={selectedEngine === engine ? "is-active" : ""}
                key={engine}
                onClick={() => setSelectedEngine(engine)}
                role="tab"
                type="button"
              >
                {engine}
              </button>
            ))}
          </div>
          <div className="ai-raw-panel">
            <header>
              <div>
                <strong>{selectedEngine} raw answer</strong>
                <span>{question.lastRun}</span>
              </div>
              <button className="ai-btn ai-btn-small ai-btn-secondary" onClick={copyRawAnswer} type="button">
                <CopyIcon /> {copied ? "Copied" : "Copy raw"}
              </button>
            </header>
            <RawAnswerText rawAnswer={rawAnswer} sourceRefs={sourceRefs} />
            <RawSourceList sourceRefs={sourceRefs} />
          </div>
        </section>
      )}
    </article>
  );
}

function agentProblemLine(question: TestQuestion, response: AgentResponse) {
  const coverage = getCoverage(question);

  if (response.state === "no_gap") {
    return `Tiny Lemon appears in ${coverage}/${wiredEngineNames.length} engines. No new work needed.`;
  }

  if (response.state === "deciding") {
    return "This question has not been tested yet. Run it before ContentDesk prepares work.";
  }

  if (response.state === "drafting") {
    return "Fresh answers are still being analyzed. ContentDesk is choosing the right fix.";
  }

  return `Tiny Lemon is missing in ${wiredEngineNames.length - coverage}/${wiredEngineNames.length} engines for this buyer question.`;
}

function agentPreparedLine(response: AgentResponse) {
  if (response.state === "no_gap") return "Daily monitoring is active.";
  if (response.state === "deciding") return "No draft yet.";
  if (response.state === "drafting") return `${response.artifactLabel}.`;

  return `${response.artifactTitle} is ready to review in Recommendations.`;
}

function getRawAnswer(question: TestQuestion, engine: EngineName, result: EngineResult) {
  if (result.status === "running") return `Testing ${engine} now. Raw answer will appear when run finishes.`;
  if (result.status === "not_wired") return `${engine} is not wired for prompt checks.`;
  if (result.status === "not-run") return `No raw ${engine} answer yet. Test this question to collect it.`;
  return (
    result.rawAnswer ??
    `${result.answer}\n\nPrompt: ${question.question}\nCitations: ${result.citations.join(", ") || "none"}`
  );
}

function summaryAnswer(result: EngineResult) {
  if (result.status === "mentioned" || result.status === "missing") {
    return summarizePromptAnswer(result.rawAnswer || result.answer);
  }

  return result.answer;
}

function EngineSummary({ result }: { result: EngineResult }) {
  const summary = summaryAnswer(result);

  return (
    <div className="ai-answer-summary">
      <p>{summary}</p>
    </div>
  );
}

function EngineErrorSummary({ result }: { result: EngineResult }) {
  return (
    <div className="ai-engine-error">
      <strong>Engine could not run</strong>
      <span>{summarizeEngineError(result.rawAnswer || result.answer)}</span>
      <details>
        <summary>View details</summary>
        <pre>{result.rawAnswer || result.answer}</pre>
      </details>
    </div>
  );
}

const citationChipLimit = 3;

function CitationChips({
  label,
  result,
  onMore,
}: {
  label: string;
  result: EngineResult;
  onMore?: () => void;
}) {
  const citationChips = citationChipsForResult(result);
  const visibleChips = citationChips.slice(0, citationChipLimit);
  const hiddenCount = citationChips.length - visibleChips.length;

  return (
    <div className="ai-citations" aria-label={label}>
      {citationChips.length ? (
        <>
          {visibleChips.map((citation) => (
            <a
              href={citation.href}
              key={citation.key}
              rel="noreferrer"
              target="_blank"
              title={citation.title}
            >
              {citation.label}
              <ExternalLinkIcon />
            </a>
          ))}
          {hiddenCount > 0 ? (
            <button
              className="ai-citation-more"
              onClick={onMore}
              title="See all sources in the raw answer"
              type="button"
            >
              +{hiddenCount} more
            </button>
          ) : null}
        </>
      ) : (
        <span>{emptyCitationLabel(result.status)}</span>
      )}
    </div>
  );
}

function RawAnswerText({
  rawAnswer,
  sourceRefs,
}: {
  rawAnswer: string;
  sourceRefs: PromptLabSourceRef[];
}) {
  const tokens = parseRawAnswerCitationMarkers(rawAnswer, sourceRefs);

  return (
    <p>
      {tokens.map((token, index) => {
        if (token.type === "text") {
          return <Fragment key={`text-${index}`}>{highlightAnswer(token.value)}</Fragment>;
        }

        return (
          <a
            className="ai-citation-ref"
            href={token.source.url}
            key={`marker-${index}-${token.value}`}
            rel="noreferrer"
            target="_blank"
            title={`${token.value} provider source\nNot verified claim-level support\n${token.source.url}`}
          >
            {token.value}
          </a>
        );
      })}
    </p>
  );
}

function RawSourceList({ sourceRefs }: { sourceRefs: PromptLabSourceRef[] }) {
  if (!sourceRefs.length) return null;

  return (
    <div className="ai-raw-sources">
      <strong>Sources</strong>
      <ol>
        {sourceRefs.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              rel="noreferrer"
              target="_blank"
              title={`[${source.index}] provider source\nNot verified claim-level support\n${source.url}`}
            >
              [{source.index}] {source.label}
              <ExternalLinkIcon />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function uniqueCitationsForDisplay(citations: string[]) {
  return [...new Set(citations.map((citation) => citation.trim()).filter(Boolean))];
}

function citationChipsForResult(result: EngineResult) {
  const sourceRefs = sourceRefsForDisplay(result.sourceCitations);
  if (sourceRefs.length) return sourceCitationChips(sourceRefs);

  return uniqueCitationsForDisplay(result.citations).map((citation) => {
    const href = citationUrl(citation);
    return {
      key: citation,
      label: domainFromCitation(citation),
      href,
      title: href,
    };
  });
}

function sourceCitationChips(sourceRefs: PromptLabSourceRef[]) {
  const groups = new Map<string, PromptLabSourceRef[]>();
  for (const source of sourceRefs) {
    groups.set(source.label, [...(groups.get(source.label) ?? []), source]);
  }

  // Rank by citation count (most-cited domain first); ties keep provider order.
  return [...groups.entries()]
    .sort((left, right) => right[1].length - left[1].length)
    .map(([domain, sources]) => ({
      key: domain,
      label: sources.length > 1 ? `${domain} (${sources.length})` : domain,
      href: sources[0].url,
      title: sources.map((source) => source.url).join("\n"),
    }));
}

function emptyCitationLabel(status: EngineStatus) {
  if (status === "error") return "No citations because run failed";
  if (status === "not-run") return "No citations until this engine runs";
  if (status === "not_wired") return "No citations because engine is not wired";
  return "No citations returned";
}

function summarizeEngineError(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();

  if (/insufficient_quota|exceeded your current quota|429/i.test(normalized)) {
    return "Quota exceeded. Check provider billing or retry after quota resets.";
  }
  if (/timed out|abort/i.test(normalized)) {
    return "Request timed out before the engine returned an answer.";
  }
  if (/api_key|authentication|unauthorized|401|403/i.test(normalized)) {
    return "Authentication failed. Check provider API key access.";
  }

  return normalized || "Unknown engine error.";
}

function highlightAnswer(value: string) {
  const terms = ["Tiny Lemon", "Shopify", "Botika", "Lalaland.ai", "ZMO.ai", "flat-lay", "apparel"];
  const pattern = new RegExp(`(${terms.join("|")})`, "gi");
  return value.split(pattern).map((part, index) => {
    const isHit = terms.some((term) => term.toLowerCase() === part.toLowerCase());
    return isHit ? <mark key={`${part}-${index}`}>{part}</mark> : part;
  });
}

function EnginePill({ result }: { result: EngineResult }) {
  if (result.status === "running") {
    return (
      <span className="ai-engine-pill running">
        <SpinnerIcon /> Testing
      </span>
    );
  }
  if (result.status === "not-run") {
    return <span className="ai-engine-pill neutral">Not run</span>;
  }
  if (result.status === "not_wired") {
    return <span className="ai-engine-pill neutral">Not wired</span>;
  }
  if (result.status === "error") {
    return <span className="ai-engine-pill error">Error</span>;
  }
  if (result.status === "mentioned") {
    return <span className="ai-engine-pill good">Mentioned {result.rank}</span>;
  }
  return <span className="ai-engine-pill bad">Missing</span>;
}

function AddQuestionModal({
  onAdd,
  onClose,
}: {
  onAdd: (input: { questions: string[] }, runNow: boolean) => void;
  onClose: () => void;
}) {
  const [questionText, setQuestionText] = useState("");
  const [runNow, setRunNow] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const parsedQuestions = parseQuestionLines(questionText);
  const inferredStages = Array.from(new Set(parsedQuestions.map(inferStage)));

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submit() {
    if (!parsedQuestions.length) {
      inputRef.current?.focus();
      return;
    }
    onAdd({ questions: parsedQuestions }, runNow);
  }

  return (
    <div
      className="ai-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ai-modal" role="dialog" aria-modal="true" aria-labelledby="add-question-title">
        <header>
          <div>
            <h3 id="add-question-title">Add buyer questions</h3>
            <p>Paste one question per line.</p>
          </div>
          <button className="ai-close" onClick={onClose} type="button">
            <CloseIcon />
          </button>
        </header>
        <div className="ai-modal-body">
          <label className="ai-field">
            <span>Questions</span>
              <textarea
                onChange={(event) => setQuestionText(event.target.value)}
              placeholder={`What is the best AI product photography app for indie fashion brands on Shopify?\nWhat are the best alternatives to Botika for flat-lay to studio conversion?\nHow can indie fashion brands on Shopify get professional product photos without a shoot budget?`}
                ref={inputRef}
                value={questionText}
              />
          </label>
          <div className="ai-inferred-box">
            <span>Stage inferred automatically</span>
            <strong>{parsedQuestions.length ? inferredStages.join(", ") : "Waiting for questions"}</strong>
            <p>ContentDesk reads each question and classifies buyer stage after adding.</p>
          </div>
          <p className="ai-modal-note">
            {parsedQuestions.length || "No"}{" "}
            {parsedQuestions.length === 1 ? "question" : "questions"} ready. Topic is inferred too.
          </p>
          <label className="ai-toggle-row">
            <input checked={runNow} onChange={(event) => setRunNow(event.target.checked)} type="checkbox" />
            <span>Test after adding</span>
          </label>
        </div>
        <footer>
          <button className="ai-btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="ai-btn ai-btn-primary" onClick={submit} type="button">
            Add {parsedQuestions.length || ""} {parsedQuestions.length === 1 ? "question" : "questions"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function parseQuestionLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
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

function ChevronIcon() {
  return (
    <svg fill="none" height="13" viewBox="0 0 24 24" width="13">
      <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
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

function CloseIcon() {
  return (
    <svg fill="none" height="17" viewBox="0 0 24 24" width="17">
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" x1="18" x2="6" y1="6" y2="18" />
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
      <polygon points="8 5 19 12 8 19 8 5" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
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

function TextIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="5" x2="19" y1="7" y2="7" />
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="5" x2="15" y1="12" y2="12" />
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="5" x2="17" y1="17" y2="17" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
      <rect height="11" rx="2" stroke="currentColor" strokeWidth="2" width="11" x="8" y="8" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg fill="none" height="12" viewBox="0 0 24 24" width="12">
      <path d="M7 17 17 7" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M9 7h8v8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M14 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="ai-spinner" fill="none" height="14" viewBox="0 0 24 24" width="14">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path d="M20 12a8 8 0 0 0-8-8" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}
