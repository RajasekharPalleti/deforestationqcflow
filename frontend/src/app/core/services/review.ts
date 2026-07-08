import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api-base';

export interface IndividualEditItem {
  id: number;
  status: string;
  reason?: string;
  comments?: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);

  bulkUpdate(params: {
    tenant: string;
    project: string;
    model_name: string;
    role: 'QA' | 'DS';
    username: string;
    plot_ids: number[];
    status: string;
    reason?: string;
  }): Promise<{ updated: number }> {
    return firstValueFrom(this.http.patch<{ updated: number }>(`${API_BASE}/review/bulk`, params));
  }

  saveEdits(params: {
    tenant: string;
    project: string;
    model_name: string;
    role: 'QA' | 'DS';
    username: string;
    edits: IndividualEditItem[];
  }): Promise<{ saved: number }> {
    return firstValueFrom(this.http.patch<{ saved: number }>(`${API_BASE}/review/save`, params));
  }
}
