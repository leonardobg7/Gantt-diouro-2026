import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dependency, TaskType } from '@/types';
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

function PredecessorCell({
  value,
  options,
  onSave,
}: {
  value: string;
  options: string[];
  onSave: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = 'predecessor-wbs-options';

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draftValue !== value) {
      onSave(draftValue);
    }
  };

  if (editing) {
    return (
      <>
        <input
          ref={inputRef}
          className="cell-input"
          type="text"
          value={draftValue}
          list={listId}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') {
              setDraftValue(value);
              setEditing(false);
            }
          }}
        />

        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <button
      className="cell-button"
      type="button"
      onDoubleClick={() => setEditing(true)}
      title="Duplo clique para digitar ou escolher predecessora"
    >
      {value || '—'}
    </button>
  );
}

function LinkTypeCell({
  value,
  onSave,
}: {
  value: 'FS' | 'SS' | 'FF' | 'SF';
  onSave: (nextValue: 'FS' | 'SS' | 'FF' | 'SF') => void;
}) {
  return (
    <select
      className="cell-select"
      value={value}
      onChange={(event) => onSave(event.target.value as 'FS' | 'SS' | 'FF' | 'SF')}
    >
      <option value="FS">FS</option>
      <option value="SS">SS</option>
      <option value="FF">FF</option>
      <option value="SF">SF</option>
    </select>
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

function TaskActionsMenu({
  taskType,
  onConvertType,
  onAddChildTask,
  onAddChildMilestone,
  onIndent,
  onOutdent,
  onRemove,
}: {
  taskType: TaskType;
  onConvertType: (type: TaskType) => void;
  onAddChildTask: () => void;
  onAddChildMilestone: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="task-menu-popup">
      <button type="button" className="task-menu-item" onClick={() => onConvertType('task')}>
        Converter em task
      </button>
      <button type="button" className="task-menu-item" onClick={() => onConvertType('summary')}>
        Converter em resumo
      </button>
      <button type="button" className="task-menu-item" onClick={() => onConvertType('milestone')}>
        Converter em marco
      </button>
      <button type="button" className="task-menu-item" onClick={onAddChildTask}>
        Adicionar subtarefa
      </button>
      <button type="button" className="task-menu-item" onClick={onAddChildMilestone}>
        Adicionar sub-marco
      </button>
      <button type="button" className="task-menu-item" onClick={onIndent}>
        Indentar hierarquia
      </button>
      <button type="button" className="task-menu-item" onClick={onOutdent}>
        Desindentar hierarquia
      </button>
      <button type="button" className="task-menu-item danger" onClick={onRemove}>
        Excluir tarefa
      </button>
      <div className="task-menu-note">Tipo atual: {taskType}</div>
    </div>
  );
}

export function TaskTable() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const selectedTaskId = usePlannerStore((state) => state.selectedTaskId);
  const setSelectedTaskId = usePlannerStore((state) => state.setSelectedTaskId);
  const updateTask = usePlannerStore((state) => state.updateTask);
  const updateDependencyInput = usePlannerStore((state) => state.updateDependencyInput);
  const addTaskAfterSelected = usePlannerStore((state) => state.addTaskAfterSelected);
  const addChildTask = usePlannerStore((state) => state.addChildTask);
  const removeSelectedTask = usePlannerStore((state) => state.removeSelectedTask);
  const convertSelectedTaskType = usePlannerStore((state) => state.convertSelectedTaskType);
  const indentSelectedTask = usePlannerStore((state) => state.indentSelectedTask);
  const outdentSelectedTask = usePlannerStore((state) => state.outdentSelectedTask);
  const columnWidths = usePlannerStore((state) => state.columnWidths);
  const scrollTop = usePlannerStore((state) => state.scrollTop);
  const setScrollTop = usePlannerStore((state) => state.setScrollTop);

  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bodyRef.current) return;

    if (Math.abs(bodyRef.current.scrollTop - scrollTop) > 1) {
      bodyRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setMenuTaskId(null);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const orderedTasks = useMemo(() => sortTasksByHierarchy(snapshot.tasks), [snapshot.tasks]);
  const taskById = useMemo(
    () => new Map(orderedTasks.map((task) => [task.id, task])),
    [orderedTasks]
  );
  const predecessorOptions = useMemo(
    () => orderedTasks.map((task) => task.wbsCode).filter(Boolean),
    [orderedTasks]
  );

  const gridTemplate = columnWidths.map((width) => `${width}px`).join(' ');
  const headers = ['ID', 'Tarefa', 'Dur.', 'Início', 'Término', '%', 'Predecessora', 'Vínculo'];

  return (
    <section ref={panelRef} className="panel table-panel">
      <div className="panel-header panel-header-table">
        <div className="panel-header-title">
          <h3>Planilha do cronograma</h3>
          <span className="panel-subtle">Duplo clique para editar</span>
        </div>

        <div className="table-actions">
          <button className="btn btn-small primary" type="button" onClick={() => addTaskAfterSelected('task')}>
            + Tarefa
          </button>
          <button className="btn btn-small ghost" type="button" onClick={() => addTaskAfterSelected('milestone')}>
            + Marco
          </button>
          <button className="btn btn-small ghost danger" type="button" onClick={removeSelectedTask}>
            Remover
          </button>
        </div>
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
                  height: `${ROW_HEIGHT}px`,
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
                    />

                    <span className={isSummary ? 'task-tag summary' : 'task-tag'}>
                      {isSummary ? 'Resumo' : task.type === 'milestone' ? 'Marco' : 'Task'}
                    </span>

                    {task.isCritical ? <span className="task-tag critical">Crítica</span> : null}

                    <button
                      type="button"
                      className="task-actions-trigger"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedTaskId(task.id);
                        setMenuTaskId((current) => (current === task.id ? null : task.id));
                      }}
                      aria-label="Abrir ações da tarefa"
                    >
                      ⋯
                    </button>

                    {menuTaskId === task.id ? (
                      <TaskActionsMenu
                        taskType={task.type}
                        onConvertType={(nextType) => {
                          setSelectedTaskId(task.id);
                          convertSelectedTaskType(nextType);
                          setMenuTaskId(null);
                        }}
                        onAddChildTask={() => {
                          setSelectedTaskId(task.id);
                          addChildTask('task');
                          setMenuTaskId(null);
                        }}
                        onAddChildMilestone={() => {
                          setSelectedTaskId(task.id);
                          addChildTask('milestone');
                          setMenuTaskId(null);
                        }}
                        onIndent={() => {
                          setSelectedTaskId(task.id);
                          indentSelectedTask();
                          setMenuTaskId(null);
                        }}
                        onOutdent={() => {
                          setSelectedTaskId(task.id);
                          outdentSelectedTask();
                          setMenuTaskId(null);
                        }}
                        onRemove={() => {
                          setSelectedTaskId(task.id);
                          removeSelectedTask();
                          setMenuTaskId(null);
                        }}
                      />
                    ) : null}
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
                  <PredecessorCell
                    value={predecessorWbs}
                    options={predecessorOptions}
                    onSave={(newValue) => updateDependencyInput(task.id, newValue, linkType)}
                  />
                </div>

                <div className="task-table-cell">
                  <LinkTypeCell
                    value={linkType}
                    onSave={(nextType) =>
                      updateDependencyInput(task.id, predecessorWbs, nextType)
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