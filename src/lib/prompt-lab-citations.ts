export type PromptLabSourceCitation = {
  url: string;
  domain: string;
  sourceFormat?: string;
  citationQuality?: string;
};

export type PromptLabSourceRef = PromptLabSourceCitation & {
  index: number;
  label: string;
};

export type RawAnswerCitationToken =
  | { type: "text"; value: string }
  | { type: "marker"; value: string; index: number; source: PromptLabSourceRef };

export function sourceRefsForDisplay(
  sourceCitations: readonly PromptLabSourceCitation[] | null | undefined,
): PromptLabSourceRef[] {
  if (!Array.isArray(sourceCitations)) return [];

  const seen = new Set<string>();
  const refs: PromptLabSourceRef[] = [];

  for (const source of sourceCitations) {
    const url = validUrl(source.url);
    if (!url || seen.has(url.href)) continue;

    seen.add(url.href);
    refs.push({
      ...source,
      url: url.href,
      domain: source.domain || domainFromUrl(url),
      label: source.domain || domainFromUrl(url),
      index: refs.length + 1,
    });
  }

  return refs;
}

export function parseRawAnswerCitationMarkers(
  answer: string,
  sourceRefs: readonly PromptLabSourceRef[],
): RawAnswerCitationToken[] {
  const tokens: RawAnswerCitationToken[] = [];
  const markerPattern = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerPattern.exec(answer)) !== null) {
    const marker = match[0];
    const markerNumber = match[1];
    pushText(tokens, answer.slice(lastIndex, match.index));

    const index = Number(markerNumber);
    const source = hasLeadingZero(markerNumber) ? undefined : sourceRefs[index - 1];
    if (index >= 1 && source) {
      tokens.push({ type: "marker", value: marker, index, source });
    } else {
      pushText(tokens, marker);
    }

    lastIndex = match.index + marker.length;
  }

  pushText(tokens, answer.slice(lastIndex));

  return tokens;
}

export function domainFromCitation(citation: string) {
  const url = validUrl(citationUrl(citation));
  return url ? domainFromUrl(url) : citation.trim();
}

export function citationUrl(citation: string) {
  if (/^https?:\/\//i.test(citation)) return citation;
  return `https://${citation}`;
}

function validUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function domainFromUrl(url: URL) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

function hasLeadingZero(value: string) {
  return value.length > 1 && value.startsWith("0");
}

function pushText(tokens: RawAnswerCitationToken[], value: string) {
  if (!value) return;

  const previous = tokens[tokens.length - 1];
  if (previous?.type === "text") {
    previous.value += value;
    return;
  }

  tokens.push({ type: "text", value });
}
