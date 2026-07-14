import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivityLogEntry } from '../models/models';
import { API_BASE } from './api-base';

export interface LogActivityEntry {
  tenant: string;
  project?: string;
  model_name: string;
  plot_id: string;
  username: string;
  action: string;
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private http = inject(HttpClient);

  getActivity(tenant: string, model_name: string): Promise<ActivityLogEntry[]> {
    const params = new HttpParams().set('tenant', tenant).set('model_name', model_name);
    return firstValueFrom(this.http.get<ActivityLogEntry[]>(`${API_BASE}/activity`, { params }));
  }

  /** Records one real QA/DS review or publish action — fire-and-forget, never blocks the caller's own flow. */
  async logActivity(entry: LogActivityEntry): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/activity`, entry));
    } catch {
      // Best-effort only — a logging failure shouldn't surface as if the review/publish itself failed.
    }
  }
}
