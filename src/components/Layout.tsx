import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BookOpen, MapPin, Settings, LogOut, Menu, X, 
  IdCard, ChevronLeft, ChevronRight, User as UserIcon, Activity, Shield, 
  PhoneCall, BadgeCheck, FileText, Truck, ClipboardList, Fuel, FolderDown, 
  Megaphone, Sparkles, ChevronDown, Palette, FileSpreadsheet, Award
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { usePresence } from '../hooks/usePresence';
import { supabase } from '../lib/supabase';
import MisAccesosModal from './accesos/MisAccesosModal';
import PresenceModal from './PresenceModal';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  show: boolean;
  category: 'principal' | 'operaciones' | 'gestion' | 'identificacion' | 'sistema';
  badge?: number;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userName, role, socorristaId, permissions, signOut } = useAuth();
  const { logos, colors } = useSettings();
  const { onlineCount, activeUsers, refreshPresence } = usePresence();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showMisAccesosModal, setShowMisAccesosModal] = useState(false);
  const [showPresenceModal, setShowPresenceModal] = useState(false);

  // Estados para notificaciones de solicitudes no leídas
  const [unreadCombustible, setUnreadCombustible] = useState(0);
  const [unreadCompra, setUnreadCompra] = useState(0);
  const [unreadGeneral, setUnreadGeneral] = useState(0);

  const checkUnreadSolicitudes = async () => {
    try {
      const lastSeenComb = Number(localStorage.getItem('cv_last_seen_combustible') || '0');
      const lastSeenComp = Number(localStorage.getItem('cv_last_seen_compra') || '0');
      const lastSeenGen = Number(localStorage.getItem('cv_last_seen_solicitudes') || '0');

      // 1. Solicitudes de combustible
      let combItems: { id: number; created_at?: string; estado?: string }[] = [];
      try {
        const { data: combData } = await supabase
          .from('solicitudes_combustible')
          .select('id, created_at, estado')
          .order('created_at', { ascending: false })
          .limit(50);
        if (combData && combData.length > 0) combItems = combData;
      } catch (e) {}

      // Fallback a almacenamiento local si no hay datos de Supabase
      if (combItems.length === 0) {
        try {
          const localComb = sessionStorage.getItem('cruz_verde_solicitudes_combustible') || localStorage.getItem('cruz_verde_solicitudes_combustible');
          if (localComb) combItems = JSON.parse(localComb);
        } catch (e) {}
      }

      if (location.pathname === '/solicitudes-combustible') {
        setUnreadCombustible(0);
      } else {
        const unreadComb = combItems.filter(s => {
          const itemTime = s.created_at ? new Date(s.created_at).getTime() : 0;
          if (lastSeenComb === 0) {
            return s.estado === 'Pendiente';
          }
          return itemTime > lastSeenComb || (s.estado === 'Pendiente' && itemTime > lastSeenComb);
        }).length;
        setUnreadCombustible(unreadComb);
      }

      // 2. Solicitudes de compra
      let compItems: { id: number; created_at?: string; estado?: string }[] = [];
      try {
        const { data: compData } = await supabase
          .from('solicitudes_compra')
          .select('id, created_at, estado')
          .order('created_at', { ascending: false })
          .limit(50);
        if (compData && compData.length > 0) compItems = compData;
      } catch (e) {}

      if (compItems.length === 0) {
        try {
          const localComp = sessionStorage.getItem('cruz_verde_solicitudes_compra') || localStorage.getItem('cruz_verde_solicitudes_compra');
          if (localComp) compItems = JSON.parse(localComp);
        } catch (e) {}
      }

      if (location.pathname === '/solicitudes-compra') {
        setUnreadCompra(0);
      } else {
        const unreadComp = compItems.filter(s => {
          const itemTime = s.created_at ? new Date(s.created_at).getTime() : 0;
          if (lastSeenComp === 0) {
            return s.estado === 'Pendiente';
          }
          return itemTime > lastSeenComp || (s.estado === 'Pendiente' && itemTime > lastSeenComp);
        }).length;
        setUnreadCompra(unreadComp);
      }

      // 3. Solicitudes generales
      if (location.pathname === '/solicitudes') {
        setUnreadGeneral(0);
      } else {
        const allItems = [...combItems, ...compItems];
        const unreadGen = allItems.filter(s => {
          const itemTime = s.created_at ? new Date(s.created_at).getTime() : 0;
          if (lastSeenGen === 0) {
            return s.estado === 'Pendiente';
          }
          return itemTime > lastSeenGen;
        }).length;
        setUnreadGeneral(unreadGen);
      }

    } catch (e) {
      // Ignorar errores silenciosos
    }
  };

  // Limpiar badges según la ruta activa al ingresar
  useEffect(() => {
    const now = Date.now().toString();
    if (location.pathname === '/solicitudes') {
      localStorage.setItem('cv_last_seen_solicitudes', now);
      setUnreadGeneral(0);
    } else if (location.pathname === '/solicitudes-combustible') {
      localStorage.setItem('cv_last_seen_combustible', now);
      setUnreadCombustible(0);
    } else if (location.pathname === '/solicitudes-compra') {
      localStorage.setItem('cv_last_seen_compra', now);
      setUnreadCompra(0);
    }
    checkUnreadSolicitudes();
  }, [location.pathname]);

  // Escuchar eventos globales y polling periódico
  useEffect(() => {
    const handleUpdate = () => checkUnreadSolicitudes();
    window.addEventListener('solicitudes_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    const interval = setInterval(checkUnreadSolicitudes, 15000);
    return () => {
      window.removeEventListener('solicitudes_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const totalUnreadSolicitudes = unreadGeneral > 0 ? unreadGeneral : (unreadCombustible + unreadCompra);

  const navigation: NavItem[] = [
    // Principal
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: permissions.view_dashboard, category: 'principal' },
    { name: 'Mi Perfil', href: `/socorristas/${socorristaId}`, icon: UserIcon, show: !!socorristaId, category: 'principal' },
    { name: 'Anuncios', href: '/anuncios', icon: Megaphone, show: Boolean(role === 'admin' || permissions.view_anuncios), category: 'principal' },
    { name: 'Archivos', href: '/archivos', icon: FolderDown, show: permissions.view_archivos ?? true, category: 'principal' },
    
    // Operaciones
    { name: 'Socorristas', href: '/socorristas', icon: Users, show: permissions.view_socorristas, category: 'operaciones' },
    { name: 'Vehículos', href: '/vehiculos', icon: Truck, show: permissions.view_vehiculos ?? true, category: 'operaciones' },
    { name: 'Cursos', href: '/cursos', icon: BookOpen, show: permissions.view_cursos, category: 'operaciones' },
    { name: 'Méritos y Premios', href: '/meritos', icon: Award, show: Boolean(role === 'admin' || (permissions.view_meritos ?? true)), category: 'operaciones' },
    { name: 'Formularios', href: '/formularios', icon: FileSpreadsheet, show: Boolean(role === 'admin' || permissions.view_formularios), category: 'operaciones' },
    { name: 'Seccionales', href: '/seccionales', icon: MapPin, show: permissions.view_seccionales, category: 'operaciones' },
    { name: 'Directorio', href: '/directorio', icon: PhoneCall, show: permissions.view_directorio, category: 'operaciones' },
    
    // Gestión & Solicitudes
    { name: 'Solicitudes', href: '/solicitudes', icon: ClipboardList, show: Boolean(permissions.view_solicitudes_compra || permissions.view_solicitudes_combustible), category: 'gestion', badge: totalUnreadSolicitudes > 0 ? totalUnreadSolicitudes : undefined },
    { name: 'Solicitud Compra', href: '/solicitudes-compra', icon: FileText, show: permissions.view_solicitudes_compra ?? true, category: 'gestion', badge: unreadCompra > 0 ? unreadCompra : undefined },
    { name: 'Combustible', href: '/solicitudes-combustible', icon: Fuel, show: permissions.view_solicitudes_combustible ?? true, category: 'gestion', badge: unreadCombustible > 0 ? unreadCombustible : undefined },
    
    // Identificación
    { name: 'Carnet Oficial', href: '/carnet', icon: IdCard, show: permissions.view_carnet, category: 'identificacion' },
    { name: 'Solicitar Carnet', href: '/solicitud-carnet', icon: FileText, show: permissions.view_solicitar_carnet, category: 'identificacion' },
    { name: 'Verificar Carnet', href: '/verificar', icon: BadgeCheck, show: permissions.view_verificar_carnet, category: 'identificacion' },
    
    // Sistema
    { name: 'Actividad', href: '/actividad', icon: Activity, show: permissions.view_activity, category: 'sistema' },
    { name: 'Accesos', href: '/accesos', icon: Shield, show: permissions.view_accesos, category: 'sistema' },
    { name: 'Configuración', href: '/configuracion', icon: Settings, show: permissions.view_config, category: 'sistema' },
    { name: 'Colores del Sistema', href: '/configuracion?tab=colores', icon: Palette, show: Boolean(role === 'admin' || permissions.personalizar_colores || permissions.view_config), category: 'sistema' },
  ];

  const filteredNavigation = navigation.filter(item => item.show);

  const categories = [
    { id: 'principal', title: 'Principal' },
    { id: 'operaciones', title: 'Operaciones' },
    { id: 'gestion', title: 'Gestión & Logística' },
    { id: 'identificacion', title: 'Credenciales' },
    { id: 'sistema', title: 'Sistema' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isItemActive = (itemHref: string) => {
    const current = location.pathname + location.search;
    if (itemHref.includes('?')) {
      return current === itemHref;
    }
    if (itemHref === '/') {
      return location.pathname === '/';
    }
    if (itemHref === '/configuracion') {
      return location.pathname === '/configuracion' && (!location.search || location.search === '?tab=plantillas');
    }
    return location.pathname.startsWith(itemHref);
  };

  React.useEffect(() => {
    if (!location.pathname.startsWith('/socorristas')) {
      const keysToRemove = [
        'socorristas_searchTerm',
        'socorristas_filterEstado',
        'socorristas_filterSeccional',
        'socorristas_filterCargoInst',
        'socorristas_filterCargoAdmin',
        'socorristas_showAdvancedFilters'
      ];
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
  }, [location.pathname]);

  return (
    <div 
      style={{ backgroundColor: colors.dashboardBg || '#f8faf9' }} 
      className="min-h-screen flex font-sans antialiased transition-colors duration-200"
    >
      {/* MOBILE DRAWER (Estilo iOS) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div 
            style={{ backgroundColor: colors.sidebarBg || '#0a2014' }} 
            className="relative flex-1 flex flex-col max-w-xs w-full text-white shadow-2xl border-r border-white/10"
          >
            {/* Header Móvil */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 p-1.5 flex items-center justify-center">
                  <img src={logos?.dashboard || "/logo.png"} alt="Cruz Verde" className="h-full w-auto object-contain" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight text-white leading-tight">Cruz Verde</h2>
                  <p className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Salvadoreña</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presencia Móvil */}
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => {
                  setShowPresenceModal(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>{onlineCount} {onlineCount === 1 ? 'persona conectada' : 'personas conectadas'}</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-200">
                  En vivo
                </span>
              </button>
            </div>

            {/* Lista de Navegación Móvil */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 sidebar-scrollbar custom-scrollbar">
              {categories.map((cat) => {
                const itemsInCat = filteredNavigation.filter(item => item.category === cat.id);
                if (itemsInCat.length === 0) return null;
                return (
                  <div key={cat.id} className="space-y-1">
                    <p className="text-[10px] font-bold tracking-widest text-emerald-400/50 uppercase px-3 pb-1">
                      {cat.title}
                    </p>
                    {itemsInCat.map((item) => {
                      const isActive = isItemActive(item.href);
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          style={
                            isActive
                              ? { backgroundColor: colors.sidebarActiveBg || 'rgba(255, 255, 255, 0.15)', color: '#ffffff' }
                              : { color: colors.sidebarText || '#d1fae5' }
                          }
                          className={`flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'font-bold shadow-xs border border-white/10'
                              : 'hover:bg-white/10'
                          }`}
                        >
                          <item.icon className="w-4 h-4 mr-3 flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full min-w-5 text-center leading-none shadow-xs">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer Móvil */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 truncate pr-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-sm shadow-xs border border-white/20">
                    {(userName ? userName.charAt(0).toUpperCase() : (role === 'admin' ? 'A' : 'S'))}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{userName || 'Usuario'}</p>
                    <p className="text-[10px] text-emerald-300/80 capitalize">{role || 'Usuario'}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR DESKTOP (ESTILO APPLE / IOS - MINIMALISTA Y ELEGANTE)              */}
      {/* ========================================================================= */}
      <aside 
        style={{ backgroundColor: colors.sidebarBg || '#0a2014' }}
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30 text-white transition-all duration-300 ease-in-out border-r border-black/20 shadow-xl overflow-hidden ${
          isSidebarCollapsed ? 'md:w-20' : 'md:w-64'
        }`}
      >
        {/* Toggle para Colapsar/Expandir (Pill estilo Apple) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{ backgroundColor: colors.sidebarBg || '#0a2014' }}
          className="absolute -right-3 top-7 w-6 h-6 text-emerald-300 hover:text-white rounded-full border border-white/20 shadow-md flex items-center justify-center transition-transform hover:scale-110 z-40 cursor-pointer"
          title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Cabecera / Logo Institucional (Estilo Apple Glass) */}
        <div className={`h-20 flex-shrink-0 px-4 border-b border-white/5 flex items-center transition-all ${
          isSidebarCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          <div className="flex items-center space-x-3 truncate">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-1.5 flex items-center justify-center flex-shrink-0 shadow-xs">
              <img 
                src={logos?.dashboard || "/logo.png"} 
                alt="Cruz Verde Salvadoreña" 
                className="h-full w-auto object-contain" 
              />
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate">
                <div className="flex items-center space-x-1.5">
                  <h1 className="text-sm font-black tracking-tight text-white leading-tight truncate">
                    Cruz Verde
                  </h1>
                </div>
                <p className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase leading-none mt-0.5">
                  Salvadoreña
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Indicador de Concurrencia y Personas Conectadas (Pill iOS) */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setShowPresenceModal(true)}
            className={`w-full group flex items-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-300 transition-all ${
              isSidebarCollapsed ? 'p-2 justify-center' : 'px-3 py-2 justify-between'
            }`}
            title="Ver usuarios en línea y capacidad del servidor"
          >
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {!isSidebarCollapsed && (
                <span className="text-xs font-semibold tracking-tight text-emerald-200">
                  {onlineCount} {onlineCount === 1 ? 'en línea' : 'en línea'}
                </span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full group-hover:bg-emerald-500/30 transition-colors">
                Activos
              </span>
            )}
          </button>
        </div>

        {/* Lista de Navegación Segmentada (Estilo macOS / iPadOS) */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 sidebar-scrollbar custom-scrollbar">
          {categories.map((cat) => {
            const itemsInCat = filteredNavigation.filter(item => item.category === cat.id);
            if (itemsInCat.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="text-[10px] font-bold tracking-widest text-emerald-400/40 uppercase px-3 pt-2 pb-1 select-none">
                    {cat.title}
                  </p>
                )}
                {isSidebarCollapsed && <div className="h-px bg-white/5 my-2" />}

                {itemsInCat.map((item) => {
                  const isActive = isItemActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      title={isSidebarCollapsed ? item.name : ''}
                      style={
                        isActive
                          ? {
                              backgroundColor: colors.sidebarActiveBg || 'rgba(255, 255, 255, 0.15)',
                              color: '#ffffff'
                            }
                          : {
                              color: colors.sidebarText || '#d1fae5'
                            }
                      }
                      className={`group relative flex items-center rounded-xl text-xs font-medium transition-all duration-150 ${
                        isSidebarCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
                      } ${
                        isActive
                          ? 'font-bold shadow-xs backdrop-blur-xs border border-white/10'
                          : 'hover:bg-white/[0.08]'
                      }`}
                    >
                      {/* Indicador de píldora activa estilo iOS */}
                      {isActive && (
                        <span 
                          style={{ backgroundColor: colors.secondary || colors.primary || '#34d399' }}
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full shadow-xs" 
                        />
                      )}
                      
                      <item.icon 
                        style={isActive ? { color: '#ffffff' } : { color: colors.sidebarText || '#d1fae5' }}
                        className={`flex-shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                          isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4 mr-3'
                        }`} 
                      />

                      {!isSidebarCollapsed && (
                        <span className="truncate">{item.name}</span>
                      )}

                      {/* Notificación Badge Estilo iOS */}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span 
                          className={`font-black rounded-full shadow-xs transition-all ${
                            isSidebarCollapsed 
                              ? 'absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 ring-2 ring-emerald-950' 
                              : 'ml-auto px-1.5 py-0.5 text-[10px] bg-rose-500 text-white min-w-5 text-center leading-none'
                          }`}
                          title={`${item.badge} nueva(s) solicitud(es)`}
                        >
                          {!isSidebarCollapsed && (item.badge > 99 ? '99+' : item.badge)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer / Tarjeta de Usuario (Estilo macOS Inset Card) */}
        <div className="p-3 border-t border-white/5 bg-black/20">
          <div className={`rounded-2xl bg-white/[0.04] border border-white/[0.06] p-2.5 flex items-center transition-all ${
            isSidebarCollapsed ? 'flex-col space-y-2.5 justify-center' : 'justify-between'
          }`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'min-w-0 pr-2 flex-1'}`}>
              {/* Avatar con anillo gradiente */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs ring-2 ring-emerald-400/30">
                {(userName ? userName.charAt(0).toUpperCase() : (role === 'admin' ? 'A' : 'S'))}
              </div>

              {!isSidebarCollapsed && (
                <div className="ml-2.5 min-w-0">
                  <p className="text-xs font-bold text-white truncate" title={userName || 'Usuario'}>
                    {userName || 'Usuario'}
                  </p>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold text-emerald-300/90 capitalize truncate">
                      {role === 'admin' ? 'Administrador' : role || 'Usuario'}
                    </span>
                    <span className="text-white/20">•</span>
                    <button
                      onClick={() => setShowMisAccesosModal(true)}
                      className="text-[10px] text-emerald-400 hover:text-white hover:underline cursor-pointer font-medium"
                      title="Ver permisos activos"
                    >
                      Permisos
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Botón Salir */}
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/15 transition-all flex-shrink-0 cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* CONTENIDO PRINCIPAL                                                       */}
      {/* ========================================================================= */}
      <div className={`flex flex-col flex-1 w-full transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
      }`}>
        {/* Barra Superior Móvil */}
        <header className="sticky top-0 z-20 md:hidden bg-white/90 backdrop-blur-md border-b border-gray-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs">
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <span className="sr-only">Abrir menú</span>
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <img src={logos?.dashboard || "/logo.png"} alt="Cruz Verde" className="h-8 w-auto object-contain" />
            <span className="text-xs font-black tracking-tight text-gray-900">Cruz Verde Salvadoreña</span>
          </div>

          <button
            onClick={() => setShowPresenceModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{onlineCount}</span>
          </button>
        </header>
        
        <main className="flex-1 w-full overflow-x-hidden">
          <div className="py-6 sm:py-8 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Modales Compartidos */}
      <MisAccesosModal
        isOpen={showMisAccesosModal}
        onClose={() => setShowMisAccesosModal(false)}
      />

      <PresenceModal
        isOpen={showPresenceModal}
        onClose={() => setShowPresenceModal(false)}
        onlineCount={onlineCount}
        activeUsers={activeUsers}
        onRefresh={refreshPresence}
      />
    </div>
  );
}
