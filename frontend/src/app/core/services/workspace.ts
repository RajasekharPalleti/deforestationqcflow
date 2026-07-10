import { Injectable, computed, signal } from '@angular/core';

export const MAX_SELECTED_PROJECTS = 5;

const TENANT_STORAGE_KEY = 'cropin_workspace_tenant';
const PROJECTS_STORAGE_KEY = 'cropin_workspace_projects';
const ACTIVE_PROJECT_STORAGE_KEY = 'cropin_workspace_active_project';

function loadPersistedProjects(): string[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly environment = signal<string>('QA');
  readonly tenant = signal<string>(localStorage.getItem(TENANT_STORAGE_KEY) ?? '');
  /** The user's shortlisted project ids — capped at MAX_SELECTED_PROJECTS, cached across refresh. */
  readonly selectedProjects = signal<string[]>(loadPersistedProjects());
  /** Which one of the selected projects currently drives the dashboard. */
  readonly activeProject = signal<string>(localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? '');
  readonly modelName = signal<string>('');
  /** Bumped after every sync so pages know to refetch. */
  readonly dataVersion = signal(0);

  readonly ready = computed(() => !!this.tenant() && !!this.activeProject() && !!this.modelName());

  bumpDataVersion(): void {
    this.dataVersion.update((v) => v + 1);
  }

  setEnvironment(environment: string): void {
    this.environment.set(environment);
  }

  setTenant(tenant: string): void {
    this.tenant.set(tenant);
    localStorage.setItem(TENANT_STORAGE_KEY, tenant);
    // Project ids are tenant-specific — clear the cached ones along with the selection.
    this.setProjects([]);
  }

  /**
   * Replaces the project id shortlist wholesale (capped at MAX_SELECTED_PROJECTS),
   * persisting it so it survives a page refresh. Keeps the current active
   * project if it's still in the list, otherwise activates the first one.
   * Pass an empty array to clear the cache entirely.
   */
  setProjects(ids: string[]): void {
    const next = ids.slice(0, MAX_SELECTED_PROJECTS);
    this.selectedProjects.set(next);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    if (!next.includes(this.activeProject())) {
      this.setActiveProject(next[0] ?? '');
    }
  }

  /**
   * Toggles one project id's membership in the shortlist — used by the
   * multi-select dropdown. Returns false (leaving state unchanged) if adding
   * would exceed MAX_SELECTED_PROJECTS.
   */
  toggleProjectSelection(id: string): boolean {
    const current = this.selectedProjects();
    if (current.includes(id)) {
      this.setProjects(current.filter((p) => p !== id));
      return true;
    }
    if (current.length >= MAX_SELECTED_PROJECTS) return false;
    this.setProjects([...current, id]);
    return true;
  }

  /** Sets the active project — used to switch which entered id drives the dashboard. */
  setActiveProject(project: string): void {
    this.activeProject.set(project);
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, project);
  }

  setModel(modelName: string): void {
    this.modelName.set(modelName);
  }
}
