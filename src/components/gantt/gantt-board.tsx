import type { Task } from '@/types';
import { sortTasksByHierarchy } from '@/modules/planner/domain/services/hierarchy-engine';
import { usePlannerStore } from '@/modules/planner/state/planner-store';

function parseIsoDate(value: string): Date {
  const parts = value.split('-').map(Number);
  return new Date(parts[0] || 2000, (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
}

function formatDayNumber(value: Date): string {
  return String(value.getDate()).padStart(2, '0');
}

function formatDayLabel(value: Date): string {
  return value.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
}

function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function diffInDays(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / 86400000);
}

function isWeekend(value: Date): boolean {
  const day = value.getDay();
  return day === 0 || day === 6;
}

function getVisibleRange(tasks: Task[]) {
  const datedTasks = tasks.filter((task) => task.startDate && task.endDate);

  if (datedTasks.length === 0) {
    const today = new Date();
    const start = addDays(today, -7);
    const end = addDays(today, 30);
    return { start, end };
  }

  const starts = datedTasks
    .map((task) => parseIsoDate(task.startDate as string))
    .sort((a, b) => a.getTime() - b.getTime());

  const ends = datedTasks
    .map((task) => parseIsoDate(task.endDate as string))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    start: addDays(starts[0], -2),
    end: addDays(ends[ends.length - 1], 14),
  };
}

export function GanttBoard() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const selectedTaskId = usePlannerStore((state) => state.selectedTaskId);
  const setSelectedTaskId = usePlannerStore((state) => state.setSelectedTaskId);
  const zoom = usePlannerStore((state) => state.zoom);

  const tasks = sortTasksByHierarchy(snapshot.tasks);
  const range = getVisibleRange(tasks);
  const totalDays = diffInDays(range.start, range.end) + 1;
  const canvasWidth = totalDays * zoom;
  const canvasHeight = tasks.length * 44 + 20;
  const today = new Date();
  const todayOffset = diffInDays(range.start, today) * zoom;

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Gráfico de Gantt</h3>
      </div>

      <div className="panel-body gantt-wrap">
        <div className="gantt-header">
          <div className="gantt-header-inner" style={{ width: String(canvasWidth) + 'px' }}>
            {Array.from({ length: totalDays }).map((_, index) => {
              const date = addDays(range.start, index);
              const weekend = isWeekend(date);
              return (
                <div
                  key={String(index)}
                  className={weekend ? 'gantt-day weekend' : 'gantt-day'}
                >
                  <strong>{formatDayNumber(date)}</strong>
                  <span>{formatDayLabel(date)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="gantt-body">
          <div className="gantt-canvas" style={{ width: String(canvasWidth) + 'px', height: String(canvasHeight) + 'px' }}>
            {Array.from({ length: totalDays }).map((_, index) => {
              const date = addDays(range.start, index);
              if (!isWeekend(date)) {
                return null;
              }

              return (
                <div
                  key={'weekend-' + String(index)}
                  className="gantt-weekend"
                  style={{ left: String(index * zoom) + 'px', width: String(zoom) + 'px' }}
                />
              );
            })}

            {tasks.map((task, rowIndex) => {
              return (
                <div
                  key={'row-' + task.id}
                  className="gantt-row"
                  style={{ top: String(rowIndex * 44) + 'px' }}
                />
              );
            })}

            {todayOffset >= 0 && todayOffset <= canvasWidth ? (
              <div className="gantt-today-line" style={{ left: String(todayOffset) + 'px' }} />
            ) : null}

            {tasks.map((task, rowIndex) => {
              if (!task.startDate || !task.endDate) {
                return null;
              }

              const start = parseIsoDate(task.startDate);
              const end = parseIsoDate(task.endDate);
              const left = diffInDays(range.start, start) * zoom + 3;
              const width = Math.max(zoom - 6, (diffInDays(start, end) + 1) * zoom - 6);
              const top = rowIndex * 44 + (task.type === 'summary' ? 11 : 8);
              const classNames = [
                'gantt-bar',
                task.type === 'summary' ? 'summary' : '',
                task.isCritical ? 'critical' : '',
                selectedTaskId === task.id ? 'selected' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={task.id}
                  className={classNames}
                  style={{
                    left: String(left) + 'px',
                    width: String(width) + 'px',
                    top: String(top) + 'px',
                  }}
                  onClick={() => setSelectedTaskId(task.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      setSelectedTaskId(task.id);
                    }
                  }}
                >
                  <span>{task.wbsCode}</span>
                </div>
              );
            })}

            {tasks.length === 0 ? <div className="empty-state">Nenhuma tarefa disponível.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
