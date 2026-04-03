export type CanonicalImportField =
  | 'id'
  | 'task'
  | 'duration'
  | 'start'
  | 'finish'
  | 'progress'
  | 'predecessors'
  | 'parentId'
  | 'level'
  | 'type';

export type HeaderMap = Record<CanonicalImportField, string | null>;

const aliases: Record<CanonicalImportField, string[]> = {
  id: ['id', 'codigo', 'código', 'wbs', 'estrutura', 'item'],
  task: ['task', 'tarefa', 'atividade', 'nome', 'descricao', 'descrição'],
  duration: ['duration', 'duracao', 'duração', 'dias', 'prazo'],
  start: ['start', 'inicio', 'início', 'data inicio', 'data início'],
  finish: ['finish', 'end', 'termino', 'término', 'data termino', 'data término'],
  progress: ['progress', 'percent', '%', 'concluido', 'concluído', 'percentual'],
  predecessors: ['predecessors', 'predecessoras', 'vinculos', 'vínculos', 'dependencias', 'dependências'],
  parentId: ['parentid', 'parent id', 'pai'],
  level: ['level', 'nivel', 'nível'],
  type: ['type', 'tipo'],
};

export function normalizeHeaderName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function buildHeaderMap(headers: string[]): HeaderMap {
  const normalizedHeaders = headers.map((header) => normalizeHeaderName(header));

  const base: HeaderMap = {
    id: null,
    task: null,
    duration: null,
    start: null,
    finish: null,
    progress: null,
    predecessors: null,
    parentId: null,
    level: null,
    type: null,
  };

  (Object.keys(base) as CanonicalImportField[]).forEach((field) => {
    const foundIndex = normalizedHeaders.findIndex((header) => aliases[field].includes(header));
    base[field] = foundIndex >= 0 ? headers[foundIndex] : null;
  });

  return base;
}
