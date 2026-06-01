import { Pool, type QueryResultRow } from "pg";
import { getEnv } from "@/lib/env";

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getEnv().DATABASE_URL,
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
