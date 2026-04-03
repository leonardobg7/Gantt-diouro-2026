export type TaskType = 'summary' | 'task' | 'milestone';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type HolidayScope = 'national' | 'state' | 'municipal' | 'project';

export interface Project {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  currency: string;
  startDate?: string;
  endDate?: string;
  calendarId: string;
  defaultZoom: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  wbsCode: string;
  name: string;
  type: TaskType;
  parentId: string | null;
  orderIndex: number;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  progressPercent: number;
  isCritical: boolean;
  calendarId?: string;
  notes?: string;
  cost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: string;
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: DependencyType;
  lagDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface Calendar {
  id: string;
  projectId?: string;
  name: string;
  countryCode: string;
  workingWeekdays: number[];
  hoursPerDay?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: string;
  calendarId: string;
  name: string;
  date: string;
  scope: HolidayScope;
  locationCode?: string;
  recurring: boolean;
}

export interface Baseline {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export interface BaselineTaskSnapshot {
  id: string;
  baselineId: string;
  taskId: string;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  progressPercent: number;
}

export interface PlannerSnapshot {
  project: Project;
  calendar: Calendar;
  holidays: Holiday[];
  tasks: Task[];
  dependencies: Dependency[];
}
