import type { PlannerSnapshot } from '@/types';

export interface PlannerRepository {
  getSnapshot(): Promise<PlannerSnapshot | null>;
  saveSnapshot(snapshot: PlannerSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export const PLANNER_STORAGE_KEY = 'obraflow-planner:snapshot';
