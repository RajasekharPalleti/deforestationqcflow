import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityService } from '../../core/services/activity';
import { AuthService } from '../../core/services/auth';
import { DashboardPlot, DashboardPlotsService, PlotFilters } from '../../core/services/dashboard-plots';
import { DeforestationPublishService, PublishOutcome } from '../../core/services/deforestation-publish';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';

/** Tab sent to the plots API — plots QA/DS have already cleared and are awaiting publish. */
const READY_TO_PUBLISH_TAB = 'READY_TO_PUBLISH';

/** Only these columns open the confirm dialog directly when clicked. */
const CLICKABLE_COLUMNS = new Set(['croppableAreaId', 'croppableAreaName']);
/** How many plot rows to show in the confirm dialog before collapsing the rest into a "+N" hover tooltip. */
const VISIBLE_CONFIRM_PLOT_COUNT = 2;
const DEFORESTATION_STATUS_OPTIONS = ['ALL', 'DEFORESTED', 'NOT_DEFORESTED'];
const FILTER_QC_STATUS_OPTIONS = ['ALL', 'PENDING', 'DEFORESTED', 'NOT_DEFORESTED', 'INCONCLUSIVE'];
const PUBLISH_STATUS_OPTIONS = ['ALL', 'PUBLISHED', 'UNPUBLISHED'];

