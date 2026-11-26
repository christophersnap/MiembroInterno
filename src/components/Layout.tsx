import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BookOpen, MapPin, Settings, LogOut, Menu, X, 
  IdCard, ChevronLeft, ChevronRight, User as UserIcon, Activity, Shield, 
  PhoneCall, BadgeCheck, FileText, Truck, ClipboardList, Fuel, FolderDown, 
  Megaphone, Newspaper, Sparkles, ChevronDown, Palette, FileSpreadsheet, Award, LifeBuoy
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { usePresence } from '../hooks/usePresence';
import { supabase } from '../lib/supabase';
import { isSolicitudRealizadaPorUsuario } from '../utils/solicitudFilter';
import {
  syncReadReceiptsFromSupabase,
  isSolicitudUnread,
  isCarnetSolicitudUnread,
  SOLICITUDES_READ_EVENT,
  publishModuleUnreadCount,
} from '../utils/solicitudReadTracker';
import MisAccesosModal from './accesos/MisAccesosModal';
import PresenceModal from './PresenceModal';
import SoporteFormModal from './soporte/SoporteFormModal';
import { matchesSoporteTicketScope } from '../lib/soporte';

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
  const {
    user,
    userName,
    role,
    socorristaId,
    directorSeccionalId,
    userSeccionalId,
    userSeccionalNombre,
    permissions,
    loading: authLoading,
    getModuleScope,
    getModuleSeccionalIds,
    signOut,
  } = useAuth();
  const { logos, colors } = useSettings();
  const { onlineCount, activeUsers, refreshPresence } = usePresence();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showMisAccesosModal, setShowMisAccesosModal] = useState(false);
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [showSoporteModal, setShowSoporteModal] = useState(false);

  const isAdmin = role === 'admin' || role === 'superadmin';
  const effectiveSeccionalId = directorSeccionalId || userSeccionalId;
  const canViewOnlineUsers = isAdmin || Boolean(permissions.ver_personas_conectadas);
  const canViewSoporte = isAdmin || Boolean(permissions.view_soporte ?? true);
  const canCreateSoporte = isAdmin || Boolean(permissions.crear_soporte ?? true);

  const canViewCompra = isAdmin || Boolean(permissions.view_solicitudes_compra);
  const canViewCompraHistorial = isAdmin || Boolean(permissions.view_compra_historial);
  const canViewCombustible = isAdmin || Boolean(permissions.view_solicitudes_combustible);
  const canViewCombustibleHistorial = isAdmin || Boolean(permissions.view_combustible_historial);
  const canViewCarnet = isAdmin || Boolean(permissions.view_solicitudes_carnet);
  const canSolveCarnet = isAdmin || Boolean(permissions.edit_solicitudes_carnet);

  const compraScope = getModuleScope('solicitudes_compra');
  const combustibleScope = getModuleScope('solicitudes_combustible');
  const carnetScope = getModuleScope('solicitudes_carnet');
  const soporteScope = getModuleScope('soporte');
  const compraSeccionalIds = getModuleSeccionalIds('solicitudes_compra');
  const combustibleSeccionalIds = getModuleSeccionalIds('solicitudes_combustible');
  const carnetSeccionalIds = getModuleSeccionalIds('solicitudes_carnet');
  const soporteSeccionalIds = getModuleSeccionalIds('soporte');
  const scopesDepsKey = `${compraScope}:${compraSeccionalIds.join(',')}|${combustibleScope}:${combustibleSeccionalIds.join(',')}|${carnetScope}:${carnetSeccionalIds.join(',')}|${soporteScope}:${soporteSeccionalIds.join(',')}`;

  // Estados para notificaciones de solicitudes no leídas por solicitud individual (según alcance del usuario)
  const [unreadCombustible, setUnreadCombustible] = useState(0);
  const [unreadCompra, setUnreadCompra] = useState(0);
  const [unreadCarnet, setUnreadCarnet] = useState(0);
  const [unreadGeneral, setUnreadGeneral] = useState(0);
  const [unreadSoporte, setUnreadSoporte] = useState(0);

  const unreadInFlightRef = useRef(false);
  const lastUnreadCheckAtRef = useRef(0);
  const seccionalesCacheRef = useRef<{ at: number; items: { id: number; nombre: string }[] }>({
    at: 0,
    items: [],
  });

  const checkUnreadSolicitudes = async (force = false) => {
    if (authLoading || !user) {
      setUnreadCombustible(0);
      setUnreadCompra(0);
      setUnreadCarnet(0);
      setUnreadGeneral(0);
      setUnreadSoporte(0);
      return;
    }

    // Evitar consultas en segundo plano o solapadas que saturan Supabase/PostgREST
    if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (unreadInFlightRef.current) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastUnreadCheckAtRef.current < 20000) {
      return;
    }

    unreadInFlightRef.current = true;
    lastUnreadCheckAtRef.current = now;

    try {
      const readSet = await syncReadReceiptsFromSupabase(user.id);

      // Catálogo de seccionales con caché en memoria de 5 minutos
      let secList: { id: number; nombre: string }[] = seccionalesCacheRef.current.items;
      const needsSeccionalesCatalog =
        (canViewCombustible && combustibleScope === 'seccional') ||
        (canViewCompra && compraScope === 'seccional') ||
        (canViewCarnet && carnetScope === 'seccional') ||
        (canViewSoporte && soporteScope === 'seccional');

      if (needsSeccionalesCatalog && (secList.length === 0 || now - seccionalesCacheRef.current.at > 300000)) {
        try {
          const { data: secData } = await supabase.from('seccionales').select('id, nombre');
          if (secData) {
            secList = secData;
            seccionalesCacheRef.current = { at: Date.now(), items: secData };
          }
        } catch {}
      }

      const matchesLogisticaScope = (
        scope: 'global' | 'seccional' | 'usuario',
        allowedIds: number[],
        row: any
      ): boolean => {
        if (scope === 'global') return true;
        if (scope === 'seccional') {
          const targetIds =
            allowedIds.length > 0
              ? allowedIds
              : effectiveSeccionalId
              ? [Number(effectiveSeccionalId)]
              : [];

          if (targetIds.length > 0) {
            if (row.seccional_id && targetIds.includes(Number(row.seccional_id))) return true;
            const allowedNames = secList
              .filter((s) => targetIds.includes(s.id))
              .map((s) => String(s.nombre || '').toLowerCase());
            if (
              row.seccional_nombre &&
              allowedNames.some((n) => n && String(row.seccional_nombre).toLowerCase().includes(n))
            ) {
              return true;
            }
            return false;
          }
          if (userSeccionalNombre) {
            return String(row.seccional_nombre || '')
              .toLowerCase()
              .includes(userSeccionalNombre.toLowerCase());
          }
          return isSolicitudRealizadaPorUsuario(row, user, userName);
        }
        return isSolicitudRealizadaPorUsuario(row, user, userName);
      };

      const ACTIVE_LOGISTICA_STATES = ['Pendiente', 'En Proceso', 'En Proceso de Compra'];
      const ACTIVE_CARNET_STATES = ['Pendiente', 'En revisión', 'Observada'];
      const ACTIVE_SOPORTE_STATES = ['Pendiente', 'En revisión'];

      // Ejecutar en paralelo solo consultas ligeras de estados activos/pendientes
      const [unreadCombCount, unreadCompCount, carnetUnreadCount, soporteUnreadCount] =
        await Promise.all([
          // 1. Combustible activo
          (async () => {
            if (!canViewCombustible) return 0;
            let rawComb: any[] = [];
            let combQueryFailed = false;
            try {
              const { data: combData, error: combErr } = await supabase
                .from('solicitudes_combustible')
                .select('id, created_at, fecha_solicitud, estado, seccional_id, seccional_nombre, nombre_solicitante, correo_electronico')
                .in('estado', ACTIVE_LOGISTICA_STATES)
                .order('created_at', { ascending: false })
                .limit(100);
              if (combErr) {
                combQueryFailed = true;
              } else if (combData) {
                rawComb = combData;
              }
            } catch {
              combQueryFailed = true;
            }

            if (combQueryFailed) {
              try {
                const localComb =
                  sessionStorage.getItem('cruz_verde_solicitudes_combustible') ||
                  localStorage.getItem('cruz_verde_solicitudes_combustible');
                if (localComb) rawComb = JSON.parse(localComb);
              } catch {}
            }

            const scopedCombItems = rawComb.filter((row) =>
              matchesLogisticaScope(combustibleScope, combustibleSeccionalIds, row)
            );
            return scopedCombItems.filter((s) =>
              isSolicitudUnread({
                userId: user.id,
                readSet,
                modulo: 'combustible',
                solicitudKey: s.id,
                estado: s.estado,
                createdAt: s.created_at || s.fecha_solicitud,
              })
            ).length;
          })(),

          // 2. Compras activas
          (async () => {
            if (!canViewCompra) return 0;
            let rawComp: any[] = [];
            let compQueryFailed = false;
            try {
              const { data: compData, error: compErr } = await supabase
                .from('solicitudes_compra')
                .select('id, created_at, fecha_solicitud, estado, seccional_id, seccional_nombre, solicitado_por, user_email')
                .in('estado', ACTIVE_LOGISTICA_STATES)
                .order('created_at', { ascending: false })
                .limit(100);
              if (compErr) {
                compQueryFailed = true;
              } else if (compData) {
                rawComp = compData;
              }
            } catch {
              compQueryFailed = true;
            }

            if (compQueryFailed) {
              try {
                const localComp =
                  sessionStorage.getItem('cruz_verde_solicitudes_compra') ||
                  localStorage.getItem('cruz_verde_solicitudes_compra');
                if (localComp) rawComp = JSON.parse(localComp);
              } catch {}
            }

            const scopedCompItems = rawComp.filter((row) =>
              matchesLogisticaScope(compraScope, compraSeccionalIds, row)
            );
            return scopedCompItems.filter((s) =>
              isSolicitudUnread({
                userId: user.id,
                readSet,
                modulo: 'compra',
                solicitudKey: s.id,
                estado: s.estado,
                createdAt: s.created_at || s.fecha_solicitud,
              })
            ).length;
          })(),

          // 3. Solicitudes de carnet (regla diferenciada: quienes solventan ven activas/entrantes; quienes solo solicitan ven cuando su estado fue actualizado)
          (async () => {
            if (!canViewCarnet) return 0;
            try {
              const secNameById = new Map<number, string>();
              secList.forEach((s) => secNameById.set(s.id, s.nombre));

              let carnetQuery = supabase
                .from('solicitudes_carnet')
                .select(`
                  id,
                  socorrista_id,
                  seccional_id,
                  seccional_nombre,
                  solicitado_por,
                  solicitado_por_email,
                  estado_solicitud,
                  fecha_solicitud,
                  fecha_revision,
                  socorristas (
                    id,
                    seccional_id,
                    seccionales (id, nombre)
                  )
                `);

              if (canSolveCarnet) {
                carnetQuery = carnetQuery
                  .in('estado_solicitud', ACTIVE_CARNET_STATES)
                  .order('fecha_solicitud', { ascending: false })
                  .limit(120);
              } else {
                carnetQuery = carnetQuery
                  .not('estado_solicitud', 'in', '("Pendiente","Cancelada","Cancelado")')
                  .order('fecha_solicitud', { ascending: false })
                  .limit(150);
              }

              const { data: carnetRows } = await carnetQuery;

              const normalizedDbCarnet = (carnetRows || []).map((row: any) => {
                const soc = Array.isArray(row.socorristas) ? row.socorristas[0] : row.socorristas;
                const socSec = Array.isArray(soc?.seccionales) ? soc.seccionales[0] : soc?.seccionales;
                const resolvedSecId = row.seccional_id || soc?.seccional_id || socSec?.id || null;
                const resolvedSecNombre =
                  row.seccional_nombre ||
                  socSec?.nombre ||
                  (resolvedSecId ? secNameById.get(resolvedSecId) : '') ||
                  '';
                return {
                  id: row.id as number | string,
                  socorrista_id: Number(row.socorrista_id || 0),
                  seccional_id: resolvedSecId,
                  seccional_nombre: resolvedSecNombre,
                  solicitado_por: row.solicitado_por || '',
                  solicitado_por_email: row.solicitado_por_email || null,
                  estado_solicitud: row.estado_solicitud || 'Pendiente',
                  fecha_solicitud: row.fecha_solicitud || '',
                  fecha_revision: row.fecha_revision || null,
                };
              });

              const scopedCarnet = normalizedDbCarnet.filter((item) => {
                if (carnetScope === 'global') return true;
                if (carnetScope === 'seccional') {
                  const targetIds =
                    carnetSeccionalIds.length > 0
                      ? carnetSeccionalIds
                      : effectiveSeccionalId
                      ? [Number(effectiveSeccionalId)]
                      : [];
                  if (targetIds.length > 0) {
                    if (item.seccional_id && targetIds.includes(Number(item.seccional_id))) return true;
                    const allowedNames = secList
                      .filter((s) => targetIds.includes(s.id))
                      .map((s) => String(s.nombre || '').toLowerCase());
                    if (
                      item.seccional_nombre &&
                      allowedNames.some((n) => n && item.seccional_nombre.toLowerCase().includes(n))
                    ) {
                      return true;
                    }
                    return false;
                  }
                  if (userSeccionalNombre) {
                    return item.seccional_nombre.toLowerCase().includes(userSeccionalNombre.toLowerCase());
                  }
                  return false;
                }
                const emailMatch =
                  user?.email &&
                  item.solicitado_por_email &&
                  item.solicitado_por_email.toLowerCase() === user.email.toLowerCase();
                const nameMatch =
                  userName &&
                  userName !== 'Usuario' &&
                  item.solicitado_por &&
                  item.solicitado_por.toLowerCase() === userName.toLowerCase();
                const socMatch = socorristaId && item.socorrista_id === socorristaId;
                return Boolean(emailMatch || nameMatch || socMatch);
              });

              return scopedCarnet.filter((item) =>
                isCarnetSolicitudUnread({
                  userId: user.id,
                  readSet,
                  solicitudKey: item.id,
                  estado: item.estado_solicitud,
                  fechaRevision: item.fecha_revision,
                  createdAt: item.fecha_solicitud,
                  canSolveCarnet,
                })
              ).length;
            } catch {
              return 0;
            }
          })(),

          // 4. Soporte activo (consulta ligera sin JSONB de imágenes ni descripción)
          (async () => {
            if (!canViewSoporte) return 0;
            try {
              let q = supabase
                .from('soporte_tickets')
                .select('id, usuario_id, usuario_email, seccional_id, seccional_nombre, estado, created_at')
                .in('estado', ACTIVE_SOPORTE_STATES)
                .order('created_at', { ascending: false })
                .limit(100);

              if (soporteScope === 'usuario' && user.id) {
                q = q.eq('usuario_id', user.id);
              }

              const { data: soporteRows, error: soporteErr } = await q;
              if (soporteErr || !Array.isArray(soporteRows)) return 0;

              const scopedSoporte = soporteRows.filter((row: any) =>
                matchesSoporteTicketScope(row, {
                  scope: soporteScope,
                  usuarioId: user.id,
                  usuarioEmail: user.email || null,
                  allowedSeccionalIds: soporteSeccionalIds,
                  userSeccionalId: effectiveSeccionalId,
                  userSeccionalNombre: userSeccionalNombre || null,
                  seccionalesCatalog: secList,
                })
              );

              return scopedSoporte.filter((t: any) =>
                isSolicitudUnread({
                  userId: user.id,
                  readSet,
                  modulo: 'soporte',
                  solicitudKey: t.id,
                  estado: t.estado,
                  createdAt: t.created_at,
                })
              ).length;
            } catch {
              return 0;
            }
          })(),
        ]);

      setUnreadCombustible(canViewCombustible && canViewCombustibleHistorial ? unreadCombCount : 0);
      setUnreadCompra(canViewCompra && canViewCompraHistorial ? unreadCompCount : 0);
      setUnreadCarnet(carnetUnreadCount);
      setUnreadSoporte(soporteUnreadCount);

      publishModuleUnreadCount('carnet', carnetUnreadCount);
      publishModuleUnreadCount('combustible', canViewCombustible ? unreadCombCount : 0);
      publishModuleUnreadCount('compra', canViewCompra ? unreadCompCount : 0);
      publishModuleUnreadCount('soporte', soporteUnreadCount);

      if (!canViewCompra && !canViewCombustible) {
        setUnreadGeneral(0);
      } else {
        setUnreadGeneral(
          (canViewCombustible ? unreadCombCount : 0) + (canViewCompra ? unreadCompCount : 0)
        );
      }
    } catch {
      // Ignorar errores silenciosos
    } finally {
      unreadInFlightRef.current = false;
    }
  };

  const checkUnreadRef = useRef(checkUnreadSolicitudes);
  checkUnreadRef.current = checkUnreadSolicitudes;

  // Recalcular cuando cambian usuario, permisos o alcances (sin saturar al cambiar de ruta)
  useEffect(() => {
    if (authLoading || !user) {
      setUnreadCombustible(0);
      setUnreadCompra(0);
      setUnreadCarnet(0);
      setUnreadGeneral(0);
      setUnreadSoporte(0);
      return;
    }

    checkUnreadRef.current(true);
  }, [
    authLoading,
    user?.id,
    user?.email,
    userName,
    role,
    socorristaId,
    effectiveSeccionalId,
    userSeccionalNombre,
    canViewCompra,
    canViewCompraHistorial,
    canViewCombustible,
    canViewCombustibleHistorial,
    canViewCarnet,
    canSolveCarnet,
    canViewSoporte,
    scopesDepsKey,
  ]);

  // Escuchar eventos explícitos de cambios (actualización inmediata) y polling moderado cada 60s solo si la pestaña está visible
  useEffect(() => {
    const handleExplicitUpdate = () => checkUnreadRef.current(true);
    const handleThrottledCheck = () => checkUnreadRef.current(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkUnreadRef.current(false);
      }
    };

    window.addEventListener('solicitudes_updated', handleExplicitUpdate);
    window.addEventListener(SOLICITUDES_READ_EVENT, handleExplicitUpdate);
    window.addEventListener('soporte_updated', handleExplicitUpdate);
    window.addEventListener('focus', handleThrottledCheck);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkUnreadRef.current(false);
      }
    }, 60000);

    return () => {
      window.removeEventListener('solicitudes_updated', handleExplicitUpdate);
      window.removeEventListener(SOLICITUDES_READ_EVENT, handleExplicitUpdate);
      window.removeEventListener('soporte_updated', handleExplicitUpdate);
      window.removeEventListener('focus', handleThrottledCheck);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  const totalUnreadSolicitudes = unreadGeneral;

  const navigation: NavItem[] = [
    // Principal
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: permissions.view_dashboard, category: 'principal' },
    { name: 'Mi Perfil', href: `/socorristas/${socorristaId}`, icon: UserIcon, show: !!socorristaId, category: 'principal' },
    { name: 'Noticias', href: '/noticias', icon: Newspaper, show: Boolean(role === 'admin' || permissions.view_noticias_ajustes || permissions.edit_noticias_banner), category: 'principal' },
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
    { name: 'Solicitudes', href: '/solicitudes', icon: ClipboardList, show: Boolean(role === 'admin' || permissions.view_solicitudes_compra || permissions.view_solicitudes_combustible), category: 'gestion', badge: totalUnreadSolicitudes > 0 ? totalUnreadSolicitudes : undefined },
    { name: 'Solicitudes de Carnet', href: '/solicitudes?tab=carnet', icon: IdCard, show: Boolean(role === 'admin' || permissions.view_solicitudes_carnet), category: 'gestion', badge: unreadCarnet > 0 ? unreadCarnet : undefined },
    { name: 'Solicitud Compra', href: '/solicitudes-compra', icon: FileText, show: Boolean(role === 'admin' || permissions.view_solicitudes_compra), category: 'gestion', badge: unreadCompra > 0 ? unreadCompra : undefined },
    { name: 'Combustible', href: '/solicitudes-combustible', icon: Fuel, show: Boolean(role === 'admin' || permissions.view_solicitudes_combustible), category: 'gestion', badge: unreadCombustible > 0 ? unreadCombustible : undefined },
    
    // Identificación
    { name: 'Carnet Oficial', href: '/carnet', icon: IdCard, show: permissions.view_carnet, category: 'identificacion' },
    { name: 'Solicitar Carnet', href: '/solicitud-carnet', icon: FileText, show: permissions.view_solicitar_carnet, category: 'identificacion' },
    { name: 'Verificar Carnet', href: '/verificar', icon: BadgeCheck, show: permissions.view_verificar_carnet, category: 'identificacion' },
    
    // Sistema
    { name: 'Soporte', href: '/soporte', icon: LifeBuoy, show: canViewSoporte, category: 'sistema', badge: unreadSoporte > 0 ? unreadSoporte : undefined },
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
    if (itemHref === '/solicitudes') {
      return location.pathname === '/solicitudes' && !location.search.includes('tab=carnet');
    }
    if (itemHref === '/solicitudes?tab=carnet') {
      return location.pathname === '/solicitudes' && location.search.includes('tab=carnet');
    }
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
              {canViewOnlineUsers ? (
                <button
                  onClick={() => {
                    setShowPresenceModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold cursor-pointer"
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
              ) : (
                <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold select-none">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    <span>{onlineCount} {onlineCount === 1 ? 'persona conectada' : 'personas conectadas'}</span>
                  </div>
                </div>
              )}
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
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 z-40 text-white transition-all duration-300 ease-in-out border-r border-black/20 shadow-xl overflow-visible ${
          isSidebarCollapsed ? 'md:w-20' : 'md:w-64'
        }`}
      >
        {/* Toggle para Colapsar/Expandir (Sobrepuesto completo sin recortes) */}
        <button 
          type="button"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{ backgroundColor: colors.sidebarBg || '#0a2014' }}
          className="absolute -right-3.5 top-7 w-7 h-7 text-emerald-300 hover:text-white rounded-full border border-white/25 shadow-lg ring-2 ring-black/20 flex items-center justify-center transition-all hover:scale-110 z-50 cursor-pointer"
          title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          aria-label={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
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
          {canViewOnlineUsers ? (
            <button
              onClick={() => setShowPresenceModal(true)}
              className={`w-full group flex items-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-300 transition-all cursor-pointer ${
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
                    {onlineCount} en línea
                  </span>
                )}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full group-hover:bg-emerald-500/30 transition-colors">
                  Ver
                </span>
              )}
            </button>
          ) : (
            <div
              className={`w-full flex items-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 select-none ${
                isSidebarCollapsed ? 'p-2 justify-center' : 'px-3 py-2 justify-between'
              }`}
              title={`${onlineCount} personas conectadas`}
            >
              <div className="flex items-center space-x-2">
                <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                {!isSidebarCollapsed && (
                  <span className="text-xs font-semibold tracking-tight text-emerald-200">
                    {onlineCount} en línea
                  </span>
                )}
              </div>
            </div>
          )}
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

          {canViewOnlineUsers ? (
            <button
              onClick={() => setShowPresenceModal(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold cursor-pointer"
              title="Ver personas conectadas"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="tabular-nums">{onlineCount}</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="tabular-nums">{onlineCount}</span>
            </div>
          )}
        </header>
        
        <main className="flex-1 w-full overflow-x-hidden">
          <div
            className={`py-5 sm:py-7 w-full mx-auto ${
              location.pathname === '/socorristas' || location.pathname === '/actividad'
                ? 'max-w-[1920px] px-3 sm:px-5 lg:px-6'
                : 'max-w-7xl px-4 sm:px-6 md:px-8'
            }`}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Modales Compartidos */}
      <MisAccesosModal
        isOpen={showMisAccesosModal}
        onClose={() => setShowMisAccesosModal(false)}
      />

      {canViewOnlineUsers && (
        <PresenceModal
          isOpen={showPresenceModal}
          onClose={() => setShowPresenceModal(false)}
          onlineCount={onlineCount}
          activeUsers={activeUsers}
          onRefresh={refreshPresence}
        />
      )}

      {/* Botón pequeño flotante de Soporte (reporte rápido de anomalías si tiene permiso de crear solicitudes de soporte) */}
      {canViewSoporte && canCreateSoporte && (
        <>
          <button
            type="button"
            onClick={() => setShowSoporteModal(true)}
            title="Reportar anomalía o solicitar soporte"
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900/95 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg border border-white/15 backdrop-blur-xs transition-all hover:scale-105 cursor-pointer"
          >
            <LifeBuoy className="w-4 h-4 text-emerald-400" />
            <span>Soporte</span>
            {unreadSoporte > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white leading-none tabular-nums">
                {unreadSoporte > 99 ? '99+' : unreadSoporte}
              </span>
            )}
          </button>

          <SoporteFormModal
            isOpen={showSoporteModal}
            onClose={() => setShowSoporteModal(false)}
          />
        </>
      )}
    </div>
  );
}
