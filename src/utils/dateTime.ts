/**
 * Centralized Date & Time Utility for Digi-Tron TI — GLPI Autoscheduler
 * Timezone of operation: America/Sao_Paulo (Curitiba, Paraná / São Paulo, Brasil)
 * 
 * Rules:
 * 1. America/Sao_Paulo is the strict operational timezone.
 * 2. Never manually add or subtract 3 hours (+3h/-3h) to fix timezone offsets.
 * 3. Never parse a date-only string (e.g. "2026-10-21") with UTC midnight conversions that roll back to the previous day.
 * 4. Safely handle SQL/GLPI format "YYYY-MM-DD HH:mm:ss", ISO strings, and calendar dates without "Invalid Date" errors.
 * 5. Calculations for scheduler next run respect the hour in America/Sao_Paulo.
 */

export const SAO_PAULO_TZ = 'America/Sao_Paulo';

/**
 * Returns current Date in America/Sao_Paulo.
 */
export function nowSaoPaulo(): Date {
  return new Date();
}

/**
 * Formats a Date/string strictly as SQL/GLPI format: "YYYY-MM-DD HH:mm:ss" in America/Sao_Paulo timezone.
 * Without any UTC shift! This is the exact format GLPI expects for "date" (Data de abertura).
 */
export function formatGlpiDateTime(input: string | number | Date | null | undefined = new Date()): string {
  const d = parseDateSafe(input) || new Date();
  const parts = getSaoPauloParts(d);
  const y = parts.year;
  const m = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  const h = String(parts.hour).padStart(2, '0');
  const min = String(parts.minute).padStart(2, '0');
  const s = String(parts.second).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * Resolves the opening date for a GLPI ticket in strict America/Sao_Paulo timezone.
 * Rules:
 * 1. If explicit openingDate is provided (e.g. from manual trigger or form), uses that date/time.
 * 2. If scheduledTime is provided (e.g. routine scheduled for "08:00"), constructs today's date in America/Sao_Paulo at that scheduled time.
 * 3. If neither is provided, uses current time in America/Sao_Paulo.
 * 4. NUNCA uses the GLPI server's UTC clock (glpi_currenttime) as the ticket's opening date!
 * 5. Applies offsetHours if configured as a manual adjustment.
 */
export function resolveOpeningDate(
  openingDate?: string | null,
  scheduledTime?: string | null,
  offsetHours: number = 0
): string {
  if (openingDate && String(openingDate).trim()) {
    let clean = String(openingDate).trim().replace('T', ' ');
    if (clean.length === 10) clean += ' 08:00:00';
    if (clean.length === 16) clean += ':00';
    const parsed = parseDateSafe(clean);
    if (parsed) {
      if (offsetHours) {
        parsed.setHours(parsed.getHours() + offsetHours);
      }
      return formatGlpiDateTime(parsed);
    }
  }

  if (scheduledTime && /^\d{2}:\d{2}$/.test(scheduledTime.trim())) {
    const today = getSaoPauloTodayIso();
    const dateStr = `${today} ${scheduledTime.trim()}:00`;
    const parsed = parseDateSafe(dateStr);
    if (parsed) {
      if (offsetHours) {
        parsed.setHours(parsed.getHours() + offsetHours);
      }
      return formatGlpiDateTime(parsed);
    }
  }

  const now = nowSaoPaulo();
  if (offsetHours) {
    now.setHours(now.getHours() + offsetHours);
  }
  return formatGlpiDateTime(now);
}

/**
 * Safely parses any date string, timestamp or Date instance into a valid Date object.
 * Returns null if input is invalid or empty.
 */
export function parseDateSafe(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();
  if (!str) return null;

  // Pattern 1: Date-only "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    // Construct local midday in Sao Paulo (-03:00) to prevent day rollover
    const date = new Date(`${str}T12:00:00-03:00`);
    return isNaN(date.getTime()) ? null : date;
  }

  // Pattern 2: GLPI / SQL format "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str)) {
    // GLPI timestamps are stored in server local time (America/Sao_Paulo)
    const isoWithT = str.replace(' ', 'T');
    // If no timezone offset is present, attach -03:00
    const fullIso = isoWithT.length === 16 ? `${isoWithT}:00-03:00` : `${isoWithT}-03:00`;
    const date = new Date(fullIso);
    if (!isNaN(date.getTime())) return date;
  }

  // Pattern 3: Standard ISO string (e.g. "2026-10-21T04:35:00.000Z")
  const standardDate = new Date(str);
  if (!isNaN(standardDate.getTime())) {
    return standardDate;
  }

  return null;
}

