import React, { useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Globe,
  MapPin,
  Monitor,
  Clock,
  KeyRound,
  X,
  AlertTriangle,
  CheckCircle2,
  Wifi,
} from 'lucide-react';
import { formatFechaHoraSV, formatHoraSV } from '../../utils/dateUtils';

export interface LoginAttemptLogItem {
  id: number;
  attempted_at: string;
  event_type: 'failed_login' | 'locked' | 'blocked_attempt' | 'unlocked_by_admin' | 'login_success' | string;
  attempt_number: number;
  ip_address?: string | null;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  region?: string | null;
  isp?: string | null;
  device?: string | null;
  browser?: string | null;
  timezone?: string | null;
  error_reason?: string | null;
}

export interface LoginSecurityRecord {
  email: string;
  failed_attempts: number;
  is_locked: boolean;
  locked_at?: string | null;
  locked_until?: string | null;
  last_attempt_at?: string | null;
  last_ip?: string | null;
  last_country?: string | null;
  last_country_code?: string | null;
  last_city?: string | null;
  last_region?: string | null;
  last_isp?: string | null;
  last_device?: string | null;
  last_browser?: string | null;
  last_timezone?: string | null;
  last_user_agent?: string | null;
  last_error_reason?: string | null;
  unlocked_by?: string | null;
  unlocked_at?: string | null;
  attempts?: LoginAttemptLogItem[];
}

export function isRecordActivelyLocked(record?: LoginSecurityRecord | null): boolean {
  if (!record || !record.is_locked) return false;
  if (!record.locked_until) return true;
  const untilMs = new Date(record.locked_until).getTime();
  if (Number.isNaN(untilMs)) return true;
  return untilMs > Date.now();
}

export function analyzeLoginRisk(record: LoginSecurityRecord): {
  level: 'suspicious' | 'user_error' | 'unknown';
  title: string;
  summary: string;
  countries: string[];
  uniqueIps: string[];
  hasForeignAttempt: boolean;
  blockedRepeatCount: number;
} {
  const attempts = Array.isArray(record.attempts)
    ? record.attempts.filter((a) => a.event_type !== 'unlocked_by_admin' && a.event_type !== 'login_success')
    : [];

  const countryCodes = new Set<string>();
  const countryNames = new Set<string>();
  const uniqueIps = new Set<string>();
  let blockedRepeatCount = 0;

  attempts.forEach((a) => {
    if (a.country_code) countryCodes.add(a.country_code.toUpperCase());
    if (a.country) countryNames.add(a.country);
    if (a.ip_address) uniqueIps.add(a.ip_address);
    if (a.event_type === 'blocked_attempt') blockedRepeatCount += 1;
  });

  if (record.last_country_code) countryCodes.add(record.last_country_code.toUpperCase());
  if (record.last_country) countryNames.add(record.last_country);
  if (record.last_ip) uniqueIps.add(record.last_ip);

  const foreignCodes = Array.from(countryCodes).filter((c) => c && c !== 'SV' && c !== 'LOCAL');
  const hasForeignAttempt = foreignCodes.length > 0;

  if (hasForeignAttempt || uniqueIps.size >= 3 || blockedRepeatCount >= 2 || record.failed_attempts >= 6) {
    const reasons: string[] = [];
    if (hasForeignAttempt) {
      reasons.push(`origen fuera de El Salvador (${Array.from(countryNames).join(', ') || foreignCodes.join(', ')})`);
    }
    if (uniqueIps.size >= 3) {
      reasons.push(`${uniqueIps.size} direcciones IP distintas`);
    }
    if (blockedRepeatCount >= 2) {
      reasons.push(`${blockedRepeatCount} intentos insistentes estando bloqueado`);
    }
    return {
      level: 'suspicious',
      title: 'Posible intento externo o actividad sospechosa',
      summary: `Se detectó ${reasons.join(' · ')}. Confirme con el usuario antes de levantar el bloqueo o restablezca su contraseña.`,
      countries: Array.from(countryNames),
      uniqueIps: Array.from(uniqueIps),
      hasForeignAttempt,
      blockedRepeatCount,
    };
  }

  if (!isRecordActivelyLocked(record) && record.failed_attempts === 0 && attempts.length === 0) {
    return {
      level: 'user_error',
      title: 'Cuenta sin bloqueos ni intentos fallidos',
      summary:
        'Esta cuenta no registra intentos fallidos activos. Si se bloquea tras 3 intentos fallidos, aquí aparecerá el país de origen, dirección IP, dispositivo y el botón para levantar el bloqueo.',
      countries: Array.from(countryNames),
      uniqueIps: Array.from(uniqueIps),
      hasForeignAttempt: false,
      blockedRepeatCount: 0,
    };
  }

  if (countryCodes.has('SV') || (uniqueIps.size <= 1 && record.failed_attempts <= 4)) {
    return {
      level: 'user_error',
      title: 'Probable error del usuario',
      summary: countryCodes.has('SV')
        ? 'Los intentos provienen de El Salvador desde una misma conexión y dispositivo. Suele corresponder a error de contraseña o bloqueo de mayúsculas.'
        : 'Los intentos provienen de un mismo dispositivo y patrón habitual. Suele tratarse de un error al escribir la contraseña.',
      countries: Array.from(countryNames),
      uniqueIps: Array.from(uniqueIps),
      hasForeignAttempt: false,
      blockedRepeatCount,
    };
  }

  return {
    level: 'unknown',
    title: 'Origen pendiente de verificación',
    summary: 'No se pudo resolver la ubicación geográfica exacta de estos intentos. Revise el dispositivo y consulte con el usuario.',
    countries: Array.from(countryNames),
    uniqueIps: Array.from(uniqueIps),
    hasForeignAttempt: false,
    blockedRepeatCount,
  };
}

