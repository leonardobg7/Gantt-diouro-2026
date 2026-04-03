import type { PlannerSnapshot } from '@/types';
import { PLANNER_STORAGE_KEY, type PlannerRepository } from './planner-repository';

export class LocalStoragePlannerRepository implements PlannerRepository {
  async getSnapshot(): Promise<PlannerSnapshot | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawValue = window.localStorage.getItem(PLANNER_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as PlannerSnapshot;
  }

  async saveSnapshot(snapshot: PlannerSnapshot): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(snapshot));
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(PLANNER_STORAGE_KEY);
  }
}