function titleCase(s: string): string {
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

/** <input type="date"> gives YYYY-MM-DD — the API wants an ISO timestamp, e.g. 2026-07-01T00:00:00.000Z. */
function toApiDate(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

/** One failed plot, enriched with its name for display (the API only returns the id). */
interface FailedPlotDisplay {
  croppableAreaId: number;
  croppableAreaName: string;
  errorMessage: string;
}

/**
 * Standalone "Ready to Publish" list + confirm-before-publish flow — separate
 * from PlotBoard's review panel so publishing isn't tangled up with reviewing.
 * Gets its own DashboardPlotsService instance (see `providers` below) so its
 * plot list/page/tab don't collide with a PlotBoard on the same page.
 */
@Component({
  selector: 'app-publish-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publish-board.html',
  styleUrl: './publish-board.scss',
  providers: [DashboardPlotsService],
})
export class PublishBoard {
  workspace = inject(WorkspaceService);
  tenantAuth = inject(TenantAuthService);
  dashboardPlots = inject(DashboardPlotsService);
  deforestationPublish = inject(DeforestationPublishService);
  private auth = inject(AuthService);
  private activityService = inject(ActivityService);

  /** Checkbox selections, keyed by croppableAreaId so they survive page navigation. */
  private selectedPlots = signal<Map<number, DashboardPlot>>(new Map());
  selectedCount = computed(() => this.selectedPlots().size);
  selectedList = computed(() => Array.from(this.selectedPlots().values()));

  /**
   * The plot(s) the confirm dialog is actually about — set either from the checkbox
   * selection ("Publish Selected") or a single plot clicked directly, same pattern as
   * PlotBoard's reviewPlots vs. its checkbox selection. Kept separate from
   * selectedPlots so a direct click doesn't disturb the user's checkbox state.
   */
  confirmTargets = signal<DashboardPlot[]>([]);
  /** First few confirm-dialog plots shown directly; the rest collapse into a hover tooltip. */
  visibleConfirmPlots = computed(() => this.confirmTargets().slice(0, VISIBLE_CONFIRM_PLOT_COUNT));
  overflowConfirmPlots = computed(() => this.confirmTargets().slice(VISIBLE_CONFIRM_PLOT_COUNT));
  overflowConfirmCount = computed(() => this.overflowConfirmPlots().length);

  /** Shows the "are you sure" dialog listing exactly what's about to be published. */
  confirming = signal(false);
  resultMessage = signal('');
  resultOutcome = signal<PublishOutcome>('failed');
  resultOk = computed(() => this.resultOutcome() === 'success');
  /** Per-plot failures from the last publish attempt — empty when everything succeeded. */
  failedPlots = signal<FailedPlotDisplay[]>([]);

  plotColumns = computed(() => {
    const rows = this.dashboardPlots.plots();
    return rows.length ? Object.keys(rows[0]) : [];
  });

  /** Filter panel — draft values, only sent to the API once "Filter Data" is clicked. */
  deforestationStatusOptions = DEFORESTATION_STATUS_OPTIONS;
  qcFilterStatusOptions = FILTER_QC_STATUS_OPTIONS;
  publishStatusOptions = PUBLISH_STATUS_OPTIONS;
  caNameDraft = signal('');
  deforestationStatusDraft = signal('ALL');
  qcStatusDraft = signal('ALL');
  publishStatusDraft = signal('ALL');
  fromDateDraft = signal('');
  toDateDraft = signal('');

  /** Whether every row on the current (server-filtered) page is selected — drives the header checkbox. */
  allOnPageSelected = computed(() => {
    const rows = this.dashboardPlots.plots();
    const selected = this.selectedPlots();
    return rows.length > 0 && rows.every((r) => selected.has(r.croppableAreaId));
  });

  constructor() {
    // Loads as soon as auth/tenant/projects are in place — no button needed to see what's ready.
    effect(() => {
      const baseUrl = this.tenantAuth.baseUrl();
      const token = this.tenantAuth.accessToken();
      const tenant = this.workspace.tenant();
      const projectIds = this.workspace.selectedProjects();
      if (!baseUrl || !token || !tenant || projectIds.length === 0) return;
      if (this.dashboardPlots.loading()) return;
      if (this.dashboardPlots.hasLoaded() && this.dashboardPlots.tab() === READY_TO_PUBLISH_TAB) return;
      void this.dashboardPlots.load(baseUrl, tenant, token, projectIds, 0, READY_TO_PUBLISH_TAB);
    });
  }

  columnTitle(key: string): string {
    return titleCase(key);
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

  clearSelection(): void {
    this.selectedPlots.set(new Map());
  }

  prevPage(): void {
    this.dashboardPlots.prev();
  }

  nextPage(): void {
    this.dashboardPlots.next();
  }

  /** Re-fetches the current page from the API — lets the user pull fresh results after a publish lands. */
  refreshList(): void {
    void this.dashboardPlots.goToPage(this.dashboardPlots.page());
  }

  /** Sends the current filter panel draft to the API, replacing whatever's currently loaded (page resets to 0). */
  applyFilters(): void {
    const baseUrl = this.tenantAuth.baseUrl();
    const tenant = this.workspace.tenant();
    const token = this.tenantAuth.accessToken();
    const projectIds = this.workspace.selectedProjects();
    if (!baseUrl || !tenant || !token || projectIds.length === 0) return;
    const filters: PlotFilters = {
      croppableAreaName: this.caNameDraft(),
      deforestationStatus: this.deforestationStatusDraft(),
      qcStatus: this.qcStatusDraft(),
      publishStatus: this.publishStatusDraft(),
      fromLastRunDate: this.fromDateDraft() ? toApiDate(this.fromDateDraft()) : undefined,
      toLastRunDate: this.toDateDraft() ? toApiDate(this.toDateDraft()) : undefined,
    };
    void this.dashboardPlots.load(baseUrl, tenant, token, projectIds, 0, READY_TO_PUBLISH_TAB, filters);
  }

  /** Resets every filter field and reloads unfiltered. */
  clearFilters(): void {
    this.caNameDraft.set('');
    this.deforestationStatusDraft.set('ALL');
    this.qcStatusDraft.set('ALL');
    this.publishStatusDraft.set('ALL');
    this.fromDateDraft.set('');
    this.toDateDraft.set('');
    this.applyFilters();
  }

  /** Opens the "are you sure" dialog for the checked rows. */
  openConfirm(): void {
    if (this.selectedCount() === 0) return;
    this.openConfirmFor(this.selectedList());
  }

  /** Opens the "are you sure" dialog for one plot clicked directly — no checkbox needed, same as review's single-plot click. */
  openConfirmForPlot(plot: DashboardPlot): void {
    this.openConfirmFor([plot]);
  }

  private openConfirmFor(plots: DashboardPlot[]): void {
    if (plots.length === 0) return;
    this.confirmTargets.set(plots);
    this.resultMessage.set('');
    this.failedPlots.set([]);
    this.deforestationPublish.reset();
    this.confirming.set(true);
  }

  cancelConfirm(): void {
    this.confirming.set(false);
  }

  async confirmPublish(): Promise<void> {
    const plots = this.confirmTargets();
    const baseUrl = this.tenantAuth.baseUrl();
    const companyCode = this.workspace.tenant();
    const token = this.tenantAuth.accessToken();
    if (plots.length === 0 || !baseUrl || !companyCode || !token) return;
    try {
      const croppableAreaIds = plots.map((p) => p.croppableAreaId);
      const result = await this.deforestationPublish.publish(baseUrl, companyCode, token, croppableAreaIds);
      const nameById = new Map(plots.map((p) => [p.croppableAreaId, p.croppableAreaName]));
      this.failedPlots.set(
        result.failedPlots.map((f) => ({
          croppableAreaId: f.croppableAreaId,
          croppableAreaName: nameById.get(f.croppableAreaId) ?? String(f.croppableAreaId),
          errorMessage: f.errorMessage || f.errorCode || 'Failed to publish.',
        }))
      );
      this.resultOutcome.set(result.outcome);
      this.resultMessage.set(
        result.outcome === 'success'
          ? plots.length > 1
            ? `✅ Published ${plots.length} plots.`
            : '✅ Published.'
          : result.outcome === 'partial'
            ? `⚠️ Published ${result.successCount} of ${plots.length} plots — ${result.failedCount} failed.`
            : `❌ ${result.message}`
      );
      this.confirming.set(false);

      // Real per-plot activity trail — unlike review, the publish API tells us exactly which plots
      // failed and why, so each entry logs its own actual outcome instead of one shared batch result.
      const username = this.auth.user()?.username ?? '';
      const project = this.workspace.selectedProjects().join(',');
      const failedById = new Map(result.failedPlots.map((f) => [f.croppableAreaId, f]));
      for (const plot of plots) {
        const failure = failedById.get(plot.croppableAreaId);
        void this.activityService.logActivity({
          tenant: companyCode,
          project,
          model_name: this.workspace.modelName(),
          plot_id: plot.croppableAreaName,
          username,
          action: failure ? 'Publish Failed' : 'Publish',
          details: failure ? failure.errorMessage || failure.errorCode || 'Failed to publish.' : 'Published.',
        });
      }
      if (result.outcome !== 'failed') {
        // Drop only the plots that actually published — failed ones stay selected so the user can retry.
        const failedIds = new Set(result.failedPlots.map((f) => f.croppableAreaId));
        const next = new Map(this.selectedPlots());
        plots.forEach((p) => {
          if (!failedIds.has(p.croppableAreaId)) next.delete(p.croppableAreaId);
        });
        this.selectedPlots.set(next);
      }
      await this.dashboardPlots.goToPage(this.dashboardPlots.page());
    } catch {
      this.resultOutcome.set('failed');
      this.resultMessage.set(this.deforestationPublish.error() || 'Publish failed. Please try again.');
      this.confirming.set(false);
    }
  }
}
