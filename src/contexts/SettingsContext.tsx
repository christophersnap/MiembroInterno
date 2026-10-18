import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SystemColors {
  primary: string;             // Color principal (botones, badges, acentos)
  primaryHover: string;        // Color hover principal
  secondary: string;           // Color secundario (iconos, destaques)
  sidebarBg: string;           // Fondo del menú lateral
  sidebarText: string;         // Texto/iconos del menú lateral
  sidebarActiveBg: string;     // Fondo de selección en el menú lateral
  sidebarBorder?: string;      // Borde del menú lateral
  dashboardBg: string;         // Fondo general del dashboard y sistema
  cardBg?: string;             // Fondo de las tarjetas del dashboard
  cardBorder?: string;         // Borde de las tarjetas del dashboard
  anuncioBg: string;           // Fondo del cuadro de anuncio superior
  anuncioBorder: string;       // Borde del cuadro de anuncio superior
  anuncioText?: string;        // Color del texto del anuncio
  tickerBg: string;            // Fondo de la línea de anuncio (slider/ticker)
  tickerText?: string;         // Color del texto de la noticia en la línea
  tickerBadgeBg: string;       // Color del badge "NOTICIAS CVS"
  tickerBadgeText?: string;    // Color del texto del badge
  // Compatibilidad con campos legacy
  menuText?: string;
  menuTextHover?: string;
  userInfoBg?: string;
  userInfoName?: string;
  userInfoEmail?: string;
  userInfoRole?: string;
  userLogoutBtn?: string;
  userLogoutBtnHover?: string;
}

export const defaultColors: SystemColors = {
  primary: '#008f39',          // Verde Cruz Verde Salvadoreña Oficial
  primaryHover: '#00702c',
  secondary: '#10b981',
  sidebarBg: '#0a2014',        // Verde esmeralda noche (Apple/iOS)
  sidebarText: '#d1fae5',
  sidebarActiveBg: 'rgba(255, 255, 255, 0.15)',
  sidebarBorder: 'rgba(0, 0, 0, 0.2)',
  dashboardBg: '#f8faf9',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  anuncioBg: '#ffffff',
  anuncioBorder: '#a7f3d0',
  anuncioText: '#111827',
  tickerBg: '#0a0f0d',
  tickerText: '#f3f4f6',
  tickerBadgeBg: '#059669',
  tickerBadgeText: '#ffffff',
  menuText: '#D1D5DB',
  menuTextHover: '#FFFFFF',
  userInfoBg: '#FFFFFF',
  userInfoName: '#111827',
  userInfoEmail: '#10B981',
  userInfoRole: '#6B7280',
  userLogoutBtn: '#EF4444',
  userLogoutBtnHover: '#DC2626'
};

