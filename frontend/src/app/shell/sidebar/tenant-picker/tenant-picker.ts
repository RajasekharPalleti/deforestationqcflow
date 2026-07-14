import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LiveTenantsService } from '../../../core/services/live-tenants';
import { WorkspaceService } from '../../../core/services/workspace';

/** Single-select searchable dropdown for tenant/customer — same interaction pattern as the
 *  multi-select project picker, but only one tenant can be active at a time. */
@Component({
  selector: 'app-tenant-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-picker.html',
  styleUrl: './tenant-picker.scss',
})
export class TenantPicker {
  private elementRef = inject(ElementRef);
  workspace = inject(WorkspaceService);
  liveTenants = inject(LiveTenantsService);

  open = signal(false);
  search = signal('');

  filteredTenants = computed(() => {
    const q = this.search().trim().toLowerCase();
    const items = this.liveTenants.tenants();
    return q ? items.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)) : items;
  });

  /** Shows the tenant's display name where known, falling back to the raw code (e.g. a restored session
   *  from before the tenant list finished loading). */
  selectedLabel = computed(() => {
    const code = this.workspace.tenant();
    if (!code) return '';
    const found = this.liveTenants.tenants().find((t) => t.code === code);
    return found ? found.name : code;
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

  isSelected(code: string): boolean {
    return this.workspace.tenant() === code;
  }

  select(code: string): void {
    this.workspace.setTenant(code);
    this.search.set('');
    this.close();
  }
}
