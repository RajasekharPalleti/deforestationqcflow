import { CommonModule } from '@angular/common';
import { Component, ViewChild, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModelConfig, Plot, Stats } from '../../core/models/models';
import { ConfigService } from '../../core/services/config';
import { PlotsService } from '../../core/services/plots';
import { WorkspaceService } from '../../core/services/workspace';
import { ReviewTable } from '../../shared/review-table/review-table';

const SHOW_OPTIONS = ['QA Done — Pending DS', 'All Plots', 'DS Done'];

@Component({
  selector: 'app-ds-review',
  standalone: true,
  imports: [CommonModule, FormsModule, ReviewTable],
  templateUrl: './ds-review.html',
  styleUrl: './ds-review.scss',
})
export class DsReview {
  private configService = inject(ConfigService);
  private plotsService = inject(PlotsService);
  workspace = inject(WorkspaceService);

  @ViewChild(ReviewTable) reviewTable?: ReviewTable;

  showOptions = SHOW_OPTIONS;
  show = signal(SHOW_OPTIONS[0]);
  plotIdSearch = signal('');

  modelCfg = signal<ModelConfig | null>(null);
  stats = signal<Stats | null>(null);
  plots = signal<Plot[]>([]);
  loading = signal(false);
  saveMessage = signal('');

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
      const show = this.show();
      const search = this.plotIdSearch();
      if (!tenant || !project || !modelName) return;
      void version;
      this.refresh(tenant, project, modelName, show, search);
    });
  }

  private async refresh(
    tenant: string,
    project: string,
    modelName: string,
    show: string,
    search: string
  ): Promise<void> {
    this.loading.set(true);
    try {
      const stats = await this.plotsService.getStats(tenant, project, modelName);
      this.stats.set(stats);
      if (stats.total === 0) {
        this.plots.set([]);
        return;
      }

      const base: Record<string, string> = { plot_id_search: search };
      let plots: Plot[];
      if (show === 'QA Done — Pending DS') {
        plots = (await this.plotsService.getPlots(tenant, project, modelName, base)).filter(
          (p) => !['Pending', 'Auto-Approved'].includes(p.qa_status) && p.ds_status === 'Pending'
        );
      } else if (show === 'DS Done') {
        plots = (await this.plotsService.getPlots(tenant, project, modelName, base)).filter(
          (p) => !['Pending', 'Auto-Approved'].includes(p.ds_status)
        );
      } else {
        plots = await this.plotsService.getPlots(tenant, project, modelName, base);
      }
      this.plots.set(plots);
    } finally {
      this.loading.set(false);
    }
  }

  async saveProgress(): Promise<void> {
    if (!this.reviewTable) return;
    const result = await this.reviewTable.saveProgress();
    this.saveMessage.set(`Saved ${result.saved} changes.`);
    setTimeout(() => this.saveMessage.set(''), 3000);
    await this.onChanged();
  }

  async onChanged(): Promise<void> {
    const tenant = this.workspace.tenant();
    const project = this.workspace.activeProject();
    const modelName = this.workspace.modelName();
    await this.refresh(tenant, project, modelName, this.show(), this.plotIdSearch());
  }
}
