import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ALL_STATUSES_TAB, DashboardPlot, DashboardPlotsService } from '../../core/services/dashboard-plots';
import { DashboardStats, DashboardStatsService } from '../../core/services/dashboard-stats';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';

interface CardDef {
  key: keyof DashboardStats;
  label: string;
  color: string;
  /** Tab value sent to the plots API when this card is clicked. */
  tab: string;
}

const CARDS: CardDef[] = [
  { key: 'totalPlots', label: 'Total Plots', color: '#2E7D32', tab: ALL_STATUSES_TAB },
  { key: 'publishedPlots', label: 'Published', color: '#0097A7', tab: 'PUBLISHED' },
  { key: 'unpublishedPlots', label: 'Unpublished', color: '#EF6C00', tab: 'UNPUBLISHED' },
  { key: 'pendingQaPlots', label: 'Pending QA', color: '#F9A825', tab: 'PENDING_QA' },
  { key: 'qaDoneAwaitingDsPlots', label: 'QA Done / Await DS', color: '#7B1FA2', tab: 'QA_DONE_AWAIT_DS' },
  { key: 'readyToPublishPlots', label: 'Ready to Publish', color: '#76be28', tab: 'READY_TO_PUBLISH' },
];

function titleCase(s: string): string {
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  workspace = inject(WorkspaceService);
  tenantAuth = inject(TenantAuthService);
  dashboardStats = inject(DashboardStatsService);
  dashboardPlots = inject(DashboardPlotsService);

  cards = CARDS;

  /** Column list derived from whatever keys the API actually returns. */
  plotColumns = computed(() => {
    const rows = this.dashboardPlots.plots();
    return rows.length ? Object.keys(rows[0]) : [];
  });

  columnTitle(key: string): string {
    return titleCase(key);
  }

  valueFor(key: CardDef['key']): number {
    return this.dashboardStats.stats()?.[key] ?? 0;
  }

  isCardActive(card: CardDef): boolean {
    return this.dashboardPlots.tab() === card.tab;
  }

  /** Shown when a load has completed but returned zero rows — names the active filter, not a generic "nothing here yet". */
  noPlotsMessage(): string {
    const card = this.cards.find((c) => c.tab === this.dashboardPlots.tab());
    return card ? `No plots available for ${card.label}.` : 'No plots available for the selected filter.';
  }

  /** Clicking a card fetches the same plots API, filtered to that card's status(es). */
  async selectCard(card: CardDef): Promise<void> {
    const baseUrl = this.tenantAuth.baseUrl();
    const tenant = this.workspace.tenant();
    const token = this.tenantAuth.accessToken();
    const projectIds = this.workspace.selectedProjects();
    if (!baseUrl || !tenant || !token || projectIds.length === 0) return;
    try {
      await this.dashboardPlots.load(baseUrl, tenant, token, projectIds, 0, card.tab);
    } catch {
      // dashboardPlots.error() already carries the message
    }
  }

  cellValue(row: DashboardPlot, key: string): string {
    const v = (row as unknown as Record<string, unknown>)[key];
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  prevPage(): void {
    this.dashboardPlots.prev();
  }

  nextPage(): void {
    this.dashboardPlots.next();
  }
}
