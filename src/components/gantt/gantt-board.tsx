import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dependency, Task } from '@/types';
import { sortTasksByHierarchy } from '@/modules/planner/domain/services/hierarchy-engine';
import { usePlannerStore } from '@/modules/planner/state/planner-store';
import {
  addWorkingDays,
  shiftWorkingDate,
} from '@/modules/planner/domain/services/working-days-engine';

const ROW_HEIGHT = 44;

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || 2000, (month || 1) - 1, day || 1, 12, 0, 0, 0);
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

function formatDayNumber(value: Date): string {
  return String(value.getDate()).padStart(2, '0');
}

function formatDayLabel(value: Date): string {
  return value.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
}

function formatMonthLabel(value: Date): string {
  return value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function getVisibleRange(tasks: Task[]) {
  const datedTasks = tasks.filter((task) => task.startDate && task.endDate);

  if (datedTasks.length === 0) {
    const today = new Date();
    return {
      start: addDays(today, -7),
      end: addDays(today, 60),
    };
  }

  const starts = datedTasks
    .map((task) => parseIsoDate(task.startDate as string))
    .sort((a, b) => a.getTime() - b.getTime());

  const ends = datedTasks
    .map((task) => parseIsoDate(task.endDate as string))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    start: addDays(starts[0], -3),
    end: addDays(ends[ends.length - 1], 14),
  };
}

function buildMonthSegments(start: Date, totalDays: number, zoom: number) {
  const segments: Array<{ label: string; width: number }> = [];
  let currentMonth = -1;
  let currentYear = -1;
  let currentWidth = 0;
  let currentLabel = '';

  for (let index = 0; index < totalDays; index += 1) {
    const date = addDays(start, index);
    const month = date.getMonth();
    const year = date.getFullYear();

    if (month !== currentMonth || year !== currentYear) {
      if (currentWidth > 0) {
        segments.push({ label: currentLabel, width: currentWidth });
      }

      currentMonth = month;
      currentYear = year;
      currentLabel = formatMonthLabel(date);
      currentWidth = zoom;
    } else {
      currentWidth += zoom;
    }
  }

  if (currentWidth > 0) {
    segments.push({ label: currentLabel, width: currentWidth });
  }

  return segments;
}

type DragMode = 'move' | 'resize-right';

interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  initialLeft: number;
  initialWidth: number;
  startDate: string;
  durationDays: number;
}

function getBarMetrics(task: Task, rangeStart: Date, zoom: number) {
  if (!task.startDate || !task.endDate) {
    return { left: 0, width: 0 };
  }

  const start = parseIsoDate(task.startDate);
  const end = parseIsoDate(task.endDate);
  const left = diffInDays(rangeStart, start) * zoom + 4;
  const width = Math.max(zoom - 8, (diffInDays(start, end) + 1) * zoom - 8);

  return { left, width };
}

function buildDependencyPath(
  sourceTask: Task,
  targetTask: Task,
  sourceIndex: number,
  targetIndex: number,
  rangeStart: Date,
  zoom: number
) {
  if (!sourceTask.endDate || !targetTask.startDate) {
    return null;
  }

  const sourceMetrics = getBarMetrics(sourceTask, rangeStart, zoom);
  const targetMetrics = getBarMetrics(targetTask, rangeStart, zoom);

  const x1 = sourceMetrics.left + sourceMetrics.width;
  const y1 = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
  const x2 = targetMetrics.left;
  const y2 = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
  const midX = x1 + Math.max(18, Math.min(72, (x2 - x1) / 2));

  return [`M ${x1} ${y1}`, `L ${midX} ${y1}`, `L ${midX} ${y2}`, `L ${x2 - 6} ${y2}`].join(
    ' '
  );
}

