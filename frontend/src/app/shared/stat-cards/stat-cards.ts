import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Stats } from '../../core/models/models';
import { WorkspaceService } from '../../core/services/workspace';

interface CardDef {
  key: string;
  label: string;
  color: string;
}

const MAIN_CARDS: CardDef[] = [
  { key: 'total', label: 'Total Plots', color: '#2E7D32' },
  { key: 'published', label: 'Published', color: '#0097A7' },
  { key: 'unpublished', label: 'Unpublished', color: '#EF6C00' },
  { key: 'qa_pending', label: 'Pending QA', color: '#F9A825' },
  { key: 'qa_done', label: 'QA Done / Await DS', color: '#7B1FA2' },
  { key: 'ready_publish', label: 'Ready to Publish', color: '#76be28' },
];

function tint(hex: string, alpha = 0.1): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

@Component({
  selector: 'app-stat-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-cards.html',
  styleUrl: './stat-cards.scss',
})
export class StatCards {
  workspace = inject(WorkspaceService);

  stats = input.required<Stats>();
  modelName = input.required<string>();

  cards = MAIN_CARDS;

  valueFor(key: string): number {
    return (this.stats() as unknown as Record<string, number>)[key] ?? 0;
  }

  isActive(key: string): boolean {
    const active = this.workspace.activeCard();
    if (key === 'published') {
      return active === 'published' || active === 'published_deforested' || active === 'published_not_deforested';
    }
    return active === key;
  }

  cardStyle(key: string, color: string): Record<string, string> {
    const active = this.isActive(key);
    return {
      background: active ? tint(color, 0.1) : '#FFFFFF',
      border: active ? `2px solid ${color}` : '1px solid #E5E7EB',
      'border-top': `3px solid ${color}`,
    };
  }

  showSubBreakdown = computed(() => {
    const active = this.workspace.activeCard();
    return (
      this.modelName() === 'Deforestation' &&
      (active === 'published' || active === 'published_deforested' || active === 'published_not_deforested')
    );
  });

  subCardStyle(color: string, isActive: boolean): Record<string, string> {
    return {
      background: isActive ? tint(color, 0.1) : '#FFFFFF',
      border: `${isActive ? '2px' : '1px'} solid ${color}`,
    };
  }

  isSubActive(key: string): boolean {
    return this.workspace.activeCard() === key;
  }

  click(key: string): void {
    this.workspace.setActiveCard(key);
  }
}
