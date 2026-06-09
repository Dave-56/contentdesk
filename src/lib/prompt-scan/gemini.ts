import type { ProviderPromptResult } from "@/lib/prompt-scan/analyzer";
import type { PromptProvider } from "@/lib/prompt-scan/provider";

const systemPrompt = [
  "Answer the user's question naturally as a buyer research assistant.",
  "Do not favor any brand unless the available evidence supports it.",
].join(" ");

export async function runGeminiPrompt(input: {
  apiKey: string;
  prompt: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<ProviderPromptResult> {
  const model = input.model ?? "gemini-3.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.prompt }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
      }),
      signal: input.signal,
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini request failed with ${response.status}: ${body.slice(0, 500)}`);
  }

  const parsed: unknown = await response.json();
  const citedUrls = uniqueUrls(extractGeminiCitedUrls(parsed));

  return {
    answerText: extractGeminiAnswerText(parsed),
    citedUrls: await resolveGeminiCitationUrls({
      urls: citedUrls,
      signal: input.signal,
    }),
  };
}

export function createGeminiProvider(input: {
  apiKey: string;
  runPrompt?: typeof runGeminiPrompt;
}): PromptProvider {
  const runPrompt = input.runPrompt ?? runGeminiPrompt;

  return {
    id: "gemini",
    scanPrompt({ prompt, signal }) {
      return runPrompt({
        apiKey: input.apiKey,
        prompt,
        ...(signal ? { signal } : {}),
      });
    },
  };
}

export function extractGeminiAnswerText(value: unknown): string {
  if (!isRecord(value)) return "";
  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  const textParts = candidates.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.content)) return [];
    const parts = Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
    return parts.flatMap((part) =>
      isRecord(part) && typeof part.text === "string" ? [part.text] : [],
    );
  });

  return textParts.join("");
}

export function extractGeminiCitedUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(extractGeminiCitedUrls);
  if (!isRecord(value)) return [];

  const directUrls =
    isRecord(value.web) && typeof value.web.uri === "string" ? [value.web.uri] : [];

  return [
    ...directUrls,
    ...Object.values(value).flatMap(extractGeminiCitedUrls),
  ];
}

const groundingRedirectHost = "vertexaisearch.cloud.google.com";

// Gemini returns grounding citations as vertexaisearch.cloud.google.com redirect
// links. Resolve them to the real destination so stored citations show the actual
// domain instead of the opaque Google redirect.
export async function resolveGeminiCitationUrls(input: {
  urls: string[];
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<string[]> {
  const fetcher = input.fetcher ?? fetch;
  const resolved = await Promise.all(
    input.urls.map((url) =>
      isGeminiGroundingRedirect(url)
        ? resolveRedirectUrl({
            url,
            fetcher,
            signal: input.signal,
            timeoutMs: input.timeoutMs ?? 5_000,
          })
        : Promise.resolve(url),
    ),
  );

  return uniqueUrls(resolved);
}

async function resolveRedirectUrl(input: {
  url: string;
  fetcher: typeof fetch;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<string> {
  // Google's redirect is a 302 whose Location header is the real destination.
  // Read it directly (redirect: "manual") so resolution depends only on Google's
  // fast response, never on the destination site, which can be slow enough to
  // blow the timeout and leave the redirect URL stored.
  const viaLocation = await fetchRedirectLocation(input);
  if (viaLocation) return viaLocation;

  // Fallback: follow redirects to the final resolved URL.
  const viaFinalUrl = await fetchFinalUrl(input);
  return viaFinalUrl ?? input.url;
}

async function fetchRedirectLocation(input: {
  url: string;
  fetcher: typeof fetch;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<string | null> {
  const { signal, cleanup } = abortSignalWithTimeout(input.signal, input.timeoutMs);

  try {
    const response = await input.fetcher(input.url, {
      method: "GET",
      redirect: "manual",
      signal,
    });
    const location = response.headers.get("location");
    await response.body?.cancel().catch(() => undefined);

    return location && validHttpUrl(location) && !isGeminiGroundingRedirect(location)
      ? location
      : null;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

async function fetchFinalUrl(input: {
  url: string;
  fetcher: typeof fetch;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<string | null> {
  const { signal, cleanup } = abortSignalWithTimeout(input.signal, input.timeoutMs);

  try {
    const response = await input.fetcher(input.url, {
      method: "HEAD",
      redirect: "follow",
      signal,
    });
    const finalUrl = response.url;
    await response.body?.cancel().catch(() => undefined);

    return validHttpUrl(finalUrl) && !isGeminiGroundingRedirect(finalUrl)
      ? finalUrl
      : null;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

function abortSignalWithTimeout(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();

  if (parent?.aborted) {
    controller.abort();
  } else {
    parent?.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abort);
    },
  };
}

function isGeminiGroundingRedirect(value: string) {
  try {
    return new URL(value).hostname.toLowerCase() === groundingRedirectHost;
  } catch {
    return false;
  }
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
