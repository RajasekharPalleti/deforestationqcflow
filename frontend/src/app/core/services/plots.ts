import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Plot, Stats } from '../models/models';
import { API_BASE } from './api-base';

export interface PlotFilters {
  detection_status?: string;
  publish_status?: string;
  qa_status?: string;
  pipeline_flag?: string;
  date_from?: string;
  date_to?: string;
  plot_id_search?: string;
}

@Injectable({ providedIn: 'root' })
export class PlotsService {
  private http = inject(HttpClient);

  getPlots(tenant: string, project: string, model_name: string, filters: PlotFilters = {}): Promise<Plot[]> {
    let params = new HttpParams().set('tenant', tenant).set('project', project).set('model_name', model_name);
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, v);
    }
    return firstValueFrom(this.http.get<Plot[]>(`${API_BASE}/plots`, { params }));
  }

  getStats(tenant: string, project: string, model_name: string): Promise<Stats> {
    const params = new HttpParams().set('tenant', tenant).set('project', project).set('model_name', model_name);
    return firstValueFrom(this.http.get<Stats>(`${API_BASE}/plots/stats`, { params }));
  }

  getCount(tenant: string, project: string, model_name: string): Promise<number> {
    const params = new HttpParams().set('tenant', tenant).set('project', project).set('model_name', model_name);
    return firstValueFrom(this.http.get<{ count: number }>(`${API_BASE}/plots/count`, { params })).then(
      (r) => r.count
    );
  }
}
