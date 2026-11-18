import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type SolicitudModulo = 'carnet' | 'combustible' | 'compra' | 'soporte';

const READ_STORAGE_PREFIX = 'cv_solicitudes_read_v1_';
const INIT_STORAGE_PREFIX = 'cv_solicitudes_read_init_v1_';
export const SOLICITUDES_READ_EVENT = 'solicitudes_read_updated';
const MODULE_COUNT_EVENT = 'solicitudes_module_count_updated';

// Cache en memoria para evitar consultas repetidas innecesarias por sesión
const memoryReadCache = new Map<string, Set<string>>();
const lastRemoteSyncAt = new Map<string, number>();
let tableMissingDetected = false;
let soporteCheckConstraintPending = false;

const moduleUnreadCounts: Record<SolicitudModulo, number> = {
  carnet: 0,
  combustible: 0,
  compra: 0,
  soporte: 0,
};

export function publishModuleUnreadCount(modulo: SolicitudModulo, count: number): void {
  const safeCount = Math.max(0, Math.floor(count || 0));
  if (moduleUnreadCounts[modulo] !== safeCount) {
    moduleUnreadCounts[modulo] = safeCount;
    window.dispatchEvent(new Event(MODULE_COUNT_EVENT));
  }
}

export function useModuleUnreadCount(modulo: SolicitudModulo): number {
  const [count, setCount] = useState<number>(() => moduleUnreadCounts[modulo] || 0);
  useEffect(() => {
    const sync = () => setCount(moduleUnreadCounts[modulo] || 0);
    sync();
    window.addEventListener(MODULE_COUNT_EVENT, sync);
    return () => window.removeEventListener(MODULE_COUNT_EVENT, sync);
  }, [modulo]);
  return count;
}

export function buildSolicitudCompositeKey(modulo: SolicitudModulo, solicitudKey: string | number): string {
  return `${modulo}:${String(solicitudKey).trim()}`;
}

export function getUserInitTimestamp(userId?: string | null): number {
  if (!userId) return Date.now();
  const storageKey = `${INIT_STORAGE_PREFIX}${userId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    const now = Date.now();
    localStorage.setItem(storageKey, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export function getLocalReadSet(userId?: string | null): Set<string> {
  if (!userId) return new Set();
  const cached = memoryReadCache.get(userId);
  if (cached) return new Set(cached);

  const storageKey = `${READ_STORAGE_PREFIX}${userId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const set = new Set<string>(arr.map((x) => String(x)));
        memoryReadCache.set(userId, set);
        return new Set(set);
      }
    }
  } catch {}

  const empty = new Set<string>();
  memoryReadCache.set(userId, empty);
  return new Set(empty);
}

function saveLocalReadSet(userId: string, set: Set<string>): void {
  memoryReadCache.set(userId, new Set(set));
  try {
    const arr = Array.from(set);
    // Mantener últimos 2000 registros como límite sano en localStorage
    const trimmed = arr.length > 2000 ? arr.slice(arr.length - 2000) : arr;
    localStorage.setItem(`${READ_STORAGE_PREFIX}${userId}`, JSON.stringify(trimmed));
  } catch {}
}

export async function syncReadReceiptsFromSupabase(
  userId?: string | null,
  force = false
): Promise<Set<string>> {
  if (!userId) return new Set();
  getUserInitTimestamp(userId);
  const localSet = getLocalReadSet(userId);

  if (tableMissingDetected) {
    return localSet;
  }

  const now = Date.now();
  const lastSync = lastRemoteSyncAt.get(userId) || 0;
  if (!force && now - lastSync < 8000 && localSet.size > 0) {
    return localSet;
  }

  try {
    const { data, error } = await supabase
      .from('solicitudes_lecturas')
      .select('modulo, solicitud_key')
      .eq('user_id', userId)
      .limit(2000);

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (error.code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache')) {
        tableMissingDetected = true;
      }
      return localSet;
    }

    lastRemoteSyncAt.set(userId, now);
    if (data && data.length > 0) {
      let changed = false;
      data.forEach((row: any) => {
        if (row.modulo && row.solicitud_key != null) {
          const key = buildSolicitudCompositeKey(row.modulo as SolicitudModulo, row.solicitud_key);
          if (!localSet.has(key)) {
            localSet.add(key);
            changed = true;
          }
        }
      });
      if (changed) {
        saveLocalReadSet(userId, localSet);
      }
    }
  } catch {
    // Fallback silencioso a localStorage
  }

  return localSet;
}

const ACTIVE_CARNET_STATES = new Set(['Pendiente', 'En revisión', 'Observada']);
const ACTIVE_LOGISTICA_STATES = new Set(['Pendiente', 'En Proceso', 'En Proceso de Compra']);
const ACTIVE_SOPORTE_STATES = new Set(['Pendiente', 'En revisión']);

/**
 * Determina si una solicitud individual debe mostrarse con tonalidad "sin leer"
 * y sumarse al contador rojo de notificaciones del usuario actual.
 */
