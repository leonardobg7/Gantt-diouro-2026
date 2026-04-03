import { useMemo } from 'react';
import { GanttBoard } from '@/components/gantt/gantt-board';
import { TaskTable } from '@/components/table/task-table';
import { usePlannerStore } from '@/modules/planner/state/planner-store';

export default function App() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const resetToSample = usePlannerStore((state) => state.resetToSample);

  const stats = useMemo(() => {
    const leafTasks = snapshot.tasks.filter((task) => task.type !== 'summary');
    const criticalTasks = leafTasks.filter((task) => task.isCritical);
    const progressBase =
      leafTasks.length > 0
        ? Math.round(
            leafTasks.reduce((sum, task) => sum + task.progressPercent, 0) /
              leafTasks.length
          )
        : 0;

    return {
      taskCount: leafTasks.length,
      criticalCount: criticalTasks.length,
      averageProgress: progressBase,
    };
  }, [snapshot.tasks]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">OF</div>
          <div>
            <h1>ObraFlow Planner</h1>
            <p>Base inicial para planejamento de obras com Gantt interativo</p>
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
              Estrutura inicial com domínio separado, persistência local, mock de
              cronograma e visual premium pronto para expansão.
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
              <span>Avanço médio</span>
              <strong>{stats.averageProgress}%</strong>
            </div>
          </div>
        </div>
      </section>

      <main className="planner-shell">
        <TaskTable />
        <GanttBoard />
      </main>
    </div>
  );
}
