import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from './http-error';

/**
 * Token-generation URLs per environment. Fixed to the "cropin" realm —
 * no tenant code needed to obtain a token.
 * Auth pattern: Keycloak resource-owner-password-credentials grant.
 */
export const TOKEN_URLS: Record<string, string> = {
  QA: 'https://v2sso-gcp.cropin.co.in/auth/realms/cropin/protocol/openid-connect/token',
  UAT: 'https://v2sso-uat-gcp.cropin.co.in/auth/realms/cropin/protocol/openid-connect/token',
  PROD: 'https://sso.sg.cropin.in/auth/realms/cropin/protocol/openid-connect/token',
};

export const ENVIRONMENTS = Object.keys(TOKEN_URLS);

/**
 * Token-generation hosts for the dashboard's "Get Token" action — distinct from
 * TOKEN_URLS above: these use the tenant code as the realm, not the fixed
 * "cropin" realm the main meta login uses.
 */
const TENANT_TOKEN_HOSTS: Record<string, string> = {
  QA: 'https://v2sso-gcp.cropin.co.in',
  UAT: 'https://v2sso-uat-gcp.cropin.co.in',
  PROD: 'https://sso.sg.cropin.in',
};

/** Per-tenant config lookup — used only to auto-fill Base URL after a dashboard token fetch. */
const TENANT_CONFIG_HOSTS: Record<string, string> = {
  QA: 'https://intl-v2.cropin.co.in',
  UAT: 'https://intl-v2uat.cropin.co.in',
  PROD: 'https://intl-cloud.cropin.in',
};

/** Trim, strip a trailing slash, and default to https:// when no scheme was typed. */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const STORAGE_KEY = 'cropin_tenant_session';

interface TokenResponse {
  access_token?: string;
  [key: string]: unknown;
}

interface TenantConfigResponse {
  webHost?: string;
  appHost?: string;
  [key: string]: unknown;
}

/** Everything needed to restore a logged-in session across page reloads. Never includes the passcode. */
interface PersistedSession {
  accessToken: string;
  projectsToken: string;
  baseUrl: string;
  appHost: string;
  username: string;
  environment: string;
}

@Injectable({ providedIn: 'root' })
export class TenantAuthService {
  private http = inject(HttpClient);

  /** Main meta login's token — used by Load Dashboard/Load Plots (needs the meta-admin role). */
  readonly accessToken = signal<string | null>(null);
  /**
   * The sidebar "Get Token" flow's own token — used only by the live projects
   * list. Kept fully separate from accessToken: a tenant-scoped user token has
   * no meta-admin role, so if it overwrote accessToken it would break Load
   * Dashboard/Load Plots (a real bug this fixed).
   */
  readonly projectsToken = signal<string | null>(null);
  readonly authenticating = signal(false);
  readonly authError = signal('');
  /** Tenant's own app API base URL — entered manually in the dashboard. */
  readonly baseUrl = signal('');
  /** The tenant's appHost (from config lookup) — used only by the live projects list, which lives on a different host than baseUrl/webHost. */
  readonly appHost = signal('');
  readonly username = signal('');
  /** Environment for the active/restored session — set on login and on restore. */
  readonly environment = signal('');

