import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CARD_FILTERS, ModelConfig, Plot, Stats } from '../../core/models/models';
import { ConfigService } from '../../core/services/config';
import { downloadCsv } from '../../core/services/csv';
import { PlotsService } from '../../core/services/plots';
import { WorkspaceService } from '../../core/services/workspace';
import { StatCards } from '../../shared/stat-cards/stat-cards';

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCards],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  private configService = inject(ConfigService);
  private plotsService = inject(PlotsService);
  workspace = inject(WorkspaceService);

  modelCfg = signal<ModelConfig | null>(null);
  stats = signal<Stats | null>(null);
  plots = signal<Plot[]>([]);
  loading = signal(false);
  filtersExpanded = signal(false);

  detectionFilter = signal('All');
  publishFilter = signal('All');
  qaFilter = signal('All');
  plotIdSearch = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  detectionOptions = computed(() =>
    this.workspace.modelName() === 'Deforestation' ? ['All', 'Deforested', 'Not Deforested'] : ['All']
  );
  qaOptions = computed(() => ['All', ...(this.modelCfg()?.qa_statuses ?? [])]);
  reviewColumns = computed(() => this.modelCfg()?.review_columns ?? []);
  reviewColumnTitles = computed(() => this.reviewColumns().map(titleCase));

  constructor() {
    // Reload model config whenever the selected model changes.
    effect(() => {
      const modelName = this.workspace.modelName();
      if (!modelName) return;
      this.configService.getConfig().then((cfg) => this.modelCfg.set(cfg.models[modelName]));
    });

    // When a stat card is clicked, seed the filter bar from CARD_FILTERS and expand it.
    effect(() => {
      const active = this.workspace.activeCard();
      const preset = active ? CARD_FILTERS[active] ?? {} : {};
      this.detectionFilter.set(preset.detection_status ?? 'All');
      this.publishFilter.set(preset.publish_status ?? 'All');
      this.qaFilter.set(preset.qa_status ?? 'All');
      this.filtersExpanded.set(!!active);
    });

    // Refetch whenever workspace or filters change.
    effect(() => {
      const tenant = this.workspace.tenant();
      const project = this.workspace.activeProject();
      const modelName = this.workspace.modelName();
      const version = this.workspace.dataVersion();
      const activeCard = this.workspace.activeCard();
      const detection = this.detectionFilter();
      const publish = this.publishFilter();
      const qa = this.qaFilter();
      const search = this.plotIdSearch();
      const from = this.dateFrom();
      const to = this.dateTo();
      if (!tenant || !project || !modelName) return;
      void version;
      this.refresh(tenant, project, modelName, activeCard, {
        detection_status: detection,
        publish_status: publish,
        qa_status: qa,
        plot_id_search: search,
        date_from: from,
        date_to: to,
      });
    });
  }

  private async refresh(
    tenant: string,
    project: string,
    modelName: string,
    activeCard: string | null,
    filters: Record<string, string>
  ): Promise<void> {
    this.loading.set(true);
    try {
      const stats = await this.plotsService.getStats(tenant, project, modelName);
      this.stats.set(stats);
      if (stats.total === 0) {
        this.plots.set([]);
        return;
      }
      let plots = await this.plotsService.getPlots(tenant, project, modelName, filters);
      if (activeCard === 'qa_done') {
        plots = plots.filter((p) => !['Pending', 'Auto-Approved'].includes(p.qa_status) && p.ds_status === 'Pending');
      } else if (activeCard === 'ready_publish') {
        plots = plots.filter((p) => p.final_status && p.publish_status === 'unpublished');
      }
      this.plots.set(plots);
    } finally {
      this.loading.set(false);
    }
  }

  clearFilters(): void {
    this.detectionFilter.set('All');
    this.publishFilter.set('All');
    this.qaFilter.set('All');
    this.plotIdSearch.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.workspace.clearActiveCard();
  }

  rowData(p: Plot): Record<string, unknown> {
    const md = JSON.parse(p.model_data || '{}');
    const row: Record<string, unknown> = {
      'Plot ID': p.plot_id,
      'Farmer ID': p.farmer_id,
      Farmer: p.farmer_name,
      Lat: p.lat,
      Lon: p.lon,
      Detection: p.detection_status,
      Flag: p.pipeline_flag,
      Publish: p.publish_status,
      'QA Status': p.qa_status,
      'DS Status': p.ds_status,
      'Final Status': p.final_status || '—',
    };
    for (const col of this.reviewColumns()) {
      row[titleCase(col)] = md[col] ?? '—';
    }
    return row;
  }

  tableRows = computed(() => this.plots().map((p) => this.rowData(p)));
  tableColumns = computed(() => (this.tableRows().length ? Object.keys(this.tableRows()[0]) : []));

  downloadCsv(): void {
    const t = this.workspace.tenant();
    const p = this.workspace.activeProject();
    const m = this.workspace.modelName();
    downloadCsv(this.tableRows(), `${t}_${p}_${m}_plots.csv`);
  }
}
