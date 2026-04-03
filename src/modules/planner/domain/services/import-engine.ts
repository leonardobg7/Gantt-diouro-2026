import type { PlannerSnapshot, Task, Dependency, Project } from '@/types';
import type { ImportedTaskRow } from '@/modules/planner/infrastructure/importers/normalizer';
import { createTask } from '@/modules/planner/domain/entities/task';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function convertImportedToSnapshot(
  project: Project,
  rows: ImportedTaskRow[]
): PlannerSnapshot {
  const taskIdMap = new Map<string, string>();
  
  // First pass: Create tasks and map IDs
  const tasks: Task[] = rows.map((row) => {
    const internalId = generateId();
    if (row.rawId) {
      taskIdMap.set(row.rawId, internalId);
    }
    
    // Fallback if no raw ID
    taskIdMap.set(`row-${row.rowIndex}`, internalId);

    return createTask({
      id: internalId,
      projectId: project.id,
      name: row.name || `Tarefa ${row.rowIndex + 1}`,
      durationDays: row.durationDays,
      progressPercent: row.progressPercent,
      startDate: row.startDate,
      endDate: row.endDate,
      type: (row.rawType?.toLowerCase() as any) || (row.durationDays === 0 ? 'milestone' : 'task'),
      parentId: null, // We'll handle hierarchy in second pass
    });
  });

  // Second pass: Link parents and create dependencies
  const dependencies: Dependency[] = [];
  
  rows.forEach((row, index) => {
    const task = tasks[index];
    
    // Link parent
    if (row.rawParentId && taskIdMap.has(row.rawParentId)) {
      task.parentId = taskIdMap.get(row.rawParentId)!;
    }

    // Create dependencies
    row.predecessors.forEach((pred) => {
      // Pred can be "1", "1FS", "1FS+2d"
      const match = pred.match(/^(\d+)([A-Z]{2})?([+-]\d+d)?$/);
      if (!match) return;

      const rawSourceId = match[1];
      const type = (match[2] as any) || 'FS';
      const lagText = match[3] || '';
      const lagDays = lagText ? parseInt(lagText) : 0;

      const sourceId = taskIdMap.get(rawSourceId) || tasks[parseInt(rawSourceId) - 1]?.id;

      if (sourceId && sourceId !== task.id) {
        dependencies.push({
          id: generateId(),
          projectId: project.id,
          sourceTaskId: sourceId,
          targetTaskId: task.id,
          type,
          lagDays,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });
  });

  return {
    project,
    tasks,
    dependencies,
    calendar: {
       id: 'default',
       name: 'Padrão',
       countryCode: 'BR',
       workingWeekdays: [1, 2, 3, 4, 5],
       isDefault: true,
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString()
    },
    holidays: []
  };
}
