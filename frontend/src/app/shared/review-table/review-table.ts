import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModelConfig, Plot } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';
import { IndividualEditItem, ReviewService } from '../../core/services/review';

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

const FLAG_COLORS: Record<string, string> = {
  Flagged: '#F44336',
  Alert: '#FF9800',
  Outlier: '#FF9800',
  Clean: '#4CAF50',
  Normal: '#4CAF50',
};

interface RowEditState {
  status: string;
  reason: string;
  comments: string;
}

@Component({
  selector: 'app-review-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-table.html',
  styleUrl: './review-table.scss',
})
export class ReviewTable {
  private reviewService = inject(ReviewService);
  private auth = inject(AuthService);

  plots = input.required<Plot[]>();
  modelCfg = input.required<ModelConfig>();
  role = input.required<'QA' | 'DS'>();
  tenant = input.required<string>();
  project = input.required<string>();
  modelNameInput = input.required<string>({ alias: 'modelName' });

  changed = output<void>();

  isQa = computed(() => this.role() === 'QA');
  statuses = computed(() => (this.isQa() ? this.modelCfg().qa_statuses : this.modelCfg().ds_statuses));

  selectAll = signal(false);
  checked = signal<Set<number>>(new Set());
  bulkStatus = signal('');
  bulkReason = signal('');
  applying = signal(false);
  warning = signal('');
  success = signal('');

  edits = signal<Map<number, RowEditState>>(new Map());
  openExpanders = signal<Set<number>>(new Set());
  saveMessage = signal('');

  constructor() {
    // Reset bulk status default + per-row edit state whenever the plot list (or role) changes.
    effect(() => {
      const plots = this.plots();
      const isQa = this.isQa();
      const cfg = this.modelCfg();
      const statuses = isQa ? cfg.qa_statuses : cfg.ds_statuses;

      if (statuses.length && !statuses.includes(this.bulkStatus())) {
        this.bulkStatus.set(statuses[0]);
      }
      if (isQa && cfg.qa_reasons.length && !this.bulkReason()) {
        this.bulkReason.set(cfg.qa_reasons[0]);
      }

      const newEdits = new Map<number, RowEditState>();
      const newOpen = new Set<number>();
      for (const p of plots) {
        newEdits.set(p.id, {
          status: isQa ? p.qa_status : p.ds_status,
          reason: p.qa_reason || '',
          comments: isQa ? p.qa_comments || '' : p.ds_comments || '',
        });
        const cur = isQa ? p.qa_status : p.ds_status;
        if (['Flagged', 'Alert', 'Outlier'].includes(p.pipeline_flag) && cur === 'Pending') {
          newOpen.add(p.id);
        }
      }
      this.edits.set(newEdits);
      this.openExpanders.set(newOpen);
      this.checked.set(new Set());
      this.selectAll.set(false);
    });
  }

  flagColor(flag: string): string {
    return FLAG_COLORS[flag] ?? '#888';
  }

  rowLabel(p: Plot): string {
    const cur = this.isQa() ? p.qa_status : p.ds_status;
    return `[${p.pipeline_flag}]  ${p.plot_id} — ${p.farmer_id} — ${p.detection_status}  |  ${
      this.isQa() ? 'QA' : 'DS'
    }: ${cur}`;
  }

  modelData(p: Plot): Record<string, unknown> {
    try {
      return JSON.parse(p.model_data || '{}');
    } catch {
      return {};
    }
  }

  reviewColTitle(col: string): string {
    return titleCase(col);
  }

  isOpen(id: number): boolean {
    return this.openExpanders().has(id);
  }

  toggleOpen(id: number): void {
    const s = new Set(this.openExpanders());
    s.has(id) ? s.delete(id) : s.add(id);
    this.openExpanders.set(s);
  }

  isChecked(id: number): boolean {
    return this.checked().has(id);
  }

  toggleChecked(id: number): void {
    const s = new Set(this.checked());
    s.has(id) ? s.delete(id) : s.add(id);
    this.checked.set(s);
    this.selectAll.set(this.plots().length > 0 && s.size === this.plots().length);
  }

  toggleSelectAll(value: boolean): void {
    this.selectAll.set(value);
    this.checked.set(value ? new Set(this.plots().map((p) => p.id)) : new Set());
  }

  checkedCount = computed(() => this.checked().size);

  edit(id: number): RowEditState {
    return this.edits().get(id) ?? { status: '', reason: '', comments: '' };
  }

  updateEdit(id: number, patch: Partial<RowEditState>): void {
    const m = new Map(this.edits());
    m.set(id, { ...this.edit(id), ...patch });
    this.edits.set(m);
  }

  async applyBulk(): Promise<void> {
    this.warning.set('');
    this.success.set('');
    const ids = [...this.checked()];
    if (ids.length === 0) {
      this.warning.set('No plots selected — tick the checkboxes or use Select All first.');
      return;
    }
    this.applying.set(true);
    try {
      await this.reviewService.bulkUpdate({
        tenant: this.tenant(),
        project: this.project(),
        model_name: this.modelNameInput(),
        role: this.role(),
        username: this.auth.user()!.username,
        plot_ids: ids,
        status: this.bulkStatus(),
        reason: this.isQa() ? this.bulkReason() : undefined,
      });
      this.success.set(`✅ Applied '${this.bulkStatus()}' to ${ids.length} plots.`);
      this.checked.set(new Set());
      this.selectAll.set(false);
      this.changed.emit();
    } finally {
      this.applying.set(false);
    }
  }

  async saveProgress(): Promise<{ saved: number }> {
    const editsList: IndividualEditItem[] = this.plots().map((p) => {
      const e = this.edit(p.id);
      return { id: p.id, status: e.status, reason: e.reason, comments: e.comments };
    });
    const result = await this.reviewService.saveEdits({
      tenant: this.tenant(),
      project: this.project(),
      model_name: this.modelNameInput(),
      role: this.role(),
      username: this.auth.user()!.username,
      edits: editsList,
    });
    this.changed.emit();
    return result;
  }
}
