import type { Task } from '@/types';

export function validateTask(task: Task): string[] {
  const errors: string[] = [];

  if (!task.name.trim()) {
    errors.push('Task name is required');
  }

  if (task.durationDays < 0) {
    errors.push('Task duration cannot be negative');
  }

  if (task.progressPercent < 0 || task.progressPercent > 100) {
    errors.push('Task progress must be between 0 and 100');
  }

  if (task.parentId === task.id) {
    errors.push('Task cannot be parent of itself');
  }

  return errors;
}
