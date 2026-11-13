import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Newspaper,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  PlayCircle,
  Clock,
  Sliders,
  Check,
  X,
  Database,
  Copy,
  Monitor,
  Smartphone,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';
import {
  DEFAULT_BANNER_CONFIG,
  fetchNoticiasBannerData,
  NoticiaBannerSlide,
  NoticiasBannerConfig,
  NoticiaVideo,
  parseVideoEmbedUrl,
  saveNoticiasBannerConfig,
  uploadNoticiaMedia,
} from '../lib/noticiasBanner';
import NoticiaRichEditor from '../components/noticias/NoticiaRichEditor';
import NoticiasBannerSlider from '../components/dashboard/NoticiasBannerSlider';

const CATEGORIAS_NOTICIA = [
  'Noticia Institucional',
  'Operativo y Emergencias',
  'Capacitación y Cursos',
  'Convocatoria',
  'Logro y Reconocimiento',
  'Aviso General',
];

const INTERVAL_PRESETS = [3, 5, 6, 8, 10, 15];

const SQL_MIGRATION_32 = `-- Migración 32: Tabla de Noticias Banner, Configuración y Permisos
CREATE TABLE IF NOT EXISTS public.noticias_banner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  categoria TEXT DEFAULT 'Noticia',
  imagen_url TEXT NOT NULL,
  contenido_html TEXT DEFAULT '',
  videos JSONB DEFAULT '[]'::jsonb,
  accion_click TEXT DEFAULT 'landing' CHECK (accion_click IN ('landing', 'url')),
  enlace_redireccion TEXT,
  enlace_texto TEXT DEFAULT 'Más información',
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre TEXT DEFAULT 'Cruz Verde Salvadoreña',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_noticias_banner_activo ON public.noticias_banner(activo);
CREATE INDEX IF NOT EXISTS idx_noticias_banner_orden ON public.noticias_banner(orden ASC, created_at DESC);
ALTER TABLE public.noticias_banner ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver noticias activas" ON public.noticias_banner;
CREATE POLICY "Usuarios autenticados pueden ver noticias activas"
  ON public.noticias_banner FOR SELECT TO authenticated
  USING (activo = true OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com' OR EXISTS (
    SELECT 1 FROM public.user_roles ur LEFT JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.id = auth.uid() AND (
      ur.role = 'admin' OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
      OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
      OR COALESCE((rp.permissions->>'view_noticias_ajustes')::boolean, false) = true
    )
  ));

DROP POLICY IF EXISTS "Autorizados pueden administrar noticias_banner" ON public.noticias_banner;
CREATE POLICY "Autorizados pueden administrar noticias_banner"
  ON public.noticias_banner FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'christopher.snap@gmail.com' OR EXISTS (
    SELECT 1 FROM public.user_roles ur LEFT JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.id = auth.uid() AND (
      ur.role = 'admin' OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
      OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
      OR COALESCE((rp.permissions->>'view_noticias_ajustes')::boolean, false) = true
    )
  )) WITH CHECK (true);

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_banner_activo', 'true', 'Activa o desactiva el Banner Slide de Noticias'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_banner_activo');

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_banner_intervalo', '6', 'Intervalo en segundos del Banner Slide'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_banner_intervalo');

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_banner_autoplay', 'true', 'Autoplay del Banner Slide'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_banner_autoplay');

UPDATE public.role_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('view_noticias_ajustes', true, 'edit_noticias_banner', true)
WHERE role = 'admin';

NOTIFY pgrst, 'reload schema';`;

