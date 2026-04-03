import { create } from 'zustand';
import type { PlannerSnapshot, Task } from '@/types';
import { markCriticalPath } from '@/modules/planner/domain/services/critical-path-engine';
import {
  applyDependencies,
  detectDependencyCycles,
} from '@/modules/planner/domain/services/dependency-engine';
import { rebuildWbsCodes } from '@/modules/planner/domain/services/hierarchy-engine';
import { recalculateSchedule } from '@/modules/planner/domain/services/schedule-engine';
import { sampleSnapshot } from '@/mock/sample-project';

interface PlannerState {
  snapshot: PlannerSnapshot;
  selectedTaskId: string | null;
  zoom: number;
  columnWidths: number[];
  leftPanelWidth: number;
  scrollTop: number;
  setSelectedTaskId: (taskId: string | null) => void;
  setZoom: (zoom: number) => void;
  setScrollTop: (scrollTop: number) => void;
  setLeftPanelWidth: (width: number) => void;
  updateColumnWidth: (index: number, width: number) => void;
  resetToSample: () => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  replaceSnapshot: (snapshot: PlannerSnapshot) => void;
}

const DEFAULT_COLUMN_WIDTHS = [74, 360, 96, 122, 122, 84, 160];

function deriveSnapshot(snapshot: PlannerSnapshot): PlannerSnapshot {
  const rebuiltTasks = rebuildWbsCodes(snapshot.tasks);

  const dependencySafeTasks = detectDependencyCycles(rebuiltTasks, snapshot.dependencies)
    ? rebuiltTasks
    : applyDependencies(
        rebuiltTasks,
        snapshot.dependencies,
        snapshot.calendar,
        snapshot.holidays
      );

  const scheduledTasks = recalculateSchedule(
    dependencySafeTasks,
    snapshot.calendar,
    snapshot.holidays
  );

  const criticalTasks = markCriticalPath(
    scheduledTasks,
    snapshot.dependencies,
    snapshot.calendar,
    snapshot.holidays
  );

  return {
    ...snapshot,
    tasks: rebuildWbsCodes(criticalTasks),
  };
}

const initialSnapshot = deriveSnapshot(sampleSnapshot);

export const usePlannerStore = create<PlannerState>((set) => ({
  snapshot: initialSnapshot,
  selectedTaskId: initialSnapshot.tasks[0]?.id ?? null,
  zoom: initialSnapshot.project.defaultZoom || 36,
  columnWidths: DEFAULT_COLUMN_WIDTHS,
  leftPanelWidth: 760,
  scrollTop: 0,

  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),

  setZoom: (zoom) =>
    set({
      zoom: Math.max(24, Math.min(72, zoom)),
    }),

  setScrollTop: (scrollTop) =>
    set((state) => {
      if (Math.abs(state.scrollTop - scrollTop) < 1) {
        return state;
      }

      return { scrollTop };
    }),

  setLeftPanelWidth: (width) =>
    set({
      leftPanelWidth: Math.max(520, Math.min(1120, width)),
    }),

  updateColumnWidth: (index, width) =>
    set((state) => {
      const next = [...state.columnWidths];
      next[index] = Math.max(56, Math.min(700, width));

      return {
        columnWidths: next,
      };
    }),

  resetToSample: () =>
    set({
      snapshot: deriveSnapshot(sampleSnapshot),
      selectedTaskId: sampleSnapshot.tasks[0]?.id ?? null,
      zoom: sampleSnapshot.project.defaultZoom || 36,
      columnWidths: DEFAULT_COLUMN_WIDTHS,
      leftPanelWidth: 760,
      scrollTop: 0,
    }),

  updateTask: (taskId, patch) =>
    set((state) => {
      const nextTasks = state.snapshot.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : task
      );

      const nextSnapshot = deriveSnapshot({
        ...state.snapshot,
        tasks: nextTasks,
      });

      return {
        snapshot: nextSnapshot,
      };
    }),

  replaceSnapshot: (snapshot) =>
    set({
      snapshot: deriveSnapshot(snapshot),
      selectedTaskId: snapshot.tasks[0]?.id ?? null,
      zoom: snapshot.project.defaultZoom || 36,
      columnWidths: DEFAULT_COLUMN_WIDTHS,
      leftPanelWidth: 760,
      scrollTop: 0,
    }),
}));