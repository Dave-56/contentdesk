export type PromptLabCronState =
  | "unauthorized"
  | "skipped_wrong_hour"
  | "skipped_already_running"
  | "skipped_already_completed"
  | "started"
  | "completed"
  | "partial"
  | "failed";

export const promptLabCronPacificHour = 8;
