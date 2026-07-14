import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { ALL_STATUSES_TAB, DashboardPlotsService } from '../../core/services/dashboard-plots';
import { DashboardStats, DashboardStatsService } from '../../core/services/dashboard-stats';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';
import { PlotBoard } from '../../shared/plot-board/plot-board';

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

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, PlotBoard],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  workspace = inject(WorkspaceService);
  tenantAuth = inject(TenantAuthService);
  dashboardStats = inject(DashboardStatsService);
  dashboardPlots = inject(DashboardPlotsService);
  auth = inject(AuthService);

  cards = CARDS;

  /** QA and DS review from their own dedicated tabs — Overview is a read-only view for them. */
  allowReview = computed(() => {
    const role = this.auth.user()?.role;
    return role !== 'QA' && role !== 'DS';
  });

  constructor() {
    // dashboardPlots is a shared, app-wide instance — a prior visit to QA/DS Review, Publish, or a
    // different card click can leave it pointed at some other tab. Every time this page is opened,
    // default the view back to the Total Plots card rather than showing whatever was left over.
    effect(() => {
      const baseUrl = this.tenantAuth.baseUrl();
      const tenant = this.workspace.tenant();
      const token = this.tenantAuth.accessToken();
      const projectIds = this.workspace.selectedProjects();
      if (!baseUrl || !tenant || !token || projectIds.length === 0) return;
      void this.selectCard(CARDS[0]);
    });
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
}
