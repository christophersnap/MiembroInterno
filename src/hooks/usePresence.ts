import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export interface ActiveUser {
  id: string;
  userId: string;
  name: string;
  role?: string;
  device?: string;
  devicesCount?: number;
  path?: string;
  lastSeen?: number;
}

export interface PresenceState {
  onlineCount: number;
  activeUsers: ActiveUser[];
  isOnline: boolean;
  lastPing: number | null;
  refreshPresence: () => Promise<void>;
}

interface PresenceIdentity {
  userId: string;
  name: string;
  role: string;
  device: string;
  path: string;
}

function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'Tablet';
  }
  if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'Móvil';
  }
  return 'Computadora';
}

function resolveCanonicalUserId(rawKey: string | undefined, metaUserId: string | undefined): string | null {
  const candidate = (metaUserId || rawKey || '').trim();
  if (!candidate) return null;
  const baseId = candidate.includes('::') ? candidate.split('::')[0].trim() : candidate;
  // Ignorar sesiones anónimas o temporales previas a la autenticación
  if (!baseId || baseId.startsWith('dev_') || baseId.startsWith('anon_')) {
    return null;
  }
  return baseId;
}

function pickBestDisplayName(currentName: string | undefined, incomingName: string | undefined): string {
  const genericNames = new Set(['', 'Usuario', 'Personal Cruz Verde']);
  const cur = (currentName || '').trim();
  const inc = (incomingName || '').trim();
  if (genericNames.has(cur) && !genericNames.has(inc)) return inc;
  if (!genericNames.has(cur) && genericNames.has(inc)) return cur;
  if (inc.length > cur.length) return inc;
  return cur || inc || 'Personal Cruz Verde';
}

function mergeDeviceLabels(existing?: string, incoming?: string): { label?: string; count: number } {
  const parts = new Set<string>();
  [existing, incoming].forEach((val) => {
    if (!val) return;
    val.split(',').forEach((item) => {
      const clean = item.trim();
      if (clean) parts.add(clean);
    });
  });
  const arr = Array.from(parts);
  return {
    label: arr.length > 0 ? arr.join(', ') : undefined,
    count: Math.max(arr.length, 1),
  };
}