export function isSolicitudUnread(params: {
  userId?: string | null;
  readSet: Set<string>;
  modulo: SolicitudModulo;
  solicitudKey: string | number | undefined | null;
  estado?: string | null;
  createdAt?: string | null;
}): boolean {
  const { userId, readSet, modulo, solicitudKey, estado, createdAt } = params;
  if (!userId || solicitudKey === undefined || solicitudKey === null || String(solicitudKey).trim() === '') {
    return false;
  }

  const compositeKey = buildSolicitudCompositeKey(modulo, solicitudKey);
  if (readSet.has(compositeKey)) {
    return false;
  }

  const normalizedEstado = String(estado || '').trim();
  if (modulo === 'carnet') {
    if (ACTIVE_CARNET_STATES.has(normalizedEstado)) return true;
  } else if (modulo === 'soporte') {
    if (ACTIVE_SOPORTE_STATES.has(normalizedEstado)) return true;
  } else {
    if (ACTIVE_LOGISTICA_STATES.has(normalizedEstado)) return true;
  }

  // Solicitudes nuevas creadas después de inicializar el lector también aparecen como no leídas hasta abrirlas
  if (createdAt) {
    const createdMs = new Date(createdAt).getTime();
    const initMs = getUserInitTimestamp(userId);
    if (!Number.isNaN(createdMs) && createdMs > initMs) {
      return true;
    }
  }

  return false;
}

export async function markSolicitudAsRead(
  userId: string | undefined | null,
  modulo: SolicitudModulo,
  solicitudKey: string | number | undefined | null
): Promise<void> {
  if (!userId || solicitudKey === undefined || solicitudKey === null) return;
  const keyStr = String(solicitudKey).trim();
  if (!keyStr) return;

  const composite = buildSolicitudCompositeKey(modulo, keyStr);
  const currentSet = getLocalReadSet(userId);
  const alreadyRead = currentSet.has(composite);

  if (!alreadyRead) {
    currentSet.add(composite);
    saveLocalReadSet(userId, currentSet);
    window.dispatchEvent(new Event(SOLICITUDES_READ_EVENT));
  }

  if (tableMissingDetected || (modulo === 'soporte' && soporteCheckConstraintPending)) return;

  try {
    const { error } = await supabase.from('solicitudes_lecturas').upsert(
      {
        user_id: userId,
        modulo,
        solicitud_key: keyStr,
        leido_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,modulo,solicitud_key' }
    );

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (error.code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache')) {
        tableMissingDetected = true;
      } else if (modulo === 'soporte' && (error.code === '23514' || msg.includes('check'))) {
        soporteCheckConstraintPending = true;
      }
    }
  } catch {
    // Ignorar error de red, queda guardado localmente
  }
}

export async function markMultipleSolicitudesAsRead(
  userId: string | undefined | null,
  items: { modulo: SolicitudModulo; solicitudKey: string | number }[]
): Promise<void> {
  if (!userId || items.length === 0) return;

  const currentSet = getLocalReadSet(userId);
  const toUpsert: { user_id: string; modulo: SolicitudModulo; solicitud_key: string; leido_at: string }[] = [];
  const nowIso = new Date().toISOString();
  let changed = false;

  items.forEach(({ modulo, solicitudKey }) => {
    const keyStr = String(solicitudKey ?? '').trim();
    if (!keyStr) return;
    const composite = buildSolicitudCompositeKey(modulo, keyStr);
    if (!currentSet.has(composite)) {
      currentSet.add(composite);
      changed = true;
      if (!(modulo === 'soporte' && soporteCheckConstraintPending)) {
        toUpsert.push({
          user_id: userId,
          modulo,
          solicitud_key: keyStr,
          leido_at: nowIso,
        });
      }
    }
  });

  if (changed) {
    saveLocalReadSet(userId, currentSet);
    window.dispatchEvent(new Event(SOLICITUDES_READ_EVENT));
  }

  if (tableMissingDetected || toUpsert.length === 0) return;

  try {
    const { error } = await supabase
      .from('solicitudes_lecturas')
      .upsert(toUpsert, { onConflict: 'user_id,modulo,solicitud_key' });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (error.code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache')) {
        tableMissingDetected = true;
      } else if (error.code === '23514' || msg.includes('check')) {
        soporteCheckConstraintPending = true;
      }
    }
  } catch {}
}

export function useSolicitudReadTracker(userId?: string | null) {
  const [readSet, setReadSet] = useState<Set<string>>(() => getLocalReadSet(userId));

  useEffect(() => {
    if (!userId) {
      setReadSet(new Set());
      return;
    }

    setReadSet(getLocalReadSet(userId));
    let cancelled = false;

    syncReadReceiptsFromSupabase(userId).then((synced) => {
      if (!cancelled) {
        setReadSet(new Set(synced));
      }
    });

    const handleReadEvent = () => {
      if (!cancelled) {
        setReadSet(getLocalReadSet(userId));
      }
    };

    window.addEventListener(SOLICITUDES_READ_EVENT, handleReadEvent);
    return () => {
      cancelled = true;
      window.removeEventListener(SOLICITUDES_READ_EVENT, handleReadEvent);
    };
  }, [userId]);

  const isUnread = useCallback(
    (
      modulo: SolicitudModulo,
      solicitudKey: string | number | undefined | null,
      estado?: string | null,
      createdAt?: string | null
    ) => {
      return isSolicitudUnread({
        userId,
        readSet,
        modulo,
        solicitudKey,
        estado,
        createdAt,
      });
    },
    [userId, readSet]
  );

  const markAsRead = useCallback(
    (modulo: SolicitudModulo, solicitudKey: string | number | undefined | null) => {
      return markSolicitudAsRead(userId, modulo, solicitudKey);
    },
    [userId]
  );

  const markManyAsRead = useCallback(
    (items: { modulo: SolicitudModulo; solicitudKey: string | number }[]) => {
      return markMultipleSolicitudesAsRead(userId, items);
    },
    [userId]
  );

  return {
    readSet,
    isUnread,
    markAsRead,
    markManyAsRead,
  };
}