  constructor() {
    this.restore();
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as PersistedSession;
      if (!data.accessToken) return;
      this.accessToken.set(data.accessToken);
      this.projectsToken.set(data.projectsToken || null);
      this.baseUrl.set(data.baseUrl ?? '');
      this.appHost.set(data.appHost ?? '');
      this.username.set(data.username ?? '');
      this.environment.set(data.environment ?? '');
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private persist(): void {
    const session: PersistedSession = {
      accessToken: this.accessToken() ?? '',
      projectsToken: this.projectsToken() ?? '',
      baseUrl: this.baseUrl(),
      appHost: this.appHost(),
      username: this.username(),
      environment: this.environment(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  async login(environment: string, username: string, passcode: string): Promise<void> {
    this.authenticating.set(true);
    this.authError.set('');
    this.accessToken.set(null);
    this.baseUrl.set('');
    try {
      const tokenUrl = TOKEN_URLS[environment];
      if (!tokenUrl) throw new Error(`Unknown environment: ${environment}`);

      const body = new URLSearchParams({
        username,
        password: passcode,
        grant_type: 'password',
        client_id: 'resource_server',
        client_secret: 'resource_server',
      });

      const res = await firstValueFrom(
        this.http.post<TokenResponse>(tokenUrl, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      if (!res.access_token) throw new Error('No access_token in response.');
      this.accessToken.set(res.access_token);
      this.username.set(username);
      this.environment.set(environment);
      this.persist();
    } catch (err) {
      this.authError.set(this.describeError(err));
      throw err;
    } finally {
      this.authenticating.set(false);
    }
  }

  /**
   * Dashboard-side "Get Token" — unlike login() above, this hits the tenant's
   * own realm (not the fixed "cropin" one) and stores the result in
   * projectsToken, never accessToken: a tenant-scoped user token has no
   * meta-admin role, so Load Dashboard/Load Plots must keep using whatever
   * came from the main login. Base URL is no longer fetched from here — see
   * fetchBaseUrlForTenant(), which uses the meta token instead.
   */
  async loginWithTenant(environment: string, tenant: string, username: string, passcode: string): Promise<void> {
    this.authenticating.set(true);
    this.authError.set('');
    this.projectsToken.set(null);
    try {
      const host = TENANT_TOKEN_HOSTS[environment];
      if (!host) throw new Error(`Unknown environment: ${environment}`);
      const tokenUrl = `${host}/auth/realms/${encodeURIComponent(tenant)}/protocol/openid-connect/token`;

      const body = new URLSearchParams({
        username,
        password: passcode,
        grant_type: 'password',
        client_id: 'resource_server',
        client_secret: 'resource_server',
      });

      const res = await firstValueFrom(
        this.http.post<TokenResponse>(tokenUrl, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      if (!res.access_token) throw new Error('No access_token in response.');
      this.projectsToken.set(res.access_token);
      this.username.set(username);
      this.environment.set(environment);
      this.persist();
    } catch (err) {
      this.authError.set(this.describeError(err));
      throw err;
    } finally {
      this.authenticating.set(false);
    }
  }

  /**
   * Auto-fills Base URL (and appHost, used only by the live projects list) as soon as a tenant is
   * picked — authenticated with the meta token from the main login, not the tenant-scoped one.
   * Best-effort: a failed lookup just leaves Base URL as whatever it was (the user can still type it
   * in manually).
   */
  async fetchBaseUrlForTenant(environment: string, tenant: string): Promise<void> {
    const configHost = TENANT_CONFIG_HOSTS[environment];
    const metaToken = this.accessToken();
    if (!configHost || !metaToken) return;
    try {
      const cfg = await firstValueFrom(
        this.http.get<TenantConfigResponse>(`${configHost}/${encodeURIComponent(tenant)}`, {
          headers: { accept: 'application/json, text/plain, */*', Authorization: `Bearer ${metaToken}` },
        })
      );
      if (cfg.webHost) this.setBaseUrl(cfg.webHost);
      if (cfg.appHost) {
        this.appHost.set(normalizeBaseUrl(cfg.appHost));
        this.persist();
      }
    } catch {
      // leave Base URL/appHost as-is — the user can still enter Base URL manually
    }
  }

  /**
   * The app's API base URL is entered manually in the dashboard, not auto-detected.
   * Normalized so a missing "https://" (which would silently turn every request
   * into a relative path against this app's own origin, not the real API) or a
   * stray trailing slash doesn't masquerade as a network/CORS failure.
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl.set(normalizeBaseUrl(baseUrl));
    this.persist();
  }

  /** Ends the session — explicit logout, or forced out after a 401 from a project API call. */
  logout(): void {
    this.accessToken.set(null);
    this.projectsToken.set(null);
    this.authError.set('');
    this.baseUrl.set('');
    this.appHost.set('');
    this.username.set('');
    localStorage.removeItem(STORAGE_KEY);
  }

  private describeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const desc = (err.error as { error_description?: string })?.error_description;
      if (desc) return desc;
    }
    return describeHttpError(err, 'the authentication server');
  }
}