interface BloqueoLoginDetalleModalProps {
  open: boolean;
  userDisplayName: string;
  userEmail: string;
  record: LoginSecurityRecord;
  unlocking: boolean;
  onUnlock: (email: string) => Promise<void>;
  onResetPassword?: () => void;
  onClose: () => void;
}

export default function BloqueoLoginDetalleModal({
  open,
  userDisplayName,
  userEmail,
  record,
  unlocking,
  onUnlock,
  onResetPassword,
  onClose,
}: BloqueoLoginDetalleModalProps) {
  const activelyLocked = isRecordActivelyLocked(record);
  const risk = useMemo(() => analyzeLoginRisk(record), [record]);

  if (!open) return null;

  const attempts = Array.isArray(record.attempts) ? record.attempts : [];
  const locationText = [record.last_city, record.last_region, record.last_country]
    .filter(Boolean)
    .join(', ');

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'locked':
        return { label: 'Cuenta bloqueada', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'blocked_attempt':
        return { label: 'Intento durante bloqueo', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'unlocked_by_admin':
        return { label: 'Bloqueo levantado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      default:
        return { label: 'Intento fallido', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/45 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] bg-[#F2F2F7] rounded-[28px] border border-slate-200/80 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera estilo iOS */}
        <div className="bg-white px-5 py-4 border-b border-slate-200/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                activelyLocked
                  ? 'bg-rose-500/12 text-rose-600'
                  : 'bg-amber-500/12 text-amber-600'
              }`}
            >
              {activelyLocked ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
                Reporte de intentos de acceso
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {userDisplayName} · {userEmail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar reporte"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Diagnóstico automático */}
          <div
            className={`rounded-2xl border p-4 flex items-start gap-3 ${
              risk.level === 'suspicious'
                ? 'bg-rose-50 border-rose-200/90 text-rose-950'
                : risk.level === 'user_error'
                ? 'bg-amber-50/90 border-amber-200/90 text-amber-950'
                : 'bg-white border-slate-200/80 text-slate-900'
            }`}
          >
            {risk.level === 'suspicious' ? (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : risk.level === 'user_error' ? (
              <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Globe className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug">{risk.title}</p>
              <p className="text-xs opacity-90 mt-1 leading-relaxed">{risk.summary}</p>
            </div>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">Intentos fallidos</span>
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {record.failed_attempts}
              </p>
              <span className="text-[11px] text-slate-400">
                {activelyLocked ? 'Bloqueo activo' : 'Sin bloqueo activo'}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">País detectado</span>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={record.last_country || 'Sin datos'}>
                {record.last_country || 'No detectado'}
              </p>
              <span className="text-[11px] text-slate-400 truncate block">
                {record.last_country_code ? `Código ${record.last_country_code}` : 'Ubicación no disponible'}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-slate-500 block">
                {activelyLocked ? 'Bloqueado hasta' : 'Último intento'}
              </span>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-1">
                {activelyLocked && record.locked_until
                  ? formatHoraSV(record.locked_until)
                  : record.last_attempt_at
                  ? formatHoraSV(record.last_attempt_at)
                  : '—'}
              </p>
              <span className="text-[11px] text-slate-400">Hora de El Salvador</span>
            </div>
          </div>

          {/* Detalle técnico agrupado estilo iOS */}
          <section className="space-y-1.5">
            <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Último origen registrado
            </h4>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Ubicación
                </span>
                <span className="font-semibold text-slate-900 text-right truncate">
                  {locationText || 'No disponible'}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                  <Wifi className="w-3.5 h-3.5 text-slate-400" />
                  Dirección IP / Red
                </span>
                <div className="text-right min-w-0">
                  <span className="font-mono font-semibold text-slate-900 block tabular-nums">
                    {record.last_ip || 'No registrada'}
                  </span>
                  {record.last_isp && (
                    <span className="text-[11px] text-slate-500 block truncate max-w-[240px]">
                      {record.last_isp}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  Dispositivo
                </span>
                <span className="font-medium text-slate-800 text-right truncate">
                  {[record.last_browser, record.last_device].filter(Boolean).join(' · ') || 'No registrado'}
                </span>
              </div>

              {record.last_attempt_at && (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Fecha y hora (SV)
                  </span>
                  <span className="font-medium text-slate-800 tabular-nums">
                    {formatFechaHoraSV(record.last_attempt_at)}
                  </span>
                </div>
              )}

              {record.unlocked_by && record.unlocked_at && !activelyLocked && (
                <div className="px-4 py-3 flex items-center justify-between gap-3 bg-emerald-50/50">
                  <span className="text-emerald-700 flex items-center gap-1.5 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Último desbloqueo
                  </span>
                  <span className="font-medium text-emerald-900 text-right truncate">
                    {record.unlocked_by} · {formatFechaHoraSV(record.unlocked_at)}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Historial de intentos */}
          <section className="space-y-1.5">
            <div className="px-1 flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Historial reciente de intentos
              </h4>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {attempts.length} {attempts.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {attempts.length === 0 ? (
                <div className="px-4 py-5 text-center text-slate-400">
                  Aún no hay registros detallados de intentos para este usuario.
                </div>
              ) : (
                attempts.slice(0, 12).map((att) => {
                  const badge = getEventBadge(att.event_type);
                  const place = [att.city, att.country].filter(Boolean).join(', ');
                  const isForeign =
                    att.country_code &&
                    att.country_code.toUpperCase() !== 'SV' &&
                    att.country_code.toUpperCase() !== 'LOCAL';

                  return (
                    <div key={att.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          {att.attempt_number > 0 && (
                            <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                              Intento #{att.attempt_number}
                            </span>
                          )}
                          {isForeign && (
                            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                              Exterior
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          {place || 'Ubicación no detectada'}
                          {att.ip_address ? ` · IP ${att.ip_address}` : ''}
                        </p>
                        {(att.browser || att.device || att.error_reason) && (
                          <p className="text-[11px] text-slate-400 truncate">
                            {[att.browser, att.device].filter(Boolean).join(' · ') || att.error_reason}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                        {formatFechaHoraSV(att.attempted_at)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Footer de acciones */}
        <div className="bg-white px-5 py-3.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {onResetPassword ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onResetPassword();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Restablecer clave</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Cerrar
            </button>

            {(activelyLocked || record.failed_attempts > 0) && (
              <button
                type="button"
                disabled={unlocking}
                onClick={() => onUnlock(userEmail)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-2xs"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>
                  {unlocking
                    ? 'Desbloqueando...'
                    : activelyLocked
                    ? 'Levantar bloqueo'
                    : 'Reiniciar intentos'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
