import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { ALL_STATUSES_TAB, DashboardPlot, DashboardPlotsService } from '../../core/services/dashboard-plots';
import { DashboardStats, DashboardStatsService } from '../../core/services/dashboard-stats';
import { DeforestationPublishService } from '../../core/services/deforestation-publish';
import { QcReviewService, QcStatus, ReviewOutcome, ReviewType } from '../../core/services/qc-review';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';

interface CardDef {
  key: keyof DashboardStats;
  label: string;
  color: string;
  /** Tab value sent to the plots API when this card is clicked. */
  tab: string;
}

const QC_STATUS_OPTIONS: QcStatus[] = ['DEFORESTED', 'NOT_DEFORESTED', 'INCONCLUSIVE'];
/** Only these columns open the review panel when clicked. */
const CLICKABLE_COLUMNS = new Set(['croppableAreaId', 'croppableAreaName']);
/** How many plot-id chips to show before collapsing the rest into a "+N" hover tooltip. */
const VISIBLE_REVIEW_PLOT_COUNT = 3;

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
  imports: [CommonModule, FormsModule],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  workspace = inject(WorkspaceService);
  tenantAuth = inject(TenantAuthService);
  dashboardStats = inject(DashboardStatsService);
  dashboardPlots = inject(DashboardPlotsService);
  auth = inject(AuthService);
  qcReview = inject(QcReviewService);
  deforestationPublish = inject(DeforestationPublishService);

  cards = CARDS;
  qcStatusOptions = QC_STATUS_OPTIONS;

  /** Checkbox selections, keyed by croppableAreaId so they survive page navigation. */
  private selectedPlots = signal<Map<number, DashboardPlot>>(new Map());

  /** The plot(s) currently open for review — swaps the table for the review panel in the same block. */
  reviewPlots = signal<DashboardPlot[]>([]);
  reviewQcStatus = signal<QcStatus>('DEFORESTED');
  reviewReason = signal('');
  reviewComments = signal('');
  reviewMessage = signal('');
  /** Set once this review has been submitted — locks the button until the user goes back and re-selects plots. */
  submitted = signal(false);
  /** 'success' — all recorded; 'partial' — some recorded, some rejected; 'failed' — none recorded. */
  reviewOutcome = signal<ReviewOutcome>('failed');
  /** Publish is allowed whenever at least one plot in the batch was actually recorded (success or partial). */
  reviewSucceeded = computed(() => this.reviewOutcome() !== 'failed');
  publishMessage = signal('');
  /** Set once this batch has been published — locks the button until the user goes back and re-selects plots. */
  publishedDone = signal(false);

  selectedCount = computed(() => this.selectedPlots().size);

  /** Whether every row on the current page is selected — drives the header checkbox. */
  allOnPageSelected = computed(() => {
    const rows = this.dashboardPlots.plots();
    const selected = this.selectedPlots();
    return rows.length > 0 && rows.every((r) => selected.has(r.croppableAreaId));
  });

  /** QA role reviews as "QA"; DS, Product/PM, and Others all review as "DS". */
  reviewType = computed<ReviewType>(() => (this.auth.user()?.role === 'QA' ? 'QA' : 'DS'));

  /** First few selected plots shown as chips in the review panel; the rest collapse into a hover tooltip. */
  visibleReviewPlots = computed(() => this.reviewPlots().slice(0, VISIBLE_REVIEW_PLOT_COUNT));
  overflowReviewCount = computed(() => Math.max(0, this.reviewPlots().length - VISIBLE_REVIEW_PLOT_COUNT));

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

  isClickableColumn(key: string): boolean {
    return CLICKABLE_COLUMNS.has(key);
  }

  isRowSelected(row: DashboardPlot): boolean {
    return this.selectedPlots().has(row.croppableAreaId);
  }

  toggleRowSelection(row: DashboardPlot): void {
    const next = new Map(this.selectedPlots());
    if (next.has(row.croppableAreaId)) {
      next.delete(row.croppableAreaId);
    } else {
      next.set(row.croppableAreaId, row);
    }
    this.selectedPlots.set(next);
  }

  /** Selects/deselects every row on the current page, leaving selections on other pages untouched. */
  toggleSelectAllOnPage(): void {
    const rows = this.dashboardPlots.plots();
    const next = new Map(this.selectedPlots());
    if (this.allOnPageSelected()) {
      rows.forEach((r) => next.delete(r.croppableAreaId));
    } else {
      rows.forEach((r) => next.set(r.croppableAreaId, r));
    }
    this.selectedPlots.set(next);
  }

  /** Clears every checkbox selection, across all pages. */
  clearSelection(): void {
    this.selectedPlots.set(new Map());
  }

  private resetReviewForm(): void {
    this.reviewQcStatus.set('DEFORESTED');
    this.reviewReason.set('');
    this.reviewComments.set('');
    this.reviewMessage.set('');
    this.submitted.set(false);
    this.reviewOutcome.set('failed');
    this.publishMessage.set('');
    this.publishedDone.set(false);
    this.qcReview.reset();
    this.deforestationPublish.reset();
  }

  /** Opens the review panel for a single plot (clicking its id/name cell), in place of the table. */
  openReview(plot: DashboardPlot): void {
    this.reviewPlots.set([plot]);
    this.resetReviewForm();
  }

  /** Opens the review panel for every checked row, so one QC decision applies to the whole batch. */
  openReviewForSelection(): void {
    const plots = Array.from(this.selectedPlots().values());
    if (plots.length === 0) return;
    this.reviewPlots.set(plots);
    this.resetReviewForm();
  }

  closeReview(): void {
    this.reviewPlots.set([]);
  }

  async submitReview(): Promise<void> {
    const plots = this.reviewPlots();
    const baseUrl = this.tenantAuth.baseUrl();
    const companyCode = this.workspace.tenant();
    const token = this.tenantAuth.accessToken();
    if (plots.length === 0 || !baseUrl || !companyCode || !token) return;
    try {
      const payloads = plots.map((plot) => ({
        croppableAreaId: plot.croppableAreaId,
        qcStatus: this.reviewQcStatus(),
        reason: this.reviewReason(),
        comments: this.reviewComments(),
      }));
      const result = await this.qcReview.submitReview(baseUrl, companyCode, token, this.reviewType(), payloads);
      // Lock the button either way — retrying requires going back to the list and re-selecting plots.
      this.submitted.set(true);
      this.reviewOutcome.set(result.outcome);
      this.reviewMessage.set(
        result.outcome === 'success' && plots.length > 1
          ? `Review completed for ${plots.length} plots and ready to publish.`
          : result.message
      );
      if (result.outcome !== 'failed') {
        // Drop submitted rows from the selection now that at least some were actually reviewed.
        const next = new Map(this.selectedPlots());
        plots.forEach((p) => next.delete(p.croppableAreaId));
        this.selectedPlots.set(next);
      }
      await this.dashboardPlots.goToPage(this.dashboardPlots.page());
    } catch {
      // A real HTTP/network failure — qcReview.error() already carries the message; submitted stays false.
    }
  }

  /** Available once the review has been submitted — publishes the same batch of plots. */
  async publish(): Promise<void> {
    const plots = this.reviewPlots();
    const baseUrl = this.tenantAuth.baseUrl();
    const companyCode = this.workspace.tenant();
    const token = this.tenantAuth.accessToken();
    if (plots.length === 0 || !baseUrl || !companyCode || !token) return;
    try {
      const croppableAreaIds = plots.map((plot) => plot.croppableAreaId);
      await this.deforestationPublish.publish(baseUrl, companyCode, token, croppableAreaIds);
      this.publishMessage.set(plots.length > 1 ? `Published ${plots.length} plots.` : 'Published.');
      this.publishedDone.set(true);
      await this.dashboardPlots.goToPage(this.dashboardPlots.page());
    } catch {
      // deforestationPublish.error() already carries the message
    }
  }

  prevPage(): void {
    this.dashboardPlots.prev();
  }

  nextPage(): void {
    this.dashboardPlots.next();
  }
}
