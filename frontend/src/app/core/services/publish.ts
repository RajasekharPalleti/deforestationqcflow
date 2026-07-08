import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Plot } from '../models/models';
import { API_BASE } from './api-base';

export interface ReadyToPublish {
  ready: Plot[];
  already_published: number;
  no_final_status: number;
}

@Injectable({ providedIn: 'root' })
export class PublishService {
  private http = inject(HttpClient);

  getReady(tenant: string, project: string, model_name: string): Promise<ReadyToPublish> {
    const params = new HttpParams().set('tenant', tenant).set('project', project).set('model_name', model_name);
    return firstValueFrom(this.http.get<ReadyToPublish>(`${API_BASE}/publish/ready`, { params }));
  }

  publish(tenant: string, project: string, model_name: string, username: string): Promise<{ published: number }> {
    return firstValueFrom(
      this.http.post<{ published: number }>(`${API_BASE}/publish`, { tenant, project, model_name, username })
    );
  }
}
