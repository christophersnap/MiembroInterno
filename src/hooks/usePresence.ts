import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export interface ActiveUser {
  id: string;
  userId?: string;
  name: string;
  role?: string;
  device?: string;
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
  sessionKey: string;
  userId: string;
  name: string;
  role: string;
  device: string;
  path: string;
}

function getOrCreateDeviceId(): string {
  try {
    let stored = localStorage.getItem('cv_device_presence_id');
    if (!stored) {
      stored = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('cv_device_presence_id', stored);
    }
    return stored;
  } catch {
    return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
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
let currentChannel: RealtimeChannel | null = null;
let currentChannelKey = '';
let currentIdentity: PresenceIdentity | null = null;
let subscriberCount = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function recomputeSharedUsers() {
  const merged = new Map<string, ActiveUser>();

  // 1. Priorizar sesiones en tiempo real (Supabase Realtime Presence)
  realtimeUsers.forEach((u) => {
    merged.set(u.id, u);
  });

  // 2. Fusionar respaldo de API local si existen sesiones no reflejadas
  apiUsers.forEach((u) => {
    if (!merged.has(u.id)) {
      merged.set(u.id, u);
    }
  });

  // 3. Garantizar que el usuario actual aparezca al menos como conectado
  if (merged.size === 0 && currentIdentity) {
    merged.set(currentIdentity.sessionKey, {
      id: currentIdentity.sessionKey,
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
    onlineCount: Math.max(list.length, 1),
    activeUsers: list,
  };
  notifyListeners();
}

function extractRealtimeUsers(channel: RealtimeChannel): ActiveUser[] {
  const state = channel.presenceState<Record<string, any>>();
  const users: ActiveUser[] = [];

  Object.entries(state).forEach(([key, metas]) => {
    if (!Array.isArray(metas) || metas.length === 0) return;
    const latest = metas[metas.length - 1];
    users.push({
      id: latest.sessionKey || key,
      userId: latest.userId || undefined,
      name: latest.name || 'Personal Cruz Verde',
      role: latest.role || 'usuario',
      device: latest.device || 'Web',
      path: latest.path || '/',
      lastSeen: latest.lastSeen || Date.now(),
    });
  });

  return users;
}

async function pingBackendApi(identity: PresenceIdentity) {
  try {
    const res = await fetch(getApiUrl('/api/presence/ping'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: identity.sessionKey,
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
        apiUsers = data.activeUsers.map((u: any) => ({
          id: u.id,
          userId: u.userId,
          name: u.name || 'Usuario',
          role: u.role || 'usuario',
          device: u.device || undefined,
          path: u.path,
          lastSeen: Date.now(),
        }));
      }
      sharedState = {
        ...sharedState,
        isOnline: true,
        lastPing: Date.now(),
      };
      recomputeSharedUsers();
    }
  } catch {
    sharedState = {
      ...sharedState,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };
    notifyListeners();
  }
}

async function trackRealtimePresence(identity: PresenceIdentity) {
  if (!currentChannel) return;
  try {
    await currentChannel.track({
      sessionKey: identity.sessionKey,
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

function ensureChannelForIdentity(identity: PresenceIdentity) {
  currentIdentity = identity;

  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }

  // Si cambió la clave de sesión (ej. login / logout / cambio de usuario), recrear canal con nueva presence key
  if (currentChannel && currentChannelKey !== identity.sessionKey) {
    const prevChannel = currentChannel;
    currentChannel = null;
    currentChannelKey = '';
    realtimeUsers = [];
    supabase.removeChannel(prevChannel).catch(() => {});
  }

  if (!currentChannel) {
    currentChannelKey = identity.sessionKey;
    const channel = supabase.channel('cv_sistema_presencia_v1', {
      config: {
        presence: {
          key: identity.sessionKey,
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
      if (status === 'SUBSCRIBED' && currentChannel === channel && currentIdentity) {
        trackRealtimePresence(currentIdentity);
      }
    });

    currentChannel = channel;
  } else {
    trackRealtimePresence(identity);
  }
}

export function usePresence(): PresenceState {
  const { user, userName, role } = useAuth();
  const location = useLocation();
  const [, setVersion] = useState(0);

  const deviceId = getOrCreateDeviceId();
  const deviceLabel = detectDeviceLabel();
  const userId = user?.id || deviceId;
  const sessionKey = `${userId}::${deviceId}`;
  const displayName = userName || user?.email?.split('@')[0] || 'Personal Cruz Verde';
  const currentRole = role || 'usuario';

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    listeners.add(onUpdate);
    subscriberCount += 1;

    const identity: PresenceIdentity = {
      sessionKey,
      userId,
      name: displayName,
      role: currentRole,
      device: deviceLabel,
      path: location.pathname,
    };

    ensureChannelForIdentity(identity);
    pingBackendApi(identity);

    if (!pingTimer) {
      pingTimer = setInterval(() => {
        if (currentIdentity) {
          pingBackendApi(currentIdentity);
          trackRealtimePresence(currentIdentity);
        }
      }, 25000);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentIdentity) {
        pingBackendApi(currentIdentity);
        trackRealtimePresence(currentIdentity);
      }
    };

    const handleOnline = () => {
      sharedState = { ...sharedState, isOnline: true };
      notifyListeners();
      if (currentIdentity) {
        pingBackendApi(currentIdentity);
        trackRealtimePresence(currentIdentity);
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
          if (subscriberCount === 0 && currentChannel) {
            const ch = currentChannel;
            currentChannel = null;
            currentChannelKey = '';
            realtimeUsers = [];
            apiUsers = [];
            supabase.removeChannel(ch).catch(() => {});
          }
        }, 1500);
      }
    };
  }, [sessionKey, userId, displayName, currentRole, deviceLabel, location.pathname]);

  const refreshPresence = useCallback(async () => {
    const identity: PresenceIdentity = {
      sessionKey,
      userId,
      name: displayName,
      role: currentRole,
      device: deviceLabel,
      path: location.pathname,
    };
    ensureChannelForIdentity(identity);
    await Promise.all([
      trackRealtimePresence(identity),
      pingBackendApi(identity),
    ]);
    if (currentChannel) {
      realtimeUsers = extractRealtimeUsers(currentChannel);
      recomputeSharedUsers();
    }
  }, [sessionKey, userId, displayName, currentRole, deviceLabel, location.pathname]);

  return {
    onlineCount: sharedState.onlineCount,
    activeUsers: sharedState.activeUsers,
    isOnline: sharedState.isOnline,
    lastPing: sharedState.lastPing,
    refreshPresence,
  };
}
