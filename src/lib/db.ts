import { Pool, type QueryResultRow } from "pg";
import { getEnv } from "@/lib/env";

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: normalizeDatabaseUrl(getEnv().DATABASE_URL),
      max: 10,
      idleTimeoutMillis: 10_000,
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getPool().query<T>(text, values);
}

export function normalizeDatabaseUrl(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get("sslmode");
    const useLibpqCompat = url.searchParams.get("uselibpqcompat") === "true";

    if (!useLibpqCompat && sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
      url.searchParams.set("sslmode", "verify-full");
    }

    // Neon's pooled endpoint (-pooler) drops the connection search_path and
    // rejects setting it, so unqualified table names fail intermittently with
    // 42P01. Use the direct endpoint, where the role's default search_path
    // (public) applies. No-op for non-Neon/local URLs.
    if (url.hostname.includes("-pooler.")) {
      url.hostname = url.hostname.replace("-pooler.", ".");
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}
