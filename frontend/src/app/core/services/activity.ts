import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivityLogEntry } from '../models/models';
import { API_BASE } from './api-base';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private http = inject(HttpClient);

  getActivity(tenant: string, project: string, model_name: string): Promise<ActivityLogEntry[]> {
    const params = new HttpParams().set('tenant', tenant).set('project', project).set('model_name', model_name);
    return firstValueFrom(this.http.get<ActivityLogEntry[]>(`${API_BASE}/activity`, { params }));
  }
}
