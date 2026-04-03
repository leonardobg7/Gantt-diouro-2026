import { create } from 'zustand';
import type { Dependency, PlannerSnapshot, Task } from '@/types';
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
  updateDependencyInput: (
    taskId: string,
    predecessorWbs: string,
    linkType: 'FS' | 'SS' | 'FF' | 'SF'
  ) => void;
  addTaskAfterSelected: (kind?: 'task' | 'milestone') => void;
  removeSelectedTask: () => void;
  replaceSnapshot: (snapshot: PlannerSnapshot) => void;
}

const DEFAULT_COLUMN_WIDTHS = [74, 360, 96, 122, 122, 84, 126, 108];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

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

function getDescendantIds(tasks: Task[], parentId: string): string[] {
  const directChildren = tasks.filter((task) => task.parentId === parentId);
  return directChildren.flatMap((child) => [child.id, ...getDescendantIds(tasks, child.id)]);
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
      zoom: Math.max(22, Math.min(76, zoom)),
    }),

  setScrollTop: (scrollTop) =>
    set((state) => {
      if (Math.abs(state.scrollTop - scrollTop) < 1) return state;
      return { scrollTop };
    }),

  setLeftPanelWidth: (width) =>
    set({
      leftPanelWidth: Math.max(560, Math.min(1180, width)),
    }),

  updateColumnWidth: (index, width) =>
    set((state) => {
      const next = [...state.columnWidths];
      next[index] = Math.max(56, Math.min(720, width));
      return { columnWidths: next };
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

      return {
        snapshot: deriveSnapshot({
          ...state.snapshot,
          tasks: nextTasks,
        }),
      };
    }),

  updateDependencyInput: (taskId, predecessorWbs, linkType) =>
    set((state) => {
      const trimmedWbs = predecessorWbs.trim();
      const tasks = state.snapshot.tasks;
      const dependencies = state.snapshot.dependencies;

      const targetTask = tasks.find((task) => task.id === taskId);
      if (!targetTask) return state;

      const remainingDependencies = dependencies.filter(
        (dependency) => dependency.targetTaskId !== taskId
      );

      if (!trimmedWbs) {
        return {
          snapshot: deriveSnapshot({
            ...state.snapshot,
            dependencies: remainingDependencies,
          }),
        };
      }

      const sourceTask = tasks.find((task) => task.wbsCode === trimmedWbs);
      if (!sourceTask || sourceTask.id === taskId) {
        return state;
      }

      const nextDependency: Dependency = {
        id: createId('dep'),
        projectId: state.snapshot.project.id,
        sourceTaskId: sourceTask.id,
        targetTaskId: taskId,
        type: linkType,
        lagDays: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const candidateSnapshot = {
        ...state.snapshot,
        dependencies: [...remainingDependencies, nextDependency],
      };

      const rebuiltTasks = rebuildWbsCodes(candidateSnapshot.tasks);
      const hasCycle = detectDependencyCycles(rebuiltTasks, candidateSnapshot.dependencies);

      if (hasCycle) {
        return state;
      }

      return {
        snapshot: deriveSnapshot(candidateSnapshot),
      };
    }),

  addTaskAfterSelected: (kind = 'task') =>
    set((state) => {
      const tasks = [...state.snapshot.tasks];
      const selectedTask =
        tasks.find((task) => task.id === state.selectedTaskId) ?? tasks[tasks.length - 1];

      const parentId = selectedTask?.parentId ?? null;
      const insertOrderIndex = selectedTask ? selectedTask.orderIndex + 1 : 0;

      const shiftedTasks = tasks.map((task) => {
        if (task.parentId === parentId && task.orderIndex >= insertOrderIndex) {
          return { ...task, orderIndex: task.orderIndex + 1 };
        }
        return task;
      });

      const baseDate =
        selectedTask?.endDate ||
        selectedTask?.startDate ||
        state.snapshot.project.startDate ||
        new Date().toISOString().slice(0, 10);

      const now = new Date().toISOString();
      const newTask: Task = {
        id: createId('task'),
        projectId: state.snapshot.project.id,
        wbsCode: '',
        name: kind === 'milestone' ? 'Novo marco' : 'Nova tarefa',
        type: kind,
        parentId,
        orderIndex: insertOrderIndex,
        startDate: baseDate,
        endDate: baseDate,
        durationDays: kind === 'milestone' ? 0 : 1,
        progressPercent: 0,
        isCritical: false,
        calendarId: state.snapshot.calendar.id,
        notes: '',
        cost: 0,
        createdAt: now,
        updatedAt: now,
      };

      const nextSnapshot = deriveSnapshot({
        ...state.snapshot,
        tasks: [...shiftedTasks, newTask],
      });

      return {
        snapshot: nextSnapshot,
        selectedTaskId: newTask.id,
      };
    }),

  removeSelectedTask: () =>
    set((state) => {
      if (!state.selectedTaskId) return state;

      const descendantIds = getDescendantIds(state.snapshot.tasks, state.selectedTaskId);
      const idsToRemove = new Set([state.selectedTaskId, ...descendantIds]);

      const nextTasks = state.snapshot.tasks.filter((task) => !idsToRemove.has(task.id));
      const nextDependencies = state.snapshot.dependencies.filter(
        (dependency) =>
          !idsToRemove.has(dependency.sourceTaskId) && !idsToRemove.has(dependency.targetTaskId)
      );

      if (nextTasks.length === 0) return state;

      return {
        snapshot: deriveSnapshot({
          ...state.snapshot,
          tasks: nextTasks,
          dependencies: nextDependencies,
        }),
        selectedTaskId: nextTasks[0]?.id ?? null,
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