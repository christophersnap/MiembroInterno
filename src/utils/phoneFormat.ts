/**
 * Utilidades de formato telefónico internacional (+503 0000-0000)
 * y enlaces de navegación para direcciones de seccionales.
 */

export const DEFAULT_COUNTRY_CODE = '+503';

/**
 * Formatea un teléfono siempre con código internacional y bloque local 0000-0000.
 * Ejemplos:
 * - "22845792"        -> "+503 2284-5792"
 * - "2284-5792"       -> "+503 2284-5792"
 * - "+503 22845792"   -> "+503 2284-5792"
 * - "50378901234"     -> "+503 7890-1234"
 * - "+1 7865551234"   -> "+1 7865-551234" (respeta código internacional explícito)
 */
export function formatInternationalPhone(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  let countryCode = '503';
  let localDigits = digits;

  if (trimmed.startsWith('+')) {
    // Detectar código internacional explícito (1 a 3 dígitos)
    if (digits.startsWith('503')) {
      countryCode = '503';
      localDigits = digits.slice(3);
    } else if (digits.length > 8) {
      const codeLen = Math.min(3, Math.max(1, digits.length - 8));
      countryCode = digits.slice(0, codeLen);
      localDigits = digits.slice(codeLen);
    } else {
      countryCode = '503';
      localDigits = digits;
    }
  } else if (digits.startsWith('503') && digits.length >= 11) {
    countryCode = '503';
    localDigits = digits.slice(3);
  } else if (digits.length > 8 && digits.length <= 11 && digits.startsWith('503')) {
    countryCode = '503';
    localDigits = digits.slice(3);
  }

  localDigits = localDigits.slice(0, 8);

  if (!localDigits) {
    return `+${countryCode}`;
  }

  if (localDigits.length <= 4) {
    return `+${countryCode} ${localDigits}`;
  }

  return `+${countryCode} ${localDigits.slice(0, 4)}-${localDigits.slice(4, 8)}`;
}

/**
 * Máscara interactiva para inputs de teléfono en formularios.
 * Mantiene siempre el prefijo internacional (+503 por defecto) y 0000-0000.
 */
export function applyInternationalPhoneMask(inputValue: string): string {
  const trimmed = inputValue.trim();
  if (!trimmed) return '';

  // Permitir borrar completamente si solo quedó el prefijo vacío
  if (trimmed === '+' || trimmed === '+5' || trimmed === '+50' || trimmed === '+503') {
    return trimmed === '+503' ? '+503 ' : '';
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  // Extraer código de país
  let countryCode = '503';
  let localDigits = digits;

  if (trimmed.startsWith('+')) {
    if (digits.startsWith('503')) {
      countryCode = '503';
      localDigits = digits.slice(3);
    } else if (digits.length > 8) {
      const codeLen = Math.min(3, digits.length - 8);
      countryCode = digits.slice(0, codeLen);
      localDigits = digits.slice(codeLen);
    } else {
      // Si el usuario escribió + y menos de 8 dígitos sin 503, asumir +503 + esos dígitos
      countryCode = '503';
      localDigits = digits;
    }
  } else if (digits.startsWith('503') && digits.length > 8) {
    countryCode = '503';
    localDigits = digits.slice(3);
  }

  localDigits = localDigits.slice(0, 8);
  if (!localDigits) return `+${countryCode} `;
  if (localDigits.length <= 4) return `+${countryCode} ${localDigits}`;
  return `+${countryCode} ${localDigits.slice(0, 4)}-${localDigits.slice(4, 8)}`;
}

/**
 * Construye el enlace tel: limpio para marcar desde dispositivos móviles o escritorio.
 */
export function buildTelHref(raw?: string | null): string {
  const formatted = formatInternationalPhone(raw);
  if (!formatted) return '';
  const clean = formatted.replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '';
}

/**
 * Construye URL de Google Maps a partir de enlace explícito o dirección textual.
 */
export function buildGoogleMapsHref(
  explicitUrl?: string | null,
  direccion?: string | null,
  departamento?: string | null,
  nombre?: string | null
): string {
  const trimmedUrl = (explicitUrl || '').trim();
  if (trimmedUrl) return trimmedUrl;

  const parts = [direccion?.trim(), departamento?.trim(), 'El Salvador'].filter(Boolean);
  if (parts.length <= 1 && nombre?.trim()) {
    parts.unshift(`Cruz Verde Salvadoreña ${nombre.trim()}`);
  }
  if (parts.length === 0) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

/**
 * Construye URL de Waze a partir de enlace explícito o dirección textual.
 */
export function buildWazeHref(
  explicitUrl?: string | null,
  direccion?: string | null,
  departamento?: string | null
): string {
  const trimmedUrl = (explicitUrl || '').trim();
  if (trimmedUrl) return trimmedUrl;

  const parts = [direccion?.trim(), departamento?.trim(), 'El Salvador'].filter(Boolean);
  if (parts.length <= 1) return '';
  return `https://waze.com/ul?q=${encodeURIComponent(parts.join(', '))}&navigate=yes`;
}
