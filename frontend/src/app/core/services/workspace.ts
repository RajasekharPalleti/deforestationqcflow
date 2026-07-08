import { Injectable, computed, signal } from '@angular/core';

export const MAX_SELECTED_PROJECTS = 5;

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly environment = signal<string>('QA');
  readonly tenant = signal<string>('');
  /** The user's checked/shortlisted projects — capped at MAX_SELECTED_PROJECTS. */
  readonly selectedProjects = signal<string[]>([]);
  /** Which one of the selected projects currently drives the dashboard. */
  readonly activeProject = signal<string>('');
  readonly modelName = signal<string>('');
  readonly activeCard = signal<string | null>(null);
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
    this.selectedProjects.set([]);
    this.activeProject.set('');
    this.activeCard.set(null);
  }

  /**
   * Toggle a project's membership in the shortlist. Auto-manages the active project.
   * Returns false (and leaves state unchanged) if adding would exceed MAX_SELECTED_PROJECTS.
   */
  toggleProjectSelection(project: string): boolean {
    const current = this.selectedProjects();
    if (current.includes(project)) {
      const next = current.filter((p) => p !== project);
      this.selectedProjects.set(next);
      if (this.activeProject() === project) {
        this.activeProject.set(next[0] ?? '');
      }
      this.activeCard.set(null);
      return true;
    }
    if (current.length >= MAX_SELECTED_PROJECTS) {
      return false;
    }
    this.selectedProjects.set([...current, project]);
    if (!this.activeProject()) {
      this.activeProject.set(project);
    }
    this.activeCard.set(null);
    return true;
  }

  /** Sets the active project. If not already selected, adds it (unless the shortlist is full). */
  setActiveProject(project: string): void {
    if (!this.selectedProjects().includes(project)) {
      if (this.selectedProjects().length >= MAX_SELECTED_PROJECTS) return;
      this.selectedProjects.set([...this.selectedProjects(), project]);
    }
    this.activeProject.set(project);
    this.activeCard.set(null);
  }

  setModel(modelName: string): void {
    this.modelName.set(modelName);
    this.activeCard.set(null);
  }

  setActiveCard(card: string | null): void {
    this.activeCard.set(this.activeCard() === card ? null : card);
  }

  clearActiveCard(): void {
    this.activeCard.set(null);
  }
}
