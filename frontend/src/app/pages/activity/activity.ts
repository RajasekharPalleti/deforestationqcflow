import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivityLogEntry } from '../../core/models/models';
import { ActivityService } from '../../core/services/activity';
import { WorkspaceService } from '../../core/services/workspace';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity.html',
  styleUrl: './activity.scss',
})
export class Activity {
  private activityService = inject(ActivityService);
  workspace = inject(WorkspaceService);

  logs = signal<ActivityLogEntry[]>([]);
  loading = signal(false);
  columns = ['id', 'tenant', 'project', 'model_name', 'plot_id', 'username', 'action', 'details', 'ts'];

  constructor() {
    effect(() => {
      const tenant = this.workspace.tenant();
      const project = this.workspace.activeProject();
      const modelName = this.workspace.modelName();
      const version = this.workspace.dataVersion();
      if (!tenant || !project || !modelName) return;
      void version;
      this.refresh(tenant, project, modelName);
    });
  }

  private async refresh(tenant: string, project: string, modelName: string): Promise<void> {
    this.loading.set(true);
    try {
      this.logs.set(await this.activityService.getActivity(tenant, project, modelName));
    } finally {
      this.loading.set(false);
    }
  }

  cell(log: ActivityLogEntry, col: string): unknown {
    return (log as unknown as Record<string, unknown>)[col];
  }
}
