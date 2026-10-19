/**
 * Cruz Verde Salvadoreña - URL oficial del sistema
 * El sistema está desplegado en el subdirectorio oficial: https://cruzverdesv.org/miembros
 */

export const OFFICIAL_APP_URL = 'https://cruzverdesv.org/miembros';

/**
 * Obtiene la URL base de la aplicación.
 * En producción siempre retorna https://cruzverdesv.org/miembros
 * En entorno de desarrollo local puede reflejar localhost.
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Si estamos en localhost para desarrollo local
    if (host === 'localhost' || host === '127.0.0.1') {
      return window.location.pathname.startsWith('/miembros')
        ? `${window.location.origin}/miembros`
        : window.location.origin;
    }
  }
  // En cualquier otro caso (preview, producción en Hostinger, correos oficiales)
  return OFFICIAL_APP_URL;
}

/**
 * URL oficial de acceso / inicio de sesión
 */
export function getOfficialLoginUrl(): string {
  return `${OFFICIAL_APP_URL}/login`;
}

/**
 * URL oficial para compartir formularios públicos de inscripción
 */
export function getOfficialFormUrl(slug: string): string {
  return `${OFFICIAL_APP_URL}/f/${slug}`;
}

/**
 * URL oficial para verificación pública de carnets físicos mediante QR o código
 */
export function getOfficialVerifyUrl(carnetOrToken: string, format: 'short' | 'long' = 'short'): string {
  const prefix = format === 'long' ? '/verificar' : '/v';
  const clean = encodeURIComponent((carnetOrToken || '').trim());
  return `${OFFICIAL_APP_URL}${prefix}/${clean}`;
}
