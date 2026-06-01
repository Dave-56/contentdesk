import { getEnv } from "@/lib/env";
import { researchSourcesSchema, type ResearchSource } from "@/lib/schemas";
import type { ResearchObjective, ResearchProvider } from "@/lib/research/provider";

type ParallelSearchResult = {
  url?: string;
  title?: string | null;
  publish_date?: string | null;
  excerpts?: string[];
};

type ParallelSearchResponse = {
  results?: ParallelSearchResult[];
  session_id?: string;
};

type ParallelExtractResult = {
  url?: string;
  title?: string | null;
  excerpts?: string[];
  full_content?: string | null;
};

type ParallelExtractResponse = {
  results?: ParallelExtractResult[];
  session_id?: string;
};

export class ParallelResearchProvider implements ResearchProvider {
  private readonly apiKey: string;
  private sessionId: string | undefined;

  constructor(apiKey = getEnv().PARALLEL_API_KEY) {
    if (!apiKey) throw new Error("PARALLEL_API_KEY is not configured");
    this.apiKey = apiKey;
  }

  async search(objectives: ResearchObjective[]) {
    const fetchedAt = new Date().toISOString();
    const sourceMap = new Map<string, ResearchSource>();

    for (const objective of objectives) {
      const response = await this.post<ParallelSearchResponse>("/v1/search", {
        objective: objective.objective,
        search_queries: objective.searchQueries.slice(0, 3),
        session_id: this.sessionId,
      });

      this.sessionId = response.session_id ?? this.sessionId;

      for (const result of response.results ?? []) {
        if (!result.url) continue;
        const excerpt = compactText((result.excerpts ?? []).join("\n\n"));
        if (!excerpt) continue;

        const existing = sourceMap.get(result.url);
        const source = {
          provider: "parallel" as const,
          query: objective.objective,
          url: result.url,
          title: result.title ?? "",
          publishedAt: result.publish_date ?? undefined,
          excerpt,
          extractedMarkdown: existing?.extractedMarkdown ?? "",
          fetchedAt,
        };

        sourceMap.set(result.url, source);
      }
    }

    return researchSourcesSchema.parse([...sourceMap.values()]);
  }

  async extract(sources: ResearchSource[], objectives: ResearchObjective[]) {
    const selected = sources.slice(0, 8);
    if (selected.length === 0) return sources;

    const response = await this.post<ParallelExtractResponse>("/v1/extract", {
      urls: selected.map((source) => source.url),
      objective: objectives[0]?.objective,
      search_queries: objectives.flatMap((objective) => objective.searchQueries).slice(0, 5),
      max_chars_total: 30000,
      session_id: this.sessionId,
    });

    this.sessionId = response.session_id ?? this.sessionId;

    const extractedByUrl = new Map(
      (response.results ?? [])
        .filter((result): result is ParallelExtractResult & { url: string } =>
          Boolean(result.url),
        )
        .map((result) => [
          result.url,
          {
            title: result.title ?? "",
            extractedMarkdown: compactText(
              result.full_content || (result.excerpts ?? []).join("\n\n"),
            ),
            excerpt: compactText((result.excerpts ?? []).join("\n\n")),
          },
        ]),
    );

    return researchSourcesSchema.parse(
      sources.map((source) => {
        const extracted = extractedByUrl.get(source.url);
        if (!extracted) return source;

        return {
          ...source,
          title: extracted.title || source.title,
          excerpt: extracted.excerpt || source.excerpt,
          extractedMarkdown: extracted.extractedMarkdown,
        };
      }),
    );
  }

  private async post<T>(path: string, body: unknown) {
    const response = await fetch(`https://api.parallel.ai${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Parallel API ${path} failed with ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
