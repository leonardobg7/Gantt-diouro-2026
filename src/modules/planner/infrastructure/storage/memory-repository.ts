import type { PlannerSnapshot } from '@/types';
import type { PlannerRepository } from './planner-repository';

export class MemoryPlannerRepository implements PlannerRepository {
  private snapshot: PlannerSnapshot | null = null;

  async getSnapshot(): Promise<PlannerSnapshot | null> {
    return this.snapshot;
  }

  async saveSnapshot(snapshot: PlannerSnapshot): Promise<void> {
    this.snapshot = snapshot;
  }

  async clear(): Promise<void> {
    this.snapshot = null;
  }
}
