import type { Calendar } from '@/types';

export function createCalendar(input?: Partial<Calendar>): Calendar {
  const now = new Date().toISOString();

  return {
    id: input?.id ?? 'calendar-br-default',
    projectId: input?.projectId,
    name: input?.name ?? 'Calendário Brasil',
    countryCode: input?.countryCode ?? 'BR',
    workingWeekdays: input?.workingWeekdays ?? [1, 2, 3, 4, 5],
    hoursPerDay: input?.hoursPerDay ?? 8,
    isDefault: input?.isDefault ?? true,
    createdAt: input?.createdAt ?? now,
    updatedAt: input?.updatedAt ?? now,
  };
}
