import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTaskDepth, sortTasksByHierarchy } from '@/modules/planner/domain/services/hierarchy-engine';
import { usePlannerStore } from '@/modules/planner/state/planner-store';

function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }

  const parts = value.split('-');
  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function toIsoDate(value: string): string {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

function buildPredecessorText(
  taskId: string,
  dependencies: Array<{
    sourceTaskId: string;
    targetTaskId: string;
    type: string;
    lagDays: number;
  }>,
  tasks: Array<{ id: string; wbsCode: string }>
): string {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const incoming = dependencies.filter((dependency) => dependency.targetTaskId === taskId);

  if (incoming.length === 0) {
    return '—';
  }

  return incoming
    .map((dependency) => {
      const source = taskById.get(dependency.sourceTaskId);
      const sourceCode = source?.wbsCode ?? dependency.sourceTaskId;
      const lag =
        dependency.lagDays === 0
          ? ''
          : dependency.lagDays > 0
            ? `+${dependency.lagDays}`
            : `${dependency.lagDays}`;

      return `${sourceCode} ${dependency.type}${lag}`;
    })
    .join(', ');
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

    if (disabled) {
      return;
    }

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
          if (event.key === 'Enter') {
            commit();
          }

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
      className={`cell-button ${align === 'center' ? 'center' : ''} ${
        disabled ? 'disabled' : ''
      }`}
      type="button"
      disabled={disabled}
      onDoubleClick={() => {
        if (!disabled) {
          setEditing(true);
        }
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
  const columnWidths = usePlannerStore((state) => state.columnWidths);
  const scrollTop = usePlannerStore((state) => state.scrollTop);
  const setScrollTop = usePlannerStore((state) => state.setScrollTop);

  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bodyRef.current) {
      return;
    }

    if (Math.abs(bodyRef.current.scrollTop - scrollTop) > 1) {
      bodyRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  const orderedTasks = useMemo(() => sortTasksByHierarchy(snapshot.tasks), [snapshot.tasks]);
  const gridTemplate = columnWidths.map((width) => `${width}px`).join(' ');
  const headers = ['ID', 'Tarefa', 'Dur.', 'Início', 'Término', '%', 'Predecessoras'];

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
            const predecessorText = buildPredecessorText(
              task.id,
              snapshot.dependencies,
              orderedTasks
            );

            return (
              <div
                key={task.id}
                className={isSelected ? 'task-table-row selected' : 'task-table-row'}
                style={{ gridTemplateColumns: gridTemplate }}
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
                      disabled={isSummary}
                    />
                    <span className={isSummary ? 'task-tag summary' : 'task-tag'}>
                      {isSummary ? 'Resumo' : task.type === 'milestone' ? 'Marco' : 'Task'}
                    </span>
                    {task.isCritical ? <span className="task-tag critical">Crítica</span> : null}
                  </div>
                </div>

                <div className="task-table-cell">
                  {isSummary ? (
                    <span className="static-value center">{task.durationDays}d</span>
                  ) : (
                    <EditableCell
                      value={task.durationDays}
                      type="number"
                      align="center"
                      onSave={(newValue) =>
                        updateTask(task.id, {
                          durationDays: Math.max(1, Number(newValue) || 1),
                        })
                      }
                    />
                  )}
                </div>

                <div className="task-table-cell">
                  {isSummary ? (
                    <span className="static-value">{formatDate(task.startDate)}</span>
                  ) : (
                    <EditableCell
                      value={formatDate(task.startDate)}
                      type="date"
                      onSave={(newValue) =>
                        updateTask(task.id, {
                          startDate: toIsoDate(newValue),
                        })
                      }
                    />
                  )}
                </div>

                <div className="task-table-cell">
                  <span className="static-value">{formatDate(task.endDate)}</span>
                </div>

                <div className="task-table-cell">
                  {isSummary ? (
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
                  <span className="static-value predecessor-text">{predecessorText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}