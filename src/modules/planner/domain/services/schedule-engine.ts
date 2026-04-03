import type { Calendar, Holiday, Task } from '@/types';
import { addWorkingDays, moveToNextWorkingDate, workingDaysBetween } from './working-days-engine';

export function calculateTaskDates(
  task: Task,
  calendar: Calendar,
  holidays: Holiday[]
): Task {
  if (task.type === 'summary') {
    return task;
  }

  if (!task.startDate && !task.endDate) {
    return task;
  }

  const safeStartDate = task.startDate ?? task.endDate ?? '';
  const normalizedStartDate = moveToNextWorkingDate(safeStartDate, calendar, holidays);
  const durationDays = task.type === 'milestone' ? 0 : Math.max(1, task.durationDays);
  const endDate =
    task.type === 'milestone'
      ? normalizedStartDate
      : addWorkingDays(normalizedStartDate, durationDays, calendar, holidays);

  return {
    ...task,
    startDate: normalizedStartDate,
    endDate,
    durationDays,
  };
}

export function rollupSummaryTasks(
  tasks: Task[],
  calendar: Calendar,
  holidays: Holiday[]
): Task[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  function aggregate(taskId: string): Task {
    const current = taskMap.get(taskId);

    if (!current) {
      throw new Error('Task not found: ' + taskId);
    }

    const children = tasks
      .filter((task) => task.parentId === taskId)
      .map((child) => aggregate(child.id));

    if (current.type !== 'summary' || children.length === 0) {
      return current;
    }

    const datedChildren = children.filter((child) => child.startDate && child.endDate);

    const startDates = datedChildren
      .map((child) => child.startDate as string)
      .sort();

    const endDates = datedChildren
      .map((child) => child.endDate as string)
      .sort();

    const earliestStartDate = startDates.length > 0 ? startDates[0] : undefined;
    const latestEndDate = endDates.length > 0 ? endDates[endDates.length - 1] : undefined;

    const totalWeight = children.reduce((sum, child) => sum + Math.max(1, child.durationDays), 0);
    const weightedProgress = children.reduce(
      (sum, child) => sum + Math.max(1, child.durationDays) * child.progressPercent,
      0
    );

    const nextTask: Task = {
      ...current,
      startDate: earliestStartDate,
      endDate: latestEndDate,
      durationDays:
        earliestStartDate && latestEndDate
          ? Math.max(1, workingDaysBetween(earliestStartDate, latestEndDate, calendar, holidays))
          : 0,
      progressPercent: totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0,
      isCritical: children.some((child) => child.isCritical),
    };

    taskMap.set(taskId, nextTask);
    return nextTask;
  }

  const roots = tasks.filter((task) => task.parentId === null);
  roots.forEach((task) => {
    aggregate(task.id);
  });

  return tasks.map((task) => taskMap.get(task.id) ?? task);
}

export function recalculateSchedule(
  tasks: Task[],
  calendar: Calendar,
  holidays: Holiday[]
): Task[] {
  const datedTasks = tasks.map((task) => calculateTaskDates(task, calendar, holidays));
  return rollupSummaryTasks(datedTasks, calendar, holidays);
}
