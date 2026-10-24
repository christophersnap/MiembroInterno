/**
 * Cruz Verde Salvadoreña - URL oficial del sistema
 * El sistema está desplegado en el subdirectorio oficial: https://cruzverdesv.org/miembros
 */

export const OFFICIAL_APP_URL = 'https://cruzverdesv.org/miembros';

/**
 * Obtiene la URL base de la aplicación.
 * En producción institucional en Hostinger retorna https://cruzverdesv.org/miembros
 * En entorno de desarrollo o preview (Google AI Studio / localhost) retorna el origen actual para pruebas inmediatas.
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Si estamos en el dominio institucional oficial
    if (host.includes('cruzverdesv.org')) {
      return OFFICIAL_APP_URL;
    }
    // Entorno local o preview (localhost, run.app, googleusercontent, etc.)
    return window.location.pathname.startsWith('/miembros')
      ? `${window.location.origin}/miembros`
      : window.location.origin;
  }
  return OFFICIAL_APP_URL;
}

/**
 * URL oficial de acceso / inicio de sesión
 */
export function getOfficialLoginUrl(): string {
  return `${getAppBaseUrl()}/login`;
}

/**
 * URL oficial para compartir formularios públicos de inscripción
 */
export function getOfficialFormUrl(slug: string): string {
  return `${getAppBaseUrl()}/f/${slug}`;
}

/**
 * URL oficial para verificación pública de carnets físicos mediante QR o código
 */
export function getOfficialVerifyUrl(carnetOrToken: string, format: 'short' | 'long' = 'short'): string {
  const prefix = format === 'long' ? '/verificar' : '/v';
  const clean = encodeURIComponent((carnetOrToken || '').trim());
  return `${getAppBaseUrl()}${prefix}/${clean}`;
}

/**
 * URL oficial para acceso y visualización pública de documentos PDF de solicitudes
 */
export function getOfficialSolicitudPdfUrl(tipo: 'combustible' | 'compra', folio: string): string {
  const cleanFolio = encodeURIComponent((folio || '').trim());
  return `${getAppBaseUrl()}/v/solicitud/${tipo}/${cleanFolio}`;
}

