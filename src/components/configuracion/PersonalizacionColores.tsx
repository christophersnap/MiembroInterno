import React, { useState } from 'react';
import { 
  Palette, Save, RefreshCw, CheckCircle2, RotateCcw, Eye, 
  Sparkles, Layers, Layout, Megaphone, Radio, Volume2, 
  ShieldCheck, ArrowRight, Code, Database, Lock
} from 'lucide-react';
import { useSettings, COLOR_PRESETS, defaultColors, SystemColors } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/logger';

export default function PersonalizacionColores() {
  const { role, permissions } = useAuth();
  const canCustomizeColors = role === 'admin' || Boolean(permissions?.personalizar_colores);
  const { colors, saveColors } = useSettings();
  const [localColors, setLocalColors] = useState<SystemColors>({ ...defaultColors, ...colors });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'todos' | 'principales' | 'menu' | 'dashboard' | 'anuncios' | 'ticker'>('todos');
  const [showSqlModal, setShowSqlModal] = useState(false);

  const handleColorChange = (key: keyof SystemColors, value: string) => {
    setLocalColors(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyPreset = (presetColors: SystemColors, presetName: string) => {
    setLocalColors({ ...presetColors });
    setSuccessMsg(`Paleta "${presetName}" cargada. Presiona "Guardar" para confirmarla en el sistema.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('¿Deseas restablecer todos los colores a los valores oficiales de Cruz Verde Salvadoreña?')) {
      setLocalColors({ ...defaultColors });
      setSuccessMsg('Colores restablecidos a los valores institucionales por defecto.');
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleSave = async () => {
    if (!canCustomizeColors) {
      alert('Acceso denegado: Se requiere permiso de personalización de colores para guardar cambios.');
      return;
    }
    setSaving(true);
    try {
      const ok = await saveColors(localColors);
      if (ok) {
        await logActivity('Actualizó la personalización de colores del sistema', 'Configuración', 'colores');
        setSuccessMsg('¡Colores del sistema guardados exitosamente en la base de datos!');
      } else {
        alert('Ocurrió un error al guardar los colores. Por favor verifica tu conexión.');
      }
    } catch (err: any) {
      console.error('Error saving colors:', err);
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const sqlScript = `-- =========================================================================
-- CONFIGURACIÓN DE COLORES EN SUPABASE / POSTGRESQL (CRUZ VERDE SALVADOREÑA)
-- =========================================================================
-- Se guardan como JSON dentro de la tabla 'public.configuracion' con clave 'colores':

INSERT INTO public.configuracion (clave, valor, descripcion)
VALUES (
  'colores',
  '${JSON.stringify(localColors).replace(/'/g, "''")}',
  'Paleta institucional personalizada'
)
ON CONFLICT (clave) 
DO UPDATE SET 
  valor = EXCLUDED.valor,
  updated_at = timezone('utc'::text, now());`;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ========================================================================= */}
      {/* 1. ENCABEZADO Y ACCIONES PRINCIPALES                                      */}
      {/* ========================================================================= */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Identidad Visual
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-500 font-medium">Personalización Integral</span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Colores del Sistema
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
              Personaliza el menú lateral, dashboard, cuadro de anuncios, línea continua de noticias y botones con persistencia en base de datos.
            </p>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="inline-flex items-center px-3.5 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Ver script SQL de almacenamiento"
          >
            <Database className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
            <span>Script SQL</span>
          </button>

          {canCustomizeColors ? (
            <>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center px-3.5 py-2 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Restablecer a valores de fábrica"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                <span>Restablecer</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-extrabold shadow-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    <span>Guardar Colores</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Solo Lectura</span>
            </span>
          )}
        </div>
      </div>

      {/* Alerta de solo lectura si no tiene permiso */}
      {!canCustomizeColors && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center space-x-2.5 shadow-2xs animate-in fade-in">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Modo de Solo Lectura: La personalización de colores del sistema requiere permiso institucional asignado en Accesos.</span>
        </div>
      )}

      {/* Alerta de éxito */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center space-x-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PALETAS PREDEFINIDAS CON 1 CLIC (PRESETS APPLE & CRUZ VERDE)           */}
      {/* ========================================================================= */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
              Paletas Predefinidas con 1 Clic
            </h3>
          </div>
          <span className="text-2xs text-gray-400 font-medium hidden sm:inline">
            Selecciona un tema para previsualizarlo de inmediato
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.colors, preset.name)}
              className="text-left p-4 rounded-2xl border border-gray-200/90 hover:border-emerald-500/50 hover:bg-emerald-50/20 transition-all shadow-2xs hover:shadow-xs group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {preset.name}
                </span>
                {/* Muestras circulares de los colores */}
                <div className="flex items-center -space-x-1">
                  <span className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs" style={{ backgroundColor: preset.colors.primary }} />
                  <span className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs" style={{ backgroundColor: preset.colors.secondary }} />
                  <span className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs" style={{ backgroundColor: preset.colors.sidebarBg }} />
                </div>
              </div>
              <p className="text-2xs text-gray-500 leading-relaxed">
                {preset.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PREVISUALIZADOR EN VIVO INTERACTIVO (MOCKUP LIVE SANDBOX)              */}
      {/* ========================================================================= */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
              Previsualización en Tiempo Real
            </h3>
          </div>
          <span className="text-2xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Vista Previa Dinámica
          </span>
        </div>

        {/* Lienzo del Mockup */}
        <div 
          style={{ backgroundColor: localColors.dashboardBg || '#f8faf9' }}
          className="rounded-2xl border border-gray-200/90 p-4 sm:p-5 transition-colors duration-200 space-y-4 overflow-hidden"
        >
          {/* Mini Mockup Superior: Menú Izquierdo simulado + Cuadro de Anuncio */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Sidebar simulado */}
            <div 
              style={{ 
                backgroundColor: localColors.sidebarBg || '#0a2014',
                borderColor: localColors.sidebarBorder || 'rgba(0,0,0,0.2)'
              }}
              className="md:col-span-4 rounded-2xl p-3.5 text-white shadow-md border space-y-2.5"
            >
              <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center font-bold text-2xs">
                  CV
                </div>
                <div>
                  <p className="text-xs font-black leading-none">Cruz Verde</p>
                  <p className="text-3xs font-semibold uppercase tracking-wider opacity-75 mt-0.5">Menú Lateral</p>
                </div>
              </div>

              {/* Elemento Activo Simulado */}
              <div 
                style={{ 
                  backgroundColor: localColors.sidebarActiveBg || 'rgba(255,255,255,0.15)',
                  color: '#ffffff'
                }}
                className="rounded-xl px-2.5 py-1.5 flex items-center justify-between text-2xs font-bold shadow-2xs border border-white/10"
              >
                <span className="flex items-center space-x-2">
                  <Layout className="w-3.5 h-3.5" />
                  <span>Dashboard (Activo)</span>
                </span>
                <span 
                  style={{ backgroundColor: localColors.secondary || '#34d399' }}
                  className="w-1.5 h-1.5 rounded-full" 
                />
              </div>

              {/* Elementos Inactivos Simulados */}
              <div 
                style={{ color: localColors.sidebarText || '#d1fae5' }}
                className="space-y-1 text-2xs font-medium px-2.5 opacity-90"
              >
                <div className="flex items-center space-x-2 py-1">
                  <Layers className="w-3.5 h-3.5 opacity-70" />
                  <span>Socorristas</span>
                </div>
                <div className="flex items-center space-x-2 py-1">
                  <Megaphone className="w-3.5 h-3.5 opacity-70" />
                  <span>Anuncios</span>
                </div>
              </div>
            </div>

            {/* Cuadro de Notificación de Anuncio Simulado */}
            <div 
              style={{ 
                backgroundColor: localColors.anuncioBg || '#ffffff',
                borderColor: localColors.anuncioBorder || '#a7f3d0',
                color: localColors.anuncioText || '#111827'
              }}
              className="md:col-span-8 rounded-2xl p-4 border shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                    Aviso Oficial Simulado
                  </span>
                  <span className="text-3xs text-gray-400">Hoy</span>
                </div>
                <h4 className="text-xs font-black">
                  Convocatoria Nacional de Capacitación
                </h4>
                <p className="text-2xs opacity-80 mt-1 leading-relaxed">
                  Este es el cuadro de anuncio superior que aparece en el Dashboard institucional con su borde y fondo configurado.
                </p>
              </div>

              {/* Botón de prueba simulado */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  style={{ backgroundColor: localColors.primary || '#008f39' }}
                  className="px-3 py-1 rounded-xl text-white text-3xs font-bold shadow-2xs"
                >
                  Botón Primario
                </button>
              </div>
            </div>
          </div>

          {/* Línea de Anuncio (Ticker / Slider de Noticias) Simulado */}
          <div 
            style={{ 
              backgroundColor: localColors.tickerBg || '#0a0f0d',
              borderColor: 'rgba(255,255,255,0.1)'
            }}
            className="rounded-2xl p-2.5 text-white border shadow-sm flex items-center space-x-2.5"
          >
            <div 
              style={{ 
                backgroundColor: localColors.tickerBadgeBg || '#059669',
                color: localColors.tickerBadgeText || '#ffffff'
              }}
              className="px-2.5 py-1 rounded-xl text-3xs font-black uppercase tracking-wider flex items-center space-x-1 shrink-0 shadow-2xs"
            >
              <Volume2 className="w-3 h-3 text-amber-300" />
              <span>NOTICIAS CVS:</span>
            </div>
            <div 
              style={{ color: localColors.tickerText || '#f3f4f6' }}
              className="text-2xs font-bold truncate flex-1"
            >
              Operativo Verano 2026 listo con más de 950 socorristas desplegados en todo El Salvador...
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CONTROLES Y SELECTORES DE COLOR ORGANIZADOS                             */}
      {/* ========================================================================= */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-3xl p-6 shadow-xs space-y-6">
        {/* Pestañas de filtrado de secciones */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-gray-100">
          {[
            { id: 'todos', label: 'Todos los Colores' },
            { id: 'principales', label: '1. Principales & Acciones' },
            { id: 'menu', label: '2. Menú de la Izquierda' },
            { id: 'dashboard', label: '3. Dashboard' },
            { id: 'anuncios', label: '4. Cuadro de Anuncio' },
            { id: 'ticker', label: '5. Línea de Noticias' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SECCIÓN 1: COLORES PRINCIPALES */}
        {(activeTab === 'todos' || activeTab === 'principales') && (
          <div className="space-y-3.5">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                1. Colores Principales y Botones
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Color Primario */}
              <ColorPickerCard
                label="Color Primario"
                desc="Botones principales, acentos y encabezados oficiales"
                value={localColors.primary}
                onChange={(val) => handleColorChange('primary', val)}
              />

              {/* Color Hover Primario */}
              <ColorPickerCard
                label="Hover Primario"
                desc="Color al pasar el cursor sobre botones principales"
                value={localColors.primaryHover}
                onChange={(val) => handleColorChange('primaryHover', val)}
              />

              {/* Color Secundario */}
              <ColorPickerCard
                label="Color Secundario"
                desc="Acentos auxiliares, badges y destaques"
                value={localColors.secondary}
                onChange={(val) => handleColorChange('secondary', val)}
              />
            </div>
          </div>
        )}

        {/* SECCIÓN 2: MENÚ DE LA IZQUIERDA (SIDEBAR) */}
        {(activeTab === 'todos' || activeTab === 'menu') && (
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                2. Menú de la Izquierda (Barra Lateral Apple/iOS)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Fondo Menú */}
              <ColorPickerCard
                label="Fondo del Menú"
                desc="Color de fondo de la barra de navegación lateral"
                value={localColors.sidebarBg}
                onChange={(val) => handleColorChange('sidebarBg', val)}
              />

              {/* Texto de Ítems */}
              <ColorPickerCard
                label="Texto e Iconos Inactivos"
                desc="Color de los enlaces del menú sin seleccionar"
                value={localColors.sidebarText}
                onChange={(val) => handleColorChange('sidebarText', val)}
              />

              {/* Fondo Ítem Activo */}
              <ColorPickerCard
                label="Fondo de Selección Activa"
                desc="Color de la píldora al seleccionar una sección"
                value={localColors.sidebarActiveBg}
                onChange={(val) => handleColorChange('sidebarActiveBg', val)}
                isRgba
              />

              {/* Borde del Menú */}
              <ColorPickerCard
                label="Borde Divisor del Menú"
                desc="Línea vertical que separa el menú del contenido"
                value={localColors.sidebarBorder || 'rgba(0, 0, 0, 0.2)'}
                onChange={(val) => handleColorChange('sidebarBorder', val)}
                isRgba
              />
            </div>
          </div>
        )}

        {/* SECCIÓN 3: DASHBOARD Y SISTEMA GENERAL */}
        {(activeTab === 'todos' || activeTab === 'dashboard') && (
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                3. Lo que aparece en Dashboard y Sistema
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Fondo del Dashboard */}
              <ColorPickerCard
                label="Fondo General del Dashboard"
                desc="Color de fondo detrás de todo el contenido del sistema"
                value={localColors.dashboardBg}
                onChange={(val) => handleColorChange('dashboardBg', val)}
              />

              {/* Fondo de Tarjetas */}
              <ColorPickerCard
                label="Fondo de Tarjetas"
                desc="Fondo de los widgets y tarjetas de estadísticas"
                value={localColors.cardBg || '#ffffff'}
                onChange={(val) => handleColorChange('cardBg', val)}
              />

              {/* Borde de Tarjetas */}
              <ColorPickerCard
                label="Borde de Tarjetas"
                desc="Línea perimetral de los módulos y gráficos"
                value={localColors.cardBorder || '#e2e8f0'}
                onChange={(val) => handleColorChange('cardBorder', val)}
              />
            </div>
          </div>
        )}

        {/* SECCIÓN 4: CUADRO DE ANUNCIO */}
        {(activeTab === 'todos' || activeTab === 'anuncios') && (
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                4. Cuadro de Anuncio (Notificación Superior)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Fondo del Cuadro de Anuncio */}
              <ColorPickerCard
                label="Fondo del Cuadro de Anuncio"
                desc="Color de fondo del widget de anuncio superior"
                value={localColors.anuncioBg}
                onChange={(val) => handleColorChange('anuncioBg', val)}
              />

              {/* Borde del Cuadro de Anuncio */}
              <ColorPickerCard
                label="Borde del Cuadro de Anuncio"
                desc="Contorno perimetral del aviso en Dashboard"
                value={localColors.anuncioBorder}
                onChange={(val) => handleColorChange('anuncioBorder', val)}
              />

              {/* Texto del Anuncio */}
              <ColorPickerCard
                label="Color de Texto del Anuncio"
                desc="Tipografía del título y descripción del aviso"
                value={localColors.anuncioText || '#111827'}
                onChange={(val) => handleColorChange('anuncioText', val)}
              />
            </div>
          </div>
        )}

        {/* SECCIÓN 5: LÍNEA DE ANUNCIO (SLIDER / TICKER DE NOTICIAS) */}
        {(activeTab === 'todos' || activeTab === 'ticker') && (
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                5. Línea de Anuncio (Cinta / Ticker de Noticias)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Fondo de la Línea */}
              <ColorPickerCard
                label="Fondo de la Línea de Anuncio"
                desc="Fondo oscuro o translúcido de la cinta de noticias"
                value={localColors.tickerBg}
                onChange={(val) => handleColorChange('tickerBg', val)}
              />

              {/* Texto de la Noticia */}
              <ColorPickerCard
                label="Texto de la Noticia"
                desc="Color del texto rotativo del titular en la cinta"
                value={localColors.tickerText || '#f3f4f6'}
                onChange={(val) => handleColorChange('tickerText', val)}
              />

              {/* Fondo del Badge NOTICIAS CVS */}
              <ColorPickerCard
                label="Fondo del Badge 'NOTICIAS CVS'"
                desc="Color de la píldora que encabeza la cinta"
                value={localColors.tickerBadgeBg}
                onChange={(val) => handleColorChange('tickerBadgeBg', val)}
              />

              {/* Texto del Badge */}
              <ColorPickerCard
                label="Texto del Badge 'NOTICIAS CVS'"
                desc="Color de la letra dentro de la píldora"
                value={localColors.tickerBadgeText || '#ffffff'}
                onChange={(val) => handleColorChange('tickerBadgeText', val)}
              />
            </div>
          </div>
        )}

        {/* Botón inferior de Guardar */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-2xs text-gray-400 font-medium">
            Los cambios se aplicarán instantáneamente y se guardarán en Supabase y SQLite.
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-black active:scale-98 text-white text-xs font-extrabold shadow-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                <span>Guardando configuración...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                <span>Guardar Colores</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SCRIPT SQL DE ALMACENAMIENTO DE COLORES                            */}
      {/* ========================================================================= */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">
                    Almacenamiento SQL de Colores del Sistema
                  </h3>
                  <p className="text-2xs text-gray-500">
                    Tabla <code className="text-emerald-700 font-bold">public.configuracion</code> con clave <code className="text-emerald-700 font-bold">'colores'</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              El sistema guarda la paleta como un objeto JSON estructurado en la base de datos PostgreSQL/Supabase y SQLite. Si necesitas ejecutar o verificar la migración manualmente, puedes usar el siguiente código SQL:
            </p>

            <pre className="p-3.5 bg-gray-950 text-emerald-400 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-60 custom-scrollbar border border-gray-800">
              {sqlScript}
            </pre>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(sqlScript);
                  alert('¡Script SQL copiado al portapapeles!');
                }}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
              >
                Copiar SQL
              </button>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponente individual de selección de color
function ColorPickerCard({
  label,
  desc,
  value,
  onChange,
  isRgba = false
}: {
  label: string;
  desc: string;
  value?: string;
  onChange: (val: string) => void;
  isRgba?: boolean;
}) {
  // Convertir rgba a hex aproximado para el input de color HTML5
  const getHexForPicker = (val?: string) => {
    if (!val) return '#000000';
    if (val.startsWith('#')) return val.slice(0, 7);
    return '#0a2014';
  };

  return (
    <div className="bg-gray-50/80 hover:bg-gray-50 border border-gray-200/90 rounded-2xl p-3.5 transition-all space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-gray-900">{label}</span>
        {/* Muestra visual de color */}
        <div 
          style={{ backgroundColor: value || '#000000' }}
          className="w-5 h-5 rounded-lg border border-black/10 shadow-2xs" 
        />
      </div>

      <p className="text-3xs text-gray-500 leading-tight">
        {desc}
      </p>

      <div className="flex items-center space-x-2 pt-1">
        {/* Selector Nativo */}
        {!isRgba ? (
          <input
            type="color"
            value={getHexForPicker(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded-xl border border-gray-300 p-0 cursor-pointer overflow-hidden shadow-2xs shrink-0"
            title="Abrir selector de color"
          />
        ) : (
          <input
            type="color"
            value={getHexForPicker(value)}
            onChange={(e) => {
              // Convertir hex seleccionado a rgba suave
              const hex = e.target.value;
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              onChange(`rgba(${r}, ${g}, ${b}, 0.20)`);
            }}
            className="w-8 h-8 rounded-xl border border-gray-300 p-0 cursor-pointer overflow-hidden shadow-2xs shrink-0"
            title="Seleccionar tono base"
          />
        )}

        {/* Input Texto Hex/RGBA */}
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#HEX o rgba(...)"
          className="flex-1 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-2xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
        />
      </div>
    </div>
  );
}
