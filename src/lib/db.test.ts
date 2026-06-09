import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDatabaseUrl } from "@/lib/db";

test("normalizes pg sslmode require to verify-full", () => {
  const url = normalizeDatabaseUrl(
    "postgres://user:pass@example.com/db?sslmode=require",
  );

  assert.equal(new URL(url).searchParams.get("sslmode"), "verify-full");
});

test("normalizes pg sslmode aliases that currently mean verify-full", () => {
  for (const mode of ["prefer", "verify-ca"]) {
    const url = normalizeDatabaseUrl(
      `postgres://user:pass@example.com/db?sslmode=${mode}`,
    );

    assert.equal(new URL(url).searchParams.get("sslmode"), "verify-full");
  }
});

test("leaves explicit libpq compatibility alone", () => {
  const input =
    "postgres://user:pass@example.com/db?uselibpqcompat=true&sslmode=require";

  assert.equal(normalizeDatabaseUrl(input), input);
});

test("leaves local database urls without sslmode alone", () => {
  const input = "postgres://postgres:postgres@localhost:5432/contentdesk";

  assert.equal(normalizeDatabaseUrl(input), input);
});

test("rewrites Neon pooled endpoint to the direct endpoint", () => {
  const url = normalizeDatabaseUrl(
    "postgres://user:pass@ep-holy-bird-123-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
  );

  assert.equal(
    new URL(url).hostname,
    "ep-holy-bird-123.c-8.us-east-1.aws.neon.tech",
  );
});
