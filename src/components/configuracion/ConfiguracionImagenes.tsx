import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  HardDrive,
  Image as ImageIcon,
  Save,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Layers,
  FolderOpen,
  ExternalLink,
  Upload,
  Copy,
  Check,
  Search,
  Sliders,
  Database,
  TrendingDown,
  FileCheck2,
  AlertCircle,
} from 'lucide-react';
import { logActivity } from '../../lib/logger';
import { formatFechaSV } from '../../utils/dateUtils';
import {
  DEFAULT_IMAGE_OPT_CONFIG,
  ImageOptimizationConfig,
  ImageOptimizationPreset,
  ImageOptimizationProfile,
  OptimizeImageResult,
  PRESET_DEFINITIONS,
  SQL_MIGRATION_47_TEXT,
  StorageImagesAnalytics,
  fetchImageOptimizationConfig,
  fetchStorageImagesAnalytics,
  formatStorageBytes,
  optimizeImageDetailed,
  saveImageOptimizationConfig,
} from '../../utils/imageOptimizer';

interface ConfiguracionImagenesProps {
  onSaved?: (msg: string) => void;
}

const FOLDER_LABELS: Record<string, string> = {
  carnets_y_perfiles: 'Carnets y Fotos de Perfil',
  logos: 'Logotipos Institucionales',
  noticias: 'Noticias y Banners Countdown',
  anuncios: 'Anuncios Institucionales',
  vehiculos: 'Flota Vehicular',
  documentos: 'Expedientes de Socorristas',
  archivos: 'Repositorio de Archivos',
  combustible: 'Plantillas Combustible',
  soporte: 'Capturas de Soporte',
  templates: 'Plantillas de Carnet',
  fonts: 'Tipografías',
};

