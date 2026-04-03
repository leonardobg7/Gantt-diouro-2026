import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Task } from '@/types';
import { sortTasksByHierarchy } from '@/modules/planner/domain/services/hierarchy-engine';
import { usePlannerStore } from '@/modules/planner/state/planner-store';
import { addWorkingDays, shiftWorkingDate } from '@/modules/planner/domain/services/working-days-engine';

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

interface GanttBarProps {
  task: Task;
  rowIndex: number;
  range: { start: Date; end: Date };
  zoom: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function GanttBar({ task, rowIndex, range, zoom, isSelected, onSelect }: GanttBarProps) {
  const updateTask = usePlannerStore((state) => state.updateTask);
  const snapshot = usePlannerStore((state) => state.snapshot);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [visualLeft, setVisualLeft] = useState(0);
  const [visualWidth, setVisualWidth] = useState(0);

  const calculateInitial = useCallback(() => {
    if (!task.startDate || !task.endDate) return { left: 0, width: 0 };
    const start = parseIsoDate(task.startDate);
    const end = parseIsoDate(task.endDate);
    const left = diffInDays(range.start, start) * zoom + 3;
    const width = Math.max(zoom - 6, (diffInDays(start, end) + 1) * zoom - 6);
    return { left, width };
  }, [task.startDate, task.endDate, range.start, zoom]);

  useEffect(() => {
    if (!isDragging && !isResizing) {
      const { left, width } = calculateInitial();
      setVisualLeft(left);
      setVisualWidth(width);
    }
  }, [calculateInitial, isDragging, isResizing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (task.type === 'summary') return;
    e.stopPropagation();
    onSelect(task.id);
    setIsDragging(true);
    console.log('[GanttBar:drag-start]', task.id);

    const startX = e.pageX;
    const initialLeft = visualLeft;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      // Snap to zoom grid
      const snappedDelta = Math.round(deltaX / zoom) * zoom;
      setVisualLeft(initialLeft + snappedDelta);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.pageX - startX;
      const dayDelta = Math.round(deltaX / zoom);
      
      if (dayDelta !== 0 && task.startDate) {
        const nextStart = shiftWorkingDate(task.startDate, dayDelta, snapshot.calendar, snapshot.holidays);
        const nextEnd = addWorkingDays(nextStart, task.durationDays, snapshot.calendar, snapshot.holidays);
        
        console.log('[GanttBar:drag-end]', { taskId: task.id, dayDelta, nextStart, nextEnd });
        updateTask(task.id, { startDate: nextStart, endDate: nextEnd });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (task.type !== 'task') return;
    e.stopPropagation();
    setIsResizing(true);
    console.log('[GanttBar:resize-start]', task.id);

    const startX = e.pageX;
    const initialWidth = visualWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const snappedWidth = Math.max(zoom - 6, initialWidth + Math.round(deltaX / zoom) * zoom);
      setVisualWidth(snappedWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.pageX - startX;
      const dayDelta = Math.round(deltaX / zoom);
      
      if (dayDelta !== 0 && task.startDate) {
        const nextDuration = Math.max(1, task.durationDays + dayDelta);
        const nextEnd = addWorkingDays(task.startDate, nextDuration, snapshot.calendar, snapshot.holidays);
        
        console.log('[GanttBar:resize-end]', { taskId: task.id, dayDelta, nextDuration, nextEnd });
        updateTask(task.id, { durationDays: nextDuration, endDate: nextEnd });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const top = rowIndex * 40 + (task.type === 'summary' ? 14 : 9);

  return (
    <div
      className={`gantt-bar ${task.type} ${task.isCritical ? 'critical' : ''} ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${visualLeft}px`,
        width: `${visualWidth}px`,
        top: `${top}px`,
      }}
      onMouseDown={handleMouseDown}
      data-type={task.type}
    >
      {task.type !== 'summary' && (
        <div 
          className="gantt-bar-progress" 
          style={{ width: `${task.progressPercent}%` }} 
        />
      )}
      <span className="gantt-bar-label">{task.name}</span>
      {task.type === 'task' && (
        <div className="bar-resize-handle" onMouseDown={handleResizeMouseDown} />
      )}
    </div>
  );
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
  const canvasHeight = tasks.length * 40 + 20;
  const today = new Date();
  const todayOffset = diffInDays(range.start, today) * zoom;

  const arrows = useMemo(() => {
    const lineData: { path: string; isCritical: boolean; id: string }[] = [];
    
    snapshot.dependencies.forEach((dep) => {
      const sourceIndex = tasks.findIndex((t) => t.id === dep.sourceTaskId);
      const targetIndex = tasks.findIndex((t) => t.id === dep.targetTaskId);
      
      if (sourceIndex === -1 || targetIndex === -1) return;
      
      const sourceTask = tasks[sourceIndex];
      const targetTask = tasks[targetIndex];
      
      if (!sourceTask.startDate || !sourceTask.endDate || !targetTask.startDate) return;
      
      const sourceEnd = parseIsoDate(sourceTask.endDate);
      const targetStart = parseIsoDate(targetTask.startDate);
      
      const x1 = diffInDays(range.start, sourceEnd) * zoom + zoom - 6;
      const y1 = sourceIndex * 40 + 13 + (sourceTask.type === 'summary' ? 5 : 0);
      
      const x2 = diffInDays(range.start, targetStart) * zoom + 3;
      const y2 = targetIndex * 40 + 13 + (targetTask.type === 'summary' ? 5 : 0);
      
      const isCritical = sourceTask.isCritical && targetTask.isCritical;
      
      const midX = x1 + (x2 - x1) / 2;
      const path = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
      
      lineData.push({ path, isCritical, id: dep.id });
    });
    
    return lineData;
  }, [snapshot.dependencies, tasks, range.start, zoom]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Gráfico de Gantt</h3>
      </div>

      <div className="panel-body gantt-wrap">
        <div className="gantt-header">
          <div className="gantt-header-inner" style={{ width: `${canvasWidth}px` }}>
            {Array.from({ length: totalDays }).map((_, index) => {
              const date = addDays(range.start, index);
              const weekend = isWeekend(date);
              return (
                <div
                  key={String(index)}
                  className={`gantt-day ${weekend ? 'weekend' : ''}`}
                >
                  <strong>{formatDayNumber(date)}</strong>
                  <span>{formatDayLabel(date)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="gantt-body">
          <div className="gantt-canvas" style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}>
            {Array.from({ length: totalDays }).map((_, index) => {
              const date = addDays(range.start, index);
              if (!isWeekend(date)) return null;

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
                style={{ top: `${rowIndex * 40}px` }}
              />
            ))}

            <svg className="gantt-svg-overlay" style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}>
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="#64748b" opacity="0.3" />
                </marker>
                <marker id="arrowhead-critical" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="var(--critical)" opacity="0.8" />
                </marker>
              </defs>
              {arrows.map((arrow) => (
                <path
                  key={arrow.id}
                  d={arrow.path}
                  fill="none"
                  stroke={arrow.isCritical ? 'var(--critical)' : 'rgba(100, 116, 139, 0.2)'}
                  strokeWidth={arrow.isCritical ? 1.2 : 1}
                  markerEnd={`url(#${arrow.isCritical ? 'arrowhead-critical' : 'arrowhead'})`}
                  strokeDasharray={arrow.isCritical ? 'none' : '2,2'}
                />
              ))}
            </svg>

            {todayOffset >= 0 && todayOffset <= canvasWidth && (
              <div className="gantt-today-line" style={{ left: `${todayOffset}px` }}>
                <div className="today-label">HOJE</div>
              </div>
            )}

            {tasks.map((task, rowIndex) => (
              <GanttBar
                key={task.id}
                task={task}
                rowIndex={rowIndex}
                range={range}
                zoom={zoom}
                isSelected={selectedTaskId === task.id}
                onSelect={setSelectedTaskId}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
