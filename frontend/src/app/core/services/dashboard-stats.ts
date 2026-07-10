import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';

export interface DashboardStats {
  totalPlots: number;
  publishedPlots: number;
  unpublishedPlots: number;
  pendingQaPlots: number;
  qaDoneAwaitingDsPlots: number;
  readyToPublishPlots: number;
}

/**
 * Real per-tenant dashboard aggregate counts — POST .../meta/api/deforestation/qc/dashboard/{tenant}
 * with the entered project ids as a plain JSON array in the body.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private http = inject(HttpClient);

  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  async load(baseUrl: string, tenant: string, token: string, projectIds: string[]): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const ids = projectIds.map((id) => (isNaN(Number(id)) ? id : Number(id)));
      const url = `${baseUrl.replace(/\/$/, '')}/meta/api/deforestation/qc/dashboard/${encodeURIComponent(tenant)}`;
      const result = await firstValueFrom(
        this.http.post<DashboardStats>(url, ids, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
      );
      this.stats.set(result);
    } catch (err) {
      this.stats.set(null);
      this.error.set(this.describeError(err));
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.stats.set(null);
    this.error.set('');
  }

  private describeError(err: unknown): string {
    return describeHttpError(err, 'the dashboard service');
  }
}