export default function ConfiguracionImagenes({ onSaved }: ConfiguracionImagenesProps) {
  const [optConfig, setOptConfig] = useState<ImageOptimizationConfig>(DEFAULT_IMAGE_OPT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<StorageImagesAnalytics | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeImageTab, setActiveImageTab] = useState<'recent' | 'largest'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedDims, setShowAdvancedDims] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Live tester state (does NOT upload anything to Supabase)
  const testInputRef = useRef<HTMLInputElement>(null);
  const [testProfile, setTestProfile] = useState<ImageOptimizationProfile>('carnet');
  const [testingImage, setTestingImage] = useState(false);
  const [testResult, setTestResult] = useState<{
    details: OptimizeImageResult;
    originalPreviewUrl: string;
    optimizedPreviewUrl: string;
  } | null>(null);

  const loadAll = async (forceRefresh = false) => {
    setLoadingConfig(true);
    setLoadingStats(true);
    setErrorBanner(null);
    try {
      const [cfg, stats] = await Promise.all([
        fetchImageOptimizationConfig(forceRefresh),
        fetchStorageImagesAnalytics(),
      ]);
      setOptConfig(cfg);
      setAnalytics(stats);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Error cargando datos de imágenes y almacenamiento.');
    } finally {
      setLoadingConfig(false);
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    void loadAll(true);
    return () => {
      if (testResult) {
        URL.revokeObjectURL(testResult.originalPreviewUrl);
        URL.revokeObjectURL(testResult.optimizedPreviewUrl);
      }
    };
  }, []);

  const handleSelectPreset = (preset: ImageOptimizationPreset) => {
    const def = PRESET_DEFINITIONS[preset];
    setOptConfig((prev) => ({
      ...prev,
      preset,
      carnetQuality: def.carnetQuality,
      templateQuality: def.templateQuality,
      bannerQuality: def.bannerQuality,
      generalQuality: def.generalQuality,
      logoQuality: def.logoQuality,
    }));
  };

  const handleToggleEnabled = async (nextEnabled: boolean) => {
    const updated = { ...optConfig, enabled: nextEnabled };
    setOptConfig(updated);
    setSaving(true);
    setErrorBanner(null);
    try {
      await saveImageOptimizationConfig(updated);
      await logActivity(
        nextEnabled
          ? 'Activó la optimización automática de imágenes sin pérdida visual'
          : 'Desactivó la optimización automática de imágenes',
        'Configuración',
        'imagenes'
      );
      const msg = nextEnabled
        ? 'Optimización automática de imágenes ACTIVADA.'
        : 'Optimización automática de imágenes DESACTIVADA (se subirán originales).';
      setLocalSuccess(msg);
      onSaved?.(msg);
      setTimeout(() => setLocalSuccess(null), 3500);
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo guardar el estado del optimizador.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setErrorBanner(null);
    try {
      const saved = await saveImageOptimizationConfig(optConfig);
      setOptConfig(saved);
      await logActivity(
        `Actualizó parámetros de optimización de imágenes (modo: ${saved.preset}, WebP: ${saved.preferWebp})`,
        'Configuración',
        'imagenes'
      );
      const msg = 'Parámetros de optimización de imágenes guardados exitosamente.';
      setLocalSuccess(msg);
      onSaved?.(msg);
      setTimeout(() => setLocalSuccess(null), 3500);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Error al guardar la configuración de imágenes.');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshStats = async () => {
    setLoadingStats(true);
    try {
      const stats = await fetchStorageImagesAnalytics();
      setAnalytics(stats);
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudieron actualizar las estadísticas.');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleCopySql47 = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_47_TEXT);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const handleRunLiveTest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTestingImage(true);
    try {
      if (testResult) {
        URL.revokeObjectURL(testResult.originalPreviewUrl);
        URL.revokeObjectURL(testResult.optimizedPreviewUrl);
      }

      const result = await optimizeImageDetailed(file, {
        profile: testProfile,
        recordTelemetry: false,
        overrideConfig: optConfig,
        forceRunWhenDisabled: true,
      });

      const originalPreviewUrl = URL.createObjectURL(file);
      const optimizedPreviewUrl = URL.createObjectURL(result.file);

      setTestResult({
        details: result,
        originalPreviewUrl,
        optimizedPreviewUrl,
      });
    } catch (err: any) {
      setErrorBanner(err?.message || 'Error al procesar imagen de prueba.');
    } finally {
      setTestingImage(false);
      if (testInputRef.current) testInputRef.current.value = '';
    }
  };

  const quotaBytes = (optConfig.storageQuotaMb || 1024) * 1024 * 1024;
  const totalImageBytes = analytics?.total_image_bytes || 0;
  const otherBytes = analytics?.other_files_bytes || 0;
  const totalStorageBytes = totalImageBytes + otherBytes;
  const quotaPercent = Math.min(100, quotaBytes > 0 ? (totalStorageBytes / quotaBytes) * 100 : 0);
  const imageSharePercent =
    totalStorageBytes > 0 ? Math.round((totalImageBytes / totalStorageBytes) * 100) : 0;

  const optLog = analytics?.optimization_log || {
    total_processed: 0,
    optimized_count: 0,
    total_original_bytes: 0,
    total_final_bytes: 0,
    total_saved_bytes: 0,
  };

  const avgReductionPct =
    optLog.total_original_bytes > 0
      ? ((optLog.total_saved_bytes / optLog.total_original_bytes) * 100).toFixed(1)
      : '0.0';

  const displayedImages = useMemo(() => {
    if (!analytics) return [];
    const baseList = activeImageTab === 'recent' ? analytics.recent_images : analytics.largest_images;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.bucket_id.toLowerCase().includes(q) ||
        item.format.toLowerCase().includes(q) ||
        (FOLDER_LABELS[item.folder] || item.folder).toLowerCase().includes(q)
    );
  }, [analytics, activeImageTab, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {errorBanner && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {localSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{localSuccess}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. CONTROL PRINCIPAL: ACTIVAR / DESACTIVAR Y AJUSTES SIN PÉRDIDA       */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                optConfig.enabled
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900">
                  Optimización Automática de Imágenes hacia Supabase
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md text-3xs font-bold uppercase tracking-wider border ${
                    optConfig.enabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {optConfig.enabled ? 'Activa · Sin Pérdida Visual' : 'Desactivada'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Optimiza automáticamente fotografías de carnets, socorristas, noticias, conteos, anuncios, vehículos, documentos y logotipos antes de guardarlos en Supabase Storage.
              </p>
            </div>
          </div>

          {/* Switch Maestro */}
          <div className="flex items-center gap-3 self-end sm:self-center bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
            <span className="text-xs font-bold text-gray-800">
              {optConfig.enabled ? 'Activado' : 'Desactivado'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={optConfig.enabled}
                disabled={loadingConfig || saving}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Selección de Nivel de Fidelidad + Opciones */}
        <div className={`p-5 space-y-5 transition-opacity ${optConfig.enabled ? '' : 'opacity-60'}`}>
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Nivel de Fidelidad Visual
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(Object.keys(PRESET_DEFINITIONS) as ImageOptimizationPreset[]).map((key) => {
                const item = PRESET_DEFINITIONS[key];
                const selected = optConfig.preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPreset(key)}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selected
                        ? 'bg-emerald-50/60 border-emerald-400 ring-2 ring-emerald-500/15'
                        : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-900">{item.label}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                    <p className="text-3xs text-gray-500 leading-relaxed">{item.shortDesc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opciones Técnicas Clave */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={optConfig.preferWebp}
                onChange={(e) => setOptConfig({ ...optConfig, preferWebp: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-bold text-gray-900 block">
                  Conversión inteligente a WebP
                </span>
                <span className="text-3xs text-gray-500 leading-tight block mt-0.5">
                  Conserva fondo transparente y nitidez reduciendo hasta 80% el peso. Los logos de correo mantienen PNG/JPG por compatibilidad con Outlook.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={optConfig.stripMetadata}
                onChange={(e) => setOptConfig({ ...optConfig, stripMetadata: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-bold text-gray-900 block">
                  Limpiar metadatos ocultos (EXIF/GPS)
                </span>
                <span className="text-3xs text-gray-500 leading-tight block mt-0.5">
                  Elimina datos innecesarios de cámara y ubicación GPS respetando la orientación original de fotos móviles.
                </span>
              </div>
            </label>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <label className="text-xs font-bold text-gray-900 block mb-1">
                Cuota de Referencia en Supabase Storage
              </label>
              <select
                value={optConfig.storageQuotaMb}
                onChange={(e) =>
                  setOptConfig({ ...optConfig, storageQuotaMb: Number(e.target.value) || 1024 })
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-emerald-500"
              >
                <option value={1024}>1 GB (Plan Free Supabase)</option>
                <option value={8192}>8 GB (Ampliado)</option>
                <option value={102400}>100 GB (Plan Pro Supabase)</option>
              </select>
              <span className="text-3xs text-gray-400 block mt-1">
                Usado para calcular el porcentaje de ocupación visual abajo.
              </span>
            </div>
          </div>

          {/* Parámetros Avanzados por Módulo */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvancedDims(!showAdvancedDims)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {showAdvancedDims
                  ? 'Ocultar resoluciones máximas por módulo'
                  : 'Ver / personalizar resoluciones máximas por módulo (300 DPI Carnets, Banners, etc.)'}
              </span>
            </button>

            {showAdvancedDims && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-3xs font-bold uppercase text-slate-500 mb-1">
                    Fotos Carnet (px máx)
                  </label>
                  <input
                    type="number"
                    min={800}
                    max={4000}
                    step={100}
                    value={optConfig.carnetMaxDim}
                    onChange={(e) =>
                      setOptConfig({ ...optConfig, carnetMaxDim: Number(e.target.value) || 1600 })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900"
                  />
                  <span className="text-3xs text-gray-400">Calidad: {Math.round(optConfig.carnetQuality * 100)}%</span>
                </div>

                <div>
                  <label className="block text-3xs font-bold uppercase text-slate-500 mb-1">
                    Plantillas Carnet (px)
                  </label>
                  <input
                    type="number"
                    min={1200}
                    max={5000}
                    step={100}
                    value={optConfig.templateMaxDim}
                    onChange={(e) =>
                      setOptConfig({ ...optConfig, templateMaxDim: Number(e.target.value) || 2600 })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900"
                  />
                  <span className="text-3xs text-gray-400">Calidad: {Math.round(optConfig.templateQuality * 100)}%</span>
                </div>

                <div>
                  <label className="block text-3xs font-bold uppercase text-slate-500 mb-1">
                    Noticias / Countdown
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={4096}
                    step={100}
                    value={optConfig.bannerMaxDim}
                    onChange={(e) =>
                      setOptConfig({ ...optConfig, bannerMaxDim: Number(e.target.value) || 2200 })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900"
                  />
                  <span className="text-3xs text-gray-400">Calidad: {Math.round(optConfig.bannerQuality * 100)}%</span>
                </div>

                <div>
                  <label className="block text-3xs font-bold uppercase text-slate-500 mb-1">
                    Vehículos / Docs (px)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={4096}
                    step={100}
                    value={optConfig.generalMaxDim}
                    onChange={(e) =>
                      setOptConfig({ ...optConfig, generalMaxDim: Number(e.target.value) || 2000 })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900"
                  />
                  <span className="text-3xs text-gray-400">Calidad: {Math.round(optConfig.generalQuality * 100)}%</span>
                </div>

                <div>
                  <label className="block text-3xs font-bold uppercase text-slate-500 mb-1">
                    Logotipos / Sellos (px)
                  </label>
                  <input
                    type="number"
                    min={400}
                    max={2500}
                    step={100}
                    value={optConfig.logoMaxDim}
                    onChange={(e) =>
                      setOptConfig({ ...optConfig, logoMaxDim: Number(e.target.value) || 1200 })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900"
                  />
                  <span className="text-3xs text-gray-400">Calidad: {Math.round(optConfig.logoQuality * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-2xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Regla activa: si un archivo ya pesa menos que la copia optimizada (o es PDF / SVG), se sube el original sin tocarlo.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. MÉTRICAS DE CANTIDAD DE IMÁGENES Y ESPACIO USADO EN SUPABASE        */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Inventario de Imágenes y Espacio Usado en Supabase Storage
              </h3>
              <p className="text-xs text-gray-500">
                Conteo real de imágenes almacenadas, peso por formato, distribución por módulo y ahorro acumulado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefreshStats}
            disabled={loadingStats}
            className="inline-flex items-center px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 transition-all cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-indigo-600 ${loadingStats ? 'animate-spin' : ''}`} />
            {loadingStats ? 'Calculando...' : 'Actualizar Datos'}
          </button>
        </div>

        {/* Banner opcional si aún no se ha corrido Migración 47 */}
        {analytics && analytics.source === 'storage_scan' && (
          <div className="mx-5 mt-4 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-indigo-950 block">
                  Lectura directa por carpetas activa · Activa el motor SQL exacto (Migración 47)
                </span>
                <span className="text-3xs text-indigo-800 block mt-0.5">
                  Ejecuta la Migración 47 en el SQL Editor de Supabase para habilitar conteo instantáneo sobre todos los objetos de Storage, asegurar soporte WebP en buckets antiguos y guardar el historial global de megabytes ahorrados.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopySql47}
              className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-2xs font-bold transition-all cursor-pointer shrink-0"
            >
              {sqlCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" /> ¡SQL Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copiar SQL Migración 47
                </>
              )}
            </button>
          </div>
        )}

        <div className="p-5 space-y-6">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Cantidad de Imágenes */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Total de Imágenes
                </span>
                <ImageIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-gray-900 tabular-nums">
                {loadingStats && !analytics ? '...' : (analytics?.total_images || 0).toLocaleString()}
              </div>
              <p className="text-3xs text-slate-500 mt-1">
                + {(analytics?.other_files_count || 0).toLocaleString()} documentos PDF / otros archivos
              </p>
            </div>

            {/* KPI 2: Espacio Usado por Imágenes */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Espacio en Imágenes
                </span>
                <HardDrive className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-gray-900 tabular-nums">
                {loadingStats && !analytics ? '...' : formatStorageBytes(totalImageBytes)}
              </div>
              <p className="text-3xs text-slate-500 mt-1">
                Promedio: {formatStorageBytes(analytics?.avg_image_bytes || 0)} por imagen ({imageSharePercent}% del Storage)
              </p>
            </div>

            {/* KPI 3: Espacio Total Bucket (Imágenes + PDFs) */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Uso Total de Storage
                </span>
                <Layers className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-gray-900 tabular-nums">
                {loadingStats && !analytics ? '...' : formatStorageBytes(totalStorageBytes)}
              </div>
              <div className="mt-2">
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quotaPercent > 85 ? 'bg-red-500' : quotaPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(1.5, quotaPercent)}%` }}
                  />
                </div>
                <span className="text-3xs text-slate-500 mt-1 block">
                  {quotaPercent.toFixed(2)}% de {formatStorageBytes(quotaBytes, 0)} de referencia
                </span>
              </div>
            </div>

            {/* KPI 4: Espacio Ahorrado por el Optimizador */}
            <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-emerald-800">
                  Espacio Ahorrado
                </span>
                <TrendingDown className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-900 tabular-nums">
                {formatStorageBytes(optLog.total_saved_bytes)}
              </div>
              <p className="text-3xs text-emerald-800/80 mt-1">
                {optLog.optimized_count.toLocaleString()} optimizadas · Reducción media: {avgReductionPct}%
              </p>
            </div>
          </div>

          {/* Desglose por Formato y por Módulo / Carpeta */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Por Formato (WebP, JPEG, PNG, SVG) */}
            <div className="border border-slate-200/80 rounded-xl p-4">
              <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <span>Distribución por Formato de Imagen</span>
              </h4>

              {!analytics || analytics.by_format.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  No se encontraron imágenes registradas aún.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.by_format.map((fmt) => {
                    const pct =
                      totalImageBytes > 0 ? Math.min(100, (fmt.bytes / totalImageBytes) * 100) : 0;
                    return (
                      <div key={fmt.format} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{fmt.format}</span>
                            <span className="text-3xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                              {fmt.count} {fmt.count === 1 ? 'imagen' : 'imágenes'}
                            </span>
                          </div>
                          <span className="font-mono text-2xs font-semibold text-gray-700">
                            {formatStorageBytes(fmt.bytes)} · prom. {formatStorageBytes(fmt.avg_bytes, 1)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              fmt.format === 'WebP'
                                ? 'bg-emerald-500'
                                : fmt.format === 'PNG'
                                ? 'bg-indigo-500'
                                : fmt.format === 'JPEG'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resumen por Bucket */}
              {analytics && analytics.by_bucket.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Buckets en Supabase Storage
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {analytics.by_bucket.map((b) => (
                      <div
                        key={b.bucket_id}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-2xs"
                      >
                        <span className="font-bold text-gray-900">{b.bucket_id}:</span>{' '}
                        <span className="text-gray-600">
                          {b.image_count} img ({formatStorageBytes(b.image_bytes, 1)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Por Módulo / Carpeta */}
            <div className="border border-slate-200/80 rounded-xl p-4">
              <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-600" />
                <span>Espacio Usado por Módulo del Sistema</span>
              </h4>

              {!analytics || analytics.by_folder.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  Sin datos de módulos disponibles.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {analytics.by_folder.map((fld) => {
                    const pct =
                      totalImageBytes > 0
                        ? Math.min(100, (fld.image_bytes / totalImageBytes) * 100)
                        : 0;
                    const label = FOLDER_LABELS[fld.folder] || fld.folder;
                    return (
                      <div key={fld.folder} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-800 truncate pr-2">{label}</span>
                          <span className="text-2xs font-mono text-gray-600 shrink-0">
                            {fld.image_count} img · <strong>{formatStorageBytes(fld.image_bytes)}</strong> ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tabla / Explorador de Imágenes Recientes y Más Pesadas */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden">
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex bg-slate-200/70 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveImageTab('recent')}
                  className={`px-3 py-1.5 rounded-md text-2xs font-bold transition cursor-pointer ${
                    activeImageTab === 'recent'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Últimas Imágenes Subidas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImageTab('largest')}
                  className={`px-3 py-1.5 rounded-md text-2xs font-bold transition cursor-pointer ${
                    activeImageTab === 'largest'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Imágenes de Mayor Peso
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por nombre, formato o módulo..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {displayedImages.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                {loadingStats ? 'Cargando listado de imágenes...' : 'No hay imágenes que coincidan con el filtro.'}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-100 text-3xs uppercase tracking-wider text-slate-500 font-bold">
                      <th className="py-2.5 px-3.5">Vista</th>
                      <th className="py-2.5 px-3.5">Archivo</th>
                      <th className="py-2.5 px-3.5">Módulo / Bucket</th>
                      <th className="py-2.5 px-3.5">Formato</th>
                      <th className="py-2.5 px-3.5">Peso</th>
                      <th className="py-2.5 px-3.5">Fecha</th>
                      <th className="py-2.5 px-3.5 text-right">Abrir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {displayedImages.map((img) => {
                      const fileNameOnly = img.name.split('/').pop() || img.name;
                      return (
                        <tr key={`${img.bucket_id}:${img.name}`} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3.5">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {img.publicUrl ? (
                                <img
                                  src={img.publicUrl}
                                  alt={fileNameOnly}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3.5 max-w-[230px]">
                            <span className="font-semibold text-gray-900 truncate block" title={img.name}>
                              {fileNameOnly}
                            </span>
                          </td>
                          <td className="py-2 px-3.5">
                            <span className="text-gray-700 font-medium block">
                              {FOLDER_LABELS[img.folder] || img.folder}
                            </span>
                            <span className="text-3xs text-gray-400 font-mono">bucket: {img.bucket_id}</span>
                          </td>
                          <td className="py-2 px-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-3xs font-bold ${
                                img.format === 'WebP'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : img.format === 'PNG'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {img.format}
                            </span>
                          </td>
                          <td className="py-2 px-3.5 font-mono font-semibold text-gray-800 whitespace-nowrap">
                            {formatStorageBytes(img.size_bytes)}
                          </td>
                          <td className="py-2 px-3.5 text-2xs text-gray-500 whitespace-nowrap">
                            {img.created_at
                              ? formatFechaSV(img.created_at, {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="py-2 px-3.5 text-right">
                            {img.publicUrl && (
                              <a
                                href={img.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-2 py-1 rounded-md text-2xs font-semibold text-indigo-700 hover:bg-indigo-50"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. SIMULADOR / PROBADOR DE CALIDAD EN VIVO (SIN SUBIR NADA)           */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Comprobador Visual de Calidad (Prueba local sin subir a Supabase)
            </h3>
            <p className="text-xs text-gray-500">
              Selecciona cualquier fotografía para comparar el archivo original frente a la versión optimizada antes y después
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={testProfile}
              onChange={(e) => setTestProfile(e.target.value as ImageOptimizationProfile)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-gray-800 outline-none"
            >
              <option value="carnet">Perfil: Foto de Carnet (300 DPI)</option>
              <option value="template">Perfil: Plantilla Impresión</option>
              <option value="banner">Perfil: Noticia / Countdown</option>
              <option value="general">Perfil: Vehículo / Documento</option>
              <option value="logo">Perfil: Logotipo Transparente</option>
              <option value="email_logo">Perfil: Logo de Correo (PNG/JPG)</option>
            </select>

            <input
              ref={testInputRef}
              type="file"
              accept="image/*"
              onChange={handleRunLiveTest}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => testInputRef.current?.click()}
              disabled={testingImage}
              className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {testingImage ? 'Procesando...' : 'Probar con una Imagen'}
            </button>
          </div>
        </div>

        {testResult && (
          <div className="p-5 space-y-4 bg-slate-50/40">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs text-emerald-950">
                <span className="font-bold">Resultado de la prueba:</span>{' '}
                {testResult.details.wasOptimized ? (
                  <>
                    De <strong>{formatStorageBytes(testResult.details.originalBytes)}</strong> (
                    {testResult.details.originalMime}) bajó a{' '}
                    <strong>{formatStorageBytes(testResult.details.finalBytes)}</strong> (
                    {testResult.details.finalMime}) —{' '}
                    <strong className="text-emerald-700">
                      {testResult.details.reductionPercent}% menos espacio
                    </strong>{' '}
                    sin pérdida visual.
                  </>
                ) : (
                  <span>
                    {testResult.details.skipReason ||
                      'El archivo ya está en su peso mínimo óptimo; se conservará el original intacto.'}
                  </span>
                )}
              </div>
              <span className="text-2xs font-mono font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                Ahorro: {formatStorageBytes(testResult.details.savedBytes)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="font-bold text-gray-800">Original</span>
                  <span className="font-mono text-2xs text-gray-500">
                    {testResult.details.originalWidth}×{testResult.details.originalHeight}px ·{' '}
                    {formatStorageBytes(testResult.details.originalBytes)}
                  </span>
                </div>
                <div className="h-56 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={testResult.originalPreviewUrl}
                    alt="Original"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-emerald-300">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="font-bold text-emerald-800">Optimizada (Lista para Supabase)</span>
                  <span className="font-mono text-2xs text-emerald-700 font-semibold">
                    {testResult.details.finalWidth}×{testResult.details.finalHeight}px ·{' '}
                    {formatStorageBytes(testResult.details.finalBytes)}
                  </span>
                </div>
                <div className="h-56 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={testResult.optimizedPreviewUrl}
                    alt="Optimizada"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