export function GanttBoard() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const selectedTaskId = usePlannerStore((state) => state.selectedTaskId);
  const setSelectedTaskId = usePlannerStore((state) => state.setSelectedTaskId);
  const updateTask = usePlannerStore((state) => state.updateTask);
  const zoom = usePlannerStore((state) => state.zoom);
  const scrollTop = usePlannerStore((state) => state.scrollTop);
  const setScrollTop = usePlannerStore((state) => state.setScrollTop);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{ taskId: string; left: number; width: number } | null>(
    null
  );

  const tasks = useMemo(() => sortTasksByHierarchy(snapshot.tasks), [snapshot.tasks]);
  const range = useMemo(() => getVisibleRange(tasks), [tasks]);

  const totalDays = diffInDays(range.start, range.end) + 1;
  const canvasWidth = totalDays * zoom;
  const canvasHeight = tasks.length * ROW_HEIGHT + 20;
  const monthSegments = useMemo(
    () => buildMonthSegments(range.start, totalDays, zoom),
    [range.start, totalDays, zoom]
  );

  useEffect(() => {
    if (!bodyRef.current) {
      return;
    }

    if (Math.abs(bodyRef.current.scrollTop - scrollTop) > 1) {
      bodyRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - dragState.startX;
      const snappedDelta = Math.round(deltaX / zoom) * zoom;

      if (dragState.mode === 'move') {
        setPreview({
          taskId: dragState.taskId,
          left: dragState.initialLeft + snappedDelta,
          width: dragState.initialWidth,
        });
        return;
      }

      const nextWidth = Math.max(zoom - 8, dragState.initialWidth + snappedDelta);

      setPreview({
        taskId: dragState.taskId,
        left: dragState.initialLeft,
        width: nextWidth,
      });
    };

    const handleMouseUp = (event: MouseEvent) => {
      const deltaX = event.clientX - dragState.startX;
      const snappedDays = Math.round(deltaX / zoom);
      const task = tasks.find((item) => item.id === dragState.taskId);

      if (task) {
        if (dragState.mode === 'move' && snappedDays !== 0) {
          const nextStart = shiftWorkingDate(
            dragState.startDate,
            snappedDays,
            snapshot.calendar,
            snapshot.holidays
          );
          const nextEnd =
            task.type === 'milestone'
              ? nextStart
              : addWorkingDays(
                  nextStart,
                  dragState.durationDays,
                  snapshot.calendar,
                  snapshot.holidays
                );

          updateTask(task.id, {
            startDate: nextStart,
            endDate: nextEnd,
          });
        }

        if (dragState.mode === 'resize-right' && snappedDays !== 0) {
          const nextDuration = Math.max(1, dragState.durationDays + snappedDays);
          const nextEnd = addWorkingDays(
            dragState.startDate,
            nextDuration,
            snapshot.calendar,
            snapshot.holidays
          );

          updateTask(task.id, {
            durationDays: nextDuration,
            endDate: nextEnd,
          });
        }
      }

      setDragState(null);
      setPreview(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, snapshot.calendar, snapshot.holidays, tasks, updateTask, zoom]);

  const today = new Date();
  const todayOffset = diffInDays(range.start, today) * zoom;

  const arrows = useMemo(() => {
    const rows: Array<{ id: string; path: string; isCritical: boolean }> = [];

    snapshot.dependencies.forEach((dependency: Dependency) => {
      const sourceIndex = tasks.findIndex((task) => task.id === dependency.sourceTaskId);
      const targetIndex = tasks.findIndex((task) => task.id === dependency.targetTaskId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return;
      }

      const sourceTask = tasks[sourceIndex];
      const targetTask = tasks[targetIndex];
      const path = buildDependencyPath(
        sourceTask,
        targetTask,
        sourceIndex,
        targetIndex,
        range.start,
        zoom
      );

      if (!path) {
        return;
      }

      rows.push({
        id: dependency.id,
        path,
        isCritical: sourceTask.isCritical && targetTask.isCritical,
      });
    });

    return rows;
  }, [range.start, snapshot.dependencies, tasks, zoom]);

  return (
    <section className="panel gantt-panel">
      <div className="panel-header">
        <h3>Gráfico de Gantt</h3>

        <div className="gantt-toolbar">
          <button
            className="chip"
            type="button"
            onClick={() => usePlannerStore.getState().setZoom(28)}
          >
            Compacto
          </button>

          <button
            className="chip active"
            type="button"
            onClick={() => usePlannerStore.getState().setZoom(36)}
          >
            Padrão
          </button>

          <button
            className="chip"
            type="button"
            onClick={() => usePlannerStore.getState().setZoom(52)}
          >
            Detalhado
          </button>
        </div>
      </div>

      <div className="panel-body gantt-wrap">
        <div
          ref={headerRef}
          className="gantt-header"
          onScroll={(event) => {
            if (bodyRef.current) {
              bodyRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
        >
          <div className="gantt-month-row" style={{ width: `${canvasWidth}px` }}>
            {monthSegments.map((segment, index) => (
              <div
                key={`${segment.label}-${index}`}
                className="gantt-month-cell"
                style={{ width: `${segment.width}px` }}
              >
                {segment.label}
              </div>
            ))}
          </div>

          <div className="gantt-header-inner" style={{ width: `${canvasWidth}px` }}>
            {Array.from({ length: totalDays }).map((_, index) => {
              const date = addDays(range.start, index);
              const weekend = isWeekend(date);

              return (
                <div key={index} className={weekend ? 'gantt-day weekend' : 'gantt-day'}>
                  <strong>{formatDayNumber(date)}</strong>
                  <span>{formatDayLabel(date)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          ref={bodyRef}
          className="gantt-body"
          onScroll={(event) => {
            setScrollTop(event.currentTarget.scrollTop);

            if (headerRef.current) {
              headerRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
        >
          <div
            className="gantt-canvas"
            style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
          >
            {Array.from({ length: totalDays }).map((_, index) => {
              const date = addDays(range.start, index);

              if (!isWeekend(date)) {
                return null;
              }

              return (
                <div
                  key={`weekend-${index}`}
                  className="gantt-weekend"
                  style={{ left: `${index * zoom}px`, width: `${zoom}px` }}
                />
              );
            })}

            {tasks.map((task, rowIndex) => (
              <div
                key={`row-${task.id}`}
                className="gantt-row"
                style={{ top: `${rowIndex * ROW_HEIGHT}px` }}
              />
            ))}

            <svg className="gantt-links-layer" width={canvasWidth} height={canvasHeight}>
              <defs>
                <marker
                  id="gantt-arrow-default"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#7fd4ff" />
                </marker>

                <marker
                  id="gantt-arrow-critical"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff9d7e" />
                </marker>
              </defs>

              {arrows.map((arrow) => (
                <path
                  key={arrow.id}
                  d={arrow.path}
                  className={arrow.isCritical ? 'gantt-link critical' : 'gantt-link'}
                  markerEnd={
                    arrow.isCritical
                      ? 'url(#gantt-arrow-critical)'
                      : 'url(#gantt-arrow-default)'
                  }
                />
              ))}
            </svg>

            {todayOffset >= 0 && todayOffset <= canvasWidth ? (
              <>
                <div className="gantt-today-line" style={{ left: `${todayOffset}px` }} />
                <div className="gantt-today-badge" style={{ left: `${todayOffset}px` }}>
                  HOJE
                </div>
              </>
            ) : null}

            {tasks.map((task, rowIndex) => {
              if (!task.startDate || !task.endDate) {
                return null;
              }

              const metrics = getBarMetrics(task, range.start, zoom);
              const barPreview = preview?.taskId === task.id ? preview : null;
              const left = barPreview ? barPreview.left : metrics.left;
              const width = barPreview ? barPreview.width : metrics.width;
              
              const isSummary = task.type === 'summary';
              const top = rowIndex * ROW_HEIGHT + (isSummary ? 16 : 8);
              const height = isSummary ? 16 : 28;

              const classNames = [
                'gantt-bar',
                isSummary ? 'summary' : '',
                task.isCritical ? 'critical' : '',
                selectedTaskId === task.id ? 'selected' : '',
                dragState?.taskId === task.id ? 'dragging' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={task.id}
                  className="gantt-bar-wrap"
                  style={{ left: `${left}px`, width: `${width}px`, top: `${top}px`, height: `${height}px` }}
                >
                  <span className="gantt-bar-id">{task.wbsCode}</span>

                  <div
                    className={classNames}
                    title={task.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTaskId(task.id)}
                    onMouseDown={(event) => {
                      if (isSummary) {
                        setSelectedTaskId(task.id);
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();

                      setSelectedTaskId(task.id);
                      setDragState({
                        taskId: task.id,
                        mode: 'move',
                        startX: event.clientX,
                        initialLeft: metrics.left,
                        initialWidth: metrics.width,
                        startDate: task.startDate as string,
                        durationDays: Math.max(1, task.durationDays),
                      });

                      setPreview({
                        taskId: task.id,
                        left: metrics.left,
                        width: metrics.width,
                      });
                    }}
                  >
                    <div
                      className="gantt-bar-progress"
                      style={{
                        width: `${Math.max(0, Math.min(100, task.progressPercent))}%`,
                      }}
                    />

                    {isSummary ? (
                      <>
                        <div className="summary-delimiter start" />
                        <div className="summary-delimiter end" />
                      </>
                    ) : (
                      <>
                        <span className="gantt-connector start" />
                        <span className="gantt-connector end" />
                      </>
                    )}

                    {!isSummary && task.type === 'task' ? (
                      <div
                        className="gantt-resize-handle"
                        aria-label="Redimensionar duração"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          setSelectedTaskId(task.id);
                          setDragState({
                            taskId: task.id,
                            mode: 'resize-right',
                            startX: event.clientX,
                            initialLeft: metrics.left,
                            initialWidth: metrics.width,
                            startDate: task.startDate as string,
                            durationDays: Math.max(1, task.durationDays),
                          });

                          setPreview({
                            taskId: task.id,
                            left: metrics.left,
                            width: metrics.width,
                          });
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}