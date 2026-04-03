import type { ImportedTaskRow } from '@/modules/planner/infrastructure/importers/normalizer';

export function validateImportedRows(rows: ImportedTaskRow[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  rows.forEach((row, index) => {
    if (!row.name.trim()) {
      errors.push('Linha ' + String(index + 1) + ': tarefa sem nome');
    }

    if (row.rawId) {
      if (seenIds.has(row.rawId)) {
        errors.push('Linha ' + String(index + 1) + ': ID duplicado ' + row.rawId);
      }

      seenIds.add(row.rawId);
    }

    if (row.progressPercent < 0 || row.progressPercent > 100) {
      errors.push('Linha ' + String(index + 1) + ': progresso inválido');
    }

    if (row.durationDays < 0) {
      errors.push('Linha ' + String(index + 1) + ': duração inválida');
    }
  });

  return errors;
}
