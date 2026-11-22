import React, { useEffect, useState } from 'react';
import {
  Clock,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Upload,
  Database,
  RefreshCw,
  Check,
  X,
  Monitor,
  Smartphone,
  Sliders,
  Palette,
  Type,
  LayoutGrid,
  Rows,
  Loader2,
  Calendar,
  CopyPlus,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getApiUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/logger';
import { uploadNoticiaMedia } from '../../lib/noticiasBanner';
import {
  COUNTDOWN_FONT_OPTIONS,
  COUNTDOWN_THEME_PRESETS,
  CountdownFontKey,
  CountdownPosition,
  CountdownTitleSize,
  DEFAULT_COUNTDOWN_CONFIG,
  fetchNoticiasCountdownData,
  NoticiaCountdown,
  NoticiasCountdownConfig,
  persistCountdownsLocal,
  saveNoticiasCountdownConfig,
} from '../../lib/noticiasCountdown';
import CountdownBannerSection from '../dashboard/CountdownBannerSection';
import {
  formatFechaHoraSV,
  getElSalvadorDateTimeInput,
  getElSalvadorIsoTimestamp,
  parseElSalvadorDateTimeInputToIso,
} from '../../utils/dateUtils';

const SQL_MIGRATION_41 = `-- ==============================================================================
-- 41_noticias_countdown_banner.sql
-- Módulo de Banner Countdown de Eventos (ubicado debajo del Banner Slider)
-- Cruz Verde Salvadoreña - Sistema Administrativo
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.noticias_countdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_evento TEXT NOT NULL,
  etiqueta_superior TEXT DEFAULT 'Próximo Evento',
  subtitulo TEXT,
  fecha_objetivo TIMESTAMPTZ NOT NULL,
  texto_finalizado TEXT DEFAULT '¡El evento ha comenzado!',
  mostrar_meses BOOLEAN DEFAULT true,
  imagen_url TEXT,
  logo_url TEXT,
  posicion_imagen TEXT DEFAULT 'izquierda' CHECK (posicion_imagen IN ('izquierda', 'centro', 'derecha')),
  posicion_logo TEXT DEFAULT 'izquierda' CHECK (posicion_logo IN ('izquierda', 'centro', 'derecha')),
  posicion_conteo TEXT DEFAULT 'derecha' CHECK (posicion_conteo IN ('izquierda', 'centro', 'derecha')),
  tipografia TEXT DEFAULT 'jakarta',
  tamano_titulo TEXT DEFAULT 'md' CHECK (tamano_titulo IN ('sm', 'md', 'lg')),
  color_fondo TEXT DEFAULT '#064e3b',
  color_fondo_secundario TEXT DEFAULT '#0f172a',
  usar_gradiente BOOLEAN DEFAULT true,
  color_texto TEXT DEFAULT '#ffffff',
  color_acento TEXT DEFAULT '#34d399',
  color_caja_tiempo TEXT DEFAULT '#022c22',
  color_texto_tiempo TEXT DEFAULT '#ffffff',
  enlace_url TEXT,
  enlace_texto TEXT DEFAULT 'Ver más detalles',
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_noticias_countdown_activo ON public.noticias_countdown(activo);
CREATE INDEX IF NOT EXISTS idx_noticias_countdown_orden ON public.noticias_countdown(orden ASC, fecha_objetivo ASC);

ALTER TABLE public.noticias_countdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver countdowns activos" ON public.noticias_countdown;
CREATE POLICY "Usuarios autenticados pueden ver countdowns activos"
  ON public.noticias_countdown FOR SELECT TO authenticated
  USING (
    activo = true OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (
        ur.role = 'admin'
        OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
        OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
        OR COALESCE((rp.permissions->>'view_noticias_ajustes')::boolean, false) = true
        OR COALESCE((rp.permissions->>'edit_noticias_banner')::boolean, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "Autorizados pueden administrar noticias_countdown" ON public.noticias_countdown;
CREATE POLICY "Autorizados pueden administrar noticias_countdown"
  ON public.noticias_countdown FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (
        ur.role = 'admin'
        OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
        OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
        OR COALESCE((rp.permissions->>'view_noticias_ajustes')::boolean, false) = true
        OR COALESCE((rp.permissions->>'edit_noticias_banner')::boolean, false) = true
      )
    )
  ) WITH CHECK (true);

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_countdown_activo', 'true', 'Activa o desactiva la sección de Banner Countdown'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_countdown_activo');

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_countdown_layout', 'grid', 'Disposición de múltiples countdowns: grid o stack'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_countdown_layout');

NOTIFY pgrst, 'reload schema';`;

function toLocalDatetimeInput(iso?: string | null): string {
  const date = iso ? iso : new Date(Date.now() + 14 * 86400000);
  return getElSalvadorDateTimeInput(date);
}

function PositionSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CountdownPosition;
  onChange: (pos: CountdownPosition) => void;
}) {
  const options: Array<{ key: CountdownPosition; label: string }> = [
    { key: 'izquierda', label: 'Izquierda' },
    { key: 'centro', label: 'En medio' },
    { key: 'derecha', label: 'Derecha' },
  ];

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-bold text-slate-700 block">{label}</span>
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              value === opt.key
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-700 block truncate">{label}</label>
      <div className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-200 bg-white">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#064e3b'}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer shrink-0 p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 text-[11px] font-mono text-slate-800 bg-transparent outline-none uppercase"
          maxLength={9}
        />
      </div>
    </div>
  );
}

