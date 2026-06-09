const metaLeadPattern =
  /^(?:short answer|bottom line|in short|here'?s the answer|the answer)\s*[:\-]\s*/i;

const metaSentencePattern =
  /^(?:i(?:'ll| will)|let me|here'?s|below|to answer|based on|if you share|could you|can you)\b/i;

export function summarizePromptAnswer(answerText: string) {
  const cleaned = cleanAnswerText(answerText);
  const sentences = splitSentences(cleaned)
    .map((sentence) => sentence.replace(metaLeadPattern, "").trim())
    .filter((sentence) => sentence && !metaSentencePattern.test(sentence));
  const picked = pickSummarySentences(sentences);

  if (!picked.length) return "Answer collected. Open raw answer for details.";

  const compacted = picked.map(compactSentence).filter(Boolean);
  const summary: string[] = [];

  for (const sentence of compacted) {
    const candidate = [...summary, sentence].join(" ");
    if (summary.length > 0 && candidate.length > 240) break;
    summary.push(sentence);
    if (summary.length >= 2) break;
  }

  return summary.join(" ");
}

function cleanAnswerText(value: string) {
  return value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/[#>`_]/g, "")
    .replace(/\s+-\s+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+|(?:\s*[•]\s*)/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickSummarySentences(sentences: string[]) {
  const useful = sentences.filter((sentence) =>
    /\b(use|choose|try|combine|recommend|suggest|best|good|practical|workflow|option|start|focus|avoid|missing|means|should|can)\b/i.test(
      sentence,
    ),
  );

  return (useful.length ? useful : sentences).slice(0, 2);
}

function compactSentence(sentence: string) {
  const normalized = sentence
    .replace(/^(?:a|the)\s+practical\s+way\s+to\s+[^:]+:\s*/i, "")
    .replace(/^the\s+most\s+practical\s+[^:]+:\s*/i, "")
    .replace(/^for\s+[^,]+,\s*/i, "")
    .trim();
  const combiningMatch = normalized.match(/\bby combining\s+(.+?)\s+to\s+(.+?)(?:\.|$)/i);
  if (combiningMatch) {
    return `Combine ${shortenPhrase(combiningMatch[1])} to ${shortenPhrase(combiningMatch[2])}.`;
  }
  const shootMatch = normalized.match(/\bshoot\s+(.+?)\s+(?:with|in)\s+(.+?)(?:\.|;|$)/i);
  if (shootMatch) {
    return `Shoot ${shortenPhrase(shootMatch[1])} with ${shortenPhrase(shootMatch[2])}.`;
  }

  const fragments = normalized
    .split(/\s*;\s*|\s+and\s+then\s+|\s+then\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return fragments.slice(0, 1).map(shortenPhrase).join("").replace(/[;:,]\s*$/, ".");
}

function shortenPhrase(value: string) {
  return value
    .replace(/\bfree or low-cost\b/gi, "free/low-cost")
    .replace(/\bAI background or lifestyle-image tools\b/gi, "AI background/lifestyle tools")
    .replace(/\bsimple product photos\b/gi, "source photos")
    .replace(/\bsimple source images\b/gi, "source images")
    .replace(/\bpolished catalog images\b/gi, "catalog-ready images")
    .replace(/\byourself\b/gi, "")
    .replace(/\ba smartphone in\b/gi, "a phone and")
    .replace(/\ba smartphone\b/gi, "a phone")
    .replace(/\bbright, even light and a clean background\b/gi, "bright light with a clean background")
    .replace(/\s+/g, " ")
    .trim();
}
