import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModelConfig, Plot } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';
import { ConfigService } from '../../core/services/config';
import { downloadCsv } from '../../core/services/csv';
import { PublishService, ReadyToPublish } from '../../core/services/publish';
import { WorkspaceService } from '../../core/services/workspace';

@Component({
  selector: 'app-publish',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publish.html',
  styleUrl: './publish.scss',
})
export class Publish {
  private configService = inject(ConfigService);
  private publishService = inject(PublishService);
  auth = inject(AuthService);
  workspace = inject(WorkspaceService);

  modelCfg = signal<ModelConfig | null>(null);
  data = signal<ReadyToPublish | null>(null);
  loading = signal(false);
  confirmChecked = signal(false);
  publishing = signal(false);
  successMessage = signal('');

  isPm = computed(() => this.auth.user()?.role === 'PM');

  finalStatusBreakdown = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.data()?.ready ?? []) {
      const key = p.final_status ?? 'Unknown';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  });

  tableRows = computed(() =>
    (this.data()?.ready ?? []).map((p) => ({
      'Plot ID': p.plot_id,
      Farmer: p.farmer_id,
      Detection: p.detection_status,
      'Final Status': p.final_status,
      'QA By': p.qa_user || '—',
      'DS By': p.ds_user || '—',
    }))
  );

  constructor() {
    effect(() => {
      const modelName = this.workspace.modelName();
      if (!modelName) return;
      this.configService.getConfig().then((cfg) => this.modelCfg.set(cfg.models[modelName]));
    });

    effect(() => {
      const tenant = this.workspace.tenant();
      const project = this.workspace.activeProject();
      const modelName = this.workspace.modelName();
      const version = this.workspace.dataVersion();
      if (!tenant || !project || !modelName || !this.isPm()) return;
      void version;
      this.refresh(tenant, project, modelName);
    });
  }

  private async refresh(tenant: string, project: string, modelName: string): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.publishService.getReady(tenant, project, modelName);
      this.data.set(data);
    } finally {
      this.loading.set(false);
    }
  }

  downloadCsv(): void {
    const t = this.workspace.tenant();
    const p = this.workspace.activeProject();
    const m = this.workspace.modelName();
    downloadCsv(this.tableRows(), `PublishList_${t}_${p}_${m}.csv`);
  }

  async publish(): Promise<void> {
    this.publishing.set(true);
    try {
      const result = await this.publishService.publish(
        this.workspace.tenant(),
        this.workspace.activeProject(),
        this.workspace.modelName(),
        this.auth.user()!.username
      );
      this.successMessage.set(`✅ Published ${result.published} plots.`);
      this.confirmChecked.set(false);
      this.workspace.bumpDataVersion();
      await this.refresh(this.workspace.tenant(), this.workspace.activeProject(), this.workspace.modelName());
    } finally {
      this.publishing.set(false);
    }
  }
}
