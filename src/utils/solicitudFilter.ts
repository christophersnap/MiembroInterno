import { SolicitudCombustible } from '../types/combustible';
import { SolicitudCompra } from '../types/compra';

export interface SolicitudIdentifiable {
  solicitante?: string;
  correo_solicitante?: string;
  correos_notificados?: string;
  user_id?: string | null;
  user_email?: string | null;
  correo_electronico?: string | null;
  nombre_solicitante?: string | null;
  solicitado_por?: string | null;
  rawCompra?: SolicitudCompra | null;
  rawCombustible?: SolicitudCombustible | null;
}

/**
 * Determina si una solicitud (combustible, compra o unificada) fue realizada
 * por el usuario que ha iniciado sesión.
 */
export function isSolicitudRealizadaPorUsuario(
  solicitud: SolicitudIdentifiable,
  user: { id?: string; email?: string } | null,
  userName: string | null
): boolean {
  if (!user && !userName) return false;

  const userEmail = (user?.email || '').trim().toLowerCase();
  const userId = (user?.id || '').trim();
  const cleanUserName = (userName || '').trim().toLowerCase();
  const isGenericUserName = !cleanUserName || cleanUserName === 'usuario' || cleanUserName.length < 2;

  // 1. Coincidencia por UUID de usuario (user_id en solicitudes_compra o metadata)
  const targetUserId = (
    solicitud.user_id ||
    solicitud.rawCompra?.user_id ||
    (solicitud.rawCombustible as any)?.user_id ||
    ''
  ).trim();
  if (userId && targetUserId && userId === targetUserId) {
    return true;
  }

  // 2. Coincidencia por correo electrónico exacto del usuario (user_email)
  const targetUserEmail = (
    solicitud.user_email ||
    solicitud.rawCompra?.user_email ||
    (solicitud.rawCombustible as any)?.user_email ||
    ''
  ).trim().toLowerCase();
  if (userEmail && targetUserEmail && userEmail === targetUserEmail) {
    return true;
  }

  // 3. Coincidencia por correo_solicitante o correo_electronico
  const solEmail = (
    solicitud.correo_solicitante ||
    solicitud.correo_electronico ||
    solicitud.rawCombustible?.correo_electronico ||
    ''
  ).trim().toLowerCase();
  if (userEmail && solEmail && userEmail === solEmail) {
    return true;
  }

  // 4. Correo del usuario presente en la lista de correos notificados con acuse
  const notificados = (
    solicitud.correos_notificados ||
    solicitud.rawCombustible?.correos_notificados ||
    solicitud.rawCompra?.correos_notificados ||
    ''
  ).toLowerCase();
  if (userEmail && notificados && notificados.includes(userEmail)) {
    return true;
  }

  // 5. Coincidencia por nombre completo del solicitante
  if (!isGenericUserName) {
    const solName = (
      solicitud.solicitante ||
      solicitud.solicitado_por ||
      solicitud.nombre_solicitante ||
      solicitud.rawCompra?.solicitado_por ||
      solicitud.rawCombustible?.nombre_solicitante ||
      ''
    ).trim().toLowerCase();

    if (solName) {
      if (solName === cleanUserName) return true;
      if (solName.includes(cleanUserName) || cleanUserName.includes(solName)) {
        return true;
      }
    }
  }

  // 6. Coincidencia con prefijo del correo electrónico (ej. nombre de usuario antes del @)
  if (userEmail) {
    const emailPrefix = userEmail.split('@')[0].replace(/[._-]/g, ' ').trim();
    if (emailPrefix.length >= 4) {
      const solName = (
        solicitud.solicitante ||
        solicitud.solicitado_por ||
        solicitud.nombre_solicitante ||
        solicitud.rawCompra?.solicitado_por ||
        solicitud.rawCombustible?.nombre_solicitante ||
        ''
      ).trim().toLowerCase();
      if (solName && (solName.includes(emailPrefix) || emailPrefix.includes(solName))) {
        return true;
      }
    }
  }

  return false;
}
