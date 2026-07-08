import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/models';
import { API_BASE } from './api-base';

const STORAGE_KEY = 'cropin_user';
/** Tracks the department used for the most recent login — survives logout()
 *  so the login page can tell whether a new login is a same-team name switch
 *  (keep the tenant/SSO session) or a different department (clear it). */
const LAST_DEPARTMENT_KEY = 'cropin_last_department';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private userSig = signal<User | null>(this.readStoredUser());
  readonly user = computed(() => this.userSig());
  readonly isLoggedIn = computed(() => this.userSig() !== null);

  readonly lastDepartment = signal<string>(this.readLastDepartment());

  private readStoredUser(): User | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private readLastDepartment(): string {
    try {
      return sessionStorage.getItem(LAST_DEPARTMENT_KEY) ?? '';
    } catch {
      return '';
    }
  }

  async login(department: string, name: string): Promise<User> {
    const user = await firstValueFrom(
      this.http.post<User>(`${API_BASE}/auth/login`, { department, name })
    );
    this.userSig.set(user);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.lastDepartment.set(department);
    sessionStorage.setItem(LAST_DEPARTMENT_KEY, department);
    return user;
  }

  logout(): void {
    this.userSig.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
    // lastDepartment is intentionally left in place — see comment above.
  }
}
