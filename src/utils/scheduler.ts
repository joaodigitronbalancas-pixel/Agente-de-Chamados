import { RoutineSchedule } from '../types';
import { 
  getSaoPauloParts, 
  calculateNextRunInSaoPaulo, 
  formatRelativeCountdown as formatRelativeCountdownUtil 
} from './dateTime';

export function replaceMacroVariables(template: string, customDate = new Date()): string {
  const parts = getSaoPauloParts(customDate);
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  const year = parts.year;
  const hours = String(parts.hour).padStart(2, '0');
  const minutes = String(parts.minute).padStart(2, '0');

  const monthsPt = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const weekDaysPt = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  // Week of year calculation
  const startOfYear = new Date(year, 0, 1);
  const daysDiff = Math.floor((customDate.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000));
  const weekNumber = Math.max(1, Math.ceil((daysDiff + startOfYear.getDay() + 1) / 7));

  const monthName = monthsPt[parts.month - 1] || 'Janeiro';
  const weekDayName = weekDaysPt[parts.dayOfWeek] || 'Segunda-feira';

  const replacements: Record<string, string> = {
    '{data}': `${day}/${month}/${year}`,
    '{data_iso}': `${year}-${month}-${day}`,
    '{hora}': `${hours}:${minutes}`,
    '{dia}': day,
    '{mes}': monthName,
    '{mes_num}': month,
    '{ano}': String(year),
    '{mes_ano}': `${month}/${year}`,
    '{mes_extenso}': monthName,
    '{dia_semana}': weekDayName,
    '{semana_ano}': `Semana ${weekNumber}`,
    '{empresa}': 'Digi-Tron Balanças',
    '{responsavel}': 'Equipe de TI'
  };

  let result = template;
  for (const [key, val] of Object.entries(replacements)) {
    result = result.split(key).join(val);
  }

  return result;
}

export function calculateNextRun(
  routine: Pick<RoutineSchedule, 'frequency' | 'time' | 'daysOfWeek' | 'dayOfMonth' | 'customIntervalHours'>,
  fromDate = new Date()
): Date {
  return calculateNextRunInSaoPaulo(routine, fromDate);
}

export function formatRelativeCountdown(targetDateStr: string | null): string {
  return formatRelativeCountdownUtil(targetDateStr);
}

export function getFrequencyLabel(routine: RoutineSchedule): string {
  const time = routine.time || '07:00';
  switch (routine.frequency) {
    case 'daily':
      return `Diário às ${time}`;
    case 'weekly': {
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const days = (routine.daysOfWeek || []).map(d => dayNames[d]).join(', ');
      return `Semanal (${days || 'Seg'}) às ${time}`;
    }
    case 'biweekly':
      return `Quinzenal às ${time}`;
    case 'monthly':
      return `Mensal (Dia ${routine.dayOfMonth || 1}) às ${time}`;
    case 'custom_interval':
      return `A cada ${routine.customIntervalHours} horas`;
    case 'cron':
      return `Cron: ${routine.cronExpression || '* * * * *'}`;
    default:
      return 'Recorrente';
  }
}
