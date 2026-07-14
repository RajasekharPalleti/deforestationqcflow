import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { DashboardPlotsService } from '../../core/services/dashboard-plots';
import { DashboardStatsService } from '../../core/services/dashboard-stats';
import { LiveProjectsService } from '../../core/services/live-projects';
import { LiveTenantsService } from '../../core/services/live-tenants';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';
import { ProjectPicker } from './project-picker/project-picker';
import { TenantPicker } from './tenant-picker/tenant-picker';

interface NavItem {
  path: string;
  label: string;
}

const ALL_NAV: NavItem[] = [
  { path: '/overview', label: '📊 Overview' },
  { path: '/qa-review', label: '✅ QA Review' },
  { path: '/ds-review', label: '🔬 DS Review' },
  { path: '/publish', label: '🚀 Publish' },
  { path: '/activity', label: '📋 Activity Log' },
];

/** Only one model exists right now — hardcoded here so the sidebar doesn't
 * need to hit /api/config just to populate a single-option dropdown. */
const MODEL_NAME = 'Deforestation';
const MODEL_ICON = '🪓';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ProjectPicker, TenantPicker],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  private router = inject(Router);
  auth = inject(AuthService);
  workspace = inject(WorkspaceService);
  tenantAuth = inject(TenantAuthService);
  dashboardStats = inject(DashboardStatsService);
  dashboardPlots = inject(DashboardPlotsService);
  liveProjects = inject(LiveProjectsService);
  liveTenants = inject(LiveTenantsService);

  syncing = signal(false);
  syncMessage = signal('');

  /** Live-edited base URL text — only committed on blur/Enter. */
  baseUrlInput = signal(this.tenantAuth.baseUrl());

  /** Username/password to (re)generate a token without leaving the dashboard — never persisted. */
  usernameInput = signal(this.tenantAuth.username());
  passwordInput = signal('');
  showPassword = signal(false);

  canFetchToken = computed(
    () =>
      !!this.usernameInput().trim() &&
      !!this.passwordInput() &&
      !!this.workspace.tenant() &&
      !this.tenantAuth.authenticating()
  );

  modelKeys = [MODEL_NAME];

  /** Identifies the last tenant/baseUrl/project-selection combo actually loaded — lets the auto-load
   *  effect below tell "nothing to do" apart from "selection changed, reload", without looping on its
   *  own syncing() flag. */
  private lastLoadedKey: string | null = null;

  /**
   * Load Dashboard / Load Plots are only meaningful once auth, tenant, and base
   * URL are all in place — and at least one project id is entered, since the
   * real API 500s on an empty projectIds array (that failure otherwise looks
   * like a generic network/CORS error to the user).
   */
  canLoadDashboard = computed(
    () =>
      !!this.tenantAuth.accessToken() &&
      !!this.workspace.tenant() &&
      !!this.tenantAuth.baseUrl() &&
      this.workspace.selectedProjects().length > 0
  );

  navItems = computed<NavItem[]>(() => {
    const role = this.auth.user()?.role;
    if (role === 'QA') return [ALL_NAV[0], ALL_NAV[1], ALL_NAV[4]];
    if (role === 'DS') return [ALL_NAV[0], ALL_NAV[2], ALL_NAV[3], ALL_NAV[4]];
    const items = [...ALL_NAV]; // PM and OTHER see everything
    if (role === 'PM') items.push({ path: '/manage-users', label: '👥 Manage Users' });
    return items;
  });

  constructor() {
    // The meta-admin token from the main login also lists every tenant/customer,
    // for the tenant picker dropdown — same token Load Dashboard/Load Plots use.
    effect(() => {
      const token = this.tenantAuth.accessToken();
      const env = this.workspace.environment();
      if (token && env) {
        void this.liveTenants.fetchTenants(env, token);
      } else {
        this.liveTenants.reset();
      }
    });

    // Picking a different tenant invalidates whatever was loaded for the old one —
    // mirrors the previous manual-entry commitTenant() reset, now reacting to the
    // workspace signal directly since selection happens inside TenantPicker.
    let previousTenant = this.workspace.tenant();
    effect(() => {
      const tenant = this.workspace.tenant();
      if (tenant === previousTenant) return;
      previousTenant = tenant;
      this.dashboardStats.reset();
      this.dashboardPlots.reset();
      this.liveProjects.reset();
    });

    // Base URL is looked up automatically as soon as a tenant is picked, using the
    // meta token from the main login — no separate username/password step needed for it.
    let lastBaseUrlFetchKey = '';
    effect(() => {
      const token = this.tenantAuth.accessToken();
      const env = this.workspace.environment();
      const tenant = this.workspace.tenant();
      if (!token || !env || !tenant) return;
      const key = `${env}|${tenant}`;
      if (key === lastBaseUrlFetchKey) return;
      lastBaseUrlFetchKey = key;
      void this.tenantAuth.fetchBaseUrlForTenant(env, tenant).then(() => {
        this.baseUrlInput.set(this.tenantAuth.baseUrl());
      });
    });

    // Once the sidebar's Get Token has run AND appHost is known (from the
    // tenant config lookup — a different host than Base URL/webHost), pull
    // the tenant's real projects for the picker dropdown. Uses projectsToken,
    // not accessToken — the projects list needs a tenant-scoped token, not
    // the main login's meta-admin one.
    effect(() => {
      const token = this.tenantAuth.projectsToken();
      const appHost = this.tenantAuth.appHost();
      if (token && appHost) {
        this.liveProjects.fetchProjects(appHost, token);
      } else {
        this.liveProjects.reset();
      }
    });

    // Auto-load the dashboard/plots on demand — as soon as everything needed is in
    // place, and again every time the project selection (or tenant/base URL) actually
    // changes, so picking projects in the picker refreshes the dashboard without the
    // user having to click Load Deforestation Dashboard by hand. Keyed on the inputs
    // that matter (not on syncing()) so finishing a load doesn't re-trigger itself.
    effect(() => {
      if (!this.canLoadDashboard() || this.syncing()) return;
      const key = [
        this.workspace.tenant(),
        this.tenantAuth.baseUrl(),
        [...this.workspace.selectedProjects()].sort().join(','),
      ].join('|');
      if (key === this.lastLoadedKey) return;
      this.lastLoadedKey = key;
      void this.loadDeforestationDashboard();
    });
  }

  ngOnInit(): void {
    if (!this.workspace.modelName()) {
      this.workspace.setModel(MODEL_NAME);
    }

    // The sidebar can mount from a hard page reload that skips the tenant-login
    // screen entirely (the guard just sees a still-valid restored session) —
    // re-apply the environment that goes with that restored session.
    if (this.tenantAuth.accessToken() && this.tenantAuth.environment()) {
      this.workspace.setEnvironment(this.tenantAuth.environment());
    }
  }

  onBaseUrlInput(raw: string): void {
    this.baseUrlInput.set(raw.trim());
  }

  commitBaseUrl(): void {
    if (this.baseUrlInput() !== this.tenantAuth.baseUrl()) {
      this.tenantAuth.setBaseUrl(this.baseUrlInput());
      this.baseUrlInput.set(this.tenantAuth.baseUrl());
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  /**
   * Fetches a fresh token scoped to the tenant already entered in the sidebar
   * (a different realm/host than the main meta login) — used for the live
   * projects list. Base URL is unrelated to this now; it's fetched separately
   * via the meta token as soon as a tenant is picked.
   */
  async fetchToken(): Promise<void> {
    if (!this.canFetchToken()) return;
    try {
      await this.tenantAuth.loginWithTenant(
        this.workspace.environment(),
        this.workspace.tenant(),
        this.usernameInput().trim(),
        this.passwordInput()
      );
      this.passwordInput.set('');
    } catch {
      // tenantAuth.authError() already carries the message
    }
  }

  onModelChange(modelName: string): void {
    this.workspace.setModel(modelName);
  }

  modelIcon(key: string): string {
    return key === MODEL_NAME ? MODEL_ICON : '';
  }

  /** Fetches real dashboard stats for the entered project ids, shown as cards on Overview. */
  private async loadDashboard(): Promise<void> {
    try {
      await this.dashboardStats.load(
        this.tenantAuth.baseUrl(),
        this.workspace.tenant(),
        this.tenantAuth.accessToken()!,
        this.workspace.selectedProjects()
      );
    } catch {
      // dashboardStats.error() already carries the message
    }
  }

  /** Fetches page 0 of the real plot list for the entered project ids, shown as a table on Overview. */
  private async loadPlots(): Promise<void> {
    try {
      await this.dashboardPlots.load(
        this.tenantAuth.baseUrl(),
        this.workspace.tenant(),
        this.tenantAuth.accessToken()!,
        this.workspace.selectedProjects(),
        0
      );
    } catch {
      // dashboardPlots.error() already carries the message
    }
  }

  /** Single sidebar action — loads both the summary cards and the plot list together. */
  async loadDeforestationDashboard(): Promise<void> {
    if (!this.canLoadDashboard()) return;
    this.syncing.set(true);
    this.syncMessage.set('');
    try {
      await Promise.all([this.loadDashboard(), this.loadPlots()]);
      this.syncMessage.set('Loaded.');
      setTimeout(() => this.syncMessage.set(''), 2500);
    } finally {
      this.syncing.set(false);
    }
  }

  backToMain(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