export default function CountdownManagerSection({ canEdit }: { canEdit: boolean }) {
  const { user } = useAuth();

  const [countdowns, setCountdowns] = useState<NoticiaCountdown[]>([]);
  const [config, setConfig] = useState<NoticiasCountdownConfig>(DEFAULT_COUNTDOWN_CONFIG);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'auto' | 'mobile'>('auto');

  // SQL modal
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<NoticiaCountdown | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [nombreEvento, setNombreEvento] = useState('');
  const [etiquetaSuperior, setEtiquetaSuperior] = useState('Próximo Evento');
  const [subtitulo, setSubtitulo] = useState('');
  const [fechaObjetivoLocal, setFechaObjetivoLocal] = useState('');
  const [textoFinalizado, setTextoFinalizado] = useState('¡El evento ha comenzado!');
  const [mostrarMeses, setMostrarMeses] = useState(true);
  const [imagenUrl, setImagenUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [posicionImagen, setPosicionImagen] = useState<CountdownPosition>('izquierda');
  const [posicionLogo, setPosicionLogo] = useState<CountdownPosition>('izquierda');
  const [posicionConteo, setPosicionConteo] = useState<CountdownPosition>('derecha');
  const [tipografia, setTipografia] = useState<CountdownFontKey>('jakarta');
  const [tamanoTitulo, setTamanoTitulo] = useState<CountdownTitleSize>('md');
  const [colorFondo, setColorFondo] = useState('#064e3b');
  const [colorFondoSecundario, setColorFondoSecundario] = useState('#0f172a');
  const [usarGradiente, setUsarGradiente] = useState(true);
  const [colorTexto, setColorTexto] = useState('#ffffff');
  const [colorAcento, setColorAcento] = useState('#34d399');
  const [colorCajaTiempo, setColorCajaTiempo] = useState('#022c22');
  const [colorTextoTiempo, setColorTextoTiempo] = useState('#ffffff');
  const [enlaceUrl, setEnlaceUrl] = useState('');
  const [enlaceTexto, setEnlaceTexto] = useState('Ver más detalles');
  const [activo, setActivo] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchNoticiasCountdownData(true);
      setCountdowns(res.countdowns);
      setConfig(res.config);
    } catch (err) {
      console.error('Error cargando countdowns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveGlobalConfig = async (next: NoticiasCountdownConfig) => {
    setConfig(next);
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      await saveNoticiasCountdownConfig(next);
      setConfigFeedback('Ajustes del Banner Countdown guardados.');
      setTimeout(() => setConfigFeedback(null), 3000);
    } catch {
      setConfigFeedback('Guardado localmente (verifica el Script SQL en Supabase).');
    } finally {
      setSavingConfig(false);
    }
  };

  const applyThemePreset = (presetId: string) => {
    const preset = COUNTDOWN_THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setColorFondo(preset.color_fondo);
    setColorFondoSecundario(preset.color_fondo_secundario);
    setUsarGradiente(preset.usar_gradiente);
    setColorTexto(preset.color_texto);
    setColorAcento(preset.color_acento);
    setColorCajaTiempo(preset.color_caja_tiempo);
    setColorTextoTiempo(preset.color_texto_tiempo);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setNombreEvento('');
    setEtiquetaSuperior('Próximo Evento');
    setSubtitulo('');
    setFechaObjetivoLocal(toLocalDatetimeInput());
    setTextoFinalizado('¡El evento ha comenzado!');
    setMostrarMeses(true);
    setImagenUrl('');
    setLogoUrl('');
    setPosicionImagen('izquierda');
    setPosicionLogo('izquierda');
    setPosicionConteo('derecha');
    setTipografia('jakarta');
    setTamanoTitulo('md');
    applyThemePreset('cruz-verde');
    setEnlaceUrl('');
    setEnlaceTexto('Ver más detalles');
    setActivo(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: NoticiaCountdown, asDuplicate = false) => {
    setEditingItem(asDuplicate ? null : item);
    setNombreEvento(asDuplicate ? `${item.nombre_evento} (Copia)` : item.nombre_evento);
    setEtiquetaSuperior(item.etiqueta_superior ?? 'Próximo Evento');
    setSubtitulo(item.subtitulo || '');
    setFechaObjetivoLocal(toLocalDatetimeInput(item.fecha_objetivo));
    setTextoFinalizado(item.texto_finalizado || '¡El evento ha comenzado!');
    setMostrarMeses(item.mostrar_meses);
    setImagenUrl(item.imagen_url || '');
    setLogoUrl(item.logo_url || '');
    setPosicionImagen(item.posicion_imagen);
    setPosicionLogo(item.posicion_logo);
    setPosicionConteo(item.posicion_conteo);
    setTipografia(item.tipografia);
    setTamanoTitulo(item.tamano_titulo);
    setColorFondo(item.color_fondo);
    setColorFondoSecundario(item.color_fondo_secundario);
    setUsarGradiente(item.usar_gradiente);
    setColorTexto(item.color_texto);
    setColorAcento(item.color_acento);
    setColorCajaTiempo(item.color_caja_tiempo);
    setColorTextoTiempo(item.color_texto_tiempo);
    setEnlaceUrl(item.enlace_url || '');
    setEnlaceTexto(item.enlace_texto || 'Ver más detalles');
    setActivo(item.activo);
    setFormError(null);
    setShowModal(true);
  };

  const handleUploadAsset = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'imagen' | 'logo'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Selecciona un archivo de imagen válido (PNG, JPG, WebP, SVG).');
      return;
    }
    setFormError(null);
    if (target === 'imagen') setUploadingImage(true);
    else setUploadingLogo(true);

    try {
      const url = await uploadNoticiaMedia(file, target === 'logo' ? 800 : 1600);
      if (target === 'imagen') setImagenUrl(url);
      else setLogoUrl(url);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo subir la imagen seleccionada.');
    } finally {
      if (target === 'imagen') setUploadingImage(false);
      else setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!nombreEvento.trim()) {
      setFormError('El nombre del evento es obligatorio.');
      return;
    }
    if (!fechaObjetivoLocal) {
      setFormError('Debes indicar la fecha y hora exacta del evento.');
      return;
    }
    const targetIsoSv = parseElSalvadorDateTimeInputToIso(fechaObjetivoLocal);
    if (!targetIsoSv) {
      setFormError('La fecha u hora ingresada no es válida.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        nombre_evento: nombreEvento.trim(),
        etiqueta_superior: etiquetaSuperior.trim() || null,
        subtitulo: subtitulo.trim() || null,
        fecha_objetivo: targetIsoSv,
        texto_finalizado: textoFinalizado.trim() || '¡El evento ha comenzado!',
        mostrar_meses: mostrarMeses,
        imagen_url: imagenUrl.trim() || null,
        logo_url: logoUrl.trim() || null,
        posicion_imagen: posicionImagen,
        posicion_logo: posicionLogo,
        posicion_conteo: posicionConteo,
        tipografia,
        tamano_titulo: tamanoTitulo,
        color_fondo: colorFondo,
        color_fondo_secundario: colorFondoSecundario,
        usar_gradiente: usarGradiente,
        color_texto: colorTexto,
        color_acento: colorAcento,
        color_caja_tiempo: colorCajaTiempo,
        color_texto_tiempo: colorTextoTiempo,
        enlace_url: enlaceUrl.trim() || null,
        enlace_texto: enlaceTexto.trim() || 'Ver más detalles',
        activo,
        orden: editingItem ? editingItem.orden : countdowns.length,
        autor_id: user?.id || null,
        updated_at: getElSalvadorIsoTimestamp(),
      };

      if (editingItem) {
        const { error: sbErr } = await supabase
          .from('noticias_countdown')
          .update(payload)
          .eq('id', editingItem.id);

        if (sbErr) {
          await fetch(getApiUrl(`/api/noticias-countdown/${encodeURIComponent(editingItem.id)}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }

        const updatedList = countdowns.map((c) =>
          c.id === editingItem.id ? ({ ...c, ...payload } as NoticiaCountdown) : c
        );
        setCountdowns(updatedList);
        persistCountdownsLocal(updatedList);

        logActivity('update', 'Noticias Countdown', editingItem.id, {
          titulo: payload.nombre_evento,
        }).catch(() => {});
      } else {
        const newId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `cnt_${Date.now()}`;

        const newRecord: NoticiaCountdown = {
          ...payload,
          id: newId,
          created_at: getElSalvadorIsoTimestamp(),
        };

        const { error: sbErr } = await supabase.from('noticias_countdown').insert([newRecord]);

        if (sbErr) {
          await fetch(getApiUrl('/api/noticias-countdown'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRecord),
          }).catch(() => {});
        }

        const updatedList = [...countdowns, newRecord].sort((a, b) => a.orden - b.orden);
        setCountdowns(updatedList);
        persistCountdownsLocal(updatedList);

        logActivity('create', 'Noticias Countdown', newId, {
          titulo: payload.nombre_evento,
        }).catch(() => {});
      }

      setShowModal(false);
    } catch (err: any) {
      setFormError(err?.message || 'Ocurrió un error al guardar el countdown.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (item: NoticiaCountdown) => {
    const nextVal = !item.activo;
    const { error: sbErr } = await supabase
      .from('noticias_countdown')
      .update({ activo: nextVal, updated_at: getElSalvadorIsoTimestamp() })
      .eq('id', item.id);

    if (sbErr) {
      await fetch(getApiUrl(`/api/noticias-countdown/${encodeURIComponent(item.id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nextVal }),
      }).catch(() => {});
    }

    const updated = countdowns.map((c) => (c.id === item.id ? { ...c, activo: nextVal } : c));
    setCountdowns(updated);
    persistCountdownsLocal(updated);
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= countdowns.length) return;

    const reordered = [...countdowns];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    const withOrder = reordered.map((c, idx) => ({ ...c, orden: idx }));
    setCountdowns(withOrder);
    persistCountdownsLocal(withOrder);

    await Promise.all(
      withOrder.map(async (c) => {
        const { error } = await supabase
          .from('noticias_countdown')
          .update({ orden: c.orden })
          .eq('id', c.id);
        if (error) {
          await fetch(getApiUrl(`/api/noticias-countdown/${encodeURIComponent(c.id)}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orden: c.orden }),
          }).catch(() => {});
        }
      })
    );
  };

  const handleDelete = async (item: NoticiaCountdown) => {
    if (!window.confirm(`¿Eliminar permanentemente el countdown "${item.nombre_evento}"?`)) return;

    const { error: sbErr } = await supabase
      .from('noticias_countdown')
      .delete()
      .eq('id', item.id);
    if (sbErr) {
      await fetch(getApiUrl(`/api/noticias-countdown/${encodeURIComponent(item.id)}`), {
        method: 'DELETE',
      }).catch(() => {});
    }

    const updated = countdowns.filter((c) => c.id !== item.id);
    setCountdowns(updated);
    persistCountdownsLocal(updated);

    logActivity('delete', 'Noticias Countdown', item.id, {
      titulo: item.nombre_evento,
    }).catch(() => {});
  };

  // Live preview object inside Create/Edit modal
  const livePreviewItem: NoticiaCountdown = {
    id: editingItem?.id || 'preview',
    nombre_evento: nombreEvento.trim() || 'Nombre del Evento Institucional',
    etiqueta_superior: etiquetaSuperior.trim() || null,
    subtitulo: subtitulo.trim() || null,
    fecha_objetivo:
      parseElSalvadorDateTimeInputToIso(fechaObjetivoLocal) ||
      getElSalvadorIsoTimestamp(new Date(Date.now() + 14 * 86400000)),
    texto_finalizado: textoFinalizado.trim() || '¡El evento ha comenzado!',
    mostrar_meses: mostrarMeses,
    imagen_url: imagenUrl.trim() || null,
    logo_url: logoUrl.trim() || null,
    posicion_imagen: posicionImagen,
    posicion_logo: posicionLogo,
    posicion_conteo: posicionConteo,
    tipografia,
    tamano_titulo: tamanoTitulo,
    color_fondo: colorFondo,
    color_fondo_secundario: colorFondoSecundario,
    usar_gradiente: usarGradiente,
    color_texto: colorTexto,
    color_acento: colorAcento,
    color_caja_tiempo: colorCajaTiempo,
    color_texto_tiempo: colorTextoTiempo,
    enlace_url: enlaceUrl.trim() || null,
    enlace_texto: enlaceTexto.trim() || 'Ver más detalles',
    activo: true,
    orden: 0,
  };

  return (
    <div className="space-y-6">
      {/* Ajustes Generales del Banner Countdown */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-emerald-700" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Banner Countdown de Eventos (Debajo del Banner Slider)
              </h2>
              <p className="text-xs text-slate-500">
                Crea uno o varios conteos regresivos con fecha, hora, meses, días, imagen, logo, tipografía y colores propios.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {configFeedback && (
              <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1 mr-1">
                <Check className="w-3.5 h-3.5" />
                {configFeedback}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span>Script SQL Countdown</span>
            </button>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
              title="Recargar countdowns"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Countdown</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Activar / Desactivar */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Mostrar Banner Countdown en Dashboard</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {config.activo
                  ? 'Visible debajo del Banner Slider de Noticias'
                  : 'Oculto temporalmente del Dashboard'}
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

          {/* Disposición para múltiples eventos */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Disposición con 2 o más eventos</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {config.layout === 'grid'
                  ? 'Cuadrícula adaptable (2 por fila en escritorio)'
                  : 'Banners apilados a todo lo ancho'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200">
              <button
                type="button"
                disabled={!canEdit || savingConfig}
                onClick={() => handleSaveGlobalConfig({ ...config, layout: 'grid' })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  config.layout === 'grid'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cuadrícula</span>
              </button>
              <button
                type="button"
                disabled={!canEdit || savingConfig}
                onClick={() => handleSaveGlobalConfig({ ...config, layout: 'stack' })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  config.layout === 'stack'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Rows className="w-3.5 h-3.5" />
                <span>Apilados</span>
              </button>
            </div>
          </div>
        </div>

        {/* Vista Previa Responsive */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Vista previa en vivo ({countdowns.filter((c) => c.activo).length} countdown(s) activos)
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

          {config.activo && countdowns.some((c) => c.activo) ? (
            <CountdownBannerSection
              countdowns={countdowns}
              config={config}
              previewMode={previewMode}
              disableNavigation
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-xs text-slate-500">
              {!config.activo
                ? 'El Banner Countdown está desactivado. Actívalo arriba para mostrarlo debajo del Banner Slider.'
                : 'No hay eventos countdown activos aún. Haz clic en "Nuevo Countdown" para crear el primero.'}
            </div>
          )}
        </div>
      </section>

      {/* Lista de Countdowns Configurados */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Eventos Countdown Configurados ({countdowns.length})
          </h2>
          <span className="text-xs text-slate-500">
            Puedes tener 2 o más eventos activos simultáneamente
          </span>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
            Cargando eventos countdown...
          </div>
        ) : countdowns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
            <Clock className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-800">Aún no hay ningún countdown configurado</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Crea un banner countdown para aniversarios, capacitaciones, operativos especiales o eventos institucionales.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Primer Countdown</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {countdowns.map((item, idx) => {
              const dateText = formatFechaHoraSV(item.fecha_objetivo, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }) || 'Fecha inválida';

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all ${
                    item.activo ? 'border-slate-200 shadow-2xs' : 'border-slate-200/70 bg-slate-50/70 opacity-75'
                  }`}
                >
                  {/* Color & Preview Swatch */}
                  <div
                    style={{
                      background: item.usar_gradiente
                        ? `linear-gradient(135deg, ${item.color_fondo}, ${item.color_fondo_secundario})`
                        : item.color_fondo,
                    }}
                    className="w-full md:w-44 h-20 rounded-xl border border-slate-200/70 p-3 flex items-center justify-between gap-2 shrink-0 overflow-hidden"
                  >
                    {item.logo_url ? (
                      <img
                        src={item.logo_url}
                        alt={item.nombre_evento}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 object-contain rounded bg-white/10 p-1 shrink-0"
                      />
                    ) : (
                      <Calendar className="w-6 h-6 shrink-0" style={{ color: item.color_acento }} />
                    )}
                    <div className="min-w-0 flex-1 text-right">
                      <p
                        className="text-[10px] font-bold uppercase truncate"
                        style={{ color: item.color_acento }}
                      >
                        {item.tipografia}
                      </p>
                      <p
                        className="text-xs font-extrabold truncate"
                        style={{ color: item.color_texto }}
                      >
                        {item.nombre_evento}
                      </p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums font-bold text-slate-700">#{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span className={item.activo ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                        {item.activo ? 'Activo' : 'Desactivado'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {dateText}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 truncate">{item.nombre_evento}</h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Imagen: {item.posicion_imagen} · Logo: {item.posicion_logo} · Conteo: {item.posicion_conteo}
                    </p>
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, -1)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-35 cursor-pointer"
                        title="Subir orden"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === countdowns.length - 1}
                        onClick={() => handleMove(idx, 1)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-35 cursor-pointer"
                        title="Bajar orden"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(item)}
                        className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                          item.activo
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                        }`}
                        title={item.activo ? 'Desactivar countdown' : 'Activar countdown'}
                      >
                        {item.activo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item, true)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                        title="Duplicar estilo para otro evento"
                      >
                        <CopyPlus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item, false)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 cursor-pointer"
                        title="Editar countdown"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer"
                        title="Eliminar countdown"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL CREAR / EDITAR COUNTDOWN */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-4 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingItem ? 'Editar Banner Countdown' : 'Crear Nuevo Banner Countdown'}
                </h2>
                <p className="text-xs text-slate-500">
                  Configura el evento, fecha/hora, imágenes, posiciones (izquierda, medio, derecha), tipografía y colores.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-6 max-h-[84vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
                  {formError}
                </div>
              )}

              {/* Vista previa en vivo del diseño actual */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Vista previa en vivo
                </span>
                <CountdownBannerSection
                  countdowns={[livePreviewItem]}
                  config={{ activo: true, layout: 'stack' }}
                  disableNavigation
                />
              </div>

              {/* 1. Datos del Evento y Fecha/Hora */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  1. Información del Evento y Fecha Objetivo
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Nombre del Evento *
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreEvento}
                      onChange={(e) => setNombreEvento(e.target.value)}
                      placeholder="Ej: Aniversario Cruz Verde Salvadoreña 2026"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Etiqueta superior (opcional)
                    </label>
                    <input
                      type="text"
                      value={etiquetaSuperior}
                      onChange={(e) => setEtiquetaSuperior(e.target.value)}
                      placeholder="Ej: Próximo Evento"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Descripción o lugar breve (opcional)
                    </label>
                    <input
                      type="text"
                      value={subtitulo}
                      onChange={(e) => setSubtitulo(e.target.value)}
                      placeholder="Ej: Plaza Central · Convocatoria nacional de seccionales"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Fecha y Hora del Evento *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={fechaObjetivoLocal}
                      onChange={(e) => setFechaObjetivoLocal(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm font-mono bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Mensaje al llegar a cero
                    </label>
                    <input
                      type="text"
                      value={textoFinalizado}
                      onChange={(e) => setTextoFinalizado(e.target.value)}
                      placeholder="¡El evento ha comenzado!"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Enlace opcional (al botón)
                    </label>
                    <input
                      type="text"
                      value={enlaceUrl}
                      onChange={(e) => setEnlaceUrl(e.target.value)}
                      placeholder="/noticias/ver/... o https://..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs font-semibold text-slate-800">
                      Mostrar Meses en conteo
                    </span>
                    <button
                      type="button"
                      onClick={() => setMostrarMeses((v) => !v)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                        mostrarMeses
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {mostrarMeses ? 'Sí' : 'Solo días'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Imagen, Logo y Ubicación (Izquierda / En medio / Derecha) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Imagen, Logo y Posición en el Banner
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Imagen del Evento */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Imagen del Evento (Opcional)</span>
                      {imagenUrl && (
                        <button
                          type="button"
                          onClick={() => setImagenUrl('')}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Quitar imagen
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 hover:bg-emerald-50 text-xs font-semibold text-emerald-800 cursor-pointer">
                        {uploadingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{uploadingImage ? 'Subiendo...' : 'Subir Imagen'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadAsset(e, 'imagen')}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        value={imagenUrl}
                        onChange={(e) => setImagenUrl(e.target.value)}
                        placeholder="O pega URL de imagen (https://...)"
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Logo del Evento */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Logo del Evento / Emblema (Opcional)</span>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Quitar logo
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 hover:bg-emerald-50 text-xs font-semibold text-emerald-800 cursor-pointer">
                        {uploadingLogo ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{uploadingLogo ? 'Subiendo...' : 'Subir Logo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadAsset(e, 'logo')}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="O pega URL del logo (https://...)"
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Selectores de Posición */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <PositionSelector
                    label="Posición de la Imagen"
                    value={posicionImagen}
                    onChange={setPosicionImagen}
                  />
                  <PositionSelector
                    label="Posición del Logo y Texto"
                    value={posicionLogo}
                    onChange={setPosicionLogo}
                  />
                  <PositionSelector
                    label="Posición del Conteo (Reloj)"
                    value={posicionConteo}
                    onChange={setPosicionConteo}
                  />
                </div>
              </div>

              {/* 3. Tipografía y Colores */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-emerald-700" />
                    3. Tipografía, Tamaño y Colores
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">Tamaño título:</span>
                    {(['sm', 'md', 'lg'] as CountdownTitleSize[]).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setTamanoTitulo(sz)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          tamanoTitulo === sz
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {sz === 'sm' ? 'Compacto' : sz === 'md' ? 'Normal' : 'Grande'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipografías */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {COUNTDOWN_FONT_OPTIONS.map((font) => (
                    <button
                      key={font.key}
                      type="button"
                      onClick={() => setTipografia(font.key)}
                      style={{ fontFamily: font.cssFamily }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        tipografia === font.key
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <p className="text-xs font-bold truncate">{font.label}</p>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          tipografia === font.key ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {font.sample}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Paletas Rápidas */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 inline-flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-emerald-700" />
                    Paletas rápidas (puedes ajustar cada color abajo):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {COUNTDOWN_THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyThemePreset(preset.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${preset.color_fondo}, ${preset.color_fondo_secundario})`,
                          }}
                        />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selectores de color individuales */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                  <ColorInput label="Fondo principal" value={colorFondo} onChange={setColorFondo} />
                  <ColorInput
                    label="Fondo degradado"
                    value={colorFondoSecundario}
                    onChange={setColorFondoSecundario}
                  />
                  <ColorInput label="Texto principal" value={colorTexto} onChange={setColorTexto} />
                  <ColorInput label="Color acento" value={colorAcento} onChange={setColorAcento} />
                  <ColorInput
                    label="Cajas de tiempo"
                    value={colorCajaTiempo}
                    onChange={setColorCajaTiempo}
                  />
                  <ColorInput
                    label="Dígitos reloj"
                    value={colorTextoTiempo}
                    onChange={setColorTextoTiempo}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usarGradiente}
                      onChange={(e) => setUsarGradiente(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span>Usar fondo con degradado suave</span>
                  </label>

                  {enlaceUrl.trim() && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-600">Texto del botón:</span>
                      <input
                        type="text"
                        value={enlaceTexto}
                        onChange={(e) => setEnlaceTexto(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Estado */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                <div>
                  <p className="text-xs font-bold text-slate-900">Estado del Countdown</p>
                  <p className="text-[11px] text-slate-500">
                    Si está activo aparecerá en el Dashboard debajo del Banner Slider.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivo((v) => !v)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                    activo
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {activo ? 'Activo' : 'Inactivo (Borrador)'}
                </button>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage || uploadingLogo}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {saving ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Publicar Countdown'}
                  </span>
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
                    Script SQL para Supabase: Banner Countdown (Migración 41)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ejecuta este script en el SQL Editor de Supabase para crear la tabla noticias_countdown y sus políticas.
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
                {SQL_MIGRATION_41}
              </pre>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_MIGRATION_41);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2500);
                  }}
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
