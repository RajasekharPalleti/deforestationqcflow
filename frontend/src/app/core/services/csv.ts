import { downloadBlob } from './evidence';

function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(','));
  }
  return lines.join('\n');
}

export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  const csv = rowsToCsv(rows);
  downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
}
