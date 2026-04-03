import type { Dependency, Task, PlannerSnapshot } from '@/types';

/**
 * Parses a dependency string from the user (e.g. "1.1 FS+2, 1.2") 
 * and returns an array of partial Dependency objects.
 */
export function parsePredecessorString(
  input: string,
  targetTaskId: string,
  allTasks: Task[],
  snapshot: PlannerSnapshot
): Dependency[] {
  if (!input || input.trim() === '' || input === '—') {
    return [];
  }

  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  const results: Dependency[] = [];

  const wbsToId = new Map(allTasks.map((t) => [t.wbsCode, t.id]));
  const now = new Date().toISOString();

  for (const part of parts) {
    // Regex to match: WBS (sequence of numbers and dots) followed by optional TYPE and optional LAG
    const match = part.match(/^([\d.]+)\s*(FS|SS|FF|SF)?\s*([+-])?\s*(\d+)?$/i);
    
    if (match) {
      const wbsCode = match[1];
      const type = (match[2]?.toUpperCase() || 'FS') as Dependency['type'];
      const sign = match[3] === '-' ? -1 : 1;
      const lagDays = match[4] ? parseInt(match[4], 10) * sign : 0;

      const sourceTaskId = wbsToId.get(wbsCode);
      
      if (sourceTaskId && sourceTaskId !== targetTaskId) {
        results.push({
          id: `dep-${sourceTaskId}-${targetTaskId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          projectId: snapshot.project.id,
          sourceTaskId,
          targetTaskId,
          type,
          lagDays,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return results;
}

/**
 * Formats dependencies into a human-readable string for the table.
 */
export function formatPredecessorString(
  taskId: string,
  dependencies: Dependency[],
  allTasks: Task[]
): string {
  const incoming = dependencies.filter((d) => d.targetTaskId === taskId);
  
  if (incoming.length === 0) {
    return '—';
  }

  const idToWbs = new Map(allTasks.map((t) => [t.id, t.wbsCode]));

  return incoming
    .map((d) => {
      const wbs = idToWbs.get(d.sourceTaskId);
      if (!wbs) return null;
      
      const typeStr = d.type === 'FS' ? '' : ` ${d.type}`;
      const lagStr = d.lagDays === 0 ? '' : d.lagDays > 0 ? `+${d.lagDays}` : `${d.lagDays}`;
      
      return `${wbs}${typeStr}${lagStr}`;
    })
    .filter(Boolean)
    .join(', ');
}