// Estado compartido entre todas las instancias del hook en la misma pestaña (Layout + Dashboard)
let sharedState: {
  onlineCount: number;
  activeUsers: ActiveUser[];
  isOnline: boolean;
  lastPing: number | null;
} = {
  onlineCount: 1,
  activeUsers: [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastPing: null,
};

let realtimeUsers: ActiveUser[] = [];
let apiUsers: ActiveUser[] = [];
let realtimeSubscribed = false;
let currentChannel: RealtimeChannel | null = null;
let currentChannelUserId = '';
let currentIdentity: PresenceIdentity | null = null;
let subscriberCount = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function upsertUserRecord(map: Map<string, ActiveUser>, incoming: ActiveUser) {
  const uid = resolveCanonicalUserId(incoming.id, incoming.userId);
  if (!uid) return;

  const existing = map.get(uid);
  if (!existing) {
    map.set(uid, {
      ...incoming,
      id: uid,
      userId: uid,
      devicesCount: incoming.devicesCount || 1,
    });
    return;
  }

  const mergedDevices = mergeDeviceLabels(existing.device, incoming.device);
  const incomingNewer = (incoming.lastSeen || 0) >= (existing.lastSeen || 0);

  map.set(uid, {
    id: uid,
    userId: uid,
    name: pickBestDisplayName(existing.name, incoming.name),
    role: incomingNewer && incoming.role ? incoming.role : (existing.role || incoming.role || 'usuario'),
    device: mergedDevices.label,
    devicesCount: mergedDevices.count,
    path: incomingNewer && incoming.path ? incoming.path : existing.path,
    lastSeen: Math.max(existing.lastSeen || 0, incoming.lastSeen || 0),
  });
}

function recomputeSharedUsers() {
  const merged = new Map<string, ActiveUser>();

  // 1. Fuente principal multi-hosting: Supabase Realtime Presence (agrupado estrictamente por usuario)
  realtimeUsers.forEach((u) => upsertUserRecord(merged, u));

  // 2. Respaldo solo si Realtime no devolvió usuarios todavía
  if (merged.size === 0) {
    apiUsers.forEach((u) => upsertUserRecord(merged, u));
  }

  // 3. Garantizar que el usuario autenticado actual aparezca al menos una sola vez
  if (currentIdentity) {
    upsertUserRecord(merged, {
      id: currentIdentity.userId,
      userId: currentIdentity.userId,
      name: currentIdentity.name,
      role: currentIdentity.role,
      device: currentIdentity.device,
      path: currentIdentity.path,
      lastSeen: Date.now(),
    });
  }

  const list = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  sharedState = {
    ...sharedState,
    onlineCount: currentIdentity ? Math.max(list.length, 1) : list.length,
    activeUsers: list,
  };
  notifyListeners();
}

function extractRealtimeUsers(channel: RealtimeChannel): ActiveUser[] {
  const state = channel.presenceState<Record<string, any>>();
  const byUser = new Map<string, ActiveUser>();

  Object.entries(state).forEach(([key, metas]) => {
    if (!Array.isArray(metas) || metas.length === 0) return;

    metas.forEach((meta) => {
      const uid = resolveCanonicalUserId(key, meta?.userId);
      if (!uid) return;

      upsertUserRecord(byUser, {
        id: uid,
        userId: uid,
        name: meta?.name || 'Personal Cruz Verde',
        role: meta?.role || 'usuario',
        device: meta?.device || 'Web',
        path: meta?.path || '/',
        lastSeen: meta?.lastSeen || Date.now(),
      });
    });
  });

  return Array.from(byUser.values());
}

async function pingBackendApi(identity: PresenceIdentity) {
  // Si Realtime ya está conectado y sincronizado, no dependemos del backend local del servidor de hosting
  if (realtimeSubscribed) return;

  try {
    const res = await fetch(getApiUrl('/api/presence/ping'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: identity.userId,
        userId: identity.userId,
        name: identity.name,
        role: identity.role,
        device: identity.device,
        path: identity.path,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data.activeUsers)) {
        const dedup = new Map<string, ActiveUser>();
        data.activeUsers.forEach((u: any) => {
          const uid = resolveCanonicalUserId(u?.id, u?.userId);
          if (!uid) return;
          upsertUserRecord(dedup, {
            id: uid,
            userId: uid,
            name: u.name || 'Usuario',
            role: u.role || 'usuario',
            device: u.device || undefined,
            path: u.path,
            lastSeen: Date.now(),
          });
        });
        apiUsers = Array.from(dedup.values());
      }
      sharedState = {
        ...sharedState,
        isOnline: true,
        lastPing: Date.now(),
      };
      recomputeSharedUsers();
    }
  } catch {
    // Silencioso en hostings estáticos donde no existe /api/presence/ping
  }
}

async function trackRealtimePresence(identity: PresenceIdentity) {
  if (!currentChannel) return;
  try {
    await currentChannel.track({
      userId: identity.userId,
      name: identity.name,
      role: identity.role,
      device: identity.device,
      path: identity.path,
      lastSeen: Date.now(),
    });
  } catch {
    // Silencioso si el canal aún está conectando
  }
}

function teardownChannel() {
  if (currentChannel) {
    const ch = currentChannel;
    currentChannel = null;
    currentChannelUserId = '';
    realtimeSubscribed = false;
    realtimeUsers = [];
    apiUsers = [];
    ch.untrack().catch(() => {});
    supabase.removeChannel(ch).catch(() => {});
  }
}

