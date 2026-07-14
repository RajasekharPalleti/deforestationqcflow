import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';

export interface FailedPublishPlot {
  croppableAreaId: number;
  errorCode?: string;
  errorMessage?: string;
}

/** The server responds 200 even when the update itself failed — a soft-failure pattern, not an HTTP error. */
interface DeforestationPublishResponse {
  totalRecords?: number;
  successCount?: number;
  failedCount?: number;
  message?: string;
  successfulPlots?: unknown[];
  failedPlots?: FailedPublishPlot[];
}

export type PublishOutcome = 'success' | 'partial' | 'failed';

export interface PublishResult {
  /** 'success' — all recorded; 'partial' — some recorded, some rejected; 'failed' — none recorded. */
  outcome: PublishOutcome;
  successCount: number;
  failedCount: number;
  message: string;
  failedPlots: FailedPublishPlot[];
}

/**
 * Publishes one or more already-reviewed plots —
 * POST .../meta/api/deforestation/publish/{companyCode} with a plain array of croppableAreaIds as the body.
 *
 * Distinct from QcReviewService, which records the QC decision rather than publishing it.
 */
@Injectable({ providedIn: 'root' })
export class DeforestationPublishService {
  private http = inject(HttpClient);

  readonly submitting = signal(false);
  readonly error = signal('');

  /**
   * Only a real HTTP/network failure throws here — a 200 with successCount 0 is a soft-failure the
   * server reports in its body, not an exception, so the caller decides how to reflect that in the UI.
   */
  async publish(
    baseUrl: string,
    companyCode: string,
    token: string,
    croppableAreaIds: number[]
  ): Promise<PublishResult> {
    this.submitting.set(true);
    this.error.set('');
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/meta/api/deforestation/publish/${encodeURIComponent(companyCode)}`;
      const res = await firstValueFrom(
        this.http.post<DeforestationPublishResponse>(url, croppableAreaIds, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
      );
      const successCount = res.successCount ?? 0;
      const failedCount = res.failedCount ?? 0;
      const failedPlots = res.failedPlots ?? [];
      const outcome: PublishOutcome = successCount === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'success';
      // The server's own message (e.g. "Publish completed.") is the same generic text regardless of
      // outcome, so build our own for partial/failed — only trust it for a clean, fully-successful call.
      const message =
        outcome === 'failed'
          ? failedPlots[0]?.errorMessage || 'Publish failed. Please try again.'
          : outcome === 'partial'
            ? `Partially published — ${successCount} succeeded, ${failedCount} failed.`
            : res.message || 'Published.';
      return { outcome, successCount, failedCount, message, failedPlots };
    } catch (err) {
      this.error.set(
        err instanceof Error && !(err instanceof HttpErrorResponse) ? err.message : describeHttpError(err, 'the publish service')
      );
      throw err;
    } finally {
      this.submitting.set(false);
    }
  }

  reset(): void {
    this.error.set('');
    this.submitting.set(false);
  }
}
