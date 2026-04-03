import type { HeaderMap } from './mapper';

export type RawImportRow = Record<string, unknown>;

export interface ImportedTaskRow {
  rowIndex: number;
  rawId: string;
  rawParentId: string | null;
  rawLevel: number | null;
  rawType: string | null;
  name: string;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  progressPercent: number;
  predecessors: string[];
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function toNumberValue(value: unknown): number {
  const numeric = Number(String(value).replace('%', '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
}

function maybeExcelDate(value: unknown): string | undefined {
  if (typeof value === 'number' && value > 25000 && value < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    const year = excelEpoch.getUTCFullYear();
    const month = String(excelEpoch.getUTCMonth() + 1).padStart(2, '0');
    const day = String(excelEpoch.getUTCDate()).padStart(2, '0');
    return String(year) + '-' + month + '-' + day;
  }

  const text = toStringValue(value);
  if (!text) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const parts = text.split('/');
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }

  return undefined;
}

function normalizePredecessors(value: unknown): string[] {
  const text = toStringValue(value);
  if (!text) {
    return [];
  }

  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeImportedRows(rows: RawImportRow[], headerMap: HeaderMap): ImportedTaskRow[] {
  return rows.map((row, index) => {
    const idValue = headerMap.id ? toStringValue(row[headerMap.id]) : '';
    const nameValue = headerMap.task ? toStringValue(row[headerMap.task]) : '';
    const durationValue = headerMap.duration ? toNumberValue(row[headerMap.duration]) : 0;
    const progressValue = headerMap.progress ? toNumberValue(row[headerMap.progress]) : 0;

    return {
      rowIndex: index,
      rawId: idValue,
      rawParentId: headerMap.parentId ? toStringValue(row[headerMap.parentId]) || null : null,
      rawLevel: headerMap.level ? Number(row[headerMap.level]) : null,
      rawType: headerMap.type ? toStringValue(row[headerMap.type]) || null : null,
      name: nameValue,
      startDate: headerMap.start ? maybeExcelDate(row[headerMap.start]) : undefined,
      endDate: headerMap.finish ? maybeExcelDate(row[headerMap.finish]) : undefined,
      durationDays: Math.max(0, Math.round(durationValue)),
      progressPercent: Math.max(0, Math.min(100, Math.round(progressValue))),
      predecessors: headerMap.predecessors
        ? normalizePredecessors(row[headerMap.predecessors])
        : [],
    };
  });
}
