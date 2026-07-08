import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * SSO base URLs per environment.
 * Source: cropin_automation_techops project, static/js/execution.js — SSO_CONFIG.
 * Auth pattern: Keycloak resource-owner-password-credentials grant.
 */
export const SSO_BASE_URLS: Record<string, string> = {
  QA: 'https://v2sso-gcp.cropin.co.in',
  UAT: 'https://v2sso-uat-gcp.cropin.co.in',
  PROD: 'https://sso.sg.cropin.in',
};

export const ENVIRONMENTS = Object.keys(SSO_BASE_URLS);

/**
 * Tenant-config lookup hosts and fallbacks for auto-resolving the app's own
 * API base URL (appHost) after login — no manual entry needed.
 * Source: cropin_automation_techops project, static/js/deforestation.js — doLogin().
 */
const CONFIG_HOST: Record<string, string> = {
  QA: 'https://intl-v2.cropin.co.in',
  UAT: 'https://intl-v2uat.cropin.co.in',
};
const FALLBACK_HOST: Record<string, string> = {
  QA: 'https://au-v2-gcp.cropin.co.in',
  UAT: 'https://au-v2uat-gcp.cropin.co.in',
  PROD: 'https://cloud.cropin.in',
};

const STORAGE_KEY = 'cropin_tenant_session';

interface TokenResponse {
  access_token?: string;
  [key: string]: unknown;
}

interface TenantConfigResponse {
  appHost?: string;
  [key: string]: unknown;
}

/** Everything needed to restore a logged-in session across page reloads. Never includes the passcode. */
interface PersistedSession {
  accessToken: string;
  baseUrl: string;
  username: string;
  environment: string;
  tenant: string;
}

@Injectable({ providedIn: 'root' })
export class TenantAuthService {
  private http = inject(HttpClient);

  readonly accessToken = signal<string | null>(null);
  readonly authenticating = signal(false);
  readonly authError = signal('');
  /** Tenant's own app API base URL — resolved automatically after login. */
  readonly baseUrl = signal('');
  readonly username = signal('');
  /** Environment/tenant restored from a persisted session — read once by the sidebar on startup. */
  readonly restoredEnvironment = signal('');
  readonly restoredTenant = signal('');

  constructor() {
    this.restore();
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as PersistedSession;
      if (!data.accessToken || !data.baseUrl) return;
      this.accessToken.set(data.accessToken);
      this.baseUrl.set(data.baseUrl);
      this.username.set(data.username ?? '');
      this.restoredEnvironment.set(data.environment ?? '');
      this.restoredTenant.set(data.tenant ?? '');
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private persist(environment: string, tenant: string): void {
    const session: PersistedSession = {
      accessToken: this.accessToken() ?? '',
      baseUrl: this.baseUrl(),
      username: this.username(),
      environment,
      tenant,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  async login(environment: string, tenant: string, username: string, passcode: string): Promise<void> {
    this.authenticating.set(true);
    this.authError.set('');
    this.accessToken.set(null);
    this.baseUrl.set('');
    try {
      const ssoBase = SSO_BASE_URLS[environment];
      if (!ssoBase) throw new Error(`Unknown environment: ${environment}`);

      const body = new URLSearchParams({
        username,
        password: passcode,
        grant_type: 'password',
        client_id: 'resource_server',
        client_secret: 'resource_server',
      });

      const res = await firstValueFrom(
        this.http.post<TokenResponse>(
          `${ssoBase}/auth/realms/${encodeURIComponent(tenant)}/protocol/openid-connect/token`,
          body.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        )
      );

      if (!res.access_token) throw new Error('No access_token in response.');
      this.accessToken.set(res.access_token);
      this.username.set(username);

      this.baseUrl.set(await this.resolveBaseUrl(environment, tenant));
      this.persist(environment, tenant);
    } catch (err) {
      this.authError.set(this.describeError(err));
      throw err;
    } finally {
      this.authenticating.set(false);
    }
  }

  /** Auto-resolve the tenant's app host — PROD is fixed, QA/UAT look it up, falling back on failure. */
  private async resolveBaseUrl(environment: string, tenant: string): Promise<string> {
    if (environment === 'PROD') return FALLBACK_HOST['PROD'];

    const configHost = CONFIG_HOST[environment];
    if (configHost) {
      try {
        const cfg = await firstValueFrom(
          this.http.get<TenantConfigResponse>(`${configHost}/${encodeURIComponent(tenant)}`, {
            headers: { accept: 'application/json, text/plain, */*', 'accept-language': 'en-GB,en;q=0.5' },
          })
        );
        if (cfg.appHost) return cfg.appHost.replace(/\/$/, '');
      } catch {
        // fall through to the hardcoded fallback host below
      }
    }
    return FALLBACK_HOST[environment] ?? FALLBACK_HOST['QA'];
  }

  /** Ends the session — explicit logout, or forced out after a 401 from a project API call. */
  logout(): void {
    this.accessToken.set(null);
    this.authError.set('');
    this.baseUrl.set('');
    this.username.set('');
    localStorage.removeItem(STORAGE_KEY);
  }

  private describeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const desc = (err.error as { error_description?: string })?.error_description;
      if (desc) return desc;
      if (err.status === 0) return 'Could not reach the authentication server (network/CORS error).';
      return `Auth failed: ${err.status} ${err.statusText}`;
    }
    return err instanceof Error ? err.message : 'Authentication failed.';
  }
}
