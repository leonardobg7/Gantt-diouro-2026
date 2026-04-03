import type { Task } from '@/types';

function getSiblings(tasks: Task[], parentId: string | null): Task[] {
  return tasks
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function sortTasksByHierarchy(tasks: Task[]): Task[] {
  const result: Task[] = [];

  function visit(parentId: string | null) {
    const siblings = getSiblings(tasks, parentId);

    siblings.forEach((task) => {
      result.push(task);
      visit(task.id);
    });
  }

  visit(null);
  return result;
}

export function getChildTasks(tasks: Task[], parentId: string | null): Task[] {
  return getSiblings(tasks, parentId);
}

export function hasChildTasks(tasks: Task[], taskId: string): boolean {
  return tasks.some((task) => task.parentId === taskId);
}

export function getTaskDepth(tasks: Task[], taskId: string): number {
  const map = new Map(tasks.map((task) => [task.id, task]));
  let current = map.get(taskId);
  let depth = 0;

  while (current?.parentId) {
    const parent = map.get(current.parentId);
    if (!parent) {
      break;
    }

    depth += 1;
    current = parent;
  }

  return depth;
}

export function rebuildWbsCodes(tasks: Task[]): Task[] {
  const ordered = sortTasksByHierarchy(tasks);
  const nextById = new Map<string, Task>();

  function visit(parentId: string | null, prefix: string) {
    const siblings = ordered.filter((task) => task.parentId === parentId);

    siblings.forEach((task, index) => {
      const wbsCode = prefix ? prefix + '.' + String(index + 1) : String(index + 1);
      nextById.set(task.id, {
        ...task,
        wbsCode,
      });

      visit(task.id, wbsCode);
    });
  }

  visit(null, '');

  return ordered.map((task) => nextById.get(task.id) ?? task);
}