export const COLOR_PRESETS: { id: string; name: string; desc: string; colors: SystemColors }[] = [
  {
    id: 'institucional',
    name: '🌿 Cruz Verde Oficial (Institucional)',
    desc: 'Verde oficial de Cruz Verde Salvadoreña con menú noche elegante',
    colors: {
      primary: '#008f39',
      primaryHover: '#00702c',
      secondary: '#10b981',
      sidebarBg: '#0a2014',
      sidebarText: '#d1fae5',
      sidebarActiveBg: 'rgba(255, 255, 255, 0.15)',
      sidebarBorder: 'rgba(0, 0, 0, 0.2)',
      dashboardBg: '#f8faf9',
      cardBg: '#ffffff',
      cardBorder: '#e2e8f0',
      anuncioBg: '#ffffff',
      anuncioBorder: '#a7f3d0',
      anuncioText: '#111827',
      tickerBg: '#0a0f0d',
      tickerText: '#f3f4f6',
      tickerBadgeBg: '#059669',
      tickerBadgeText: '#ffffff'
    }
  },
  {
    id: 'esmeralda_ios',
    name: '🌲 Esmeralda Moderno (Apple iOS)',
    desc: 'Estilo contemporáneo inspirado en interfaces de Apple Sequoia e iPadOS',
    colors: {
      primary: '#10b981',
      primaryHover: '#059669',
      secondary: '#34d399',
      sidebarBg: '#064e3b',
      sidebarText: '#ecfdf5',
      sidebarActiveBg: 'rgba(255, 255, 255, 0.20)',
      sidebarBorder: 'rgba(0, 0, 0, 0.25)',
      dashboardBg: '#f0fdf4',
      cardBg: '#ffffff',
      cardBorder: '#bbf7d0',
      anuncioBg: '#ffffff',
      anuncioBorder: '#6ee7b7',
      anuncioText: '#064e3b',
      tickerBg: '#022c22',
      tickerText: '#f0fdf4',
      tickerBadgeBg: '#10b981',
      tickerBadgeText: '#ffffff'
    }
  },
  {
    id: 'azul_rescate',
    name: '🌊 Azul Búsqueda y Rescate',
    desc: 'Paleta técnica para operaciones acuáticas y de rescate nacional',
    colors: {
      primary: '#0284c7',
      primaryHover: '#0369a1',
      secondary: '#38bdf8',
      sidebarBg: '#0c1e33',
      sidebarText: '#e0f2fe',
      sidebarActiveBg: 'rgba(255, 255, 255, 0.18)',
      sidebarBorder: 'rgba(0, 0, 0, 0.3)',
      dashboardBg: '#f0f9ff',
      cardBg: '#ffffff',
      cardBorder: '#bae6fd',
      anuncioBg: '#ffffff',
      anuncioBorder: '#7dd3fc',
      anuncioText: '#0c4a6e',
      tickerBg: '#081526',
      tickerText: '#f0f9ff',
      tickerBadgeBg: '#0284c7',
      tickerBadgeText: '#ffffff'
    }
  },
  {
    id: 'rojo_emergencia',
    name: '🚑 Rojo Emergencia y Rescate',
    desc: 'Alto contraste institucional para atención médica de urgencia',
    colors: {
      primary: '#dc2626',
      primaryHover: '#b91c1c',
      secondary: '#f87171',
      sidebarBg: '#200c0c',
      sidebarText: '#fee2e2',
      sidebarActiveBg: 'rgba(255, 255, 255, 0.18)',
      sidebarBorder: 'rgba(0, 0, 0, 0.3)',
      dashboardBg: '#fef2f2',
      cardBg: '#ffffff',
      cardBorder: '#fecaca',
      anuncioBg: '#ffffff',
      anuncioBorder: '#fca5a5',
      anuncioText: '#7f1d1d',
      tickerBg: '#140505',
      tickerText: '#fef2f2',
      tickerBadgeBg: '#dc2626',
      tickerBadgeText: '#ffffff'
    }
  },
  {
    id: 'modo_oscuro',
    name: '🌑 Modo Carbón y Titanio',
    desc: 'Paleta nocturna elegante de bajo brillo estilo Dark Mode Apple',
    colors: {
      primary: '#22c55e',
      primaryHover: '#16a34a',
      secondary: '#4ade80',
      sidebarBg: '#121212',
      sidebarText: '#e4e4e7',
      sidebarActiveBg: 'rgba(255, 255, 255, 0.14)',
      sidebarBorder: '#27272a',
      dashboardBg: '#18181b',
      cardBg: '#27272a',
      cardBorder: '#3f3f46',
      anuncioBg: '#27272a',
      anuncioBorder: '#3f3f46',
      anuncioText: '#f4f4f5',
      tickerBg: '#09090b',
      tickerText: '#f4f4f5',
      tickerBadgeBg: '#22c55e',
      tickerBadgeText: '#000000'
    }
  }
];

interface SettingsContextType {
  logos: {
    login: string;
    dashboard: string;
    footer: string;
    verificacion: string;
  };
  loginShowSolicitar: boolean;
  loginShowVerificar: boolean;
  colors: SystemColors;
  verificacion: {
    titulo: string;
    mensaje: string;
    fields: Record<string, boolean>;
  };
  loading: boolean;
  refreshSettings: () => Promise<void>;
  saveColors: (newColors: SystemColors) => Promise<boolean>;
}

const defaultSettings = {
  logos: {
    login: '/logo.png',
    dashboard: '/logo.png',
    footer: '/logo.png',
    verificacion: '/logo.png'
  },
  loginShowSolicitar: true,
  loginShowVerificar: true,
  colors: defaultColors,
  verificacion: {
    titulo: 'Verificación de Carnet - Cruz Verde Salvadoreña',
    mensaje: 'Este carnet es auténtico y pertenece a un elemento activo de la institución.',
    fields: {
      dui: true,
      seccional: true,
      cargoInstitucional: true,
      cargoAdministrativo: true,
      fechaIngreso: true,
      fechaNacimiento: true,
      telefono: true,
      cursos: true,
      tipoSangre: true,
      email: true
    }
  }
};

