import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';

export type QcStatus = 'DEFORESTED' | 'NOT_DEFORESTED' | 'INCONCLUSIVE';
export type ReviewType = 'QA' | 'DS';

export interface ReviewPayload {
  croppableAreaId: number;
  qcStatus: QcStatus;
  reason: string;
  comments: string;
}

/** The server responds 200 even when the update itself failed — a soft-failure pattern, not an HTTP error. */
interface ReviewResponse {
  totalRecords?: number;
  successCount?: number;
  failedCount?: number;
  message?: string;
}

export type ReviewOutcome = 'success' | 'partial' | 'failed';

export interface ReviewSubmitResult {
  /** 'success' — all recorded; 'partial' — some recorded, some rejected; 'failed' — none recorded. */
  outcome: ReviewOutcome;
  successCount: number;
  failedCount: number;
  message: string;
}

/**
 * Submits a QA/DS review decision for one or more plots —
 * POST .../meta/api/deforestation/qc/review/{companyCode}?reviewType=QA|DS
 * with the whole batch sent as a single array body.
 *
 * Distinct from DeforestationPublishService, which publishes rather than records the QC review.
 */
@Injectable({ providedIn: 'root' })
export class QcReviewService {
  private http = inject(HttpClient);

  readonly submitting = signal(false);
  readonly error = signal('');

  /**
   * Only a real HTTP/network failure throws here — a 200 with successCount 0 is a soft-failure the
   * server reports in its body, not an exception, so the caller decides how to reflect that in the UI.
   */
  async submitReview(
    baseUrl: string,
    companyCode: string,
    token: string,
    reviewType: ReviewType,
    payloads: ReviewPayload[]
  ): Promise<ReviewSubmitResult> {
    this.submitting.set(true);
    this.error.set('');
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/meta/api/deforestation/qc/review/${encodeURIComponent(companyCode)}`;
      const params = new HttpParams().set('reviewType', reviewType);
      const res = await firstValueFrom(
        this.http.post<ReviewResponse>(url, payloads, {
          params,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
      );
      const successCount = res.successCount ?? 0;
      const failedCount = res.failedCount ?? 0;
      const outcome: ReviewOutcome = successCount === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'success';
      // The server's own message (e.g. "QA review completed.") is the same generic text regardless of
      // outcome, so build our own for partial/failed — only trust it for a clean, fully-successful call.
      const message =
        outcome === 'failed'
          ? 'Review failed. Please try again.'
          : outcome === 'partial'
            ? `Partially completed — ${successCount} succeeded, ${failedCount} failed. Please check and proceed with publish.`
            : res.message || 'Review completed.';
      return { outcome, successCount, failedCount, message };
    } catch (err) {
      this.error.set(err instanceof Error && !(err instanceof HttpErrorResponse) ? err.message : describeHttpError(err, 'the review service'));
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
