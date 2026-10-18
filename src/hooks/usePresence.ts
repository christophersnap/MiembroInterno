import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

export interface ActiveUser {
  id: string;
  name: string;
  role?: string;
}

export interface PresenceState {
  onlineCount: number;
  activeUsers: ActiveUser[];
  isOnline: boolean;
  lastPing: number | null;
  refreshPresence: () => Promise<void>;
}

export function usePresence(): PresenceState {
  const { user, userName, role } = useAuth();
  const location = useLocation();
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastPing, setLastPing] = useState<number | null>(null);

  // ID persistente anónimo en caso de no tener auth ID
  const anonIdRef = useRef<string>(
    (() => {
      let stored = localStorage.getItem('cv_client_presence_id');
      if (!stored) {
        stored = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        localStorage.setItem('cv_client_presence_id', stored);
      }
      return stored;
    })()
  );

  const sendPing = useCallback(async () => {
    try {
      const clientId = user?.id || anonIdRef.current;
      const displayName = userName || user?.email?.split('@')[0] || 'Personal Cruz Verde';
      
      const res = await fetch('/api/presence/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          name: displayName,
          role: role || 'usuario',
          path: location.pathname
        })
      });

      if (res.ok) {
        const data = await res.json();
        setOnlineCount(data.onlineCount || 1);
        setActiveUsers(data.activeUsers || []);
        setIsOnline(true);
        setLastPing(Date.now());
      }
    } catch {
      // Fallback offline o error de red
      setIsOnline(navigator.onLine);
    }
  }, [user?.id, user?.email, userName, role, location.pathname]);

  useEffect(() => {
    // Ping inicial
    sendPing();

    // Intervalo de latido cada 25 segundos
    const interval = setInterval(sendPing, 25000);

    // Eventos de reactivación de ventana
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendPing();
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      sendPing();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sendPing]);

  return {
    onlineCount,
    activeUsers,
    isOnline,
    lastPing,
    refreshPresence: sendPing
  };
}