const SettingsContext = createContext<SettingsContextType>({
  ...defaultSettings,
  loading: true,
  refreshSettings: async () => {},
  saveColors: async () => false
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(() => {
    // Carga inicial instantánea desde localStorage
    try {
      const cachedColors = localStorage.getItem('cv_system_colors');
      if (cachedColors) {
        const parsed = JSON.parse(cachedColors);
        return {
          ...defaultSettings,
          colors: { ...defaultColors, ...parsed }
        };
      }
    } catch {}
    return defaultSettings;
  });

  const [loading, setLoading] = useState(true);

  const applyCssVariables = (cols: SystemColors) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--app-primary', cols.primary);
    root.style.setProperty('--app-primary-hover', cols.primaryHover);
    root.style.setProperty('--app-secondary', cols.secondary || '#10b981');
    root.style.setProperty('--app-sidebar-bg', cols.sidebarBg || '#0a2014');
    root.style.setProperty('--app-sidebar-text', cols.sidebarText || '#d1fae5');
    root.style.setProperty('--app-sidebar-active-bg', cols.sidebarActiveBg || 'rgba(255, 255, 255, 0.15)');
    root.style.setProperty('--app-sidebar-border', cols.sidebarBorder || 'rgba(0, 0, 0, 0.2)');
    root.style.setProperty('--app-dashboard-bg', cols.dashboardBg || '#f8faf9');
    root.style.setProperty('--app-card-bg', cols.cardBg || '#ffffff');
    root.style.setProperty('--app-card-border', cols.cardBorder || 'rgba(226, 232, 240, 0.8)');
    root.style.setProperty('--app-anuncio-bg', cols.anuncioBg || '#ffffff');
    root.style.setProperty('--app-anuncio-border', cols.anuncioBorder || '#a7f3d0');
    root.style.setProperty('--app-anuncio-text', cols.anuncioText || '#111827');
    root.style.setProperty('--app-ticker-bg', cols.tickerBg || '#0a0f0d');
    root.style.setProperty('--app-ticker-text', cols.tickerText || '#f3f4f6');
    root.style.setProperty('--app-ticker-badge-bg', cols.tickerBadgeBg || '#059669');
    root.style.setProperty('--app-ticker-badge-text', cols.tickerBadgeText || '#ffffff');
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('configuracion').select('*');
      
      const newSettings = JSON.parse(JSON.stringify(defaultSettings));

      // Si localStorage tenía colores, respetarlos como base
      try {
        const cached = localStorage.getItem('cv_system_colors');
        if (cached) {
          newSettings.colors = { ...defaultColors, ...JSON.parse(cached) };
        }
      } catch {}

      if (!error && data) {
        data.forEach(row => {
          if (row.clave === 'logos' && row.valor) {
            try { newSettings.logos = { ...newSettings.logos, ...JSON.parse(row.valor) }; } catch (e) {}
          }
          if (row.clave === 'colores' && row.valor) {
            try { 
              const parsed = JSON.parse(row.valor);
              newSettings.colors = { ...newSettings.colors, ...parsed };
              localStorage.setItem('cv_system_colors', JSON.stringify(newSettings.colors));
            } catch (e) {}
          }
          if (row.clave === 'verificacion_titulo') newSettings.verificacion.titulo = row.valor;
          if (row.clave === 'verificacion_mensaje') newSettings.verificacion.mensaje = row.valor;
          if (row.clave === 'verificacion_fields' && row.verificacion_fields) {
            newSettings.verificacion.fields = row.verificacion_fields;
          } else if (row.clave === 'verificacion_fields' && row.valor) {
            try { newSettings.verificacion.fields = { ...newSettings.verificacion.fields, ...JSON.parse(row.valor) }; } catch(e){}
          }
          if (row.clave === 'login_show_solicitar') {
             newSettings.loginShowSolicitar = row.valor === 'true';
          }
          if (row.clave === 'login_show_verificar') {
             newSettings.loginShowVerificar = row.valor === 'true';
          }
        });
      } else {
        // Fallback API local
        try {
          const res = await fetch('/api/configuracion');
          if (res.ok) {
            const localConf = await res.json();
            if (localConf.colores) {
              const parsed = JSON.parse(localConf.colores);
              newSettings.colors = { ...newSettings.colors, ...parsed };
              localStorage.setItem('cv_system_colors', JSON.stringify(newSettings.colors));
            }
          }
        } catch {}
      }

      setSettings(newSettings);
      applyCssVariables(newSettings.colors);
    } catch (error) {
      console.warn('Error loading settings, using cached/defaults:', error);
      applyCssVariables(settings.colors);
    } finally {
      setLoading(false);
    }
  };

  const saveColors = async (newColors: SystemColors): Promise<boolean> => {
    try {
      const mergedColors = { ...settings.colors, ...newColors };
      
      // 1. Inmediatamente actualizar estado y CSS variables
      setSettings(prev => ({ ...prev, colors: mergedColors }));
      applyCssVariables(mergedColors);
      localStorage.setItem('cv_system_colors', JSON.stringify(mergedColors));

      const jsonStr = JSON.stringify(mergedColors);

      // 2. Guardar en Supabase
      try {
        await supabase
          .from('configuracion')
          .upsert({ clave: 'colores', valor: jsonStr }, { onConflict: 'clave' });
      } catch (err) {
        console.warn('Supabase save error:', err);
      }

      // 3. Guardar en backend local (SQLite)
      try {
        await fetch('/api/configuracion', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colores: jsonStr })
        });
      } catch (err) {
        console.warn('Local API save error:', err);
      }

      return true;
    } catch (e) {
      console.error('Error saving colors:', e);
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSettings();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      ...settings, 
      loading, 
      refreshSettings: fetchSettings,
      saveColors 
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
