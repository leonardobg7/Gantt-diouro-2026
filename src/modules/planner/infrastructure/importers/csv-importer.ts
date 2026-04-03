import { validateImportedRows } from '@/modules/planner/domain/validators/import-validator';
import { buildHeaderMap } from './mapper';
import { normalizeImportedRows, type RawImportRow } from './normalizer';

function splitCsvLine(line: string, separator: string): string[] {
  return line.split(separator).map((value) => value.trim());
}

export async function importCsvFile(file: File) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return {
      rows: [],
      errors: ['Arquivo CSV vazio'],
    };
  }

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0], separator);
  const rawRows: RawImportRow[] = lines.slice(1).map((line) => {
    const values = splitCsvLine(line, separator);
    return headers.reduce<RawImportRow>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });

  const headerMap = buildHeaderMap(headers);
  const rows = normalizeImportedRows(rawRows, headerMap);
  const errors = validateImportedRows(rows);

  return {
    rows,
    errors,
  };
}
