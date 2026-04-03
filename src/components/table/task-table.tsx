import { useState, useEffect, useRef, useCallback } from 'react';
import { getTaskDepth, sortTasksByHierarchy } from '@/modules/planner/domain/services/hierarchy-engine';
import { usePlannerStore } from '@/modules/planner/state/planner-store';

function formatDate(value?: string): string {
  if (!value) return '—';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

interface EditableCellProps {
  value: string | number;
  onSave: (newValue: string) => void;
  type?: 'text' | 'number';
  className?: string;
}

function EditableCell({ value, onSave, type = 'text', className = '' }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentValue(String(value));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (currentValue !== String(value)) {
      onSave(currentValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setCurrentValue(String(value));
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className={`task-table-cell editing ${className}`}>
        <input
          ref={inputRef}
          type={type}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="cell-input"
        />
      </div>
    );
  }

  return (
    <div
      className={`task-table-cell editable ${className}`}
      onClick={() => setEditing(true)}
    >
      {value}
    </div>
  );
}

interface ColResizerProps {
  index: number;
}

function ColResizer({ index }: ColResizerProps) {
  const updateColumnWidth = usePlannerStore((state) => state.updateColumnWidth);
  const columnWidths = usePlannerStore((state) => state.columnWidths);
  const [isResizing, setIsResizing] = useState(false);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.pageX;
    const startWidth = columnWidths[index];
    
    const handleMouseMove = (mouseEvent: MouseEvent) => {
      const currentX = mouseEvent.pageX;
      const newWidth = Math.max(40, startWidth + (currentX - startX));
      updateColumnWidth(index, newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      console.log('[Table:col-resize-end]', { index, finalWidth: columnWidths[index] });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [index, columnWidths, updateColumnWidth]);

  return <div className={`col-resizer ${isResizing ? 'is-resizing' : ''}`} onMouseDown={handleMouseDown} />;
}

export function TaskTable() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const selectedTaskId = usePlannerStore((state) => state.selectedTaskId);
  const setSelectedTaskId = usePlannerStore((state) => state.setSelectedTaskId);
  const updateTask = usePlannerStore((state) => state.updateTask);
  const columnWidths = usePlannerStore((state) => state.columnWidths);

  const orderedTasks = sortTasksByHierarchy(snapshot.tasks);
  
  const gridTemplate = columnWidths.map(w => `${w}px`).join(' ');

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Planilha do cronograma</h3>
      </div>

      <div className="panel-body table-wrap">
        <div className="task-table-header" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="task-table-head">ID <ColResizer index={0} /></div>
          <div className="task-table-head">Tarefa <ColResizer index={1} /></div>
          <div className="task-table-head">Dur. <ColResizer index={2} /></div>
          <div className="task-table-head">Início <ColResizer index={3} /></div>
          <div className="task-table-head">Término <ColResizer index={4} /></div>
          <div className="task-table-head">% <ColResizer index={5} /></div>
        </div>

        <div className="task-table-body">
          {orderedTasks.map((task) => {
            const depth = getTaskDepth(orderedTasks, task.id);
            const isSelected = selectedTaskId === task.id;
            const isSummary = task.type === 'summary';

            return (
              <div
                key={task.id}
                className={`task-table-row ${isSelected ? 'selected' : ''} ${isSummary ? 'summary-row' : ''}`}
                style={{ gridTemplateColumns: gridTemplate }}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="task-table-cell wbs">{task.wbsCode}</div>
                <div className="task-table-cell name-cell" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
                  {task.type === 'summary' && <span className="folder-icon">📁</span>}
                  <EditableCell
                    value={task.name}
                    onSave={(val) => updateTask(task.id, { name: val })}
                    className="full-width"
                  />
                  {task.isCritical && <span className="critical-dot" title="Caminho Crítico" />}
                </div>
                {isSummary ? (
                   <div className="task-table-cell readonly">{task.durationDays}d</div>
                ) : (
                  <EditableCell
                    value={task.durationDays}
                    type="number"
                    onSave={(val) => updateTask(task.id, { durationDays: Number(val) })}
                    className="center"
                  />
                )}
                <div className="task-table-cell date readonly">{formatDate(task.startDate)}</div>
                <div className="task-table-cell date readonly">{formatDate(task.endDate)}</div>
                <EditableCell
                  value={task.progressPercent}
                  type="number"
                  onSave={(val) => updateTask(task.id, { progressPercent: Math.min(100, Math.max(0, Number(val))) })}
                  className="center"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
