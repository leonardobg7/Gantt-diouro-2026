import type { Holiday, HolidayScope } from '@/types';

export interface CreateHolidayInput extends Partial<Holiday> {
  id: string;
  calendarId: string;
  name: string;
  date: string;
  scope?: HolidayScope;
}

export function createHoliday(input: CreateHolidayInput): Holiday {
  return {
    id: input.id,
    calendarId: input.calendarId,
    name: input.name,
    date: input.date,
    scope: input.scope ?? 'project',
    locationCode: input.locationCode,
    recurring: input.recurring ?? false,
  };
}
