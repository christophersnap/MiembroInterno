export function isSolicitudRealizadaPorUsuario(
  solicitud: any,
  user: any,
  userName?: string | null
): boolean {
  if (!user && !userName) return false;
  const userEmail = (user?.email || '').toLowerCase().trim();
  const uName = (userName || '').toLowerCase().trim();

  const solEmail = (solicitud?.correo_electronico || solicitud?.user_email || '').toLowerCase().trim();
  const solName = (solicitud?.nombre_solicitante || solicitud?.solicitante || solicitud?.user_nombre || '').toLowerCase().trim();

  if (userEmail && solEmail && userEmail === solEmail) return true;
  if (uName && solName && (uName.includes(solName) || solName.includes(uName))) return true;

  if (solicitud?.user_id && user?.id && String(solicitud.user_id) === String(user.id)) return true;

  return false;
}
