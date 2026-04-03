import * as XLSX from 'xlsx';
import { validateImportedRows } from '@/modules/planner/domain/validators/import-validator';
import { buildHeaderMap } from './mapper';
import { normalizeImportedRows, type RawImportRow } from './normalizer';

export async function importXlsxFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      rows: [],
      errors: ['Arquivo XLSX sem abas válidas'],
    };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rowsAsArray = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    raw: true,
  });

  if (rowsAsArray.length === 0) {
    return {
      rows: [],
      errors: ['Planilha vazia'],
    };
  }

  const headers = (rowsAsArray[0] ?? []).map((value) => String(value ?? '').trim());
  const rawRows: RawImportRow[] = rowsAsArray.slice(1).map((line) => {
    return headers.reduce<RawImportRow>((acc, header, index) => {
      acc[header] = line[index] ?? '';
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
