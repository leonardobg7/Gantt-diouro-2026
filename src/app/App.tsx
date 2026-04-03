import { useCallback, useEffect, useRef } from 'react';
import { GanttBoard } from '@/components/gantt/gantt-board';
import { TaskTable } from '@/components/table/task-table';
import { usePlannerStore } from '@/modules/planner/state/planner-store';

export default function App() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const leftPanelWidth = usePlannerStore((state) => state.leftPanelWidth);
  const setLeftPanelWidth = usePlannerStore((state) => state.setLeftPanelWidth);
  const resetToSample = usePlannerStore((state) => state.resetToSample);

  const dragStateRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const delta = event.clientX - dragState.startX;
      const nextWidth = Math.max(420, Math.min(920, dragState.startWidth + delta));
      setLeftPanelWidth(nextWidth);
    },
    [setLeftPanelWidth]
  );

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleDividerMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: leftPanelWidth,
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const leafTasks = snapshot.tasks.filter((task) => task.type !== 'summary');
  const criticalCount = leafTasks.filter((task) => task.isCritical).length;
  const avgProgress =
    leafTasks.length > 0
      ? Math.round(
          leafTasks.reduce((sum, task) => sum + task.progressPercent, 0) / leafTasks.length
        )
      : 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">OF</div>

          <div>
            <h1>ObraFlow Planner</h1>
            <p>Planejamento de obras com Gantt interativo</p>
          </div>
        </div>

        <div className="toolbar">
          <button className="btn ghost" type="button">
            Importar XLSX
          </button>

          <button className="btn ghost" type="button">
            Calendário BR
          </button>

          <button className="btn primary" type="button" onClick={resetToSample}>
            Resetar mock
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-card">
          <div>
            <div className="hero-badge">Projeto ativo</div>
            <h2>{snapshot.project.name}</h2>
            <p>
              Cronograma executivo com hierarquia, dias úteis, predecessoras, caminho
              crítico e visual premium em tema dark-blue.
            </p>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span>Tarefas</span>
              <strong>{leafTasks.length}</strong>
            </div>

            <div className="stat-card">
              <span>Críticas</span>
              <strong>{criticalCount}</strong>
            </div>

            <div className="stat-card">
              <span>Avanço</span>
              <strong>{avgProgress}%</strong>
            </div>
          </div>
        </div>
      </section>

      <main
        className="planner-shell"
        style={
          {
            '--left-panel-width': `${leftPanelWidth}px`,
          } as React.CSSProperties
        }
      >
        <TaskTable />

        <div
          className="planner-divider"
          onMouseDown={handleDividerMouseDown}
          role="separator"
          aria-label="Redimensionar tabela e Gantt"
          aria-orientation="vertical"
        />

        <GanttBoard />
      </main>
    </div>
  );
}