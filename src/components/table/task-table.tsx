import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dependency } from '@/types';
import { getTaskDepth, sortTasksByHierarchy } from '@/modules/planner/domain/services/hierarchy-engine';
import { usePlannerStore } from '@/modules/planner/state/planner-store';

const ROW_HEIGHT = 44;

function formatDate(value?: string): string {
  if (!value) return '—';

  const parts = value.split('-');
  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function toIsoDate(value: string): string {
  const trimmed = value.trim();
  const currentYear = new Date().getFullYear();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{2}\/\d{2}$/.test(trimmed)) {
    const [day, month] = trimmed.split('/');
    return `${currentYear}-${month}-${day}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

function getIncomingDependency(
  taskId: string,
  dependencies: Dependency[]
): Dependency | null {
  return dependencies.find((dependency) => dependency.targetTaskId === taskId) ?? null;
}

interface EditableCellProps {
  value: string | number;
  onSave: (newValue: string) => void;
  type?: 'text' | 'number' | 'date';
  align?: 'left' | 'center';
  disabled?: boolean;
}

function EditableCell({
  value,
  onSave,
  type = 'text',
  align = 'left',
  disabled = false,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (disabled) return;

    if (draftValue !== String(value)) {
      onSave(draftValue);
    }
  };

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        className={`cell-input ${align === 'center' ? 'center' : ''}`}
        type={type === 'number' ? 'number' : 'text'}
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setDraftValue(String(value));
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className={`cell-button ${align === 'center' ? 'center' : ''} ${disabled ? 'disabled' : ''}`}
      type="button"
      disabled={disabled}
      onDoubleClick={() => {
        if (!disabled) setEditing(true);
      }}
      title={disabled ? '' : 'Duplo clique para editar'}
    >
      {String(value)}
    </button>
  );
}

function ColResizer({ index }: { index: number }) {
  const updateColumnWidth = usePlannerStore((state) => state.updateColumnWidth);
  const columnWidths = usePlannerStore((state) => state.columnWidths);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.pageX;
      const startWidth = columnWidths[index];

      const handleMouseMove = (mouseEvent: MouseEvent) => {
        const nextWidth = Math.max(56, startWidth + (mouseEvent.pageX - startX));
        updateColumnWidth(index, nextWidth);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [columnWidths, index, updateColumnWidth]
  );

  return <div className="col-resizer" onMouseDown={handleMouseDown} aria-hidden="true" />;
}

export function TaskTable() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const selectedTaskId = usePlannerStore((state) => state.selectedTaskId);
  const setSelectedTaskId = usePlannerStore((state) => state.setSelectedTaskId);
  const updateTask = usePlannerStore((state) => state.updateTask);
  const updateDependencyInput = usePlannerStore((state) => state.updateDependencyInput);
  const columnWidths = usePlannerStore((state) => state.columnWidths);
  const scrollTop = usePlannerStore((state) => state.scrollTop);
  const setScrollTop = usePlannerStore((state) => state.setScrollTop);

  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bodyRef.current) return;

    if (Math.abs(bodyRef.current.scrollTop - scrollTop) > 1) {
      bodyRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  const orderedTasks = useMemo(() => sortTasksByHierarchy(snapshot.tasks), [snapshot.tasks]);
  const taskById = useMemo(
    () => new Map(orderedTasks.map((task) => [task.id, task])),
    [orderedTasks]
  );
  
  const gridTemplate = columnWidths.map((width) => `${width}px`).join(' ');
  const headers = ['ID', 'Tarefa', 'Dur.', 'Início', 'Término', '%', 'Predecessora', 'Vínculo'];

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <h3>Planilha do cronograma</h3>
        <span className="panel-subtle">Duplo clique para editar</span>
      </div>

      <div className="panel-body table-wrap">
        <div className="task-table-header" style={{ gridTemplateColumns: gridTemplate }}>
          {headers.map((label, index) => (
            <div key={label} className="task-table-head">
              <span>{label}</span>
              {index < headers.length - 1 ? <ColResizer index={index} /> : null}
            </div>
          ))}
        </div>

        <div
          ref={bodyRef}
          className="task-table-body"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {orderedTasks.map((task) => {
            const depth = getTaskDepth(orderedTasks, task.id);
            const isSelected = selectedTaskId === task.id;
            const isSummary = task.type === 'summary';
            
            const incoming = getIncomingDependency(task.id, snapshot.dependencies);
            const predecessorWbs = incoming
              ? taskById.get(incoming.sourceTaskId)?.wbsCode ?? ''
              : '';
            const linkType = incoming?.type ?? 'FS';

            return (
              <div
                key={task.id}
                className={isSelected ? 'task-table-row selected' : 'task-table-row'}
                style={{
                  gridTemplateColumns: gridTemplate,
                  minHeight: `${ROW_HEIGHT}px`,
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
                <div className="task-table-cell mono">{task.wbsCode}</div>

                <div className="task-table-cell">
                  <div className="task-name" style={{ paddingLeft: `${depth * 14}px` }}>
                    <span className="depth-dot" />
                    <EditableCell
                      value={task.name}
                      onSave={(newValue) => updateTask(task.id, { name: newValue })}
                      disabled={false}
                    />
                    <span className={isSummary ? 'task-tag summary' : 'task-tag'}>
                      {isSummary ? 'Resumo' : task.type === 'milestone' ? 'Marco' : 'Task'}
                    </span>
                    {task.isCritical ? <span className="task-tag critical">Crítica</span> : null}
                  </div>
                </div>

                <div className="task-table-cell">
                  {task.type === 'summary' ? (
                    <span className="static-value center">{task.durationDays}d</span>
                  ) : (
                    <EditableCell
                      value={task.type === 'milestone' ? 0 : task.durationDays}
                      type="number"
                      align="center"
                      onSave={(newValue) =>
                        updateTask(task.id, {
                          durationDays:
                            task.type === 'milestone'
                              ? 0
                              : Math.max(1, Number(newValue) || 1),
                        })
                      }
                    />
                  )}
                </div>

                <div className="task-table-cell">
                  <EditableCell
                    value={formatDate(task.startDate)}
                    type="date"
                    onSave={(newValue) =>
                      updateTask(task.id, {
                        startDate: toIsoDate(newValue),
                      })
                    }
                  />
                </div>

                <div className="task-table-cell">
                  <span className="static-value">{formatDate(task.endDate)}</span>
                </div>

                <div className="task-table-cell">
                  {task.type === 'summary' ? (
                    <span className="static-value center">{task.progressPercent}%</span>
                  ) : (
                    <EditableCell
                      value={task.progressPercent}
                      type="number"
                      align="center"
                      onSave={(newValue) =>
                        updateTask(task.id, {
                          progressPercent: Math.max(0, Math.min(100, Number(newValue) || 0)),
                        })
                      }
                    />
                  )}
                </div>

                <div className="task-table-cell">
                  <EditableCell
                    value={predecessorWbs || '—'}
                    onSave={(newValue) =>
                      updateDependencyInput(task.id, newValue === '—' ? '' : newValue, linkType)
                    }
                  />
                </div>

                <div className="task-table-cell">
                  <EditableCell
                    value={linkType}
                    align="center"
                    onSave={(newValue) =>
                      updateDependencyInput(
                        task.id,
                        predecessorWbs,
                        (newValue.toUpperCase() as 'FS' | 'SS' | 'FF' | 'SF')
                      )
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}