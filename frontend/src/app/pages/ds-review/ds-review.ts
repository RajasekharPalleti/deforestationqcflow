import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DashboardStatsService } from '../../core/services/dashboard-stats';
import { WorkspaceService } from '../../core/services/workspace';
import { PlotBoard } from '../../shared/plot-board/plot-board';

/** Tab sent to the plots API — restricts this page to plots QA has already cleared, awaiting DS review. */
const QA_DONE_AWAIT_DS_TAB = 'QA_DONE_AWAIT_DS';

@Component({
  selector: 'app-ds-review',
  standalone: true,
  imports: [CommonModule, PlotBoard],
  templateUrl: './ds-review.html',
  styleUrl: './ds-review.scss',
})
export class DsReview {
  workspace = inject(WorkspaceService);
  dashboardStats = inject(DashboardStatsService);

  fixedTab = QA_DONE_AWAIT_DS_TAB;
}
