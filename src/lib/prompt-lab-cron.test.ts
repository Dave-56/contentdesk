import assert from "node:assert/strict";
import test from "node:test";
import {
  isCronAuthorized,
  isPromptLabCronForceAllowed,
  pacificHour,
  shouldRunAtPacificEight,
} from "@/lib/prompt-lab-cron";

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

test("cron runs only at 8am Pacific unless forced", () => {
  assert.equal(
    shouldRunAtPacificEight({
      force: false,
      now: new Date("2026-06-08T15:00:00.000Z"),
    }),
    true,
  );
  assert.equal(
    shouldRunAtPacificEight({
      force: false,
      now: new Date("2026-06-08T14:00:00.000Z"),
    }),
    false,
  );
  assert.equal(
    shouldRunAtPacificEight({
      force: true,
      now: new Date("2026-06-08T14:00:00.000Z"),
    }),
    true,
  );
});

test("test force header is local-only while force query works behind auth", () => {
  assert.equal(
    isPromptLabCronForceAllowed({
      forceParam: "true",
      testForceHeader: null,
      nodeEnv: "production",
    }),
    true,
  );
  assert.equal(
    isPromptLabCronForceAllowed({
      forceParam: null,
      testForceHeader: "true",
      nodeEnv: "production",
    }),
    false,
  );
  assert.equal(
    isPromptLabCronForceAllowed({
      forceParam: null,
      testForceHeader: "true",
      nodeEnv: "development",
    }),
    true,
  );
});
