/**
 * Utilidades oficiales de Fecha y Hora para El Salvador (America/El_Salvador / UTC-06:00).
 * El Salvador no usa horario de verano (DST), por lo que su desplazamiento es siempre UTC-06:00.
 * Garantiza que todos los registros, actualizaciones, filtros y formatos visuales usen
 * exclusivamente la hora oficial de El Salvador.
 */

export const EL_SALVADOR_TZ = 'America/El_Salvador';
export const EL_SALVADOR_OFFSET = '-06:00';
export const EL_SALVADOR_LOCALE = 'es-SV';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_NO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/**
 * Extrae partes numéricas de fecha y hora en zona horaria de El Salvador.
 */
function extractSvParts(baseDate: Date = new Date()) {
  const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: EL_SALVADOR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(safeDate);
  const partMap: Record<string, string> = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });

  const year = partMap['year'] || String(safeDate.getUTCFullYear());
  const month = partMap['month'] || String(safeDate.getUTCMonth() + 1).padStart(2, '0');
  const day = partMap['day'] || String(safeDate.getUTCDate()).padStart(2, '0');
  const rawHour = partMap['hour'] || '00';
  const hour = rawHour === '24' ? '00' : rawHour;
  const minute = partMap['minute'] || '00';
  const second = partMap['second'] || '00';
  const ms = String(safeDate.getMilliseconds()).padStart(3, '0');

  return { safeDate, year, month, day, hour, minute, second, ms };
}

/**
 * Parsea de forma segura cualquier fecha o timestamp evitando corrimientos de día
 * en cadenas de solo fecha (YYYY-MM-DD) o inputs sin zona horaria (interpretados en El Salvador).
 */
export function parseSafeDateSV(dateInput?: string | Date | number | null): Date | null {
  if (dateInput === undefined || dateInput === null || dateInput === '') return null;
  if (dateInput instanceof Date) {
    return Number.isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const trimmed = String(dateInput).trim();
  if (!trimmed) return null;

  // Fecha sin hora (YYYY-MM-DD): fijar al mediodía hora El Salvador para evitar retroceso de día
  if (DATE_ONLY_REGEX.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00${EL_SALVADOR_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Fecha y hora local sin zona (ej. input datetime-local "2026-05-12T14:30")
  if (DATETIME_LOCAL_NO_TZ_REGEX.test(trimmed)) {
    const normalized = trimmed.replace(' ', 'T');
    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
    const d = new Date(`${withSeconds}${EL_SALVADOR_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Retorna marca de tiempo ISO-8601 con desplazamiento oficial de El Salvador (-06:00).
 * Ejemplo: "2026-05-12T14:35:08.123-06:00"
 * Compatible con columnas TIMESTAMPTZ, TIMESTAMP y TEXT en Supabase/PostgreSQL.
 */
export function getElSalvadorIsoTimestamp(baseDate: Date = new Date()): string {
  const { year, month, day, hour, minute, second, ms } = extractSvParts(baseDate);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${EL_SALVADOR_OFFSET}`;
}

/**
 * Retorna la fecha actual (o de una Date) en formato YYYY-MM-DD según El Salvador.
 * Reemplaza a new Date().toISOString().split('T')[0] que adelantaba el día después de las 6:00 p. m.
 */
export function getElSalvadorDateString(baseDate: Date = new Date()): string {
  const { year, month, day } = extractSvParts(baseDate);
  return `${year}-${month}-${day}`;
}

/**
 * Retorna el mes actual (o de una Date) en formato YYYY-MM según El Salvador.
 */
export function getElSalvadorMonthString(baseDate: Date = new Date()): string {
  const { year, month } = extractSvParts(baseDate);
  return `${year}-${month}`;
}

/**
 * Retorna valor YYYY-MM-DDTHH:mm en hora de El Salvador para inputs <input type="datetime-local">.
 */
export function getElSalvadorDateTimeInput(baseDate: Date | string | null | undefined = new Date()): string {
  const parsed = baseDate ? parseSafeDateSV(baseDate) : new Date();
  if (!parsed) return '';
  const { year, month, day, hour, minute } = extractSvParts(parsed);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Convierte el valor de un input datetime-local (interpretado como hora de El Salvador)
 * a marca ISO con offset -06:00.
 */
export function parseElSalvadorDateTimeInputToIso(val: string): string | null {
  if (!val) return null;
  const parsed = parseSafeDateSV(val);
  if (!parsed) return null;
  return getElSalvadorIsoTimestamp(parsed);
}

/**
 * Retorna el inicio del día (00:00:00.000) en El Salvador como ISO-8601 con offset -06:00.
 */
export function getElSalvadorDayStartIso(baseDate: Date = new Date()): string {
  const { year, month, day } = extractSvParts(baseDate);
  return `${year}-${month}-${day}T00:00:00.000${EL_SALVADOR_OFFSET}`;
}

/**
 * Obtiene los componentes de fecha y hora actuales en El Salvador.
 */
export function getElSalvadorDateTime(baseDate: Date = new Date()) {
  const { safeDate, year, month, day, hour, minute, second } = extractSvParts(baseDate);

  const fechaSV = `${day}/${month}/${year}`;
  const fechaISO = `${year}-${month}-${day}`;
  const hora24 = `${hour}:${minute}:${second}`;

  const dtf12 = new Intl.DateTimeFormat(EL_SALVADOR_LOCALE, {
    timeZone: EL_SALVADOR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const hora12 = dtf12.format(safeDate);

  const dtfTexto = new Intl.DateTimeFormat(EL_SALVADOR_LOCALE, {
    timeZone: EL_SALVADOR_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const fechaTexto = dtfTexto.format(safeDate);

  const fechaCompletaSV = `${fechaSV} ${hora12}`;

  return {
    year: parseInt(year, 10),
    month,
    day,
    fechaISO,
    fechaSV,
    fechaTexto,
    hora12,
    hora24,
    fechaCompletaSV,
    isoTimestamp: getElSalvadorIsoTimestamp(safeDate),
  };
}

/**
 * Formatea cualquier fecha existente al estilo salvadoreño (por defecto DD/MM/YYYY)
 * siempre en zona horaria America/El_Salvador.
 */
export function formatFechaSV(
  dateInput?: string | Date | number | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (dateInput === undefined || dateInput === null || dateInput === '') return '-';
  try {
    const d = parseSafeDateSV(dateInput);
    if (!d) return String(dateInput);
    return new Intl.DateTimeFormat(EL_SALVADOR_LOCALE, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options,
      timeZone: EL_SALVADOR_TZ,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formatea fecha y hora completa en El Salvador (DD/MM/YYYY hh:mm:ss a. m./p. m.).
 */
export function formatFechaHoraSV(
  dateInput?: string | Date | number | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (dateInput === undefined || dateInput === null || dateInput === '') return '-';
  try {
    const d = parseSafeDateSV(dateInput);
    if (!d) return String(dateInput);
    return new Intl.DateTimeFormat(EL_SALVADOR_LOCALE, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options,
      timeZone: EL_SALVADOR_TZ,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formatea únicamente la hora en zona horaria de El Salvador.
 */
export function formatHoraSV(
  dateInput?: string | Date | number | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (dateInput === undefined || dateInput === null || dateInput === '') return '-';
  try {
    const d = parseSafeDateSV(dateInput);
    if (!d) return String(dateInput);
    return new Intl.DateTimeFormat(EL_SALVADOR_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options,
      timeZone: EL_SALVADOR_TZ,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}
