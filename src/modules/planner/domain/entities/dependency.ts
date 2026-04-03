import type { Dependency, DependencyType } from '@/types';

export interface CreateDependencyInput extends Partial<Dependency> {
  id: string;
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  type?: DependencyType;
}

export function createDependency(input: CreateDependencyInput): Dependency {
  const now = new Date().toISOString();

  return {
    id: input.id,
    projectId: input.projectId,
    sourceTaskId: input.sourceTaskId,
    targetTaskId: input.targetTaskId,
    type: input.type ?? 'FS',
    lagDays: input.lagDays ?? 0,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
