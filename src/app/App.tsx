import { useMemo, useRef } from 'react';
import { GanttBoard } from '@/components/gantt/gantt-board';
import { TaskTable } from '@/components/table/task-table';
import { usePlannerStore } from '@/modules/planner/state/planner-store';
import { importXlsxFile } from '@/modules/planner/infrastructure/importers/xlsx-importer';
import { convertImportedToSnapshot } from '@/modules/planner/domain/services/import-engine';

export default function App() {
  const snapshot = usePlannerStore((state) => state.snapshot);
  const resetToSample = usePlannerStore((state) => state.resetToSample);
  const replaceSnapshot = usePlannerStore((state) => state.replaceSnapshot);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importXlsxFile(file);
      if (result.errors.length > 0) {
        alert('Erros na importação:\n' + result.errors.join('\n'));
      }
      
      if (result.rows.length > 0) {
        const nextSnapshot = convertImportedToSnapshot(snapshot.project, result.rows);
        replaceSnapshot(nextSnapshot);
      }
    } catch (err) {
      console.error(err);
      alert('Falha ao processar arquivo XLSX.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">OF</div>
          <div>
            <h1>ObraFlow Planner</h1>
            <p>Planejamento de obras com visual premium inspirado em MS Project</p>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportXlsx}
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
          />
          <button 
            className="btn ghost" 
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
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
            <div className="hero-badge">Projeto Ativo</div>
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

      <main className="planner-shell">
        <TaskTable />
        <GanttBoard />
      </main>
    </div>
  );
}
