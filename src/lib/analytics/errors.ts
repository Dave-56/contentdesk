// Thrown when a source rejects credentials/permissions, so the runner can
// write a failed_auth row (actionable: fix key or grant) instead of a generic
// failed row (actionable: look at logs).
export class AnalyticsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsAuthError";
  }
}
