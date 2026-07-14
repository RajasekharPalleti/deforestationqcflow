import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';

export interface DashboardPlot {
  croppableAreaId: number;
  croppableAreaName: string;
  plotStatus: string;
  farmerName: string;
  farmerId: number;
  latitude: number;
  longitude: number;
  deforestationStatus: string;
  isPublished: boolean;
  qcStatus: string;
  lastRunDate: string;
  qcData: unknown;
}

const PAGE_SIZE = 100;

/** Every status combined — the default, unfiltered view ("Load Plots" / the Total Plots card). */
export const ALL_STATUSES_TAB = 'PENDING_QA,PUBLISHED,UNPUBLISHED,QA_DONE_AWAIT_DS,READY_TO_PUBLISH,TOTAL_PLOTS';

interface LoadParams {
  baseUrl: string;
  tenant: string;
  token: string;
  projectIds: string[];
}

/**
 * Real per-tenant plot list — POST .../meta/api/deforestation/qc/plots/{tenant}?page&size
 * with the entered project ids + a tab filter (all statuses, or one status per
 * dashboard card). Paginated, 100 rows per page.
 */
@Injectable({ providedIn: 'root' })
export class DashboardPlotsService {
  private http = inject(HttpClient);
  private lastParams: LoadParams | null = null;

  readonly plots = signal<DashboardPlot[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(0);
  /** The tab filter behind the current result set — lets a card highlight itself as "active". */
  readonly tab = signal(ALL_STATUSES_TAB);
  /** True once a load has completed at least once — distinguishes "never loaded" from "loaded, zero rows". */
  readonly hasLoaded = signal(false);
  /** Total row count across all pages, read from the X-Total-Count response header — null when the
   *  server didn't send one (older/other environments), in which case we fall back to a length guess. */
  readonly totalCount = signal<number | null>(null);

  /** Exact page count once totalCount is known; null while it isn't. */
  readonly totalPages = computed(() => {
    const total = this.totalCount();
    return total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE));
  });

  /** Prefers the real total from X-Total-Count; falls back to "this page was full, there might be more"
   *  when the header isn't present. */
  readonly hasNext = computed(() => {
    const totalPages = this.totalPages();
    if (totalPages !== null) return this.page() + 1 < totalPages;
    return this.plots().length >= PAGE_SIZE;
  });
  readonly hasPrev = computed(() => this.page() > 0);

  async load(
    baseUrl: string,
    tenant: string,
    token: string,
    projectIds: string[],
    page = 0,
    tab = ALL_STATUSES_TAB
  ): Promise<void> {
    this.lastParams = { baseUrl, tenant, token, projectIds };
    this.loading.set(true);
    this.error.set('');
    try {
      const ids = projectIds.map((id) => (isNaN(Number(id)) ? id : Number(id)));
      const url = `${baseUrl.replace(/\/$/, '')}/meta/api/deforestation/qc/plots/${encodeURIComponent(tenant)}`;
      const params = new HttpParams().set('page', String(page)).set('size', String(PAGE_SIZE));
      const res = await firstValueFrom(
        this.http.post<DashboardPlot[]>(
          url,
          { projectIds: ids, tab },
          {
            params,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            observe: 'response',
          }
        )
      );
      const totalHeader = res.headers.get('X-Total-Count') ?? res.headers.get('x-total-count');
      this.totalCount.set(totalHeader !== null ? Number(totalHeader) : null);
      this.plots.set(res.body ?? []);
      this.page.set(page);
      this.tab.set(tab);
      this.hasLoaded.set(true);
    } catch (err) {
      this.plots.set([]);
      this.totalCount.set(null);
      this.error.set(this.describeError(err));
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async goToPage(page: number): Promise<void> {
    if (!this.lastParams || page < 0) return;
    const { baseUrl, tenant, token, projectIds } = this.lastParams;
    await this.load(baseUrl, tenant, token, projectIds, page, this.tab());
  }

  next(): Promise<void> {
    return this.hasNext() ? this.goToPage(this.page() + 1) : Promise.resolve();
  }

  prev(): Promise<void> {
    return this.hasPrev() ? this.goToPage(this.page() - 1) : Promise.resolve();
  }

  reset(): void {
    this.plots.set([]);
    this.error.set('');
    this.page.set(0);
    this.tab.set(ALL_STATUSES_TAB);
    this.hasLoaded.set(false);
    this.totalCount.set(null);
    this.lastParams = null;
  }

  private describeError(err: unknown): string {
    return describeHttpError(err, 'the plots service');
  }
}
