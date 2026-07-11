import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';

/** The server responds 200 even when the update itself failed — a soft-failure pattern, not an HTTP error. */
interface DeforestationPublishResponse {
  totalRecords?: number;
  successCount?: number;
  failedCount?: number;
  message?: string;
}

/**
 * Publishes one or more already-reviewed plots —
 * POST .../meta/api/deforestation/publish/{companyCode} with a plain array of croppableAreaIds as the body.
 *
 * Distinct from both QcReviewService (records the QC decision) and the mock PublishService (pages/publish).
 */
@Injectable({ providedIn: 'root' })
export class DeforestationPublishService {
  private http = inject(HttpClient);

  readonly submitting = signal(false);
  readonly error = signal('');

  async publish(baseUrl: string, companyCode: string, token: string, croppableAreaIds: number[]): Promise<void> {
    this.submitting.set(true);
    this.error.set('');
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/meta/api/deforestation/publish/${encodeURIComponent(companyCode)}`;
      const res = await firstValueFrom(
        this.http.post<DeforestationPublishResponse>(url, croppableAreaIds, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
      );
      // A 200 doesn't guarantee every item actually applied — check the body too.
      if ((res.failedCount ?? 0) > 0 || res.successCount === 0) {
        throw new Error(res.message || 'The server rejected this publish request.');
      }
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
