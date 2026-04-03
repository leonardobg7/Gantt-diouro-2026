import type { Calendar, Holiday } from '@/types';

function parseIsoDate(value: string): Date {
  const parts = value.split('-').map(Number);
  return new Date(parts[0] || 2000, (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
}

function formatIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return String(year) + '-' + month + '-' + day;
}

export function normalizeIsoDate(value: string): string {
  return formatIsoDate(parseIsoDate(value));
}

export function addCalendarDays(value: string, amount: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + amount);
  return formatIsoDate(date);
}

export function isHolidayDate(value: string, holidays: Holiday[]): boolean {
  const normalized = normalizeIsoDate(value);
  return holidays.some((holiday) => normalizeIsoDate(holiday.date) === normalized);
}

export function isWorkingDate(value: string, calendar: Calendar, holidays: Holiday[]): boolean {
  const date = parseIsoDate(value);
  const jsDay = date.getDay();
  const weekday = jsDay === 0 ? 7 : jsDay;

  return calendar.workingWeekdays.includes(weekday) && !isHolidayDate(value, holidays);
}

export function moveToNextWorkingDate(
  value: string,
  calendar: Calendar,
  holidays: Holiday[]
): string {
  let current = normalizeIsoDate(value);

  while (!isWorkingDate(current, calendar, holidays)) {
    current = addCalendarDays(current, 1);
  }

  return current;
}

export function shiftWorkingDate(
  value: string,
  offset: number,
  calendar: Calendar,
  holidays: Holiday[]
): string {
  let current = moveToNextWorkingDate(value, calendar, holidays);

  if (offset === 0) {
    return current;
  }

  const direction = offset > 0 ? 1 : -1;
  let remaining = Math.abs(offset);

  while (remaining > 0) {
    current = addCalendarDays(current, direction);

    while (!isWorkingDate(current, calendar, holidays)) {
      current = addCalendarDays(current, direction);
    }

    remaining -= 1;
  }

  return current;
}

export function addWorkingDays(
  startDate: string,
  durationDays: number,
  calendar: Calendar,
  holidays: Holiday[]
): string {
  const safeStart = moveToNextWorkingDate(startDate, calendar, holidays);

  if (durationDays <= 1) {
    return safeStart;
  }

  return shiftWorkingDate(safeStart, durationDays - 1, calendar, holidays);
}

export function workingDaysBetween(
  startDate: string,
  endDate: string,
  calendar: Calendar,
  holidays: Holiday[]
): number {
  let current = normalizeIsoDate(startDate);
  const end = normalizeIsoDate(endDate);
  let count = 0;

  while (current <= end) {
    if (isWorkingDate(current, calendar, holidays)) {
      count += 1;
    }

    current = addCalendarDays(current, 1);
  }

  return count;
}
