import type { Calendar, Dependency, Holiday, Task } from '@/types';
import { shiftWorkingDate } from './working-days-engine';

function alignsWithDependency(
  sourceTask: Task,
  targetTask: Task,
  dependency: Dependency,
  calendar: Calendar,
  holidays: Holiday[]
): boolean {
  if (!sourceTask.startDate || !sourceTask.endDate || !targetTask.startDate || !targetTask.endDate) {
    return false;
  }

  if (dependency.type === 'FS') {
    return shiftWorkingDate(sourceTask.endDate, dependency.lagDays + 1, calendar, holidays) === targetTask.startDate;
  }

  if (dependency.type === 'SS') {
    return shiftWorkingDate(sourceTask.startDate, dependency.lagDays, calendar, holidays) === targetTask.startDate;
  }

  if (dependency.type === 'FF') {
    return shiftWorkingDate(sourceTask.endDate, dependency.lagDays, calendar, holidays) === targetTask.endDate;
  }

  return shiftWorkingDate(sourceTask.startDate, dependency.lagDays, calendar, holidays) === targetTask.endDate;
}

export function markCriticalPath(
  tasks: Task[],
  dependencies: Dependency[],
  calendar: Calendar,
  holidays: Holiday[]
): Task[] {
  const leafTasks = tasks.filter((task) => task.type !== 'summary' && task.endDate);
  if (leafTasks.length === 0) {
    return tasks;
  }

  const latestEndDate = leafTasks
    .map((task) => task.endDate as string)
    .sort()
    .slice(-1)[0];

  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const predecessorMap = new Map<string, Dependency[]>();

  dependencies.forEach((dependency) => {
    const current = predecessorMap.get(dependency.targetTaskId) ?? [];
    current.push(dependency);
    predecessorMap.set(dependency.targetTaskId, current);
  });

  const criticalIds = new Set<string>(
    leafTasks
      .filter((task) => task.endDate === latestEndDate)
      .map((task) => task.id)
  );

  const stack = Array.from(criticalIds);

  while (stack.length > 0) {
    const currentTaskId = stack.pop() as string;
    const currentTask = taskMap.get(currentTaskId);

    if (!currentTask) {
      continue;
    }

    const predecessors = predecessorMap.get(currentTaskId) ?? [];

    predecessors.forEach((dependency) => {
      const sourceTask = taskMap.get(dependency.sourceTaskId);

      if (!sourceTask) {
        return;
      }

      if (
        alignsWithDependency(sourceTask, currentTask, dependency, calendar, holidays) &&
        !criticalIds.has(sourceTask.id)
      ) {
        criticalIds.add(sourceTask.id);
        stack.push(sourceTask.id);
      }
    });
  }

  const childrenByParent = new Map<string, string[]>();

  tasks.forEach((task) => {
    if (!task.parentId) {
      return;
    }

    const current = childrenByParent.get(task.parentId) ?? [];
    current.push(task.id);
    childrenByParent.set(task.parentId, current);
  });

  function summaryHasCriticalDescendant(taskId: string): boolean {
    const children = childrenByParent.get(taskId) ?? [];

    for (const childId of children) {
      if (criticalIds.has(childId) || summaryHasCriticalDescendant(childId)) {
        return true;
      }
    }

    return false;
  }

  return tasks.map((task) => ({
    ...task,
    isCritical:
      task.type === 'summary'
        ? summaryHasCriticalDescendant(task.id)
        : criticalIds.has(task.id),
  }));
}