function ensureChannelForIdentity(identity: PresenceIdentity) {
  currentIdentity = identity;

  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }

  // Si cambió de usuario (ej. cambio de cuenta), recrear canal con el nuevo userId como presence key
  if (currentChannel && currentChannelUserId !== identity.userId) {
    teardownChannel();
  }

  if (!currentChannel) {
    currentChannelUserId = identity.userId;
    realtimeSubscribed = false;

    const channel = supabase.channel('cv_sistema_presencia_v1', {
      config: {
        presence: {
          key: identity.userId,
        },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      if (currentChannel !== channel) return;
      realtimeUsers = extractRealtimeUsers(channel);
      sharedState = {
        ...sharedState,
        isOnline: true,
        lastPing: Date.now(),
      };
      recomputeSharedUsers();
    });

    channel.subscribe((status) => {
      if (currentChannel !== channel) return;
      if (status === 'SUBSCRIBED') {
        realtimeSubscribed = true;
        if (currentIdentity) {
          trackRealtimePresence(currentIdentity);
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        realtimeSubscribed = false;
        if (currentIdentity) {
          pingBackendApi(currentIdentity);
        }
      }
    });

    currentChannel = channel;
    recomputeSharedUsers();
  } else {
    trackRealtimePresence(identity);
    recomputeSharedUsers();
  }
}

export function usePresence(): PresenceState {
  const { user, userName, role, loading: authLoading } = useAuth();
  const location = useLocation();
  const [, setVersion] = useState(0);

  const deviceLabel = detectDeviceLabel();
  const authUserId = user?.id || '';
  const displayName = userName || user?.email?.split('@')[0] || 'Personal Cruz Verde';
  const currentRole = role || 'usuario';

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    listeners.add(onUpdate);
    subscriberCount += 1;

    // Esperar a que AuthContext resuelva el usuario real para evitar registros temporales duplicados
    if (authLoading || !authUserId) {
      if (!authLoading && !authUserId) {
        currentIdentity = null;
        teardownChannel();
        sharedState = {
          ...sharedState,
          onlineCount: 0,
          activeUsers: [],
        };
        notifyListeners();
      }

      return () => {
        listeners.delete(onUpdate);
        subscriberCount = Math.max(0, subscriberCount - 1);
      };
    }

    const identity: PresenceIdentity = {
      userId: authUserId,
      name: displayName,
      role: currentRole,
      device: deviceLabel,
      path: location.pathname,
    };

    ensureChannelForIdentity(identity);

    // Si en 2.5s Realtime no conectó (ej. red restrictiva en servidor local), usar respaldo API
    const fallbackTimer = setTimeout(() => {
      if (!realtimeSubscribed && currentIdentity) {
        pingBackendApi(currentIdentity);
      }
    }, 2500);

    if (!pingTimer) {
      pingTimer = setInterval(() => {
        if (currentIdentity) {
          trackRealtimePresence(currentIdentity);
          if (!realtimeSubscribed) {
            pingBackendApi(currentIdentity);
          }
        }
      }, 25000);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentIdentity) {
        trackRealtimePresence(currentIdentity);
        if (!realtimeSubscribed) {
          pingBackendApi(currentIdentity);
        }
      }
    };

    const handleOnline = () => {
      sharedState = { ...sharedState, isOnline: true };
      notifyListeners();
      if (currentIdentity) {
        trackRealtimePresence(currentIdentity);
        if (!realtimeSubscribed) {
          pingBackendApi(currentIdentity);
        }
      }
    };

    const handleOffline = () => {
      sharedState = { ...sharedState, isOnline: false };
      notifyListeners();
    };

    const handleBeforeUnload = () => {
      if (currentChannel) {
        currentChannel.untrack().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(fallbackTimer);
      listeners.delete(onUpdate);
      subscriberCount = Math.max(0, subscriberCount - 1);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (subscriberCount === 0) {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        teardownTimer = setTimeout(() => {
          if (subscriberCount === 0) {
            currentIdentity = null;
            teardownChannel();
          }
        }, 1500);
      }
    };
  }, [authLoading, authUserId, displayName, currentRole, deviceLabel, location.pathname]);

  const refreshPresence = useCallback(async () => {
    if (authLoading || !authUserId) return;

    const identity: PresenceIdentity = {
      userId: authUserId,
      name: displayName,
      role: currentRole,
      device: deviceLabel,
      path: location.pathname,
    };
    ensureChannelForIdentity(identity);
    await trackRealtimePresence(identity);
    if (!realtimeSubscribed) {
      await pingBackendApi(identity);
    }
    if (currentChannel) {
      realtimeUsers = extractRealtimeUsers(currentChannel);
      recomputeSharedUsers();
    }
  }, [authLoading, authUserId, displayName, currentRole, deviceLabel, location.pathname]);

  return {
    onlineCount: sharedState.onlineCount,
    activeUsers: sharedState.activeUsers,
    isOnline: sharedState.isOnline,
    lastPing: sharedState.lastPing,
    refreshPresence,
  };
}
