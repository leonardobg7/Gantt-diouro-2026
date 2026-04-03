import type { Project } from '@/types';

export function createProject(input?: Partial<Project>): Project {
  const now = new Date().toISOString();

  return {
    id: input?.id ?? 'project-001',
    name: input?.name ?? 'Residencial Colorado V2',
    description: input?.description,
    timezone: input?.timezone ?? 'America/Sao_Paulo',
    currency: input?.currency ?? 'BRL',
    startDate: input?.startDate,
    endDate: input?.endDate,
    calendarId: input?.calendarId ?? 'calendar-br-default',
    defaultZoom: input?.defaultZoom ?? 36,
    createdAt: input?.createdAt ?? now,
    updatedAt: input?.updatedAt ?? now,
  };
}
