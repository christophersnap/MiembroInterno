import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Plus, Bell, AlertTriangle, AlertCircle, CheckCircle2, 
  Calendar, Clock, Download, ExternalLink, Eye, EyeOff, Edit3, 
  Trash2, Search, Filter, RefreshCw, FileText, Upload, X, Copy, Check, 
  Sparkles, SlidersHorizontal, CheckSquare, Square, ArrowRight, ShieldAlert,
  Info, ShieldCheck, Flame, Volume2, Globe, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';

export interface AnuncioItem {
  id: string;
  titulo: string;
  contenido: string;
  tipo: 'info' | 'alerta' | 'urgente' | 'exito' | 'evento';
  prioridad?: number;
  mostrar_cuadro_dashboard: boolean;
  mostrar_ticker_dashboard: boolean;
  activo: boolean;
  fecha_expiracion?: string | null;
  enlace_url?: string | null;
  enlace_texto?: string | null;
  imagen_url?: string | null;
  archivo_nombre?: string | null;
  archivo_url?: string | null;
  archivo_tamano?: string | null;
  autor_id?: string;
  autor_nombre?: string;
  vistas_count?: number;
  created_at?: string;
  updated_at?: string;
}

const TIPOS_ANUNCIO = [
  { value: 'info', label: 'Informativo', icon: Info, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  { value: 'alerta', label: 'Alerta Operativa', icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  { value: 'urgente', label: 'Urgente / Emergencia', icon: Flame, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-800' },
  { value: 'exito', label: 'Logro / Reconocimiento', icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
  { value: 'evento', label: 'Convocatoria / Evento', icon: Calendar, bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800' },
];

export default function Anuncios() {
  const { user, userName, role, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const canPublish = isAdmin || Boolean(permissions?.crear_anuncios);

  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [selectedEstado, setSelectedEstado] = useState<'todos' | 'activos' | 'inactivos' | 'expirados'>('todos');
  const [selectedUbicacion, setSelectedUbicacion] = useState<'todos' | 'cuadro' | 'ticker'>('todos');

  // Modal Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [editingAnuncio, setEditingAnuncio] = useState<AnuncioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Formulario
  const [formTitulo, setFormTitulo] = useState('');
  const [formContenido, setFormContenido] = useState('');
  const [formTipo, setFormTipo] = useState<'info' | 'alerta' | 'urgente' | 'exito' | 'evento'>('info');
  const [formMostrarCuadro, setFormMostrarCuadro] = useState(true);
  const [formMostrarTicker, setFormMostrarTicker] = useState(true);
  const [formActivo, setFormActivo] = useState(true);
  const [formExpPreset, setFormExpPreset] = useState<'nunca' | '1d' | '3d' | '7d' | '15d' | '30d' | 'custom'>('nunca');
  const [formFechaExp, setFormFechaExp] = useState('');
  const [formEnlaceUrl, setFormEnlaceUrl] = useState('');
  const [formEnlaceTexto, setFormEnlaceTexto] = useState('Más información');
  
  // Imagen destacada / Banner del anuncio
  const [formImagenUrl, setFormImagenUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageToUpload, setSelectedImageToUpload] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Archivo adjunto
  const [formArchivoNombre, setFormArchivoNombre] = useState('');
  const [formArchivoUrl, setFormArchivoUrl] = useState('');
  const [formArchivoTamano, setFormArchivoTamano] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFileToUpload, setSelectedFileToUpload] = useState<File | null>(null);

  // Modal Previsualización Dashboard
  const [previewAnuncio, setPreviewAnuncio] = useState<AnuncioItem | null>(null);

  // Modal SQL
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    fetchAnuncios();
  }, []);

  const fetchAnuncios = async () => {
    setLoading(true);
    try {
      // 1. Intentar Supabase
      const { data, error } = await supabase
        .from('anuncios')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setAnuncios(data);
        setLoading(false);
        return;
      }

      // 2. Intentar API local
      const res = await fetch('/api/anuncios');
      if (res.ok) {
        const localData = await res.json();
        if (localData && localData.length > 0) {
          setAnuncios(localData);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback localStorage si no hay datos
      const stored = localStorage.getItem('cv_anuncios_local');
      if (stored) {
        setAnuncios(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Error al cargar anuncios, revisando almacenamiento local:', err);
      const stored = localStorage.getItem('cv_anuncios_local');
      if (stored) {
        setAnuncios(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateExpirationDate = (preset: string): string | null => {
    if (preset === 'nunca') return null;
    const now = new Date();
    if (preset === '1d') now.setDate(now.getDate() + 1);
    else if (preset === '3d') now.setDate(now.getDate() + 3);
    else if (preset === '7d') now.setDate(now.getDate() + 7);
    else if (preset === '15d') now.setDate(now.getDate() + 15);
    else if (preset === '30d') now.setDate(now.getDate() + 30);
    else if (preset === 'custom' && formFechaExp) return new Date(formFechaExp).toISOString();
    return now.toISOString();
  };

  const handleOpenCreateModal = () => {
    setEditingAnuncio(null);
    setFormTitulo('');
    setFormContenido('');
    setFormTipo('info');
    setFormMostrarCuadro(true);
    setFormMostrarTicker(true);
    setFormActivo(true);
    setFormExpPreset('nunca');
    setFormFechaExp('');
    setFormEnlaceUrl('');
    setFormEnlaceTexto('Más información');
    setFormImagenUrl('');
    setSelectedImageToUpload(null);
    setImagePreviewUrl(null);
    setFormArchivoNombre('');
    setFormArchivoUrl('');
    setFormArchivoTamano('');
    setSelectedFileToUpload(null);
    setSaveError(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (anuncio: AnuncioItem) => {
    setEditingAnuncio(anuncio);
    setFormTitulo(anuncio.titulo);
    setFormContenido(anuncio.contenido);
    setFormTipo(anuncio.tipo);
    setFormMostrarCuadro(anuncio.mostrar_cuadro_dashboard ?? true);
    setFormMostrarTicker(anuncio.mostrar_ticker_dashboard ?? true);
    setFormActivo(anuncio.activo ?? true);
    
    if (anuncio.fecha_expiracion) {
      setFormExpPreset('custom');
      // format for datetime-local
      const d = new Date(anuncio.fecha_expiracion);
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setFormFechaExp(iso);
    } else {
      setFormExpPreset('nunca');
      setFormFechaExp('');
    }

    setFormEnlaceUrl(anuncio.enlace_url || '');
    setFormEnlaceTexto(anuncio.enlace_texto || 'Más información');
    setFormImagenUrl(anuncio.imagen_url || '');
    setSelectedImageToUpload(null);
    setImagePreviewUrl(anuncio.imagen_url || null);
    setFormArchivoNombre(anuncio.archivo_nombre || '');
    setFormArchivoUrl(anuncio.archivo_url || '');
    setFormArchivoTamano(anuncio.archivo_tamano || '');
    setSelectedFileToUpload(null);
    setSaveError(null);
    setShowModal(true);
  };

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const json = await res.json();
        return json.url;
      }

      // Fallback Supabase Storage
      const cleanFileName = `img_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: storageError } = await supabase.storage
        .from('socorristas')
        .upload(`anuncios/${cleanFileName}`, file, { cacheControl: '3600', upsert: true });

      if (!storageError) {
        const { data: pubData } = supabase.storage
          .from('socorristas')
          .getPublicUrl(`anuncios/${cleanFileName}`);
        return pubData.publicUrl;
      }

      return URL.createObjectURL(file);
    } catch (err) {
      console.error('Error subiendo imagen de anuncio:', err);
      return URL.createObjectURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadAttachment = async (file: File): Promise<{ url: string; name: string; size: string } | null> => {
    setUploadingFile(true);
    try {
      // 1. Intentar endpoint local /api/upload-file
      const formData = new FormData();
      formData.append('archivo', file);
      
      const res = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const json = await res.json();
        return {
          url: json.url,
          name: json.originalName || file.name,
          size: json.tamanoLegible || `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        };
      }

      // 2. Intentar Supabase Storage
      const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: storageError } = await supabase.storage
        .from('socorristas')
        .upload(`anuncios/${cleanFileName}`, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (!storageError) {
        const { data: pubData } = supabase.storage
          .from('socorristas')
          .getPublicUrl(`anuncios/${cleanFileName}`);

        return {
          url: pubData.publicUrl,
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        };
      }

      throw new Error('No se pudo subir el archivo adjunto');
    } catch (err: any) {
      console.error('Error subiendo adjunto:', err);
      // Fallback: objeto temporal base64 o simulado
      return {
        url: URL.createObjectURL(file),
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      };
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveAnuncio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim() || !formContenido.trim()) {
      setSaveError('Por favor complete el título y sobre qué trata el anuncio');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      let finalArchivoUrl = formArchivoUrl;
      let finalArchivoNombre = formArchivoNombre;
      let finalArchivoTamano = formArchivoTamano;

      // Si seleccionó un archivo descargable nuevo para subir
      if (selectedFileToUpload) {
        const uploadRes = await handleUploadAttachment(selectedFileToUpload);
        if (uploadRes) {
          finalArchivoUrl = uploadRes.url;
          finalArchivoNombre = uploadRes.name;
          finalArchivoTamano = uploadRes.size;
        }
      }

      // Si seleccionó una imagen destacada nueva para subir
      let finalImagenUrl = formImagenUrl;
      if (selectedImageToUpload) {
        const imgUrlRes = await handleUploadImage(selectedImageToUpload);
        if (imgUrlRes) {
          finalImagenUrl = imgUrlRes;
        }
      }

      const calculatedExp = calculateExpirationDate(formExpPreset);

      const anuncioData: Partial<AnuncioItem> = {
        titulo: formTitulo.trim(),
        contenido: formContenido.trim(),
        tipo: formTipo,
        mostrar_cuadro_dashboard: formMostrarCuadro,
        mostrar_ticker_dashboard: formMostrarTicker,
        activo: formActivo,
        fecha_expiracion: calculatedExp,
        enlace_url: formEnlaceUrl.trim() || null,
        enlace_texto: formEnlaceTexto.trim() || 'Más información',
        imagen_url: finalImagenUrl.trim() || null,
        archivo_nombre: finalArchivoNombre.trim() || null,
        archivo_url: finalArchivoUrl.trim() || null,
        archivo_tamano: finalArchivoTamano.trim() || null,
        autor_id: user?.id,
        autor_nombre: 'Cruz Verde Salvadoreña',
        updated_at: new Date().toISOString()
      };

      if (editingAnuncio) {
        // Actualizar en Supabase
        const { error: sbError } = await supabase
          .from('anuncios')
          .update(anuncioData)
          .eq('id', editingAnuncio.id);

        if (sbError) {
          // Fallback a API local
          await fetch(`/api/anuncios/${editingAnuncio.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(anuncioData)
          });
        }

        // Actualizar estado local
        const updatedList = anuncios.map(a => a.id === editingAnuncio.id ? { ...a, ...anuncioData } as AnuncioItem : a);
        setAnuncios(updatedList);
        localStorage.setItem('cv_anuncios_local', JSON.stringify(updatedList));

        logActivity('update', 'Anuncios', editingAnuncio.id, {
          titulo: formTitulo,
          detalles: `Actualizó el anuncio "${formTitulo}"`
        });
      } else {
        // Crear nuevo
        const newId = crypto.randomUUID ? crypto.randomUUID() : `anuncio_${Date.now()}`;
        const newRecord: AnuncioItem = {
          ...anuncioData as any,
          id: newId,
          vistas_count: 0,
          created_at: new Date().toISOString()
        };

        const { error: sbError } = await supabase
          .from('anuncios')
          .insert([newRecord]);

        if (sbError) {
          // Fallback a API local
          await fetch('/api/anuncios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRecord)
          });
        }

        const updatedList = [newRecord, ...anuncios];
        setAnuncios(updatedList);
        localStorage.setItem('cv_anuncios_local', JSON.stringify(updatedList));

        logActivity('create', 'Anuncios', newId, {
          titulo: formTitulo,
          detalles: `Publicó nuevo anuncio institucional: "${formTitulo}"`
        });
      }

      setShowModal(false);
    } catch (err: any) {
      console.error('Error al guardar anuncio:', err);
      setSaveError(err.message || 'Error al guardar el anuncio');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (anuncio: AnuncioItem) => {
    const nuevoEstado = !anuncio.activo;
    try {
      await supabase.from('anuncios').update({ activo: nuevoEstado }).eq('id', anuncio.id);
      await fetch(`/api/anuncios/${anuncio.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoEstado })
      }).catch(() => {});

      const updated = anuncios.map(a => a.id === anuncio.id ? { ...a, activo: nuevoEstado } : a);
      setAnuncios(updated);
      localStorage.setItem('cv_anuncios_local', JSON.stringify(updated));

      logActivity('update', 'Anuncios', anuncio.id, {
        detalles: `${nuevoEstado ? 'Activó' : 'Desactivó'} anuncio "${anuncio.titulo}"`,
        activo: nuevoEstado
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleCuadroDashboard = async (anuncio: AnuncioItem) => {
    const val = !anuncio.mostrar_cuadro_dashboard;
    try {
      await supabase.from('anuncios').update({ mostrar_cuadro_dashboard: val }).eq('id', anuncio.id);
      await fetch(`/api/anuncios/${anuncio.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mostrar_cuadro_dashboard: val })
      }).catch(() => {});

      const updated = anuncios.map(a => a.id === anuncio.id ? { ...a, mostrar_cuadro_dashboard: val } : a);
      setAnuncios(updated);
      localStorage.setItem('cv_anuncios_local', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTickerDashboard = async (anuncio: AnuncioItem) => {
    const val = !anuncio.mostrar_ticker_dashboard;
    try {
      await supabase.from('anuncios').update({ mostrar_ticker_dashboard: val }).eq('id', anuncio.id);
      await fetch(`/api/anuncios/${anuncio.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mostrar_ticker_dashboard: val })
      }).catch(() => {});

      const updated = anuncios.map(a => a.id === anuncio.id ? { ...a, mostrar_ticker_dashboard: val } : a);
      setAnuncios(updated);
      localStorage.setItem('cv_anuncios_local', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAnuncio = async (id: string, titulo: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el anuncio "${titulo}"?`)) return;

    try {
      await supabase.from('anuncios').delete().eq('id', id);
      await fetch(`/api/anuncios/${id}`, { method: 'DELETE' }).catch(() => {});

      const updated = anuncios.filter(a => a.id !== id);
      setAnuncios(updated);
      localStorage.setItem('cv_anuncios_local', JSON.stringify(updated));

      logActivity('delete', 'Anuncios', id, {
        titulo,
        detalles: `Eliminó el anuncio "${titulo}"`
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Filtrado
  const now = new Date();
  const filteredAnuncios = anuncios.filter(a => {
    const matchesSearch = 
      a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.contenido.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = selectedTipo === 'todos' || a.tipo === selectedTipo;

    const isExpired = a.fecha_expiracion ? new Date(a.fecha_expiracion) < now : false;
    let matchesEstado = true;
    if (selectedEstado === 'activos') matchesEstado = a.activo && !isExpired;
    else if (selectedEstado === 'inactivos') matchesEstado = !a.activo;
    else if (selectedEstado === 'expirados') matchesEstado = isExpired;

    let matchesUbicacion = true;
    if (selectedUbicacion === 'cuadro') matchesUbicacion = !!a.mostrar_cuadro_dashboard;
    else if (selectedUbicacion === 'ticker') matchesUbicacion = !!a.mostrar_ticker_dashboard;

    return matchesSearch && matchesTipo && matchesEstado && matchesUbicacion;
  });

  // Estadísticas rápidas
  const totalActivos = anuncios.filter(a => a.activo && (!a.fecha_expiracion || new Date(a.fecha_expiracion) >= now)).length;
  const totalCuadro = anuncios.filter(a => a.activo && a.mostrar_cuadro_dashboard && (!a.fecha_expiracion || new Date(a.fecha_expiracion) >= now)).length;
  const totalTicker = anuncios.filter(a => a.activo && a.mostrar_ticker_dashboard && (!a.fecha_expiracion || new Date(a.fecha_expiracion) >= now)).length;
  const totalConAdjuntos = anuncios.filter(a => !!a.archivo_url).length;

  const copySqlScript = () => {
    const sqlText = `-- Migración SQL para Anuncios, Imágenes y Archivos
CREATE TABLE IF NOT EXISTS public.anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'info',
  prioridad INTEGER DEFAULT 1,
  mostrar_cuadro_dashboard BOOLEAN DEFAULT true,
  mostrar_ticker_dashboard BOOLEAN DEFAULT true,
  activo BOOLEAN DEFAULT true,
  fecha_expiracion TIMESTAMPTZ,
  enlace_url TEXT,
  enlace_texto TEXT DEFAULT 'Más información',
  imagen_url TEXT,
  archivo_nombre TEXT,
  archivo_url TEXT,
  archivo_tamano TEXT,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre TEXT,
  vistas_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migración idónea si la tabla ya existía previamente en Supabase
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS imagen_url TEXT;

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados pueden ver anuncios" ON public.anuncios FOR SELECT TO authenticated USING (activo = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin y autorizados pueden insertar anuncios" ON public.anuncios FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));`;
    navigator.clipboard.writeText(sqlText);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="p-3.5 bg-primary/10 rounded-2xl text-primary flex-shrink-0">
            <Megaphone className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Gestión de Anuncios y Noticias
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Oficial CVS
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 max-w-2xl">
              Publica avisos institucionales, boletines urgentes, adjunta documentos descargables y configura si se mostrarán en el Dashboard como cuadro de notificación o en la línea de texto deslizante.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowSqlModal(true)}
            className="inline-flex items-center px-3.5 py-2.5 border border-gray-300 shadow-sm text-xs font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <ShieldAlert className="w-4 h-4 mr-2 text-primary" />
            Script SQL (Base de Datos)
          </button>

          <button
            onClick={fetchAnuncios}
            disabled={loading}
            className="inline-flex items-center p-2.5 border border-gray-300 shadow-sm text-xs font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-all"
            title="Recargar anuncios"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : 'text-gray-500'}`} />
          </button>

          {canPublish && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center px-5 py-2.5 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary-hover transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <Plus className="w-4 h-4 mr-2 stroke-[2.5]" />
              Publicar Anuncio
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen y KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Anuncios</p>
            <h3 className="text-2xl font-black text-gray-900 mt-1">{anuncios.length}</h3>
            <p className="text-2xs text-gray-500 mt-0.5">{totalActivos} activos actualmente</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Megaphone className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">En Cuadro Dashboard</p>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{totalCuadro}</h3>
            <p className="text-2xs text-emerald-600 mt-0.5">Notificación con botón de cierre (X)</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Bell className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Línea de Texto / Slider</p>
            <h3 className="text-2xl font-black text-purple-700 mt-1">{totalTicker}</h3>
            <p className="text-2xs text-purple-600 mt-0.5">Cinta de titulares en tiempo real</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Volume2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Con Archivo Adjunto</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1">{totalConAdjuntos}</h3>
            <p className="text-2xs text-gray-500 mt-0.5">PDF, formatos y documentos descargables</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Download className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título o contenido del anuncio..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent placeholder-gray-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-primary focus:border-primary"
            >
              <option value="todos">Todos los Tipos</option>
              <option value="info">Informativo</option>
              <option value="alerta">Alerta Operativa</option>
              <option value="urgente">Urgente / Emergencia</option>
              <option value="exito">Logro / Éxito</option>
              <option value="evento">Evento / Convocatoria</option>
            </select>

            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value as any)}
              className="px-3 py-2 text-xs font-medium border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-primary focus:border-primary"
            >
              <option value="todos">Todos los Estados</option>
              <option value="activos">Solo Activos y Vigentes</option>
              <option value="inactivos">Desactivados</option>
              <option value="expirados">Vencidos / Expirados</option>
            </select>

            <select
              value={selectedUbicacion}
              onChange={(e) => setSelectedUbicacion(e.target.value as any)}
              className="px-3 py-2 text-xs font-medium border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-primary focus:border-primary"
            >
              <option value="todos">Toda Ubicación</option>
              <option value="cuadro">En Cuadro Dashboard</option>
              <option value="ticker">En Línea de Noticias</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Anuncios */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-3 text-sm text-gray-500 font-medium">Cargando anuncios institucionales...</p>
        </div>
      ) : filteredAnuncios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No se encontraron anuncios</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedTipo !== 'todos' || selectedEstado !== 'todos'
              ? 'Prueba modificando los filtros de búsqueda aplicados.'
              : 'Aún no se han publicado anuncios. Comienza publicando el primero con el botón superior.'}
          </p>
          {canPublish && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center px-4 py-2 text-xs font-bold rounded-xl text-white bg-primary hover:bg-primary-hover shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Publicar Primer Anuncio
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAnuncios.map((anuncio) => {
            const tipoConfig = TIPOS_ANUNCIO.find(t => t.value === anuncio.tipo) || TIPOS_ANUNCIO[0];
            const TipoIcon = tipoConfig.icon;
            const isExpired = anuncio.fecha_expiracion ? new Date(anuncio.fecha_expiracion) < now : false;

            return (
              <div 
                key={anuncio.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  !anuncio.activo 
                    ? 'border-gray-200 opacity-60 bg-gray-50/50' 
                    : isExpired 
                      ? 'border-amber-200 bg-amber-50/20' 
                      : 'border-gray-200 hover:border-primary/40'
                }`}
              >
                <div className="p-5 sm:p-6">
                  {/* Fila superior: Tipo, Estado de expiración, Acciones */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${tipoConfig.border} ${tipoConfig.bg} ${tipoConfig.text}`}>
                        <TipoIcon className="w-3.5 h-3.5 mr-1.5" />
                        {tipoConfig.label}
                      </span>

                      {anuncio.activo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3 mr-1" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-gray-200 text-gray-700">
                          <X className="w-3 h-3 mr-1" />
                          Desactivado
                        </span>
                      )}

                      {isExpired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 mr-1" />
                          Vencido
                        </span>
                      ) : anuncio.fecha_expiracion ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3 mr-1" />
                          Vence: {new Date(anuncio.fecha_expiracion).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium text-gray-500">
                          Sin expiración
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setPreviewAnuncio(anuncio)}
                        className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ver cómo se ve en el Dashboard"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {canPublish && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(anuncio)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar anuncio"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteAnuncio(anuncio.id, anuncio.titulo)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar anuncio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Título y Contenido */}
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">
                    {anuncio.titulo}
                  </h3>

                  {/* Imagen ilustrativa / Banner si existe */}
                  {anuncio.imagen_url && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 shadow-2xs group-hover:border-gray-200 transition-colors">
                      <img 
                        src={anuncio.imagen_url} 
                        alt={anuncio.titulo}
                        className="w-full h-44 sm:h-52 object-cover object-center group-hover:scale-[1.01] transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  )}

                  <p className="mt-2 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                    {anuncio.contenido}
                  </p>

                  {/* Enlace o Archivo adjunto si existen */}
                  {(anuncio.enlace_url || anuncio.archivo_url) && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                      {anuncio.archivo_url && (
                        <a
                          href={anuncio.archivo_url}
                          download={anuncio.archivo_nombre || 'archivo_anuncio'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          <span>Descargar: {anuncio.archivo_nombre || 'Documento Adjunto'}</span>
                          {anuncio.archivo_tamano && (
                            <span className="ml-1.5 text-2xs text-emerald-600 font-normal">({anuncio.archivo_tamano})</span>
                          )}
                        </a>
                      )}

                      {anuncio.enlace_url && (
                        <a
                          href={anuncio.enlace_url}
                          target={anuncio.enlace_url.startsWith('http') ? '_blank' : '_self'}
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                          <span>{anuncio.enlace_texto || 'Enlace de Redirección'}</span>
                          <ExternalLink className="w-3 h-3 ml-1 text-blue-500" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Controles de visualización en Dashboard y Ticker */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Control Cuadro Notificación */}
                      <label className="inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={anuncio.mostrar_cuadro_dashboard}
                          onChange={() => handleToggleCuadroDashboard(anuncio)}
                          className="sr-only"
                        />
                        <div className={`w-8 h-4 rounded-full transition-colors relative mr-2 ${anuncio.mostrar_cuadro_dashboard ? 'bg-primary' : 'bg-gray-300'}`}>
                          <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${anuncio.mostrar_cuadro_dashboard ? 'left-4.5' : 'left-0.5'}`} />
                        </div>
                        <span className={`text-xs font-medium ${anuncio.mostrar_cuadro_dashboard ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                          Cuadro Dashboard (con X)
                        </span>
                      </label>

                      {/* Control Slider de Noticias / Ticker */}
                      <label className="inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={anuncio.mostrar_ticker_dashboard}
                          onChange={() => handleToggleTickerDashboard(anuncio)}
                          className="sr-only"
                        />
                        <div className={`w-8 h-4 rounded-full transition-colors relative mr-2 ${anuncio.mostrar_ticker_dashboard ? 'bg-purple-600' : 'bg-gray-300'}`}>
                          <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${anuncio.mostrar_ticker_dashboard ? 'left-4.5' : 'left-0.5'}`} />
                        </div>
                        <span className={`text-xs font-medium ${anuncio.mostrar_ticker_dashboard ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                          Línea de Texto (Slider)
                        </span>
                      </label>

                      {/* Control Activo General */}
                      <button
                        onClick={() => handleToggleActivo(anuncio)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-bold transition-colors ${
                          anuncio.activo
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                        }`}
                      >
                        {anuncio.activo ? 'Desactivar Anuncio' : 'Activar Anuncio'}
                      </button>
                    </div>

                    <div className="text-2xs text-gray-400 flex items-center space-x-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>Publicado: {new Date(anuncio.created_at || Date.now()).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR ANUNCIO */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    {editingAnuncio ? 'Editar Anuncio Institucional' : 'Publicar Nuevo Anuncio'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Configura la visibilidad en el Dashboard y recursos descargables
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveAnuncio} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {saveError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Título del Anuncio <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ej: Convocatoria para Curso de Rescate Vertical 2026"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                />
              </div>

              {/* Sobre qué trata / Contenido */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Sobre qué trata / Detalle del Anuncio <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formContenido}
                  onChange={(e) => setFormContenido(e.target.value)}
                  placeholder="Describe la información completa del anuncio, instrucciones, fechas, lugar o recomendaciones para el personal..."
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Tipo de Anuncio */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tipo de Notificación
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TIPOS_ANUNCIO.map((t) => {
                    const Icon = t.icon;
                    const isSelected = formTipo === t.value;
                    return (
                      <button
                        type="button"
                        key={t.value}
                        onClick={() => setFormTipo(t.value as any)}
                        className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                          isSelected
                            ? `${t.bg} ${t.text} ${t.border} ring-2 ring-primary/30 shadow-xs`
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Configuración de Dashboard y Visualización */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Visualización en Dashboard
                </h4>

                <div className="space-y-2.5">
                  {/* Cuadro Notificación */}
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formMostrarCuadro}
                      onChange={(e) => setFormMostrarCuadro(e.target.checked)}
                      className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        Mostrar en cuadro superior de notificación en Dashboard
                      </span>
                      <span className="text-2xs text-gray-500">
                        Aparecerá en la parte superior con botón de cerrar (X). Ideal para anuncios importantes o alertas.
                      </span>
                    </div>
                  </label>

                  {/* Slider de noticias / Ticker */}
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formMostrarTicker}
                      onChange={(e) => setFormMostrarTicker(e.target.checked)}
                      className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        Mostrar en la línea de texto que va pasando (Slider de Noticias)
                      </span>
                      <span className="text-2xs text-gray-500">
                        Se incluirá en el carrusel de titulares que pasa continuamente abajo del banner.
                      </span>
                    </div>
                  </label>

                  {/* Estado Activo */}
                  <label className="flex items-start space-x-3 cursor-pointer pt-1 border-t border-gray-200">
                    <input
                      type="checkbox"
                      checked={formActivo}
                      onChange={(e) => setFormActivo(e.target.checked)}
                      className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        Anuncio Activo
                      </span>
                      <span className="text-2xs text-gray-500">
                        Si está desmarcado, el anuncio quedará guardado pero no se mostrará a nadie en el sistema.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tiempo de Visualización / Expiración */}
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                    Vigencia: ¿Después de qué tiempo dejar de mostrar?
                  </h4>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'nunca', label: 'Sin límite (Siempre)' },
                    { id: '1d', label: '1 Día' },
                    { id: '3d', label: '3 Días' },
                    { id: '7d', label: '1 Semana' },
                    { id: '15d', label: '15 Días' },
                    { id: '30d', label: '1 Mes' },
                    { id: 'custom', label: 'Fecha exacta' },
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => setFormExpPreset(preset.id as any)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        formExpPreset === preset.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {formExpPreset === 'custom' && (
                  <div className="pt-2">
                    <label className="block text-2xs font-semibold text-gray-700 mb-1">
                      Fecha y Hora en que dejará de mostrarse en Dashboard:
                    </label>
                    <input
                      type="datetime-local"
                      value={formFechaExp}
                      onChange={(e) => setFormFechaExp(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Imagen Ilustrativa / Banner del Anuncio */}
              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center">
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-purple-700" />
                    Imagen Ilustrativa / Banner del Anuncio (Opcional)
                  </h4>
                  <span className="text-2xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                    1200 x 630 px
                  </span>
                </div>

                {/* Banner de dimensiones recomendadas */}
                <div className="p-3 bg-white/90 rounded-xl border border-purple-200/80 text-2xs space-y-1">
                  <div className="font-bold text-purple-950 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                    <span>Dimensiones recomendadas para que se visualice perfecto:</span>
                  </div>
                  <div className="text-gray-600 pl-5 space-y-0.5">
                    <p>• <strong>1200 x 630 píxeles</strong> (proporción panorámica 16:9 o 1.91:1) o mínimo <strong>800 x 450 px</strong>.</p>
                    <p>• Formatos compatibles: <strong>JPG, PNG, WebP</strong>. Se adapta fluidamente a teléfonos y computadoras.</p>
                  </div>
                </div>

                {imagePreviewUrl || formImagenUrl ? (
                  <div className="bg-white p-3 rounded-xl border border-purple-200 space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-h-52">
                      <img 
                        src={imagePreviewUrl || formImagenUrl} 
                        alt="Previsualización de imagen" 
                        className="w-full h-44 object-cover object-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormImagenUrl('');
                          setImagePreviewUrl(null);
                          setSelectedImageToUpload(null);
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-xl shadow-md hover:bg-red-700 transition-colors"
                        title="Quitar imagen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-2xs text-gray-500 font-medium">
                      <span>{selectedImageToUpload ? `Archivo seleccionado: ${selectedImageToUpload.name}` : 'Imagen vinculada al anuncio'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormImagenUrl('');
                          setImagePreviewUrl(null);
                          setSelectedImageToUpload(null);
                        }}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Cambiar / Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block w-full border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-white">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedImageToUpload(file);
                            setImagePreviewUrl(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <ImageIcon className="w-6 h-6 text-purple-600 mx-auto mb-1.5" />
                      <span className="text-xs font-bold text-purple-950 block">
                        Subir imagen o banner para el anuncio
                      </span>
                      <span className="text-2xs text-gray-500">
                        Haz clic aquí para seleccionar una foto o afiche (Recomendado 1200x630 px)
                      </span>
                    </label>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        value={formImagenUrl}
                        onChange={(e) => {
                          setFormImagenUrl(e.target.value);
                          setImagePreviewUrl(e.target.value);
                        }}
                        placeholder="O pega directamente un enlace web de imagen (https://...)"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Archivo Descargable Adjunto */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center">
                  <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                  Archivo Descargable Adjunto (Opcional)
                </h4>

                {formArchivoUrl ? (
                  <div className="bg-white p-3 rounded-xl border border-emerald-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-gray-900 truncate">{formArchivoNombre || 'Archivo adjunto'}</p>
                        <p className="text-2xs text-gray-500">{formArchivoTamano || 'Disponible para descarga'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormArchivoNombre('');
                        setFormArchivoUrl('');
                        setFormArchivoTamano('');
                        setSelectedFileToUpload(null);
                      }}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 text-xs font-semibold"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block w-full border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-white">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFileToUpload(file);
                            setFormArchivoNombre(file.name);
                            setFormArchivoTamano(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
                            setFormArchivoUrl('pending_upload');
                          }
                        }}
                      />
                      <Upload className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                      <span className="text-xs font-bold text-emerald-900 block">
                        {selectedFileToUpload ? selectedFileToUpload.name : 'Subir archivo descargable (PDF, Word, Excel, Imagen)'}
                      </span>
                      <span className="text-2xs text-gray-500">
                        {selectedFileToUpload ? `${(selectedFileToUpload.size / (1024 * 1024)).toFixed(1)} MB - Listo para subir al guardar` : 'Haz clic para seleccionar un documento'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Enlace de Redirección */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Enlace de Redirección (Opcional)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-gray-600 mb-1">
                      URL del Enlace
                    </label>
                    <input
                      type="text"
                      value={formEnlaceUrl}
                      onChange={(e) => setFormEnlaceUrl(e.target.value)}
                      placeholder="https://... o /solicitudes"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-gray-600 mb-1">
                      Texto del Botón
                    </label>
                    <input
                      type="text"
                      value={formEnlaceTexto}
                      onChange={(e) => setFormEnlaceTexto(e.target.value)}
                      placeholder="Ej: Acceder a Formulario"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Botones del Formulario */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingFile}
                  className="inline-flex items-center px-6 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {saving || uploadingFile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      {editingAnuncio ? 'Actualizar Anuncio' : 'Publicar Anuncio'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVISUALIZACIÓN DASHBOARD */}
      {previewAnuncio && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 flex items-center">
                <Eye className="w-4 h-4 mr-2 text-primary" />
                Previsualización en Dashboard
              </h3>
              <button
                onClick={() => setPreviewAnuncio(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Vista 1: Cuadro Notificación Superior */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  1. Cuadro de Notificación Superior (con botón de cierre X):
                </p>
                <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 relative shadow-xs">
                  <button 
                    onClick={() => alert('Este botón cerrará la notificación en el Dashboard')}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-white/60 transition-colors"
                    title="Cerrar notificación"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex items-start space-x-3.5 pr-8">
                    <div className="p-2.5 bg-primary text-white rounded-xl flex-shrink-0 shadow-xs">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider bg-primary/10 text-primary mb-1">
                        {previewAnuncio.tipo}
                      </span>
                      <h4 className="text-base font-extrabold text-gray-900">{previewAnuncio.titulo}</h4>
                      
                      {/* Imagen si existe */}
                      {previewAnuncio.imagen_url && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-white max-h-56">
                          <img 
                            src={previewAnuncio.imagen_url} 
                            alt={previewAnuncio.titulo} 
                            className="w-full h-44 object-cover object-center"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      )}

                      <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{previewAnuncio.contenido}</p>
                      
                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        {previewAnuncio.archivo_url && (
                          <a
                            href={previewAnuncio.archivo_url}
                            download
                            className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Descargar: {previewAnuncio.archivo_nombre || 'Archivo Adjunto'}
                          </a>
                        )}
                        {previewAnuncio.enlace_url && (
                          <a
                            href={previewAnuncio.enlace_url}
                            className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 transition-colors"
                          >
                            {previewAnuncio.enlace_texto || 'Más información'}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vista 2: Línea de texto / Slider de Noticias */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  2. Línea de Texto que va pasando (Slider de Noticias):
                </p>
                <div className="bg-gray-900 text-white rounded-xl p-3 flex items-center space-x-3 overflow-hidden shadow-inner">
                  <div className="flex items-center space-x-1.5 text-xs font-extrabold text-amber-400 bg-gray-800 px-2.5 py-1 rounded-lg flex-shrink-0">
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    <span>AVISOS:</span>
                  </div>
                  <div className="truncate text-xs font-medium text-gray-200 flex-1">
                    <span className="font-bold text-white mr-2">[{previewAnuncio.tipo.toUpperCase()}]</span>
                    {previewAnuncio.titulo} — {previewAnuncio.contenido.slice(0, 80)}...
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-right">
              <button
                onClick={() => setPreviewAnuncio(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cerrar Previsualización
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCRIPT SQL */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Script SQL para Base de Datos Supabase (Migración 21)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Copia y ejecuta este script en el SQL Editor de tu proyecto Supabase para habilitar las tablas y políticas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="relative bg-gray-900 rounded-2xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-96">
                <button
                  onClick={copySqlScript}
                  className="absolute top-3 right-3 inline-flex items-center px-3 py-1.5 rounded-lg text-2xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  {sqlCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copiar SQL
                    </>
                  )}
                </button>
                <pre className="whitespace-pre-wrap leading-relaxed">
{`-- 21_archivos_y_anuncios_sistema.sql
-- TABLA DE ANUNCIOS:
CREATE TABLE IF NOT EXISTS public.anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'info',
  prioridad INTEGER DEFAULT 1,
  mostrar_cuadro_dashboard BOOLEAN DEFAULT true,
  mostrar_ticker_dashboard BOOLEAN DEFAULT true,
  activo BOOLEAN DEFAULT true,
  fecha_expiracion TIMESTAMPTZ,
  enlace_url TEXT,
  enlace_texto TEXT DEFAULT 'Más información',
  imagen_url TEXT,
  archivo_nombre TEXT,
  archivo_url TEXT,
  archivo_tamano TEXT,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre TEXT,
  vistas_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Si la tabla ya fue creada previamente, añadir columna de imagen:
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS imagen_url TEXT;

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver anuncios" 
  ON public.anuncios FOR SELECT TO authenticated 
  USING (activo = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin y autorizados pueden crear anuncios" 
  ON public.anuncios FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin y autorizados pueden actualizar anuncios" 
  ON public.anuncios FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin y autorizados pueden borrar anuncios" 
  ON public.anuncios FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));`}
                </pre>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                Archivo completo disponible en: <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-800">/21_archivos_y_anuncios_sistema.sql</code>
              </span>
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
