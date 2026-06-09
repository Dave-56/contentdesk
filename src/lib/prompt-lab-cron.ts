const pacificTimeZone = "America/Los_Angeles";

export type PromptLabCronState =
  | "unauthorized"
  | "skipped_wrong_hour"
  | "skipped_already_running"
  | "skipped_already_completed"
  | "started"
  | "completed"
  | "partial"
  | "failed";

export function isCronAuthorized(input: {
  authorization: string | null;
  cronSecret: string | undefined;
}) {
  return Boolean(input.cronSecret) && input.authorization === `Bearer ${input.cronSecret}`;
}

export function isPromptLabCronForceAllowed(input: {
  forceParam: string | null;
  testForceHeader: string | null;
  nodeEnv: string | undefined;
}) {
  if (input.forceParam === "true") return true;
  return input.nodeEnv !== "production" && input.testForceHeader === "true";
}

export function pacificHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: pacificTimeZone,
    hour: "numeric",
    hour12: false,
  }).format(date);

  return Number(hour);
}

export function shouldRunAtPacificEight(input: {
  force: boolean;
  now: Date;
}) {
  if (input.force) return true;
  return pacificHour(input.now) === 8;
}
