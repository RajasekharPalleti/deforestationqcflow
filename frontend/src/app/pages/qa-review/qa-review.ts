import { CommonModule } from '@angular/common';
import { Component, ViewChild, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModelConfig, Plot, Stats } from '../../core/models/models';
import { ConfigService } from '../../core/services/config';
import { EvidenceService } from '../../core/services/evidence';
import { PlotsService } from '../../core/services/plots';
import { WorkspaceService } from '../../core/services/workspace';
import { ReviewTable } from '../../shared/review-table/review-table';

const SHOW_OPTIONS = ['Pending QA', 'All Unpublished', 'QA Done', 'All Plots'];

@Component({
  selector: 'app-qa-review',
  standalone: true,
  imports: [CommonModule, FormsModule, ReviewTable],
  templateUrl: './qa-review.html',
  styleUrl: './qa-review.scss',
})
export class QaReview {
  private configService = inject(ConfigService);
  private plotsService = inject(PlotsService);
  private evidenceService = inject(EvidenceService);
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
      if (show === 'Pending QA') {
        plots = await this.plotsService.getPlots(tenant, project, modelName, {
          ...base,
          qa_status: 'Pending',
          publish_status: 'unpublished',
        });
      } else if (show === 'All Unpublished') {
        plots = await this.plotsService.getPlots(tenant, project, modelName, {
          ...base,
          publish_status: 'unpublished',
        });
      } else if (show === 'QA Done') {
        plots = (await this.plotsService.getPlots(tenant, project, modelName, base)).filter(
          (p) => !['Pending', 'Auto-Approved'].includes(p.qa_status)
        );
      } else {
        plots = await this.plotsService.getPlots(tenant, project, modelName, base);
      }
      this.plots.set(plots);
    } finally {
      this.loading.set(false);
    }
  }

  async generateEvidence(): Promise<void> {
    await this.evidenceService.generateAndDownload(
      this.workspace.tenant(),
      this.workspace.activeProject(),
      this.workspace.modelName(),
      this.plots().map((p) => p.id)
    );
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
