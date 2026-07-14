import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { DashboardPlot, DashboardPlotsService } from '../../core/services/dashboard-plots';
import { QcReviewService, QcStatus, ReviewOutcome, ReviewType } from '../../core/services/qc-review';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';

const QC_STATUS_OPTIONS: QcStatus[] = ['DEFORESTED', 'NOT_DEFORESTED', 'INCONCLUSIVE'];
const REASON_OPTIONS: string[] = [
  'Forest Boundary',
  'Plantation',
  'Cloud Issue',
  'No Change Visible',
  'Urban / Built-up Area',
  'Water Body Misclassification',
  'Seasonality Effect',
  'Other',
];
/** Only these columns open the review panel when clicked. */
const CLICKABLE_COLUMNS = new Set(['croppableAreaId', 'croppableAreaName']);

function titleCase(s: string): string {
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

/** Per-plot QC decision — each selected plot gets its own independent set of these. Starts blank so all three are genuinely mandatory. */
interface ReviewEditState {
  qcStatus: QcStatus | '';
  reason: string;
  comments: string;
}

type ReviewField = 'qcStatus' | 'reason' | 'comments';

/**
 * Real plot list + review panel, shared by Overview (all statuses, switchable via
 * cards) and the QA/DS Review pages (locked to one status via `fixedTab`).
 */
@Component({
  selector: 'app-plot-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plot-board.html',
  styleUrl: './plot-board.scss',
})
export class PlotBoard {
  workspace = inject(WorkspaceService);
  tenantAuth = inject(TenantAuthService);
  dashboardPlots = inject(DashboardPlotsService);
  auth = inject(AuthService);
  qcReview = inject(QcReviewService);

  /** When set, this board always loads just this tab's plots — e.g. 'PENDING_QA' for the QA Review page. */
  fixedTab = input<string | null>(null);
  /** Forces the review submission type, overriding role-based inference — set by pages scoped to one review type. */
  reviewTypeOverride = input<ReviewType | null>(null);
  /** Shown when a load has completed but returned zero rows, in place of the generic default. */
  emptyMessage = input<string>('No plots available for the selected filter.');
  /** When false, hides selection/review entirely — Overview shows QA/DS a read-only list; they review from their own tab. */
  allowReview = input<boolean>(true);

  qcStatusOptions = QC_STATUS_OPTIONS;
  reasonOptions = REASON_OPTIONS;

  /** Checkbox selections, keyed by croppableAreaId so they survive page navigation. */
  private selectedPlots = signal<Map<number, DashboardPlot>>(new Map());

  /** The plot(s) currently open for review — swaps the table for the review panel in the same block. */
  reviewPlots = signal<DashboardPlot[]>([]);
  /** Independent QC Status/Reason/Comments per plot, keyed by croppableAreaId. */
  edits = signal<Map<number, ReviewEditState>>(new Map());
  /** Set once the user has tried to submit — field-level red-border validation only shows after this. */
  attemptedSubmit = signal(false);
  /** Set when a submit attempt is blocked by missing required fields — kept separate from the API-outcome reviewMessage. */
  validationMessage = signal('');
  reviewMessage = signal('');
  /** Set once this review has been submitted — locks the button until the user goes back and re-selects plots. */
  submitted = signal(false);
  /** 'success' — all recorded; 'partial' — some recorded, some rejected; 'failed' — none recorded. */
  reviewOutcome = signal<ReviewOutcome>('failed');
  /** True once at least one plot in the batch was actually recorded (success or partial). */
  reviewSucceeded = computed(() => this.reviewOutcome() !== 'failed');

  selectedCount = computed(() => this.selectedPlots().size);

  /** Search box — filters the current page's rows by croppable area name (client-side, current page only). */
  search = signal('');

  /** Rows on the current page that match the search box, or every row when it's empty. */
  filteredPlots = computed(() => {
    const q = this.search().trim().toLowerCase();
    const rows = this.dashboardPlots.plots();
    return q ? rows.filter((r) => (r.croppableAreaName ?? '').toLowerCase().includes(q)) : rows;
  });

  /** Whether every currently-visible (filtered) row is selected — drives the header checkbox. */
  allOnPageSelected = computed(() => {
    const rows = this.filteredPlots();
    const selected = this.selectedPlots();
    return rows.length > 0 && rows.every((r) => selected.has(r.croppableAreaId));
  });

  /** QA role reviews as "QA"; DS, Product/PM, and Others all review as "DS" — unless the page forces one. */
  reviewType = computed<ReviewType>(
    () => this.reviewTypeOverride() ?? (this.auth.user()?.role === 'QA' ? 'QA' : 'DS')
  );

  /** Field label for the status dropdown — matches whichever review this board is doing. */
  statusFieldLabel = computed(() => (this.reviewType() === 'QA' ? 'QA Status' : 'DS Status'));

  /** Column list derived from whatever keys the API actually returns. */
  plotColumns = computed(() => {
    const rows = this.dashboardPlots.plots();
    return rows.length ? Object.keys(rows[0]) : [];
  });

  constructor() {
    // Pages with a fixed tab (e.g. QA Review -> 'PENDING_QA') keep the shared
    // dashboardPlots service pointed at that tab as soon as auth/tenant/projects
    // are in place — no card click needed, and it re-asserts itself if some
    // other page (or the sidebar's own all-statuses auto-load) changed the tab.
    effect(() => {
      const tab = this.fixedTab();
      if (!tab) return;
      const baseUrl = this.tenantAuth.baseUrl();
      const token = this.tenantAuth.accessToken();
      const tenant = this.workspace.tenant();
      const projectIds = this.workspace.selectedProjects();
      if (!baseUrl || !token || !tenant || projectIds.length === 0) return;
      if (this.dashboardPlots.loading()) return;
      if (this.dashboardPlots.hasLoaded() && this.dashboardPlots.tab() === tab) return;
      void this.dashboardPlots.load(baseUrl, tenant, token, projectIds, 0, tab);
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
    return this.allowReview() && CLICKABLE_COLUMNS.has(key);
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

  /** Selects/deselects every currently-visible (filtered) row, leaving selections on other pages/rows untouched. */
  toggleSelectAllOnPage(): void {
    const rows = this.filteredPlots();
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

  /** The edit state for one plot, defaulted so every field always has a valid selection. */
  editFor(id: number): ReviewEditState {
    return this.edits().get(id) ?? { qcStatus: '', reason: '', comments: '' };
  }

  updateEdit(id: number, patch: Partial<ReviewEditState>): void {
    const m = new Map(this.edits());
    m.set(id, { ...this.editFor(id), ...patch });
    this.edits.set(m);
  }

  /** True when this plot's field is empty and the user has already tried to submit — drives the red border. */
  isFieldInvalid(id: number, field: ReviewField): boolean {
    if (!this.attemptedSubmit()) return false;
    const e = this.editFor(id);
    return field === 'comments' ? !e.comments.trim() : !e[field];
  }

  private resetReviewForm(plots: DashboardPlot[]): void {
    const edits = new Map<number, ReviewEditState>();
    for (const p of plots) {
      edits.set(p.croppableAreaId, { qcStatus: '', reason: '', comments: '' });
    }
    this.edits.set(edits);
    this.attemptedSubmit.set(false);
    this.validationMessage.set('');
    this.reviewMessage.set('');
    this.submitted.set(false);
    this.reviewOutcome.set('failed');
    this.qcReview.reset();
  }

  /** Opens the review panel for a single plot (clicking its id/name cell), in place of the table. */
  openReview(plot: DashboardPlot): void {
    this.reviewPlots.set([plot]);
    this.resetReviewForm([plot]);
  }

  /** Opens the review panel for every checked row — each gets its own independent QC fields. */
  openReviewForSelection(): void {
    const plots = Array.from(this.selectedPlots().values());
    if (plots.length === 0) return;
    this.reviewPlots.set(plots);
    this.resetReviewForm(plots);
  }

  /** Returns to the table, re-fetching the current page so it reflects the latest API state. */
  closeReview(): void {
    this.reviewPlots.set([]);
    void this.dashboardPlots.goToPage(this.dashboardPlots.page());
  }

  async submitReview(): Promise<void> {
    const plots = this.reviewPlots();
    this.attemptedSubmit.set(true);
    const hasMissingField = plots.some((plot) => {
      const e = this.editFor(plot.croppableAreaId);
      return !e.qcStatus || !e.reason || !e.comments.trim();
    });
    if (hasMissingField) {
      this.validationMessage.set('Please fill in all required fields — highlighted in red below.');
      return;
    }
    this.validationMessage.set('');

    const baseUrl = this.tenantAuth.baseUrl();
    const companyCode = this.workspace.tenant();
    const token = this.tenantAuth.accessToken();
    if (plots.length === 0 || !baseUrl || !companyCode || !token) return;
    try {
      const payloads = plots.map((plot) => {
        const e = this.editFor(plot.croppableAreaId);
        return {
          croppableAreaId: plot.croppableAreaId,
          qcStatus: e.qcStatus as QcStatus,
          reason: e.reason,
          comments: e.comments,
        };
      });
      const result = await this.qcReview.submitReview(baseUrl, companyCode, token, this.reviewType(), payloads);
      // Lock the button either way — retrying requires going back to the list and re-selecting plots.
      this.submitted.set(true);
      this.reviewOutcome.set(result.outcome);
      this.reviewMessage.set(
        result.outcome === 'success' && plots.length > 1 ? `Review completed for ${plots.length} plots.` : result.message
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

  prevPage(): void {
    this.dashboardPlots.prev();
  }

  nextPage(): void {
    this.dashboardPlots.next();
  }
}
