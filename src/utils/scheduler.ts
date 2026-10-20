import { RoutineSchedule } from '../types';

export function replaceMacroVariables(template: string, customDate = new Date()): string {
  const d = customDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

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
  const daysDiff = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000));
  const weekNumber = Math.ceil((daysDiff + startOfYear.getDay() + 1) / 7);

  const replacements: Record<string, string> = {
    '{data}': `${day}/${month}/${year}`,
    '{data_iso}': `${year}-${month}-${day}`,
    '{hora}': `${hours}:${minutes}`,
    '{dia}': day,
    '{mes}': monthsPt[d.getMonth()],
    '{mes_num}': month,
    '{ano}': String(year),
    '{mes_ano}': `${month}/${year}`,
    '{mes_extenso}': monthsPt[d.getMonth()],
    '{dia_semana}': weekDaysPt[d.getDay()],
    '{semana_ano}': `Semana ${weekNumber}`,
    '{empresa}': 'Digitron Balanças',
    '{responsavel}': 'João Leopoldino'
  };

  let result = template;
  for (const [key, val] of Object.entries(replacements)) {
    result = result.split(key).join(val);
  }

  return result;
}

export function calculateNextRun(routine: Pick<RoutineSchedule, 'frequency' | 'time' | 'daysOfWeek' | 'dayOfMonth' | 'customIntervalHours'>, fromDate = new Date()): Date {
  const [targetH, targetM] = (routine.time || '08:00').split(':').map(Number);
  const now = new Date(fromDate);

  switch (routine.frequency) {
    case 'daily': {
      const candidate = new Date(now);
      candidate.setHours(targetH, targetM, 0, 0);
      if (candidate <= now) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    }

    case 'weekly': {
      const days = routine.daysOfWeek && routine.daysOfWeek.length > 0 ? routine.daysOfWeek : [1]; // Default monday
      for (let offset = 0; offset <= 7; offset++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + offset);
        candidate.setHours(targetH, targetM, 0, 0);

        if (days.includes(candidate.getDay())) {
          if (candidate > now) {
            return candidate;
          }
        }
      }
      // Fallback
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(targetH, targetM, 0, 0);
      return nextWeek;
    }

    case 'biweekly': {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + 14);
      candidate.setHours(targetH, targetM, 0, 0);
      return candidate;
    }

    case 'monthly': {
      const targetDay = routine.dayOfMonth || 1;
      let candidate = new Date(now.getFullYear(), now.getMonth(), targetDay, targetH, targetM, 0, 0);
      if (candidate <= now) {
        candidate = new Date(now.getFullYear(), now.getMonth() + 1, targetDay, targetH, targetM, 0, 0);
      }
      return candidate;
    }

    case 'custom_interval': {
      const hours = routine.customIntervalHours && routine.customIntervalHours > 0 ? routine.customIntervalHours : 12;
      return new Date(now.getTime() + hours * 3600 * 1000);
    }

    case 'cron':
    default: {
      // Default to daily at target time
      const candidate = new Date(now);
      candidate.setHours(targetH, targetM, 0, 0);
      if (candidate <= now) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    }
  }
}

export function formatRelativeCountdown(targetDateStr: string | null): string {
  if (!targetDateStr) return 'Não agendado';
  const target = new Date(targetDateStr).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return 'Disparo iminente';

  const mins = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remHours = hours % 24;
    return `em ${days}d ${remHours}h`;
  }
  if (hours > 0) {
    const remMins = mins % 60;
    return `em ${hours}h ${remMins}m`;
  }
  return `em ${mins} min`;
}

export function getFrequencyLabel(routine: RoutineSchedule): string {
  const time = routine.time || '08:00';
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
