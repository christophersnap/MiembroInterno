import React, { useEffect, useState, useRef } from 'react';
import { 
  Users, UserCheck, UserX, Activity, MapPin, BookOpen, AlertTriangle, 
  Cake, Calendar, Download, FileText, Image as ImageIcon, Megaphone, X, 
  ExternalLink, ChevronLeft, ChevronRight, Volume2, Flame, Info, CheckCircle2, 
  Bell, Sparkles, TrendingUp, ShieldCheck, Zap, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toJpeg } from 'html-to-image';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { usePresence } from '../hooks/usePresence';
import { useSettings } from '../contexts/SettingsContext';
import PresenceModal from '../components/PresenceModal';
import WatermarkImage from '../components/WatermarkImage';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const birthdaysRef = useRef<HTMLDivElement>(null);
  const anniversariesRef = useRef<HTMLDivElement>(null);

  // Sistema de presencia en vivo y concurrencia
  const { onlineCount, activeUsers, refreshPresence } = usePresence();
  const { colors } = useSettings();
  const [showPresenceModal, setShowPresenceModal] = useState(false);

  // Estados para Anuncios Institucionales (Cuadro Notificación y Slider Noticias)
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [dismissedBoxIds, setDismissedBoxIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('cv_dismissed_anuncios') || '[]');
    } catch {
      return [];
    }
  });
  const [boxIndex, setBoxIndex] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [isTickerPaused, setIsTickerPaused] = useState(false);
  const [selectedAnuncioModal, setSelectedAnuncioModal] = useState<any | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [socRes, secRes, curRes, certRes] = await Promise.all([
          supabase.from('socorristas').select('*, seccionales(nombre)'),
          supabase.from('seccionales').select('*').eq('estado', 'Activa'),
          supabase.from('cursos').select('*'),
          supabase.from('socorrista_cursos').select('*')
        ]);

        if (socRes.error) console.error('Error fetching socorristas:', socRes.error);
        if (secRes.error) console.error('Error fetching seccionales:', secRes.error);
        if (curRes.error) console.error('Error fetching cursos:', curRes.error);
        if (certRes.error) console.error('Error fetching certs:', certRes.error);

        const socorristas = socRes.data || [];
        const seccionales = secRes.data || [];
        const cursos = curRes.data || [];
        const certs = certRes.data || [];

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const monthNames = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const currentMonthName = monthNames[now.getMonth()];

        // Calculate KPIs
        const totalSocorristas = socorristas.length;
        const activos = socorristas.filter(s => s.estado === 'Activo').length;
        const inactivos = socorristas.filter(s => s.estado === 'Inactivo').length;
        
        // Detección robusta de género (admite 'Masculino'/'Femenino', 'M'/'F', 'FEMENINA ', 'MASCULINO ', etc.)
        const isHombre = (val?: string) => {
          if (!val) return false;
          const s = val.trim().toLowerCase();
          return s === 'm' || s.startsWith('masc') || s.includes('hombre');
        };
        const isMujer = (val?: string) => {
          if (!val) return false;
          const s = val.trim().toLowerCase();
          return s === 'f' || s.startsWith('fem') || s.includes('mujer');
        };
        const hombres = socorristas.filter(s => isHombre(s.sexo)).length;
        const mujeres = socorristas.filter(s => isMujer(s.sexo)).length;
        const noDefinido = socorristas.filter(s => !isHombre(s.sexo) && !isMujer(s.sexo)).length;

        const seccionalesActivas = seccionales.length;
        const cursosActivos = cursos.length;

        // Certificaciones por vencer (próximos 30 días o vencidas)
        const certsPorVencer = certs.filter(c => {
          if (!c.fecha_vencimiento) return false;
          const venc = new Date(c.fecha_vencimiento);
          const diffDays = Math.ceil((venc.getTime() - now.getTime()) / (1000 * 3600 * 24));
          return diffDays <= 30;
        }).length;

        // Cumpleañeros del mes actual
        const cumpleañeros = socorristas
          .filter(s => {
            if (!s.fecha_nacimiento) return false;
            const nac = new Date(s.fecha_nacimiento + 'T00:00:00');
            return (nac.getMonth() + 1) === currentMonth;
          })
          .map(s => {
            const nac = new Date(s.fecha_nacimiento + 'T00:00:00');
            const edad = currentYear - nac.getFullYear();
            return {
              ...s,
              dia: nac.getDate(),
              edad,
              seccional_nombre: s.seccionales?.nombre || 'Central'
            };
          })
          .sort((a, b) => a.dia - b.dia);

        // Aniversarios institucionales del mes actual
        const aniversarios = socorristas
          .filter(s => {
            if (!s.fecha_ingreso) return false;
            const ing = new Date(s.fecha_ingreso + 'T00:00:00');
            return (ing.getMonth() + 1) === currentMonth;
          })
          .map(s => {
            const ing = new Date(s.fecha_ingreso + 'T00:00:00');
            const años = currentYear - ing.getFullYear();
            return {
              ...s,
              dia: ing.getDate(),
              años,
              seccional_nombre: s.seccionales?.nombre || 'Central'
            };
          })
          .sort((a, b) => a.dia - b.dia);

        // Distribución por Seccional
        const elementosPorSeccionalMap: { [key: string]: number } = {};
        socorristas.forEach(s => {
          const secName = s.seccionales?.nombre || 'Central';
          elementosPorSeccionalMap[secName] = (elementosPorSeccionalMap[secName] || 0) + 1;
        });

        const elementosPorSeccional = Object.entries(elementosPorSeccionalMap).map(([nombre, cantidad]) => ({
          nombre,
          cantidad
        }));

        setStats({
          kpis: {
            totalSocorristas,
            activos,
            inactivos,
            hombres,
            mujeres,
            noDefinido,
            seccionalesActivas,
            cursosActivos,
            certsPorVencer
          },
          charts: {
            elementosPorSeccional
          },
          cumpleañeros,
          aniversarios,
          currentMonthName
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchDashboardAnuncios = async () => {
      try {
        const { data, error } = await supabase
          .from('anuncios')
          .select('*')
          .eq('activo', true)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          setAnuncios(data);
          return;
        }

        const res = await fetch('/api/anuncios');
        if (res.ok) {
          const localData = await res.json();
          if (localData && localData.length > 0) {
            setAnuncios(localData.filter((a: any) => a.activo));
            return;
          }
        }

        const stored = localStorage.getItem('cv_anuncios_local');
        if (stored) {
          setAnuncios(JSON.parse(stored).filter((a: any) => a.activo));
        }
      } catch (e) {
        console.warn('Error fetching dashboard anuncios:', e);
        const stored = localStorage.getItem('cv_anuncios_local');
        if (stored) {
          setAnuncios(JSON.parse(stored).filter((a: any) => a.activo));
        }
      }
    };

    fetchStats();
    fetchDashboardAnuncios();
  }, []);

  // Ticker interval para cambiar titulares automáticamente
  useEffect(() => {
    if (isTickerPaused) return;
    const now = new Date();
    const tickerItems = anuncios.filter(a => a.mostrar_ticker_dashboard && (!a.fecha_expiracion || new Date(a.fecha_expiracion) > now));
    if (tickerItems.length <= 1) return;

    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % tickerItems.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [anuncios, isTickerPaused]);

  const handleDismissBox = (anuncioId: string) => {
    const updated = [...dismissedBoxIds, anuncioId];
    setDismissedBoxIds(updated);
    try {
      localStorage.setItem('cv_dismissed_anuncios', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const [exportingImageKey, setExportingImageKey] = useState<string | null>(null);

  const exportToImage = async (ref: React.RefObject<HTMLDivElement | null>, fileName: string, key?: string) => {
    const node = ref.current;
    if (!node) return;
    
    if (key) setExportingImageKey(key);

    // 1. Detectar todos los contenedores con límite de altura y scroll dentro del cuadro
    const scrollContainers = node.querySelectorAll<HTMLElement>('.overflow-y-auto, [class*="max-h-"], .custom-scrollbar');
    
    // Guardar estilos previos para restaurarlos fielmente luego de la exportación
    const originalStyles = Array.from(scrollContainers).map(el => ({
      el,
      maxHeight: el.style.maxHeight,
      overflow: el.style.overflow,
      overflowY: el.style.overflowY,
      height: el.style.height,
      paddingRight: el.style.paddingRight
    }));

    const origNodeHeight = node.style.height;
    const origNodeMaxHeight = node.style.maxHeight;
    const origNodeOverflow = node.style.overflow;

    try {
      // 2. Extender temporalmente al 100% de la altura para incluir a todas las personas del listado
      scrollContainers.forEach(el => {
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        el.style.setProperty('overflow-y', 'visible', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('padding-right', '0px', 'important');
      });

      node.style.setProperty('height', 'auto', 'important');
      node.style.setProperty('max-height', 'none', 'important');
      node.style.setProperty('overflow', 'visible', 'important');

      // 3. Pequeña espera para reflow del DOM y renderizado de imágenes
      await new Promise(resolve => setTimeout(resolve, 150));

      // 4. Capturar en alta resolución (pixelRatio: 2) excluyendo botones de descarga
      const dataUrl = await toJpeg(node, { 
        quality: 0.95, 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (domNode: HTMLElement) => {
          if (domNode.classList && domNode.classList.contains('no-export-btn')) {
            return false;
          }
          return true;
        }
      });

      // 5. Descargar la imagen completa
      const link = document.createElement('a');
      link.download = `${fileName}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al generar la imagen completa:', err);
      // Intento de respaldo sin filtro
      try {
        const fallbackUrl = await toJpeg(node, { quality: 0.92, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `${fileName}.jpg`;
        link.href = fallbackUrl;
        link.click();
      } catch (fallbackErr) {
        console.error('Error en captura de respaldo:', fallbackErr);
        alert('No se pudo generar la imagen completa del listado. Por favor intenta nuevamente.');
      }
    } finally {
      // 6. Restaurar inmediatamente el scroll original del cuadro
      originalStyles.forEach(({ el, maxHeight, overflow, overflowY, height, paddingRight }) => {
        el.style.maxHeight = maxHeight;
        el.style.overflow = overflow;
        el.style.overflowY = overflowY;
        el.style.height = height;
        el.style.paddingRight = paddingRight;
      });

      node.style.height = origNodeHeight;
      node.style.maxHeight = origNodeMaxHeight;
      node.style.overflow = origNodeOverflow;

      if (key) setExportingImageKey(null);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-600 animate-spin"></div>
      <p className="mt-4 text-xs font-semibold text-gray-500 tracking-wide uppercase">Cargando estadísticas institucionales...</p>
    </div>
  );

  if (!stats) return (
    <div className="p-8 text-center bg-white rounded-3xl border border-red-200 text-red-600 max-w-md mx-auto my-12 shadow-sm">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
      <p className="font-bold">Error al sincronizar estadísticas</p>
      <p className="text-xs text-gray-500 mt-1">Por favor recargue la página o verifique la conexión.</p>
    </div>
  );

  // KPI Cards Estilo iOS Widget
  const kpiWidgets = [
    { 
      name: 'Total Elementos', 
      value: stats.kpis.totalSocorristas, 
      icon: Users, 
      iconBg: 'bg-blue-500/10 text-blue-600 border border-blue-500/15',
      trend: 'Personal registrado',
    },
    { 
      name: 'Elementos Activos', 
      value: stats.kpis.activos, 
      icon: UserCheck, 
      iconBg: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/15',
      trend: 'En servicio activo',
    },
    { 
      name: 'Inactivos / Permiso', 
      value: stats.kpis.inactivos, 
      icon: UserX, 
      iconBg: 'bg-slate-500/10 text-slate-600 border border-slate-500/15',
      trend: 'Bajas temporales',
    },
    { 
      name: 'Seccionales Activas', 
      value: stats.kpis.seccionalesActivas, 
      icon: MapPin, 
      iconBg: 'bg-purple-500/10 text-purple-600 border border-purple-500/15',
      trend: 'Bases en El Salvador',
    },
    { 
      name: 'Cursos Impartidos', 
      value: stats.kpis.cursosActivos, 
      icon: BookOpen, 
      iconBg: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/15',
      trend: 'Capacitaciones vigentes',
    },
    { 
      name: 'Certs. por Vencer', 
      value: stats.kpis.certsPorVencer, 
      icon: AlertTriangle, 
      iconBg: 'bg-amber-500/10 text-amber-600 border border-amber-500/15',
      trend: 'Requieren renovación',
    },
  ];

  const totalGender = (stats?.kpis?.hombres || 0) + (stats?.kpis?.mujeres || 0) + (stats?.kpis?.noDefinido || 0);

  const rawGenderData = [
    { name: 'Hombres', value: stats?.kpis?.hombres || 0, color: '#10b981' },
    { name: 'Mujeres', value: stats?.kpis?.mujeres || 0, color: '#f59e0b' },
    ...(stats?.kpis?.noDefinido > 0 ? [{ name: 'Sin especificar', value: stats.kpis.noDefinido, color: '#6366f1' }] : [])
  ];

  const genderData = totalGender > 0 
    ? rawGenderData.filter(d => d.value > 0)
    : [{ name: 'Sin registros', value: 1, color: '#cbd5e1' }];
  const COLORS = ['#10b981', '#f59e0b', '#6366f1'];

  // Anuncios vigentes
  const now = new Date();
  const validAnuncios = anuncios.filter(a => a.activo && (!a.fecha_expiracion || new Date(a.fecha_expiracion) > now));

  // 1. Cuadro de notificación superior
  const activeBoxAnuncios = validAnuncios.filter(a => 
    a.mostrar_cuadro_dashboard && !dismissedBoxIds.includes(a.id)
  );

  // 2. Línea de texto / Slider de noticias
  const tickerAnuncios = validAnuncios.filter(a => a.mostrar_ticker_dashboard);

  const currentBoxAnuncio = activeBoxAnuncios.length > 0 
    ? activeBoxAnuncios[boxIndex % activeBoxAnuncios.length] 
    : null;

  const currentTickerAnuncio = tickerAnuncios.length > 0 
    ? tickerAnuncios[tickerIndex % tickerAnuncios.length] 
    : null;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* ENCABEZADO ESTILO APPLE LARGE TITLE & SECTOR DE PERSONAS CONECTADAS        */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Cruz Verde Salvadoreña
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-500 font-medium">
              Centro de Operaciones y Estadísticas
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-gray-900">
            Dashboard Institucional
          </h1>
        </div>

        {/* Sector Superior: Personas Conectadas en Vivo (Apple Status Pill) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Píldora de Personas Conectadas en Vivo */}
          <button
            onClick={() => setShowPresenceModal(true)}
            className="group inline-flex items-center space-x-2 px-3.5 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-900 text-xs font-bold transition-all shadow-2xs hover:scale-102 cursor-pointer active:scale-98"
            title="Haz clic para ver concurrencia y detalles de usuarios conectados"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-emerald-950">
              {onlineCount} {onlineCount === 1 ? 'persona conectada' : 'personas conectadas'}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200/60 px-2 py-0.5 rounded-full">
              En vivo
            </span>
          </button>

          {/* Fecha Oficial Estilo iOS */}
          <div className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-white/90 border border-gray-200/80 text-gray-700 text-xs font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="capitalize">{new Date().toLocaleDateString('es-SV', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN: CUADRO DE NOTIFICACIÓN DE ANUNCIO (ESTILO WIDGET IOS CON X)   */}
      {/* ========================================================================= */}
      {currentBoxAnuncio && (
        <div 
          style={{
            backgroundColor: (currentBoxAnuncio.tipo === 'urgente' || currentBoxAnuncio.tipo === 'alerta') ? undefined : colors.anuncioBg || undefined,
            borderColor: (currentBoxAnuncio.tipo === 'urgente' || currentBoxAnuncio.tipo === 'alerta') ? undefined : colors.anuncioBorder || undefined,
            color: colors.anuncioText || undefined
          }}
          className={`relative rounded-3xl border p-5 sm:p-7 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 backdrop-blur-md ${
          currentBoxAnuncio.tipo === 'urgente' 
            ? 'bg-gradient-to-br from-red-50/90 via-rose-50/80 to-white border-red-200/80 text-red-950'
            : currentBoxAnuncio.tipo === 'alerta'
              ? 'bg-gradient-to-br from-amber-50/90 via-yellow-50/80 to-white border-amber-200/80 text-amber-950'
              : currentBoxAnuncio.tipo === 'exito'
                ? 'bg-gradient-to-br from-emerald-50/90 via-teal-50/80 to-white border-emerald-200/80 text-emerald-950'
                : currentBoxAnuncio.tipo === 'evento'
                  ? 'bg-gradient-to-br from-purple-50/90 via-fuchsia-50/80 to-white border-purple-200/80 text-purple-950'
                  : 'bg-gradient-to-br from-emerald-50/60 via-white to-gray-50/60 border-emerald-200/70 text-gray-900'
        }`}>
          {/* Botón de Cierre (X) */}
          <button
            onClick={() => handleDismissBox(currentBoxAnuncio.id)}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-all focus:outline-none cursor-pointer"
            title="Cerrar notificación (no volver a mostrar en esta sesión)"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start space-x-4 pr-8 sm:pr-10">
            {/* Icono temático */}
            <div className={`p-3 sm:p-3.5 rounded-2xl flex-shrink-0 shadow-xs ${
              currentBoxAnuncio.tipo === 'urgente'
                ? 'bg-red-600 text-white'
                : currentBoxAnuncio.tipo === 'alerta'
                  ? 'bg-amber-600 text-white'
                  : currentBoxAnuncio.tipo === 'exito'
                    ? 'bg-emerald-600 text-white'
                    : currentBoxAnuncio.tipo === 'evento'
                      ? 'bg-purple-600 text-white'
                      : 'bg-emerald-700 text-white'
            }`}>
              {currentBoxAnuncio.tipo === 'urgente' ? (
                <Flame className="w-6 h-6 animate-pulse" />
              ) : currentBoxAnuncio.tipo === 'alerta' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : currentBoxAnuncio.tipo === 'exito' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : currentBoxAnuncio.tipo === 'evento' ? (
                <Calendar className="w-6 h-6" />
              ) : (
                <Megaphone className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Badges de cabecera y paginación si hay múltiples anuncios */}
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  currentBoxAnuncio.tipo === 'urgente'
                    ? 'bg-red-200/80 text-red-900 border border-red-300/60'
                    : currentBoxAnuncio.tipo === 'alerta'
                      ? 'bg-amber-200/80 text-amber-900 border border-amber-300/60'
                      : currentBoxAnuncio.tipo === 'exito'
                        ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300/60'
                        : currentBoxAnuncio.tipo === 'evento'
                          ? 'bg-purple-200/80 text-purple-900 border border-purple-300/60'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}>
                  {currentBoxAnuncio.tipo === 'urgente' ? 'Aviso Urgente' : currentBoxAnuncio.tipo === 'alerta' ? 'Alerta Operativa' : currentBoxAnuncio.tipo === 'exito' ? 'Logro Institucional' : currentBoxAnuncio.tipo === 'evento' ? 'Convocatoria' : 'Aviso Oficial'}
                </span>

                <span className="text-2xs text-gray-500 font-medium flex items-center">
                  <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                  {new Date(currentBoxAnuncio.created_at || Date.now()).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>

                {activeBoxAnuncios.length > 1 && (
                  <div className="flex items-center space-x-1 ml-auto text-2xs font-bold text-gray-600 bg-white/80 px-2.5 py-0.5 rounded-full border border-gray-200/80 shadow-2xs">
                    <span>{boxIndex % activeBoxAnuncios.length + 1} de {activeBoxAnuncios.length}</span>
                    <button 
                      onClick={() => setBoxIndex(prev => (prev - 1 + activeBoxAnuncios.length) % activeBoxAnuncios.length)}
                      className="p-0.5 hover:text-emerald-700 transition-colors"
                      title="Anterior anuncio"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setBoxIndex(prev => (prev + 1) % activeBoxAnuncios.length)}
                      className="p-0.5 hover:text-emerald-700 transition-colors"
                      title="Siguiente anuncio"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Título y Contenido */}
              <h3 className="text-base sm:text-lg font-black text-gray-900 leading-snug">
                {currentBoxAnuncio.titulo}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {currentBoxAnuncio.contenido}
              </p>

              {/* Imagen destacada si existe en el anuncio */}
              {currentBoxAnuncio.imagen_url && (
                <div className="mt-3.5 rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs max-h-72 bg-white/60">
                  <img 
                    src={currentBoxAnuncio.imagen_url} 
                    alt={currentBoxAnuncio.titulo}
                    className="w-full h-auto max-h-64 object-cover object-center cursor-pointer hover:scale-[1.01] transition-transform duration-200"
                    onClick={() => setSelectedAnuncioModal(currentBoxAnuncio)}
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Acciones: Archivo descargable y Enlace de redirección */}
              {(currentBoxAnuncio.archivo_url || currentBoxAnuncio.enlace_url) && (
                <div className="mt-4 pt-3.5 border-t border-gray-200/60 flex flex-wrap items-center gap-2.5">
                  {currentBoxAnuncio.archivo_url && (
                    <a
                      href={currentBoxAnuncio.archivo_url}
                      download={currentBoxAnuncio.archivo_nombre || 'documento'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                      <span>Descargar: {currentBoxAnuncio.archivo_nombre || 'Archivo Adjunto'}</span>
                      {currentBoxAnuncio.archivo_tamano && (
                        <span className="ml-1 text-2xs text-emerald-700 font-normal">({currentBoxAnuncio.archivo_tamano})</span>
                      )}
                    </a>
                  )}

                  {currentBoxAnuncio.enlace_url && (
                    <a
                      href={currentBoxAnuncio.enlace_url}
                      target={currentBoxAnuncio.enlace_url.startsWith('http') ? '_blank' : '_self'}
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-950 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition-colors shadow-2xs"
                    >
                      <span>{currentBoxAnuncio.enlace_texto || 'Más información'}</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-blue-700" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECCIÓN: SLIDER DE NOTICIAS (ESTILO APPLE NEWS TICKER)                 */}
      {/* ========================================================================= */}
      {tickerAnuncios.length > 0 && currentTickerAnuncio && (
        <div 
          onMouseEnter={() => setIsTickerPaused(true)}
          onMouseLeave={() => setIsTickerPaused(false)}
          style={{
            backgroundColor: colors.tickerBg || '#0a0f0d',
            borderColor: 'rgba(255, 255, 255, 0.1)'
          }}
          className="text-white rounded-2xl shadow-sm border p-2.5 sm:p-3 flex items-center justify-between gap-3 overflow-hidden transition-all backdrop-blur-md"
        >
          {/* Badge Fijo */}
          <div 
            style={{
              backgroundColor: colors.tickerBadgeBg || '#059669',
              color: colors.tickerBadgeText || '#ffffff'
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex-shrink-0 shadow-xs"
          >
            <Volume2 className="w-3.5 h-3.5 animate-pulse text-amber-300" />
            <span>NOTICIAS CVS:</span>
          </div>

          {/* Titular interactivo */}
          <div 
            onClick={() => setSelectedAnuncioModal(currentTickerAnuncio)}
            className="flex-1 min-w-0 cursor-pointer group flex items-center space-x-2 overflow-hidden py-0.5"
            title="Clic para leer anuncio completo y descargar archivos"
          >
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase flex-shrink-0 ${
              currentTickerAnuncio.tipo === 'urgente'
                ? 'bg-red-600 text-white'
                : currentTickerAnuncio.tipo === 'alerta'
                  ? 'bg-amber-600 text-white'
                  : currentTickerAnuncio.tipo === 'exito'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white'
            }`}>
              {currentTickerAnuncio.tipo}
            </span>
            <span 
              style={{ color: colors.tickerText || '#f3f4f6' }}
              className="font-bold text-xs sm:text-sm group-hover:underline truncate transition-colors"
            >
              {currentTickerAnuncio.titulo}
            </span>
            <span className="text-gray-400 text-xs truncate hidden md:inline">
              — {currentTickerAnuncio.contenido.slice(0, 95)}...
            </span>
            {currentTickerAnuncio.archivo_url && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 flex-shrink-0">
                <Download className="w-2.5 h-2.5 mr-1" />
                Adjunto
              </span>
            )}
          </div>

          {/* Controles de Navegación del Slider */}
          <div className="flex items-center space-x-1.5 flex-shrink-0 pl-2 border-l border-gray-800 text-xs text-gray-400">
            <span className="text-[11px] font-mono font-medium hidden sm:inline">
              {(tickerIndex % tickerAnuncios.length) + 1}/{tickerAnuncios.length}
            </span>
            <button
              onClick={() => setTickerIndex(prev => (prev - 1 + tickerAnuncios.length) % tickerAnuncios.length)}
              className="p-1 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              title="Noticia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTickerIndex(prev => (prev + 1) % tickerAnuncios.length)}
              className="p-1 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              title="Siguiente noticia"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECCIÓN: TARJETAS KPI (ESTILO WIDGETS APPLE / IOS HEALTH & FITNESS)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        {kpiWidgets.map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.name} 
              className="bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {item.name}
                </span>
                <div className={`p-2.5 rounded-2xl flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200 ${item.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3.5 sm:mt-4">
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
                  {item.value}
                </div>
                <div className="mt-1 flex items-center space-x-1.5 text-xs text-gray-500 font-medium">
                  <span>{item.trend}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 4. SECCIÓN: GRÁFICAS ESTILO APPLE INSET GROUPED                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Elementos por Seccional */}
        <div className="bg-white/95 backdrop-blur-md shadow-xs border border-gray-200/80 rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">Elementos por Seccional</h3>
              <p className="text-xs text-gray-500 font-medium">Distribución geográfica del personal</p>
            </div>
            <span className="text-2xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Personal Activo
            </span>
          </div>
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.charts.elementosPorSeccional} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="nombre" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={{ stroke: '#e2e8f0' }} 
                  tickLine={false} 
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0a2014', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                  }} 
                  cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }}
                />
                <Bar 
                  dataKey="cantidad" 
                  fill="#10b981" 
                  name="Elementos" 
                  radius={[8, 8, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribución por Género (Donut Chart Apple) */}
        <div 
          style={{
            backgroundColor: colors.cardBg || undefined,
            borderColor: colors.cardBorder || undefined
          }}
          className="bg-white/95 backdrop-blur-md shadow-xs border border-gray-200/80 rounded-3xl p-6 sm:p-7 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">Distribución por Género</h3>
              <p className="text-xs text-gray-500 font-medium">Equidad e integración en la institución</p>
            </div>
            <div className="flex items-center space-x-2 text-2xs font-bold">
              <span className="flex items-center text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span> Hombres
              </span>
              <span className="flex items-center text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span> Mujeres
              </span>
            </div>
          </div>

          {/* Gráfico Donut con Centro Informativo */}
          <div className="relative w-full h-60 min-h-[240px] flex items-center justify-center my-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={220} minHeight={240}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  animationDuration={800}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any, name: any) => [
                    `${val} socorristas (${((Number(val) / (totalGender || 1)) * 100).toFixed(1)}%)`,
                    name
                  ]}
                  contentStyle={{ 
                    backgroundColor: '#0a2014', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255,255,255,0.15)', 
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total Central estilo Apple Activity Rings */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Personal</span>
              <span className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none mt-0.5">
                {totalGender}
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-1">
                Socorristas
              </span>
            </div>
          </div>

          {/* Métricas Detalladas y Barras de Progreso Estilo iOS */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-gray-100">
            {/* Hombres */}
            <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-2xl p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-950 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                  Hombres
                </span>
                <span className="font-black text-emerald-900">
                  {stats.kpis.hombres || 0}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-emerald-800">
                <span className="font-medium">Proporción</span>
                <span className="font-bold">
                  {totalGender > 0 ? ((stats.kpis.hombres / totalGender) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-emerald-200/50 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalGender > 0 ? (stats.kpis.hombres / totalGender) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Mujeres */}
            <div className="bg-amber-50/60 border border-amber-100/80 rounded-2xl p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-950 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
                  Mujeres
                </span>
                <span className="font-black text-amber-900">
                  {stats.kpis.mujeres || 0}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-amber-800">
                <span className="font-medium">Proporción</span>
                <span className="font-bold">
                  {totalGender > 0 ? ((stats.kpis.mujeres / totalGender) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-amber-200/50 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalGender > 0 ? (stats.kpis.mujeres / totalGender) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SECCIÓN: PANELES CUMPLEAÑEROS Y ANIVERSARIOS (ESTILO APPLE REMINDERS)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Cumpleañeros del Mes */}
        <div ref={birthdaysRef} className="bg-white/95 backdrop-blur-md shadow-xs border border-gray-200/80 rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-600 flex items-center justify-center shadow-2xs">
                <Cake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  Cumpleañeros de {stats.currentMonthName}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {stats.cumpleañeros.length} {stats.cumpleañeros.length === 1 ? 'cumpleañero este mes' : 'cumpleañeros este mes'}
                </p>
              </div>
            </div>

            {/* Botones de Exportación Apple Pill */}
            <div className="flex items-center space-x-1.5 no-export-btn">
              <button 
                onClick={() => exportToExcel(stats.cumpleañeros.map((s: any) => ({
                  Nombre: `${s.primer_nombre} ${s.primer_apellido}`,
                  Seccional: s.seccional_nombre,
                  Día: s.dia,
                  'Edad que cumple': s.edad
                })), `cumpleaneros_${stats.currentMonthName}`)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer shadow-2xs"
                title="Descargar lista en Excel"
              >
                <FileText className="w-4 h-4 text-emerald-700" />
              </button>
              <button 
                disabled={exportingImageKey === 'cumple'}
                onClick={() => exportToImage(birthdaysRef, `cumpleaneros_${stats.currentMonthName}`, 'cumple')}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                title={exportingImageKey === 'cumple' ? 'Generando imagen del listado completo...' : 'Descargar listado completo en imagen'}
              >
                {exportingImageKey === 'cumple' ? (
                  <RefreshCw className="w-4 h-4 text-pink-600 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-blue-700" />
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-80 pr-1 divide-y divide-gray-100 custom-scrollbar">
            {stats.cumpleañeros.length > 0 ? (
              stats.cumpleañeros.map((person: any) => (
                <div key={person.id} className="py-3 flex items-center space-x-3.5 hover:bg-gray-50/80 px-2 rounded-2xl transition-colors">
                  <div className="flex-shrink-0">
                    {person.foto_url ? (
                      <WatermarkImage src={person.foto_url} alt="" className="h-10 w-10 border border-gray-200" isRounded={true} />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-pink-100/80 text-pink-700 font-bold flex items-center justify-center text-xs shadow-2xs border border-pink-200">
                        {person.primer_nombre[0]}{person.primer_apellido[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {person.primer_nombre} {person.primer_apellido}
                    </p>
                    <p className="text-2xs sm:text-xs text-gray-500 truncate">{person.seccional_nombre}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-pink-700 bg-pink-50 border border-pink-200">
                      Día {person.dia}
                    </span>
                    <p className="text-2xs text-gray-400 mt-0.5">{person.edad} años</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-gray-400 font-medium">
                No hay cumpleañeros registrados en este mes.
              </div>
            )}
          </div>
        </div>

        {/* Aniversarios Institucionales */}
        <div ref={anniversariesRef} className="bg-white/95 backdrop-blur-md shadow-xs border border-gray-200/80 rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center shadow-2xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  Aniversarios de {stats.currentMonthName}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {stats.aniversarios.length} {stats.aniversarios.length === 1 ? 'aniversario institucional' : 'aniversarios institucionales'}
                </p>
              </div>
            </div>

            {/* Botones de Exportación Apple Pill */}
            <div className="flex items-center space-x-1.5 no-export-btn">
              <button 
                onClick={() => exportToExcel(stats.aniversarios.map((s: any) => ({
                  Nombre: `${s.primer_nombre} ${s.primer_apellido}`,
                  Seccional: s.seccional_nombre,
                  Día: s.dia,
                  'Años en la institución': s.años
                })), `aniversarios_${stats.currentMonthName}`)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer shadow-2xs"
                title="Descargar lista en Excel"
              >
                <FileText className="w-4 h-4 text-emerald-700" />
              </button>
              <button 
                disabled={exportingImageKey === 'aniversario'}
                onClick={() => exportToImage(anniversariesRef, `aniversarios_${stats.currentMonthName}`, 'aniversario')}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                title={exportingImageKey === 'aniversario' ? 'Generando imagen del listado completo...' : 'Descargar listado completo en imagen'}
              >
                {exportingImageKey === 'aniversario' ? (
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-blue-700" />
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-80 pr-1 divide-y divide-gray-100 custom-scrollbar">
            {stats.aniversarios.length > 0 ? (
              stats.aniversarios.map((person: any) => (
                <div key={person.id} className="py-3 flex items-center space-x-3.5 hover:bg-gray-50/80 px-2 rounded-2xl transition-colors">
                  <div className="flex-shrink-0">
                    {person.foto_url ? (
                      <WatermarkImage src={person.foto_url} alt="" className="h-10 w-10 border border-gray-200" isRounded={true} />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-blue-100/80 text-blue-700 font-bold flex items-center justify-center text-xs shadow-2xs border border-blue-200">
                        {person.primer_nombre[0]}{person.primer_apellido[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {person.primer_nombre} {person.primer_apellido}
                    </p>
                    <p className="text-2xs sm:text-xs text-gray-500 truncate">{person.seccional_nombre}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200">
                      Día {person.dia}
                    </span>
                    <p className="text-2xs text-gray-400 mt-0.5">{person.años} {person.años === 1 ? 'año' : 'años'} de servicio</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-gray-400 font-medium">
                No hay aniversarios registrados en este mes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DETALLES DEL ANUNCIO (ESTILO APPLE)                                 */}
      {/* ========================================================================= */}
      {selectedAnuncioModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl text-white shadow-xs ${
                  selectedAnuncioModal.tipo === 'urgente' ? 'bg-red-600' :
                  selectedAnuncioModal.tipo === 'alerta' ? 'bg-amber-600' :
                  selectedAnuncioModal.tipo === 'exito' ? 'bg-emerald-600' : 'bg-primary'
                }`}>
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                    Comunicado Oficial
                  </span>
                  <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                    {selectedAnuncioModal.titulo}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnuncioModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Imagen destacada en modal si existe */}
              {selectedAnuncioModal.imagen_url && (
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 shadow-xs max-h-80">
                  <img 
                    src={selectedAnuncioModal.imagen_url} 
                    alt={selectedAnuncioModal.titulo}
                    className="w-full h-auto max-h-72 object-cover object-center"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}

              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {selectedAnuncioModal.contenido}
              </p>

              {/* Archivo adjunto */}
              {selectedAnuncioModal.archivo_url && (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 truncate">
                    <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {selectedAnuncioModal.archivo_nombre || 'Documento Adjunto'}
                      </p>
                      {selectedAnuncioModal.archivo_tamano && (
                        <p className="text-2xs text-gray-500">{selectedAnuncioModal.archivo_tamano}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={selectedAnuncioModal.archivo_url}
                    download={selectedAnuncioModal.archivo_nombre || 'documento'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-2xs transition-colors flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Descargar
                  </a>
                </div>
              )}

              {/* Enlace redirección */}
              {selectedAnuncioModal.enlace_url && (
                <div className="pt-2">
                  <a
                    href={selectedAnuncioModal.enlace_url}
                    target={selectedAnuncioModal.enlace_url.startsWith('http') ? '_blank' : '_self'}
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors"
                  >
                    <span>{selectedAnuncioModal.enlace_texto || 'Ir al enlace relacionado'}</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-400">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                  Publicado: {new Date(selectedAnuncioModal.created_at || Date.now()).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span className="font-semibold text-primary">Cruz Verde Salvadoreña</span>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 text-right">
              <button
                onClick={() => setSelectedAnuncioModal(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Concurrencia y Presencia */}
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
