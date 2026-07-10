import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';
import { TenantAuthService } from './tenant-auth';

export interface LiveProject {
  id: string | number;
  name: string;
}

interface ProjectsFilterResponse {
  content?: { id: string | number; name: string }[];
  last?: boolean;
}

const PAGE_SIZE = 50;

/**
 * Fetches the tenant's real projects from the farm service, paginated for
 * infinite-scroll style lazy loading in the project-picker dropdown.
 * Source: cropin_automation_techops project, static/js/deforestation.js — fetchProjects().
 */
@Injectable({ providedIn: 'root' })
export class LiveProjectsService {
  private http = inject(HttpClient);
  private tenantAuth = inject(TenantAuthService);
  private baseUrl = '';
  private token = '';

  readonly projects = signal<LiveProject[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal('');
  readonly page = signal(0);
  readonly hasMore = signal(false);

  /** Initial load — resets accumulated results and starts from page 0. */
  async fetchProjects(baseUrl: string, token: string): Promise<void> {
    this.baseUrl = baseUrl;
    this.token = token;
    this.projects.set([]);
    this.page.set(0);
    this.hasMore.set(false);
    this.loading.set(true);
    this.error.set('');
    try {
      const { items, isLast } = await this.fetchPage(0);
      this.projects.set(items);
      this.hasMore.set(!isLast);
    } catch (err) {
      this.projects.set([]);
      this.error.set(this.describeError(err));
      this.forceLogoutOn401(err);
    } finally {
      this.loading.set(false);
    }
  }

  /** Fetches the next page and appends — called when the dropdown list is scrolled near the bottom. */
  async loadMore(): Promise<void> {
    if (this.loadingMore() || this.loading() || !this.hasMore() || !this.baseUrl || !this.token) return;
    this.loadingMore.set(true);
    try {
      const nextPage = this.page() + 1;
      const { items, isLast } = await this.fetchPage(nextPage);
      this.projects.update((prev) => [...prev, ...items]);
      this.page.set(nextPage);
      this.hasMore.set(!isLast);
    } catch (err) {
      this.error.set(this.describeError(err));
      this.forceLogoutOn401(err);
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async fetchPage(page: number): Promise<{ items: LiveProject[]; isLast: boolean }> {
    const url =
      `${this.baseUrl.replace(/\/$/, '')}/services/farm/api/projects/filter` +
      `?sort=projectStatus,asc&sort=lastModifiedDate,desc` +
      `&projectExecutionStatus=TO_BE_STARTED&projectExecutionStatus=STARTED&projectStatus=UPCOMING` +
      `&page=${page}&size=${PAGE_SIZE}`;

    const res = await firstValueFrom(
      this.http.post<ProjectsFilterResponse | LiveProject[]>(
        url,
        { statusList: ['LIVE', 'PAST', 'UPCOMING'], projectStatusList: ['TO_BE_STARTED', 'STARTED'] },
        { headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' } }
      )
    );

    const items = (Array.isArray(res) ? res : res.content ?? []).map((p) => ({ id: p.id, name: p.name }));
    const isLast = Array.isArray(res) ? items.length < PAGE_SIZE : (res.last ?? items.length < PAGE_SIZE);
    return { items, isLast };
  }

  reset(): void {
    this.baseUrl = '';
    this.token = '';
    this.projects.set([]);
    this.error.set('');
    this.page.set(0);
    this.hasMore.set(false);
  }

  private describeError(err: unknown): string {
    return describeHttpError(err, 'the project service');
  }

  /** A 401 from the project API means the token is no longer valid — end the session. */
  private forceLogoutOn401(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.tenantAuth.logout();
    }
  }
}
