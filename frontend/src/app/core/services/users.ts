import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ManagedUser } from '../models/models';
import { API_BASE } from './api-base';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);

  list(): Promise<ManagedUser[]> {
    return firstValueFrom(this.http.get<ManagedUser[]>(`${API_BASE}/users`));
  }

  add(username: string, display_name: string, role: string, password: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${API_BASE}/users`, { username, display_name, role, password })
    );
  }
}
