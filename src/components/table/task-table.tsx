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

  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

export function TaskTable() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const selectedTaskId = usePlannerStore((state) => state.selectedTaskId);
  const setSelectedTaskId = usePlannerStore((state) => state.setSelectedTaskId);

  const orderedTasks = sortTasksByHierarchy(snapshot.tasks);

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Planilha do cronograma</h3>
      </div>

      <div className="panel-body table-wrap">
        <div className="task-table-header">
          <div className="task-table-head">ID</div>
          <div className="task-table-head">Tarefa</div>
          <div className="task-table-head">Duração</div>
          <div className="task-table-head">Início</div>
          <div className="task-table-head">Término</div>
          <div className="task-table-head">%</div>
        </div>

        <div className="task-table-body">
          {orderedTasks.map((task) => {
            const depth = getTaskDepth(orderedTasks, task.id);
            const isSelected = selectedTaskId === task.id;
            const typeLabel =
              task.type === 'summary'
                ? 'Resumo'
                : task.type === 'milestone'
                  ? 'Marco'
                  : 'Task';

            return (
              <div
                key={task.id}
                className={isSelected ? 'task-table-row selected' : 'task-table-row'}
                onClick={() => setSelectedTaskId(task.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setSelectedTaskId(task.id);
                  }
                }}
              >
                <div className="task-table-cell">{task.wbsCode}</div>
                <div className="task-table-cell">
                  <div className="task-name" style={{ paddingLeft: String(depth * 14) + 'px' }}>
                    <span className="depth-dot" />
                    <span className="task-name-label">{task.name}</span>
                    <span className={task.type === 'summary' ? 'task-tag summary' : 'task-tag'}>
                      {typeLabel}
                    </span>
                    {task.isCritical ? <span className="task-tag critical">Crítica</span> : null}
                  </div>
                </div>
                <div className="task-table-cell">{task.durationDays}</div>
                <div className="task-table-cell">{formatDate(task.startDate)}</div>
                <div className="task-table-cell">{formatDate(task.endDate)}</div>
                <div className="task-table-cell">{task.progressPercent}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
