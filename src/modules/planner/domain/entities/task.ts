import type { Task, TaskType } from '@/types';

export interface CreateTaskInput extends Partial<Task> {
  id: string;
  projectId: string;
  name: string;
  type?: TaskType;
}

export function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();

  return {
    id: input.id,
    projectId: input.projectId,
    wbsCode: input.wbsCode ?? '',
    name: input.name,
    type: input.type ?? 'task',
    parentId: input.parentId ?? null,
    orderIndex: input.orderIndex ?? 0,
    startDate: input.startDate,
    endDate: input.endDate,
    durationDays: input.durationDays ?? 1,
    progressPercent: input.progressPercent ?? 0,
    isCritical: input.isCritical ?? false,
    calendarId: input.calendarId,
    notes: input.notes,
    cost: input.cost,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
