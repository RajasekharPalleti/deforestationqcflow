import { HttpErrorResponse } from '@angular/common/http';

/**
 * Shared error-to-message formatting for the real (non-mock) API calls.
 * A status of 0 is opaque — it covers a genuinely unreachable host, a bad/missing
 * "https://" in a manually-typed Base URL, and a CORS rejection indistinguishably,
 * so the message below lists all three instead of guessing which one it was.
 */
export function describeHttpError(err: unknown, label: string): string {
  if (err instanceof HttpErrorResponse) {
    const desc = (err.error as { error_description?: string; message?: string })?.error_description
      ?? (err.error as { message?: string })?.message;
    if (desc) return desc;
    if (err.status === 0) {
      return (
        `Could not reach ${label}. Check that the Base URL is correct ` +
        `(including "https://", no typos, no trailing slash) and that its server ` +
        `allows requests from this origin (CORS) — this is also what a wrong or ` +
        `expired access token can look like.`
      );
    }
    if (err.status === 401) return `Session expired or unauthorized (401) while reaching ${label}. Please log in again.`;
    return `Failed to reach ${label}: ${err.status} ${err.statusText}`;
  }
  return err instanceof Error ? err.message : `Failed to reach ${label}.`;
}
