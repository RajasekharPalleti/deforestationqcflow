import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DashboardStatsService } from '../../core/services/dashboard-stats';
import { WorkspaceService } from '../../core/services/workspace';
import { PlotBoard } from '../../shared/plot-board/plot-board';

/** Tab sent to the plots API — restricts this page to plots still awaiting QA. */
const PENDING_QA_TAB = 'PENDING_QA';

@Component({
  selector: 'app-qa-review',
  standalone: true,
  imports: [CommonModule, PlotBoard],
  templateUrl: './qa-review.html',
  styleUrl: './qa-review.scss',
})
export class QaReview {
  workspace = inject(WorkspaceService);
  dashboardStats = inject(DashboardStatsService);

  fixedTab = PENDING_QA_TAB;
}
