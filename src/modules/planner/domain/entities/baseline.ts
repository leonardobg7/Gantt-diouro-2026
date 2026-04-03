import type { Baseline, BaselineTaskSnapshot } from '@/types';

export function createBaseline(input?: Partial<Baseline>): Baseline {
  return {
    id: input?.id ?? 'baseline-001',
    projectId: input?.projectId ?? 'project-001',
    name: input?.name ?? 'Baseline 1',
    createdAt: input?.createdAt ?? new Date().toISOString(),
  };
}

export function createBaselineTaskSnapshot(
  input: Partial<BaselineTaskSnapshot> & {
    id: string;
    baselineId: string;
    taskId: string;
  }
): BaselineTaskSnapshot {
  return {
    id: input.id,
    baselineId: input.baselineId,
    taskId: input.taskId,
    startDate: input.startDate,
    endDate: input.endDate,
    durationDays: input.durationDays ?? 0,
    progressPercent: input.progressPercent ?? 0,
  };
}
