import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api-base';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private http = inject(HttpClient);

  async generateAndDownload(
    tenant: string,
    project: string,
    model_name: string,
    plot_ids: number[]
  ): Promise<void> {
    const blob = await firstValueFrom(
      this.http.post(
        `${API_BASE}/evidence/generate`,
        { tenant, project, model_name, plot_ids },
        { responseType: 'blob' }
      )
    );
    const filename = `Evidence_${tenant.replace(/ /g, '_')}_${project.replace(/ /g, '_')}_${model_name}.html`;
    downloadBlob(blob, filename);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
