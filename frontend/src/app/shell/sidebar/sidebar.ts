import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AppConfig } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';
import { ConfigService } from '../../core/services/config';
import { LiveProjectsService } from '../../core/services/live-projects';
import { PlotsService } from '../../core/services/plots';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';
import { ProjectPicker } from './project-picker/project-picker';

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

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ProjectPicker],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  private configService = inject(ConfigService);
  private plotsService = inject(PlotsService);
  private router = inject(Router);
  auth = inject(AuthService);
  workspace = inject(WorkspaceService);
  tenantAuth = inject(TenantAuthService);
  liveProjects = inject(LiveProjectsService);

  config = signal<AppConfig | null>(null);
  syncing = signal(false);
  syncMessage = signal('');

  modelKeys = computed(() => (this.config() ? Object.keys(this.config()!.models) : []));

  navItems = computed<NavItem[]>(() => {
    const role = this.auth.user()?.role;
    if (role === 'QA') return [ALL_NAV[0], ALL_NAV[1]];
    if (role === 'DS') return [ALL_NAV[0], ALL_NAV[2]];
    const items = [...ALL_NAV]; // PM and OTHER see everything
    if (role === 'PM') items.push({ path: '/manage-users', label: '👥 Manage Users' });
    return items;
  });

  constructor() {
    // Once logged in AND a base URL is resolved, pull the tenant's real projects.
    // Covers both a fresh login and a session restored from a previous page load.
    effect(() => {
      const token = this.tenantAuth.accessToken();
      const baseUrl = this.tenantAuth.baseUrl();
      if (token && baseUrl) {
        this.liveProjects.fetchProjects(baseUrl, token);
      } else {
        this.liveProjects.reset();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const cfg = await this.configService.getConfig();
    this.config.set(cfg);
    if (!this.workspace.modelName()) {
      this.workspace.setModel(Object.keys(cfg.models)[0]);
    }

    // The sidebar can mount from a hard page reload that skips the tenant-login
    // screen entirely (the guard just sees a still-valid restored session) —
    // re-apply the environment/tenant that go with that restored session.
    if (this.tenantAuth.accessToken()) {
      if (this.tenantAuth.restoredEnvironment()) {
        this.workspace.setEnvironment(this.tenantAuth.restoredEnvironment());
      }
      if (this.tenantAuth.restoredTenant()) {
        this.workspace.setTenant(this.tenantAuth.restoredTenant());
      }
    }
  }

  onModelChange(modelName: string): void {
    this.workspace.setModel(modelName);
  }

  modelIcon(key: string): string {
    return this.config()?.models[key]?.icon ?? '';
  }

  async sync(): Promise<void> {
    this.syncing.set(true);
    this.syncMessage.set('');
    try {
      await this.plotsService.sync(
        this.workspace.tenant(),
        this.workspace.activeProject(),
        this.workspace.modelName()
      );
      this.workspace.bumpDataVersion();
      this.syncMessage.set('Synced.');
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
