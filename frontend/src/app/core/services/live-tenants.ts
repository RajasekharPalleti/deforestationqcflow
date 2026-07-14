import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';

export interface LiveTenant {
  code: string;
  name: string;
}

/** Meta-admin host per environment — distinct from the per-tenant Base URL, used only to list customers. */
const TENANT_LIST_HOSTS: Record<string, string> = {
  QA: 'https://v2.cropin.co.in',
  UAT: 'https://v2uat.cropin.co.in',
  PROD: 'https://cloud.cropin.in',
};

const PAGE_SIZE = 1000;

interface CustomerRaw {
  companyCode?: string;
  companyName?: string;
  [key: string]: unknown;
}

interface CustomersPageResponse {
  content?: CustomerRaw[];
}

/**
 * Fetches the full tenant/customer list for the picker dropdown —
 * GET {metaHost}/meta/api/customers?page=0&size=500, using the main login's
 * meta-admin token (the same one Load Dashboard/Load Plots use).
 */
@Injectable({ providedIn: 'root' })
export class LiveTenantsService {
  private http = inject(HttpClient);

  readonly tenants = signal<LiveTenant[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  async fetchTenants(environment: string, token: string): Promise<void> {
    const host = TENANT_LIST_HOSTS[environment];
    if (!host) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const url = `${host}/meta/api/customers`;
      const params = new HttpParams().set('page', '0').set('size', String(PAGE_SIZE));
      const res = await firstValueFrom(
        this.http.get<CustomersPageResponse | CustomerRaw[]>(url, {
          params,
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      const list = Array.isArray(res) ? res : res.content ?? [];
      this.tenants.set(
        list
          .filter((c) => !!c.companyCode)
          .map((c) => ({ code: c.companyCode!, name: c.companyName || c.companyCode! }))
      );
    } catch (err) {
      this.tenants.set([]);
      this.error.set(describeHttpError(err, 'the tenants list'));
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.tenants.set([]);
    this.error.set('');
  }
}
