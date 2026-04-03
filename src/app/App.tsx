import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { GanttBoard } from '@/components/gantt/gantt-board';
import { TaskTable } from '@/components/table/task-table';
import { usePlannerStore } from '@/modules/planner/state/planner-store';

export default function App() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const leftPanelWidth = usePlannerStore((state) => state.leftPanelWidth);
  const setLeftPanelWidth = usePlannerStore((state) => state.setLeftPanelWidth);
  const resetToSample = usePlannerStore((state) => state.resetToSample);

  const dividerDragRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleWindowMouseMove = useCallback(
    (event: MouseEvent) => {
      const dragState = dividerDragRef.current;
      if (!dragState) return;

      const delta = event.clientX - dragState.startX;
      const nextWidth = Math.max(620, Math.min(1220, dragState.startWidth + delta));
      setLeftPanelWidth(nextWidth);
    },
    [setLeftPanelWidth]
  );

  const handleWindowMouseUp = useCallback(() => {
    dividerDragRef.current = null;
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [handleWindowMouseMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [handleWindowMouseMove, handleWindowMouseUp]);

  const handleDividerMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    dividerDragRef.current = {
      startX: event.clientX,
      startWidth: leftPanelWidth,
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const stats = useMemo(() => {
    const leafTasks = snapshot.tasks.filter((task) => task.type !== 'summary');
    const criticalTasks = leafTasks.filter((task) => task.isCritical);

    const averageProgress =
      leafTasks.length > 0
        ? Math.round(
            leafTasks.reduce((sum, task) => sum + task.progressPercent, 0) / leafTasks.length
          )
        : 0;

    return {
      taskCount: leafTasks.length,
      criticalCount: criticalTasks.length,
      averageProgress,
    };
  }, [snapshot.tasks]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">OF</div>

          <div>
            <h1>ObraFlow Planner</h1>
            <p>Mockup SaaS de planejamento de obras com Gantt interativo</p>
          </div>
        </div>

        <div className="toolbar">
          <button className="btn ghost" type="button">
            Importar XLSX
          </button>

          <button className="btn ghost" type="button">
            Exportar PDF
          </button>

          <button className="btn ghost" type="button">
            Baseline
          </button>

          <button className="btn ghost" type="button" onClick={resetToSample}>
            Resetar
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-card">
          <div>
            <div className="hero-badge">Projeto ativo</div>
            <h2>{snapshot.project.name}</h2>
            <p>
              Estrutura profissional com suporte a dependências (FS, SS, FF, SF),
              cálculo automático de datas, caminho crítico e visual premium.
            </p>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span>Tarefas</span>
              <strong>{stats.taskCount}</strong>
            </div>

            <div className="stat-card">
              <span>Críticas</span>
              <strong>{stats.criticalCount}</strong>
            </div>

            <div className="stat-card">
              <span>Progresso</span>
              <strong>{stats.averageProgress}%</strong>
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
          aria-orientation="vertical"
          aria-label="Redimensionar planilha do cronograma"
        />

        <GanttBoard />
      </main>
    </div>
  );
}