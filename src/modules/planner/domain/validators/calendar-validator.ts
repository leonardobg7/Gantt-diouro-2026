import type { Calendar } from '@/types';

export function validateCalendar(calendar: Calendar): string[] {
  const errors: string[] = [];

  if (!calendar.name.trim()) {
    errors.push('Calendar name is required');
  }

  if (calendar.workingWeekdays.length === 0) {
    errors.push('Calendar must have at least one working weekday');
  }

  return errors;
}