export default function Noticias() {
  const navigate = useNavigate();
  const { user, userName, role, permissions } = useAuth();
  const canEdit =
    role === 'admin' ||
    Boolean(permissions.edit_noticias_banner || permissions.view_noticias_ajustes);

  const [slides, setSlides] = useState<NoticiaBannerSlide[]>([]);
  const [config, setConfig] = useState<NoticiasBannerConfig>(DEFAULT_BANNER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'auto' | 'mobile'>('auto');

  // Slide Form Modal
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<NoticiaBannerSlide | null>(null);
  const [savingSlide, setSavingSlide] = useState(false);
  const [slideError, setSlideError] = useState<string | null>(null);

  const [formTitulo, setFormTitulo] = useState('');
  const [formSubtitulo, setFormSubtitulo] = useState('');
  const [formCategoria, setFormCategoria] = useState(CATEGORIAS_NOTICIA[0]);
  const [formImagenUrl, setFormImagenUrl] = useState('');
  const [uploadingBannerImg, setUploadingBannerImg] = useState(false);
  const [formContenidoHtml, setFormContenidoHtml] = useState('');
  const [formVideos, setFormVideos] = useState<NoticiaVideo[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [formAccionClick, setFormAccionClick] = useState<'landing' | 'url'>('landing');
  const [formEnlaceRedireccion, setFormEnlaceRedireccion] = useState('');
  const [formEnlaceTexto, setFormEnlaceTexto] = useState('Más información');
  const [formActivo, setFormActivo] = useState(true);

  // SQL Modal
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchNoticiasBannerData(true);
      setSlides(res.slides);
      setConfig(res.config);
    } catch (err) {
      console.error('Error cargando configuración de noticias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const persistSlidesLocal = (list: NoticiaBannerSlide[]) => {
    try {
      localStorage.setItem('cv_noticias_banner_slides', JSON.stringify(list));
    } catch {}
  };

  const handleSaveGlobalConfig = async (nextConfig: NoticiasBannerConfig) => {
    setConfig(nextConfig);
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      await saveNoticiasBannerConfig(nextConfig);
      setConfigFeedback('Ajustes del banner guardados correctamente.');
      setTimeout(() => setConfigFeedback(null), 3000);
    } catch (err) {
      console.error('Error guardando configuración de banner:', err);
      setConfigFeedback('No se pudieron guardar los ajustes en Supabase (guardados localmente).');
    } finally {
      setSavingConfig(false);
    }
  };

  const openCreateModal = () => {
    setEditingSlide(null);
    setFormTitulo('');
    setFormSubtitulo('');
    setFormCategoria(CATEGORIAS_NOTICIA[0]);
    setFormImagenUrl('');
    setFormContenidoHtml('');
    setFormVideos([]);
    setNewVideoUrl('');
    setNewVideoTitle('');
    setFormAccionClick('landing');
    setFormEnlaceRedireccion('');
    setFormEnlaceTexto('Más información');
    setFormActivo(true);
    setSlideError(null);
    setShowSlideModal(true);
  };

  const openEditModal = (slide: NoticiaBannerSlide) => {
    setEditingSlide(slide);
    setFormTitulo(slide.titulo || '');
    setFormSubtitulo(slide.subtitulo || '');
    setFormCategoria(slide.categoria || CATEGORIAS_NOTICIA[0]);
    setFormImagenUrl(slide.imagen_url || '');
    setFormContenidoHtml(slide.contenido_html || '');
    setFormVideos(Array.isArray(slide.videos) ? slide.videos : []);
    setNewVideoUrl('');
    setNewVideoTitle('');
    setFormAccionClick(slide.accion_click === 'url' ? 'url' : 'landing');
    setFormEnlaceRedireccion(slide.enlace_redireccion || '');
    setFormEnlaceTexto(slide.enlace_texto || 'Más información');
    setFormActivo(Boolean(slide.activo));
    setSlideError(null);
    setShowSlideModal(true);
  };

  const handleUploadBannerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSlideError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }
    setSlideError(null);
    setUploadingBannerImg(true);
    try {
      const url = await uploadNoticiaMedia(file, 1920);
      setFormImagenUrl(url);
    } catch (err: any) {
      setSlideError(err?.message || 'Error al subir la imagen destacada.');
    } finally {
      setUploadingBannerImg(false);
      e.target.value = '';
    }
  };

  const handleAddVideo = () => {
    const url = newVideoUrl.trim();
    if (!url) return;
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const info = parseVideoEmbedUrl(normalized);
    setFormVideos((prev) => [
      ...prev,
      {
        id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        titulo: newVideoTitle.trim() || `Video (${info.platform})`,
        url: normalized,
      },
    ]);
    setNewVideoUrl('');
    setNewVideoTitle('');
  };

  const handleRemoveVideo = (vidId: string) => {
    setFormVideos((prev) => prev.filter((v) => v.id !== vidId));
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) {
      setSlideError('El título de la noticia es obligatorio.');
      return;
    }
    if (!formImagenUrl.trim()) {
      setSlideError('Debes subir o indicar la URL de la imagen destacada para el banner slide.');
      return;
    }
    if (formAccionClick === 'url' && !formEnlaceRedireccion.trim()) {
      setSlideError('Ingresa la URL de redirección o selecciona "Abrir Landing Page".');
      return;
    }

    setSavingSlide(true);
    setSlideError(null);

    try {
      const payload = {
        titulo: formTitulo.trim(),
        subtitulo: formSubtitulo.trim() || null,
        categoria: formCategoria.trim() || 'Noticia Institucional',
        imagen_url: formImagenUrl.trim(),
        contenido_html: formContenidoHtml || '',
        videos: formVideos,
        accion_click: formAccionClick,
        enlace_redireccion: formEnlaceRedireccion.trim() || null,
        enlace_texto: formEnlaceTexto.trim() || 'Más información',
        activo: formActivo,
        orden: editingSlide ? editingSlide.orden : slides.length,
        autor_id: user?.id || null,
        autor_nombre: userName || 'Cruz Verde Salvadoreña',
        updated_at: new Date().toISOString(),
      };

      if (editingSlide) {
        const { error: sbErr } = await supabase
          .from('noticias_banner')
          .update(payload)
          .eq('id', editingSlide.id);

        if (sbErr) {
          await fetch(getApiUrl(`/api/noticias-banner/${encodeURIComponent(editingSlide.id)}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }

        const updatedList = slides.map((s) =>
          s.id === editingSlide.id ? ({ ...s, ...payload } as NoticiaBannerSlide) : s
        );
        setSlides(updatedList);
        persistSlidesLocal(updatedList);

        logActivity('update', 'Noticias Banner', editingSlide.id, {
          titulo: payload.titulo,
          detalles: `Actualizó slide de banner "${payload.titulo}"`,
        });
      } else {
        const newId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `not_${Date.now()}`;

        const newRecord: NoticiaBannerSlide = {
          ...payload,
          id: newId,
          created_at: new Date().toISOString(),
        };

        const { error: sbErr } = await supabase.from('noticias_banner').insert([newRecord]);

        if (sbErr) {
          await fetch(getApiUrl('/api/noticias-banner'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRecord),
          }).catch(() => {});
        }

        const updatedList = [...slides, newRecord].sort((a, b) => a.orden - b.orden);
        setSlides(updatedList);
        persistSlidesLocal(updatedList);

        logActivity('create', 'Noticias Banner', newId, {
          titulo: payload.titulo,
          detalles: `Creó nuevo slide en el banner de noticias "${payload.titulo}"`,
        });
      }

      setShowSlideModal(false);
    } catch (err: any) {
      console.error('Error guardando slide:', err);
      setSlideError(err?.message || 'Ocurrió un error al guardar el slide.');
    } finally {
      setSavingSlide(false);
    }
  };

  const handleToggleSlideActivo = async (slide: NoticiaBannerSlide) => {
    const nextVal = !slide.activo;
    const { error: sbErr } = await supabase
      .from('noticias_banner')
      .update({ activo: nextVal, updated_at: new Date().toISOString() })
      .eq('id', slide.id);

    if (sbErr) {
      await fetch(getApiUrl(`/api/noticias-banner/${encodeURIComponent(slide.id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nextVal }),
      }).catch(() => {});
    }

    const updated = slides.map((s) => (s.id === slide.id ? { ...s, activo: nextVal } : s));
    setSlides(updated);
    persistSlidesLocal(updated);
  };

  const handleMoveSlide = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= slides.length) return;

    const reordered = [...slides];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    const withOrder = reordered.map((s, idx) => ({ ...s, orden: idx }));
    setSlides(withOrder);
    persistSlidesLocal(withOrder);

    await Promise.all(
      withOrder.map(async (s) => {
        const { error } = await supabase
          .from('noticias_banner')
          .update({ orden: s.orden })
          .eq('id', s.id);
        if (error) {
          await fetch(getApiUrl(`/api/noticias-banner/${encodeURIComponent(s.id)}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orden: s.orden }),
          }).catch(() => {});
        }
      })
    );
  };

  const handleDeleteSlide = async (slide: NoticiaBannerSlide) => {
    if (!window.confirm(`¿Eliminar permanentemente el slide "${slide.titulo}"?`)) return;

    const { error: sbErr } = await supabase.from('noticias_banner').delete().eq('id', slide.id);
    if (sbErr) {
      await fetch(getApiUrl(`/api/noticias-banner/${encodeURIComponent(slide.id)}`), {
        method: 'DELETE',
      }).catch(() => {});
    }

    const updated = slides.filter((s) => s.id !== slide.id);
    setSlides(updated);
    persistSlidesLocal(updated);

    logActivity('delete', 'Noticias Banner', slide.id, {
      titulo: slide.titulo,
      detalles: `Eliminó slide "${slide.titulo}" del banner de noticias`,
    });
  };

  const copySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_32);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/70 shrink-0">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Noticias y Banner Slide del Dashboard
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
              Administra las imágenes destacadas del carrusel principal del Dashboard, tiempos de transición y el contenido editorial (texto, imágenes y videos) de cada noticia.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
          >
            <Database className="w-4 h-4 text-emerald-700" />
            <span>Script SQL Supabase</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
            title="Recargar slides y ajustes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Nuevo Slide</span>
            </button>
          )}
        </div>
      </div>

      {/* Ajustes Generales del Banner Slide */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Ajustes del Carrusel en Dashboard
            </h2>
          </div>

          {configFeedback && (
            <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {configFeedback}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Activar / Desactivar Banner completo */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Mostrar Banner en Dashboard</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {config.activo ? 'Visible para todos los usuarios' : 'Oculto temporalmente'}
              </p>
            </div>
            <button
              type="button"
              disabled={!canEdit || savingConfig}
              onClick={() => handleSaveGlobalConfig({ ...config, activo: !config.activo })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                config.activo
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {config.activo ? 'Activado' : 'Desactivado'}
            </button>
          </div>

          {/* Autoplay */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Deslizamiento Automático</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {config.autoplay ? 'Cambia de slide automáticamente' : 'Solo cambio manual con flechas'}
              </p>
            </div>
            <button
              type="button"
              disabled={!canEdit || savingConfig}
              onClick={() => handleSaveGlobalConfig({ ...config, autoplay: !config.autoplay })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                config.autoplay
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {config.autoplay ? 'Automático' : 'Manual'}
            </button>
          </div>

          {/* Tiempo de transición */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                Tiempo por slide (segundos)
              </span>
              <span className="text-xs font-mono tabular-nums font-bold text-emerald-700">
                {config.intervalo_segundos}s
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {INTERVAL_PRESETS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={!canEdit || savingConfig}
                  onClick={() => handleSaveGlobalConfig({ ...config, intervalo_segundos: sec })}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono tabular-nums font-semibold border cursor-pointer transition-colors ${
                    config.intervalo_segundos === sec
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sec}s
                </button>
              ))}
              <input
                type="number"
                min={2}
                max={120}
                value={config.intervalo_segundos}
                onChange={(e) => {
                  const v = Math.max(2, Math.min(120, Number(e.target.value) || 6));
                  setConfig((prev) => ({ ...prev, intervalo_segundos: v }));
                }}
                onBlur={() => handleSaveGlobalConfig(config)}
                className="w-16 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-center outline-none focus:border-emerald-600"
                title="Segundos personalizados (2 - 120)"
              />
            </div>
          </div>
        </div>

        {/* Vista Previa Responsive */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Vista previa en vivo del Banner Slide ({slides.filter((s) => s.activo).length} slides activos)
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewMode('auto')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer ${
                  previewMode === 'auto' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Escritorio
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer ${
                  previewMode === 'mobile' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Móvil
              </button>
            </div>
          </div>

          {config.activo && slides.some((s) => s.activo) ? (
            <NoticiasBannerSlider
              slides={slides}
              config={config}
              previewMode={previewMode}
              disableNavigation
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-xs text-slate-500">
              {!config.activo
                ? 'El banner está desactivado globalmente. Actívalo arriba para mostrarlo en el Dashboard.'
                : 'No hay slides activos aún. Agrega un slide para previsualizar el banner.'}
            </div>
          )}
        </div>
      </section>

      {/* Lista de Slides configurados */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Slides Configurados ({slides.length})
          </h2>
          <span className="text-xs text-slate-500">
            Usa las flechas para cambiar el orden de aparición
          </span>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
            Cargando slides de noticias...
          </div>
        ) : slides.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Newspaper className="w-10 h-10 text-slate-300 mx-auto stroke-[1.5]" />
            <h3 className="text-sm font-bold text-slate-900">Aún no hay slides publicados</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Crea el primer slide con una imagen destacada, texto enriquecido, imágenes internas o videos de YouTube para mostrarlo en el Dashboard.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Agregar Primer Slide
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={`bg-white rounded-2xl border p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all ${
                  slide.activo
                    ? 'border-slate-200 shadow-2xs'
                    : 'border-slate-200/70 bg-slate-50/70 opacity-75'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-full md:w-56 aspect-[16/9] md:aspect-[16/7] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/70 shrink-0">
                  <img
                    src={slide.imagen_url}
                    alt={slide.titulo}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums font-bold text-slate-700">
                      #{idx + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-emerald-700">
                      {slide.categoria || 'Noticia'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={slide.activo ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                      {slide.activo ? 'Activo en carrusel' : 'Desactivado'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {slide.accion_click === 'url'
                        ? `Redirección: ${slide.enlace_redireccion}`
                        : `Landing Page (${slide.videos?.length || 0} videos)`}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 truncate">{slide.titulo}</h3>
                  {slide.subtitulo && (
                    <p className="text-xs text-slate-600 line-clamp-2">{slide.subtitulo}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {slide.accion_click !== 'url' && (
                    <button
                      type="button"
                      onClick={() => navigate(`/noticias/ver/${slide.id}`)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      title="Ver Landing Page como usuario"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver Página
                    </button>
                  )}

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSlide(idx, -1)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-35 cursor-pointer"
                        title="Subir orden"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === slides.length - 1}
                        onClick={() => handleMoveSlide(idx, 1)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-35 cursor-pointer"
                        title="Bajar orden"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleSlideActivo(slide)}
                        className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                          slide.activo
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                        }`}
                        title={slide.activo ? 'Desactivar slide' : 'Activar slide'}
                      >
                        {slide.activo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(slide)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 cursor-pointer"
                        title="Editar slide y contenido"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer"
                        title="Eliminar slide"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL CREAR / EDITAR SLIDE Y CONTENIDO */}
      {showSlideModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-4 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingSlide ? 'Editar Slide y Contenido de Noticia' : 'Nuevo Slide del Banner de Noticias'}
                </h2>
                <p className="text-xs text-slate-500">
                  Sube la imagen panorámica del banner y configura la landing page o redirección al hacer clic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSlideModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">
              {slideError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
                  {slideError}
                </div>
              )}

              {/* 1. Imagen Destacada + Guía de Dimensiones */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-900">
                    1. Imagen Destacada del Banner Slide *
                  </label>
                  <span className="text-xs text-slate-500">
                    Formatos admitidos: JPG, PNG, WebP
                  </span>
                </div>

                {/* Cuadro de Dimensiones Sugeridas */}
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-950">
                  <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      Dimensiones sugeridas para el Banner Slide: 1600 × 540 px (o 1920 × 640 px)
                    </p>
                    <p className="text-emerald-800">
                      Proporción panorámica <strong>3:1 / 16:5</strong> en pantallas de escritorio y adaptación automática a <strong>16:9</strong> en móviles. Peso recomendado menor a 2 MB; procura centrar rostros o textos clave para evitar recortes en teléfonos.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 text-xs font-semibold text-emerald-800 cursor-pointer transition-colors">
                    {uploadingBannerImg ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploadingBannerImg ? 'Subiendo imagen...' : 'Subir Imagen desde Dispositivo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadBannerImage}
                      disabled={uploadingBannerImg}
                      className="hidden"
                    />
                  </label>

                  <div>
                    <input
                      type="url"
                      value={formImagenUrl}
                      onChange={(e) => setFormImagenUrl(e.target.value)}
                      placeholder="O pega la URL directa de una imagen (https://...)"
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
                    />
                  </div>
                </div>

                {formImagenUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[24/8] relative">
                    <img
                      src={formImagenUrl}
                      alt="Vista previa de imagen destacada"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                )}
              </div>

              {/* 2. Título, Subtítulo y Categoría */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-900 block">Título Principal *</label>
                  <input
                    type="text"
                    required
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value)}
                    placeholder="Ej: Cruz Verde inaugura jornada nacional de capacitación 2026"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-900 block">Categoría</label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    {CATEGORIAS_NOTICIA.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-900 block">
                    Subtítulo / Resumen breve (opcional)
                  </label>
                  <input
                    type="text"
                    value={formSubtitulo}
                    onChange={(e) => setFormSubtitulo(e.target.value)}
                    placeholder="Breve descripción que aparece debajo del título en el banner y portada"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* 3. Acción al hacer clic/tap en el Banner */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <label className="text-xs font-bold text-slate-900 block">
                  Al dar Tap / Clic en la imagen del Banner en el Dashboard:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormAccionClick('landing')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formAccionClick === 'landing'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold">Abrir Landing Page de la Noticia</p>
                    <p className={`text-[11px] mt-0.5 ${formAccionClick === 'landing' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      Muestra título, párrafos con imágenes, videos y botón regresar al Dashboard.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormAccionClick('url')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formAccionClick === 'url'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold">Redireccionar a un Enlace directo</p>
                    <p className={`text-[11px] mt-0.5 ${formAccionClick === 'url' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Envía al usuario directamente a una URL interna o sitio externo.
                    </p>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      {formAccionClick === 'url'
                        ? 'URL de Redirección Obligatoria *'
                        : 'Enlace adicional opcional (aparece como botón en la Landing Page)'}
                    </label>
                    <input
                      type="text"
                      value={formEnlaceRedireccion}
                      onChange={(e) => setFormEnlaceRedireccion(e.target.value)}
                      placeholder="https://... o ruta interna como /cursos"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Texto del botón
                    </label>
                    <input
                      type="text"
                      value={formEnlaceTexto}
                      onChange={(e) => setFormEnlaceTexto(e.target.value)}
                      placeholder="Más información"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Editor de Texto Rico + Imágenes internas */}
              {formAccionClick === 'landing' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900">
                        2. Editor de Contenido de la Noticia (Párrafos e Imágenes)
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Solo visible aquí en ajustes
                      </span>
                    </div>
                    <NoticiaRichEditor
                      editorKey={editingSlide?.id || 'new-slide'}
                      value={formContenidoHtml}
                      onChange={setFormContenidoHtml}
                    />
                  </div>

                  {/* 5. Enlaces de Videos (YouTube u otras plataformas) */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                        <PlayCircle className="w-4 h-4 text-emerald-700" />
                        3. Enlaces de Videos para Reproducir (YouTube, Vimeo, Facebook, TikTok, MP4)
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        value={newVideoTitle}
                        onChange={(e) => setNewVideoTitle(e.target.value)}
                        placeholder="Título del video (opcional)"
                        className="sm:col-span-4 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                      />
                      <input
                        type="url"
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... o Vimeo/TikTok/MP4"
                        className="sm:col-span-6 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={handleAddVideo}
                        disabled={!newVideoUrl.trim()}
                        className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        + Agregar
                      </button>
                    </div>

                    {formVideos.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {formVideos.map((vid) => {
                          const info = parseVideoEmbedUrl(vid.url);
                          return (
                            <div
                              key={vid.id}
                              className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {vid.titulo} · <span className="text-emerald-700">{info.platform}</span>
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">{vid.url}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveVideo(vid.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Quitar video"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Estado Activo */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                <div>
                  <p className="text-xs font-bold text-slate-900">Estado del Slide</p>
                  <p className="text-[11px] text-slate-500">
                    Si está activo aparecerá en el carrusel del Dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormActivo((v) => !v)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                    formActivo
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {formActivo ? 'Activo' : 'Inactivo (Borrador)'}
                </button>
              </div>

              {/* Footer Modal */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSlideModal(false)}
                  disabled={savingSlide}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSlide || uploadingBannerImg}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                >
                  {savingSlide && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingSlide ? 'Guardando...' : editingSlide ? 'Guardar Cambios' : 'Publicar Slide'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SQL SUPABASE */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Script SQL para Supabase (Migración 32)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ejecuta este script en el SQL Editor de Supabase para habilitar la tabla noticias_banner y permisos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <pre className="p-4 rounded-xl bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-80 custom-scrollbar">
                {SQL_MIGRATION_32}
              </pre>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={copySql}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {sqlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{sqlCopied ? 'Script Copiado' : 'Copiar Script SQL'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
