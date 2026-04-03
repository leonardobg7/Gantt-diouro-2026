import type { Calendar, Dependency, Holiday, Task } from '@/types';
import { shiftWorkingDate } from './working-days-engine';

function compareIsoDates(a?: string, b?: string): number {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return -1;
  }

  if (!b) {
    return 1;
  }

  return a.localeCompare(b);
}

function getTaskDuration(task: Task): number {
  return task.type === 'milestone' ? 0 : Math.max(1, task.durationDays);
}

function applySingleDependency(
  sourceTask: Task,
  targetTask: Task,
  dependency: Dependency,
  calendar: Calendar,
  holidays: Holiday[]
): Task {
  if (!sourceTask.startDate || !sourceTask.endDate) {
    return targetTask;
  }

  const duration = getTaskDuration(targetTask);

  if (dependency.type === 'FS') {
    const candidateStart = shiftWorkingDate(sourceTask.endDate, dependency.lagDays + 1, calendar, holidays);

    if (!targetTask.startDate || compareIsoDates(candidateStart, targetTask.startDate) > 0) {
      return {
        ...targetTask,
        startDate: candidateStart,
        endDate: duration === 0 ? candidateStart : shiftWorkingDate(candidateStart, duration - 1, calendar, holidays),
      };
    }

    return targetTask;
  }

  if (dependency.type === 'SS') {
    const candidateStart = shiftWorkingDate(sourceTask.startDate, dependency.lagDays, calendar, holidays);

    if (!targetTask.startDate || compareIsoDates(candidateStart, targetTask.startDate) > 0) {
      return {
        ...targetTask,
        startDate: candidateStart,
        endDate: duration === 0 ? candidateStart : shiftWorkingDate(candidateStart, duration - 1, calendar, holidays),
      };
    }

    return targetTask;
  }

  if (dependency.type === 'FF') {
    const candidateEnd = shiftWorkingDate(sourceTask.endDate, dependency.lagDays, calendar, holidays);

    if (!targetTask.endDate || compareIsoDates(candidateEnd, targetTask.endDate) > 0) {
      return {
        ...targetTask,
        startDate: duration === 0 ? candidateEnd : shiftWorkingDate(candidateEnd, -(duration - 1), calendar, holidays),
        endDate: candidateEnd,
      };
    }

    return targetTask;
  }

  const candidateEnd = shiftWorkingDate(sourceTask.startDate, dependency.lagDays, calendar, holidays);

  if (!targetTask.endDate || compareIsoDates(candidateEnd, targetTask.endDate) > 0) {
    return {
      ...targetTask,
      startDate: duration === 0 ? candidateEnd : shiftWorkingDate(candidateEnd, -(duration - 1), calendar, holidays),
      endDate: candidateEnd,
    };
  }

  return targetTask;
}

export function detectDependencyCycles(tasks: Task[], dependencies: Dependency[]): boolean {
  const taskIds = new Set(tasks.map((task) => task.id));
  const adjacency = new Map<string, string[]>();

  dependencies.forEach((dependency) => {
    if (!taskIds.has(dependency.sourceTaskId) || !taskIds.has(dependency.targetTaskId)) {
      return;
    }

    const next = adjacency.get(dependency.sourceTaskId) ?? [];
    next.push(dependency.targetTaskId);
    adjacency.set(dependency.sourceTaskId, next);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function walk(taskId: string): boolean {
    if (visiting.has(taskId)) {
      return true;
    }

    if (visited.has(taskId)) {
      return false;
    }

    visiting.add(taskId);

    const nextIds = adjacency.get(taskId) ?? [];
    for (const nextId of nextIds) {
      if (walk(nextId)) {
        return true;
      }
    }

    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  }

  for (const task of tasks) {
    if (walk(task.id)) {
      return true;
    }
  }

  return false;
}

export function applyDependencies(
  tasks: Task[],
  dependencies: Dependency[],
  calendar: Calendar,
  holidays: Holiday[]
): Task[] {
  const nextTasks = new Map<string, Task>(tasks.map((task) => [task.id, task]));
  const maxPasses = Math.max(1, tasks.length * 2);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (const dependency of dependencies) {
      const sourceTask = nextTasks.get(dependency.sourceTaskId);
      const targetTask = nextTasks.get(dependency.targetTaskId);

      if (!sourceTask || !targetTask) {
        continue;
      }

      const updated = applySingleDependency(sourceTask, targetTask, dependency, calendar, holidays);

      const hasChanged =
        updated.startDate !== targetTask.startDate ||
        updated.endDate !== targetTask.endDate;

      if (hasChanged) {
        nextTasks.set(updated.id, updated);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return tasks.map((task) => nextTasks.get(task.id) ?? task);
}
