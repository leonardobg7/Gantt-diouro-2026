import type { Holiday } from '@/types';
import { createHoliday } from '@/modules/planner/domain/entities/holiday';

export function getBrazilNationalHolidays(calendarId: string): Holiday[] {
  return [
    createHoliday({
      id: 'br-2026-01-01',
      calendarId,
      name: 'Confraternização Universal',
      date: '2026-01-01',
      scope: 'national',
      recurring: true,
    }),
    createHoliday({
      id: 'br-2026-04-21',
      calendarId,
      name: 'Tiradentes',
      date: '2026-04-21',
      scope: 'national',
      recurring: true,
    }),
    createHoliday({
      id: 'br-2026-05-01',
      calendarId,
      name: 'Dia do Trabalho',
      date: '2026-05-01',
      scope: 'national',
      recurring: true,
    }),
    createHoliday({
      id: 'br-2026-09-07',
      calendarId,
      name: 'Independência do Brasil',
      date: '2026-09-07',
      scope: 'national',
      recurring: true,
    }),
    createHoliday({
      id: 'br-2026-10-12',
      calendarId,
      name: 'Nossa Senhora Aparecida',
      date: '2026-10-12',
      scope: 'national',
      recurring: true,
    }),
    createHoliday({
      id: 'br-2026-11-02',
      calendarId,
      name: 'Finados',
      date: '2026-11-02',
      scope: 'national',
      recurring: true,
    }),
    createHoliday({
      id: 'br-2026-11-15',
      calendarId,
      name: 'Proclamação da República',
      date: '2026-11-15',
      scope: 'national',
      recurring: true,
    }),
    createHoliday({
      id: 'br-2026-12-25',
      calendarId,
      name: 'Natal',
      date: '2026-12-25',
      scope: 'national',
      recurring: true,
    }),
  ];
}
