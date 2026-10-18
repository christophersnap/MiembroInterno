/**
 * Utilidades oficiales de Fecha y Hora para El Salvador (America/El_Salvador / UTC-6)
 * Garantiza que días, meses, años y horas se calculen siempre con el huso horario oficial salvadoreño.
 */

export const EL_SALVADOR_TZ = 'America/El_Salvador';

/**
 * Obtiene los componentes de fecha y hora actuales en El Salvador
 */
export function getElSalvadorDateTime(baseDate: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat('es-SV', {
    timeZone: EL_SALVADOR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = dtf.formatToParts(baseDate);
  const partMap: Record<string, string> = {};
  parts.forEach(p => { partMap[p.type] = p.value; });

  const year = partMap['year'] || String(baseDate.getFullYear());
  const month = partMap['month'] || String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = partMap['day'] || String(baseDate.getDate()).padStart(2, '0');
  const hour = partMap['hour'] || '00';
  const minute = partMap['minute'] || '00';
  const second = partMap['second'] || '00';

  // Fecha formato estándar salvadoreño DD/MM/YYYY
  const fechaSV = `${day}/${month}/${year}`;

  // Fecha formato ISO seguro para inputs o bases de datos YYYY-MM-DD
  const fechaISO = `${year}-${month}-${day}`;

  // Hora formato 24h
  const hora24 = `${hour}:${minute}:${second}`;

  // Hora formato 12h salvadoreño (ej: 05:37:00 p.m.)
  const dtf12 = new Intl.DateTimeFormat('es-SV', {
    timeZone: EL_SALVADOR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const hora12 = dtf12.format(baseDate);

  // Fecha en texto largo (ej: 18 de octubre de 2026)
  const dtfTexto = new Intl.DateTimeFormat('es-SV', {
    timeZone: EL_SALVADOR_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const fechaTexto = dtfTexto.format(baseDate);

  // Fecha y hora completa salvadoreña
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
    fechaCompletaSV
  };
}

/**
 * Formatea cualquier fecha existente al estilo salvadoreño DD/MM/YYYY
 */
export function formatFechaSV(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('es-SV', {
      timeZone: EL_SALVADOR_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Formatea fecha y hora completa en El Salvador (DD/MM/YYYY hh:mm a)
 */
export function formatFechaHoraSV(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('es-SV', {
      timeZone: EL_SALVADOR_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return String(dateInput);
  }
}