/**
 * Extracts numeric parts of a Date in America/Sao_Paulo timezone.
 */
export function getSaoPauloParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  // Map weekday to 0=Sunday, 1=Monday ... 6=Saturday
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  const hourVal = map.hour === '24' ? 0 : parseInt(map.hour || '0', 10);

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1-12
    day: parseInt(map.day, 10), // 1-31
    hour: hourVal, // 0-23
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    dayOfWeek: weekdayMap[map.weekday] ?? 0
  };
}

/**
 * Returns the current date in America/Sao_Paulo formatted as "YYYY-MM-DD".
 * This prevents the bug where UTC midnight rolls into tomorrow at night in Brazil.
 */
export function getSaoPauloTodayIso(): string {
  const parts = getSaoPauloParts(new Date());
  const y = parts.year;
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Creates a Date instance representing an exact calendar date and time in America/Sao_Paulo.
 */
export function createSaoPauloDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const h = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');
  const s = String(second).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}-03:00`);
}

/**
 * Formats full Date & Time in America/Sao_Paulo.
 * Example: "21/10/2026 às 08:35" or "21/10/2026 08:35"
 */
export function formatDateTime(
  input: string | number | Date | null | undefined,
  fallback = '-',
  includeSeconds = false
): string {
  if (!input) return fallback;

  // If date-only string, format without time
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return formatDateOnly(input, fallback);
  }

  const d = parseDateSafe(input);
  if (!d) return fallback;

  try {
    const parts = getSaoPauloParts(d);
    const day = String(parts.day).padStart(2, '0');
    const month = String(parts.month).padStart(2, '0');
    const year = parts.year;
    const hour = String(parts.hour).padStart(2, '0');
    const min = String(parts.minute).padStart(2, '0');
    const sec = String(parts.second).padStart(2, '0');

    if (includeSeconds) {
      return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
    }
    return `${day}/${month}/${year} às ${hour}:${min}`;
  } catch {
    return fallback;
  }
}

/**
 * Formats Date-Only in America/Sao_Paulo.
 * Guarantee: "2026-10-21" ALWAYS formats as "21/10/2026" (NEVER rolls back to previous day!).
 */
export function formatDateOnly(
  input: string | number | Date | null | undefined,
  fallback = '-'
): string {
  if (!input) return fallback;

  // Direct calendar date extraction without timezone shift
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
  }

  const date = parseDateSafe(input);
  if (!date) return fallback;

  try {
    const parts = getSaoPauloParts(date);
    const day = String(parts.day).padStart(2, '0');
    const month = String(parts.month).padStart(2, '0');
    const year = parts.year;
    return `${day}/${month}/${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Formats Time-Only in America/Sao_Paulo.
 * Example: "08:30"
 */
export function formatTimeOnly(
  input: string | number | Date | null | undefined,
  fallback = '-'
): string {
  if (!input) return fallback;
  const date = parseDateSafe(input);
  if (!date) return fallback;

  try {
    const parts = getSaoPauloParts(date);
    const hour = String(parts.hour).padStart(2, '0');
    const min = String(parts.minute).padStart(2, '0');
    return `${hour}:${min}`;
  } catch {
    return fallback;
  }
}

/**
 * Human-readable countdown for scheduled routines.
 */
export function formatRelativeCountdown(targetDateStr: string | null | undefined): string {
  if (!targetDateStr) return 'Não agendado';
  const targetDate = parseDateSafe(targetDateStr);
  if (!targetDate) return 'Data não definida';

  const diff = targetDate.getTime() - Date.now();
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

/**
 * Calculates the next execution instant in America/Sao_Paulo timezone.
 * Guarantees that target "07:00" runs at exactly 07:00 in Sao Paulo time.
 */
export function calculateNextRunInSaoPaulo(
  routine: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom_interval' | 'cron';
    time?: string; // "HH:MM"
    daysOfWeek?: number[]; // 0-6
    dayOfMonth?: number; // 1-31
    customIntervalHours?: number;
  },
  fromDate: Date = new Date()
): Date {
  const [targetH, targetM] = (routine.time || '07:00').split(':').map(Number);
  const spParts = getSaoPauloParts(fromDate);

  switch (routine.frequency) {
    case 'daily': {
      let candidate = createSaoPauloDate(spParts.year, spParts.month, spParts.day, targetH, targetM, 0);
      if (candidate.getTime() <= fromDate.getTime()) {
        // Schedule next day
        const nextDayDate = new Date(candidate.getTime() + 24 * 3600 * 1000);
        const nextParts = getSaoPauloParts(nextDayDate);
        candidate = createSaoPauloDate(nextParts.year, nextParts.month, nextParts.day, targetH, targetM, 0);
      }
      return candidate;
    }

    case 'weekly': {
      const allowedDays = routine.daysOfWeek && routine.daysOfWeek.length > 0 ? routine.daysOfWeek : [1];
      for (let offset = 0; offset <= 7; offset++) {
        const testDate = new Date(fromDate.getTime() + offset * 24 * 3600 * 1000);
        const testParts = getSaoPauloParts(testDate);
        if (allowedDays.includes(testParts.dayOfWeek)) {
          const candidate = createSaoPauloDate(testParts.year, testParts.month, testParts.day, targetH, targetM, 0);
          if (candidate.getTime() > fromDate.getTime()) {
            return candidate;
          }
        }
      }
      // Fallback 7 days ahead
      const nextWeek = new Date(fromDate.getTime() + 7 * 24 * 3600 * 1000);
      const nwParts = getSaoPauloParts(nextWeek);
      return createSaoPauloDate(nwParts.year, nwParts.month, nwParts.day, targetH, targetM, 0);
    }

    case 'biweekly': {
      const twoWeeks = new Date(fromDate.getTime() + 14 * 24 * 3600 * 1000);
      const parts = getSaoPauloParts(twoWeeks);
      return createSaoPauloDate(parts.year, parts.month, parts.day, targetH, targetM, 0);
    }

    case 'monthly': {
      const targetDay = routine.dayOfMonth || 1;
      let candidate = createSaoPauloDate(spParts.year, spParts.month, targetDay, targetH, targetM, 0);
      if (candidate.getTime() <= fromDate.getTime()) {
        const nextMonth = spParts.month === 12 ? 1 : spParts.month + 1;
        const nextYear = spParts.month === 12 ? spParts.year + 1 : spParts.year;
        candidate = createSaoPauloDate(nextYear, nextMonth, targetDay, targetH, targetM, 0);
      }
      return candidate;
    }

    case 'custom_interval': {
      const hours = routine.customIntervalHours && routine.customIntervalHours > 0 ? routine.customIntervalHours : 12;
      return new Date(fromDate.getTime() + hours * 3600 * 1000);
    }

    case 'cron':
    default: {
      let candidate = createSaoPauloDate(spParts.year, spParts.month, spParts.day, targetH, targetM, 0);
      if (candidate.getTime() <= fromDate.getTime()) {
        const nextDayDate = new Date(candidate.getTime() + 24 * 3600 * 1000);
        const nextParts = getSaoPauloParts(nextDayDate);
        candidate = createSaoPauloDate(nextParts.year, nextParts.month, nextParts.day, targetH, targetM, 0);
      }
      return candidate;
    }
  }
}
