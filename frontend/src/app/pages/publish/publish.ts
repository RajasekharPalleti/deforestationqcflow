import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DashboardStatsService } from '../../core/services/dashboard-stats';
import { WorkspaceService } from '../../core/services/workspace';
import { PublishBoard } from '../../shared/publish-board/publish-board';

@Component({
  selector: 'app-publish',
  standalone: true,
  imports: [CommonModule, PublishBoard],
  templateUrl: './publish.html',
  styleUrl: './publish.scss',
})
export class Publish {
  workspace = inject(WorkspaceService);
  dashboardStats = inject(DashboardStatsService);
}
