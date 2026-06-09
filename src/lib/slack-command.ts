export type ContentDeskCommand =
  | { mode: "start" }
  | { mode: "profile" }
  | { mode: "setup" }
  | { mode: "edit-profile" }
  | { mode: "article"; idea: string }
  | { mode: "reddit-teardown"; websiteUrl: string }
  | { mode: "reddit-scout-now" };

export function parseContentDeskCommand(text: string): ContentDeskCommand {
  const trimmed = text.trim();
  const normalized = trimmed.toLowerCase();

  if (!trimmed) return { mode: "start" };
  if (normalized === "profile") return { mode: "profile" };
  if (normalized === "setup") return { mode: "setup" };
  if (normalized === "edit-profile") return { mode: "edit-profile" };
  if (normalized === "reddit-scout" || normalized === "reddit-scout now") {
    return { mode: "reddit-scout-now" };
  }

  const teardownMatch = /^(?:reddit-teardown|teardown)(?::|\s+)([\s\S]*)$/i.exec(trimmed);
  if (teardownMatch) {
    const websiteUrl = teardownMatch[1]?.trim() ?? "";
    return {
      mode: "reddit-teardown",
      websiteUrl: looksLikeWebsiteInput(websiteUrl) ? websiteUrl : "",
    };
  }

  if (
    normalized === "reddit-teardown" ||
    normalized === "reddit-teardown:" ||
    normalized === "teardown" ||
    normalized === "teardown:"
  ) {
    return { mode: "reddit-teardown", websiteUrl: "" };
  }

  const articleMatch = /^article(?::|\s+)([\s\S]*)$/i.exec(trimmed);
  if (articleMatch) {
    return {
      mode: "article",
      idea: articleMatch[1]?.trim() ?? "",
    };
  }

  if (normalized === "article" || normalized === "article:") {
    return { mode: "article", idea: "" };
  }

  return { mode: "start" };
}

function looksLikeWebsiteInput(input: string) {
  if (!input || /\s/.test(input)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}
