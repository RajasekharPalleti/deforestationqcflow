import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../models/models';
import { API_BASE } from './api-base';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private configPromise: Promise<AppConfig> | null = null;
  private teamMembersPromise: Promise<Record<string, string[]>> | null = null;

  getConfig(): Promise<AppConfig> {
    if (!this.configPromise) {
      this.configPromise = firstValueFrom(this.http.get<AppConfig>(`${API_BASE}/config`));
    }
    return this.configPromise;
  }

  getTeamMembers(): Promise<Record<string, string[]>> {
    if (!this.teamMembersPromise) {
      this.teamMembersPromise = firstValueFrom(
        this.http.get<Record<string, string[]>>(`${API_BASE}/team-members`)
      );
    }
    return this.teamMembersPromise;
  }
}
