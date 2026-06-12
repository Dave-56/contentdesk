import assert from "node:assert/strict";
import test from "node:test";
import {
  isCronAuthorized,
  isCronForceAllowed,
  pacificHour,
  shouldRunAtPacificHour,
} from "@/lib/cron";

test("cron auth requires bearer token matching CRON_SECRET", () => {
  assert.equal(
    isCronAuthorized({
      authorization: "Bearer secret",
      cronSecret: "secret",
    }),
    true,
  );
  assert.equal(
    isCronAuthorized({
      authorization: "Bearer wrong",
      cronSecret: "secret",
    }),
    false,
  );
  assert.equal(
    isCronAuthorized({
      authorization: "Bearer secret",
      cronSecret: undefined,
    }),
    false,
  );
});

test("Pacific hour handles daylight saving time", () => {
  assert.equal(pacificHour(new Date("2026-06-08T15:00:00.000Z")), 8);
  assert.equal(pacificHour(new Date("2026-01-08T16:00:00.000Z")), 8);
});

test("cron runs only at the configured Pacific hour unless forced", () => {
  assert.equal(
    shouldRunAtPacificHour({
      hour: 8,
      force: false,
      now: new Date("2026-06-08T15:00:00.000Z"),
    }),
    true,
  );
  assert.equal(
    shouldRunAtPacificHour({
      hour: 8,
      force: false,
      now: new Date("2026-06-08T14:00:00.000Z"),
    }),
    false,
  );
  assert.equal(
    shouldRunAtPacificHour({
      hour: 9,
      force: false,
      now: new Date("2026-06-08T16:00:00.000Z"),
    }),
    true,
  );
  assert.equal(
    shouldRunAtPacificHour({
      hour: 8,
      force: true,
      now: new Date("2026-06-08T14:00:00.000Z"),
    }),
    true,
  );
});

test("test force header is local-only while force query works behind auth", () => {
  assert.equal(
    isCronForceAllowed({
      forceParam: "true",
      testForceHeader: null,
      nodeEnv: "production",
    }),
    true,
  );
  assert.equal(
    isCronForceAllowed({
      forceParam: null,
      testForceHeader: "true",
      nodeEnv: "production",
    }),
    false,
  );
  assert.equal(
    isCronForceAllowed({
      forceParam: null,
      testForceHeader: "true",
      nodeEnv: "development",
    }),
    true,
  );
});
