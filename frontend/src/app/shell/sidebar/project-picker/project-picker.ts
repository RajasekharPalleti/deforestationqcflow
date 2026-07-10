import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LiveProjectsService } from '../../../core/services/live-projects';
import { MAX_SELECTED_PROJECTS, WorkspaceService } from '../../../core/services/workspace';

/** How many selected-project chips to show before collapsing the rest into "+N". */
const VISIBLE_CHIP_COUNT = 2;
/** Trigger the next lazy-load page when the scroll position is within this many px of the bottom. */
const SCROLL_THRESHOLD_PX = 40;

@Component({
  selector: 'app-project-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-picker.html',
  styleUrl: './project-picker.scss',
})
export class ProjectPicker {
  private elementRef = inject(ElementRef);
  workspace = inject(WorkspaceService);
  liveProjects = inject(LiveProjectsService);

  open = signal(false);
  search = signal('');
  limitMessage = signal('');

  maxSelected = MAX_SELECTED_PROJECTS;

  visibleChips = computed(() => this.workspace.selectedProjects().slice(0, VISIBLE_CHIP_COUNT));
  overflowCount = computed(() => Math.max(0, this.workspace.selectedProjects().length - VISIBLE_CHIP_COUNT));

  filteredProjects = computed(() => {
    const q = this.search().trim().toLowerCase();
    const items = this.liveProjects.projects();
    return q ? items.filter((p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q)) : items;
  });

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  /** Shows the project's name where known, falling back to the raw id (e.g. before its page has loaded). */
  projectLabel(id: string): string {
    const found = this.liveProjects.projects().find((p) => String(p.id) === id);
    return found ? found.name : id;
  }

  isSelected(id: string | number): boolean {
    return this.workspace.selectedProjects().includes(String(id));
  }

  toggleSelection(id: string | number, event: Event): void {
    event.stopPropagation();
    const ok = this.workspace.toggleProjectSelection(String(id));
    if (!ok) {
      // The click already flipped the native checkbox to "checked" before we could
      // reject it — force the DOM back in sync since Angular's [checked] binding
      // won't re-apply a value it thinks is unchanged.
      (event.target as HTMLInputElement).checked = false;
      this.limitMessage.set(`You can select up to ${this.maxSelected} projects.`);
      setTimeout(() => this.limitMessage.set(''), 3000);
    }
  }

  makeActive(id: string | number): void {
    if (this.isSelected(id)) {
      this.workspace.setActiveProject(String(id));
    }
  }

  clearAll(event: Event): void {
    event.stopPropagation();
    this.workspace.setProjects([]);
  }

  onListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < SCROLL_THRESHOLD_PX) {
      this.liveProjects.loadMore();
    }
  }
}
