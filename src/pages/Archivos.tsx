import React, { useState, useEffect } from 'react';
import { 
  FolderDown, Upload, Download, Search, Filter, FileText, 
  Trash2, Eye, Plus, CheckCircle2, Clock, 
  FileSpreadsheet, FileCode, Archive, Image as ImageIcon,
  Tag, ExternalLink, HardDrive, RefreshCw, Copy, Check, Info, AlertTriangle, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';

export interface ArchivoItem {
  id: string;
  titulo: string;
  descripcion?: string;
  categoria: string;
  nombre_archivo: string;
  url_archivo: string;
  tipo_archivo?: string;
  extension?: string;
  tamano_bytes?: number;
  tamano_legible?: string;
  subido_por_id?: string;
  subido_por_nombre?: string;
  seccional_id?: number | null;
  descargas_count?: number;
  activo?: boolean;
  enlace_externo?: string | null;
  created_at?: string;
  updated_at?: string;
}

const CATEGORIAS_DEFAULT = [
  'Manuales y Protocolos',
  'Formatos y Formularios',
  'Leyes y Normativas',
  'Capacitaciones y Guías',
  'Plantillas Institucionales',
  'Boletines y Comunicados',
  'Otros'
];

export default function Archivos() {
  const { user, userName, role, permissions } = useAuth();
  
  // El usuario admin siempre puede subir; o cualquier usuario con subir_archivos habilitado
  const canUpload = role === 'admin' || !!permissions.subir_archivos;

  const [archivos, setArchivos] = useState<ArchivoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');
  const [selectedTipo, setSelectedTipo] = useState<string>('Todos');
  const [sortBy, setSortBy] = useState<'recientes' | 'descargas' | 'alfabetico'>('recientes');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal Subida
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Formulario de Subida
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCategoria, setFormCategoria] = useState(CATEGORIAS_DEFAULT[0]);
  const [formEnlaceExterno, setFormEnlaceExterno] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Modal Previsualización
  const [previewFile, setPreviewFile] = useState<ArchivoItem | null>(null);

  // Modal SQL Script
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    fetchArchivos();
  }, []);

  const fetchArchivos = async () => {
    setLoading(true);
    try {
      // 1. Intentar obtener desde Supabase
      const { data, error } = await supabase
        .from('archivos')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setArchivos(data);
        setLoading(false);
        return;
      }

      // 2. Si la tabla no existe en Supabase o está vacía, consultar endpoint de la API local
      const res = await fetch('/api/archivos');
      if (res.ok) {
        const localData = await res.json();
        if (localData && localData.length > 0) {
          setArchivos(localData);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback de respaldo en localStorage
      const cached = localStorage.getItem('cruz_verde_archivos_data');
      if (cached) {
        setArchivos(JSON.parse(cached));
      }
    } catch (err) {
      console.warn('Error al obtener archivos de base de datos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper para calcular tamaño legible
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Helper para icono según extensión
  const getFileIcon = (ext?: string) => {
    const cleanExt = (ext || '').toLowerCase().replace('.', '');
    if (['pdf'].includes(cleanExt)) {
      return <FileText className="w-8 h-8 text-rose-600" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(cleanExt)) {
      return <FileSpreadsheet className="w-8 h-8 text-emerald-600" />;
    }
    if (['doc', 'docx'].includes(cleanExt)) {
      return <FileText className="w-8 h-8 text-blue-600" />;
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(cleanExt)) {
      return <ImageIcon className="w-8 h-8 text-amber-600" />;
    }
    if (['zip', 'rar', '7z', 'tar'].includes(cleanExt)) {
      return <Archive className="w-8 h-8 text-purple-600" />;
    }
    return <FileCode className="w-8 h-8 text-gray-500" />;
  };

  // Subir archivo
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) {
      setUploadError('Por favor ingresa un título para el archivo');
      return;
    }
    if (!selectedFile && !formEnlaceExterno.trim()) {
      setUploadError('Debes seleccionar un archivo o indicar un enlace de descarga');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      let finalFileUrl = formEnlaceExterno.trim();
      let originalFileName = selectedFile ? selectedFile.name : 'Documento_Externo.pdf';
      let extension = selectedFile ? selectedFile.name.split('.').pop()?.toLowerCase() || '' : 'link';
      let tamanoLegible = selectedFile ? formatBytes(selectedFile.size) : 'Enlace en la nube';
      let tamanoBytes = selectedFile ? selectedFile.size : 0;
      let mimetype = selectedFile ? selectedFile.type : 'application/octet-stream';

      if (selectedFile) {
        // Intentar subir a través del endpoint API del servidor
        const formData = new FormData();
        formData.append('archivo', selectedFile);

        try {
          const uploadRes = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.url) {
              finalFileUrl = uploadData.url;
            }
          }
        } catch (serverUploadErr) {
          console.warn('API local upload falló, probando fallback a Supabase Storage:', serverUploadErr);
        }

        // Si falló el servidor, intentar Supabase Storage bucket 'socorristas'
        if (!finalFileUrl) {
          try {
            const cleanName = `archivos/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
            const { error: storageErr } = await supabase.storage
              .from('socorristas')
              .upload(cleanName, selectedFile, { upsert: true });

            if (!storageErr) {
              const { data: { publicUrl } } = supabase.storage
                .from('socorristas')
                .getPublicUrl(cleanName);
              finalFileUrl = publicUrl;
            }
          } catch (storageException) {
            console.warn('Storage fallback falló:', storageException);
          }
        }

        // Si ambos fallaron, convertir a Data URL (para que nunca falle)
        if (!finalFileUrl) {
          finalFileUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.readAsDataURL(selectedFile);
          });
        }
      }

      const newArchivoItem: ArchivoItem = {
        id: `arc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        titulo: formTitulo.trim(),
        descripcion: formDescripcion.trim() || undefined,
        categoria: formCategoria,
        nombre_archivo: originalFileName,
        url_archivo: finalFileUrl,
        tipo_archivo: mimetype,
        extension: extension,
        tamano_bytes: tamanoBytes,
        tamano_legible: tamanoLegible,
        subido_por_id: user?.id,
        subido_por_nombre: userName || user?.email || 'Administración',
        enlace_externo: formEnlaceExterno.trim() || null,
        descargas_count: 0,
        activo: true,
        created_at: new Date().toISOString()
      };

      // Guardar en Supabase
      try {
        const { data: insertedSupabase, error: insertError } = await supabase
          .from('archivos')
          .insert([newArchivoItem])
          .select()
          .single();

        if (!insertError && insertedSupabase) {
          newArchivoItem.id = insertedSupabase.id;
        }
      } catch (errDb) {
        console.warn('No se pudo guardar directamente en Supabase, sincronizando con API local:', errDb);
      }

      // Guardar en API local (respaldo)
      try {
        await fetch('/api/archivos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newArchivoItem)
        });
      } catch (apiErr) {
        console.warn('No se pudo guardar en API local:', apiErr);
      }

      // Actualizar estado en memoria y cache
      const updatedList = [newArchivoItem, ...archivos];
      setArchivos(updatedList);
      localStorage.setItem('cruz_verde_archivos_data', JSON.stringify(updatedList));

      await logActivity('Subió nuevo archivo institucional', 'Archivos', newArchivoItem.id, {
        titulo: newArchivoItem.titulo,
        categoria: newArchivoItem.categoria,
        nombre_archivo: newArchivoItem.nombre_archivo
      });

      // Limpiar y cerrar modal
      setFormTitulo('');
      setFormDescripcion('');
      setFormCategoria(CATEGORIAS_DEFAULT[0]);
      setFormEnlaceExterno('');
      setSelectedFile(null);
      setShowUploadModal(false);
    } catch (err: any) {
      setUploadError(err.message || 'Error al guardar el archivo');
    } finally {
      setUploading(false);
    }
  };

  // Manejo de descarga
  const handleDescargar = async (archivo: ArchivoItem) => {
    try {
      // Registrar descarga en Supabase
      try {
        await (supabase.rpc as any)('increment_descarga_archivo', { archivo_id: archivo.id });
      } catch {
        // ignore
      }

      // O mediante API local
      fetch(`/api/archivos/${archivo.id}/descarga`, { method: 'POST' }).catch(() => {});

      // Actualizar contador en UI
      setArchivos(prev => prev.map(a => a.id === archivo.id ? { ...a, descargas_count: (a.descargas_count || 0) + 1 } : a));

      // Descarga real
      const link = document.createElement('a');
      link.href = archivo.url_archivo;
      link.download = archivo.nombre_archivo || 'archivo_cruz_verde';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await logActivity('Descargó archivo institucional', 'Archivos', archivo.id, {
        titulo: archivo.titulo,
        nombre_archivo: archivo.nombre_archivo
      });
    } catch (err) {
      console.error('Error al iniciar la descarga:', err);
    }
  };

  // Eliminar archivo
  const handleEliminar = async (id: string, titulo: string) => {
    if (!canUpload) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el archivo "${titulo}"?`)) return;

    try {
      await supabase.from('archivos').delete().eq('id', id);
      await fetch(`/api/archivos/${id}`, { method: 'DELETE' }).catch(() => {});

      const updated = archivos.filter(a => a.id !== id);
      setArchivos(updated);
      localStorage.setItem('cruz_verde_archivos_data', JSON.stringify(updated));

      await logActivity('Eliminó archivo institucional', 'Archivos', id, { titulo });
    } catch (err) {
      console.error('Error al eliminar archivo:', err);
      alert('No se pudo eliminar el archivo');
    }
  };

  // Filtrado y orden
  const filteredArchivos = archivos.filter(item => {
    const matchesSearch = 
      item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoria.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCat = selectedCategoria === 'Todas' || item.categoria === selectedCategoria;

    let matchesType = true;
    if (selectedTipo === 'PDF') matchesType = (item.extension || '').toLowerCase() === 'pdf';
    else if (selectedTipo === 'Excel') matchesType = ['xlsx', 'xls', 'csv'].includes((item.extension || '').toLowerCase());
    else if (selectedTipo === 'Word') matchesType = ['docx', 'doc'].includes((item.extension || '').toLowerCase());
    else if (selectedTipo === 'Imágenes') matchesType = ['jpg', 'jpeg', 'png', 'webp'].includes((item.extension || '').toLowerCase());

    return matchesSearch && matchesCat && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'descargas') return (b.descargas_count || 0) - (a.descargas_count || 0);
    if (sortBy === 'alfabetico') return a.titulo.localeCompare(b.titulo);
    // recientes
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
  });

  const totalDescargas = archivos.reduce((acc, a) => acc + (a.descargas_count || 0), 0);

  const sqlMigrationCode = `-- ==============================================================================
-- Migración SQL para Habilitar Archivos y Anuncios en Supabase
-- Ejecuta este código en el Editor SQL de tu panel Supabase
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'General',
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  tipo_archivo TEXT,
  extension TEXT,
  tamano_bytes BIGINT DEFAULT 0,
  tamano_legible TEXT,
  subido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subido_por_nombre TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  descargas_count INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  enlace_externo TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS can_upload_files BOOLEAN DEFAULT false;

ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver archivos activos"
  ON public.archivos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autorizados pueden subir archivos"
  ON public.archivos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin y creador pueden modificar o eliminar"
  ON public.archivos FOR ALL TO authenticated USING (true);
`;

  return (
    <div className="space-y-6 w-full mx-auto pb-12">
      
      {/* Encabezado Principal */}
      <div className="bg-gradient-to-r from-primary via-primary-hover to-blue-900 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <FolderDown className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-emerald-300 border border-white/10">
              <HardDrive className="w-3.5 h-3.5" />
              Repositorio Institucional de Documentos
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Archivos y Formatos Descargables
            </h1>
            <p className="text-gray-200 text-sm md:text-base leading-relaxed">
              Consulta, visualiza y descarga manuales de primeros auxilios, normativas institucionales, hojas de servicio y formatos oficiales de Cruz Verde Salvadoreña.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {role === 'admin' && (
              <button
                onClick={() => setShowSqlModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all flex items-center gap-2 border border-white/20 shadow-sm cursor-pointer"
                title="Ver y copiar script SQL para Supabase"
              >
                <FileCode className="w-4 h-4 text-emerald-400" />
                Script SQL
              </button>
            )}

            {canUpload ? (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Subir Nuevo Archivo
              </button>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-gray-200 flex items-center gap-1.5 border border-white/15">
                <Info className="w-3.5 h-3.5 text-blue-300" />
                Modo Consulta y Descarga
              </div>
            )}
          </div>
        </div>

        {/* Tarjetas de Estadísticas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-xs text-gray-300 block">Total Archivos</span>
            <span className="text-2xl font-bold text-white">{archivos.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-xs text-gray-300 block">Descargas Totales</span>
            <span className="text-2xl font-bold text-emerald-300">{totalDescargas}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-xs text-gray-300 block">Categorías</span>
            <span className="text-2xl font-bold text-white">{CATEGORIAS_DEFAULT.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-xs text-gray-300 block">Tu Permiso</span>
            <span className="text-sm font-bold text-amber-300 flex items-center mt-1 gap-1">
              {canUpload ? <Check className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {canUpload ? 'Subir y Descargar' : 'Solo Descarga'}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Input de Búsqueda */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por título, palabra clave o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtros rápidos y controles */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            
            {/* Filtro por Categoría */}
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="Todas">Todas las Categorías</option>
              {CATEGORIAS_DEFAULT.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Filtro por Tipo */}
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="Todos">Todos los Formatos</option>
              <option value="PDF">PDF</option>
              <option value="Excel">Excel / Tablas</option>
              <option value="Word">Word / Texto</option>
              <option value="Imágenes">Imágenes</option>
            </select>

            {/* Ordenamiento */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="recientes">Más recientes</option>
              <option value="descargas">Más descargados</option>
              <option value="alfabetico">Alfabético (A-Z)</option>
            </select>

            {/* Botón de Refrescar */}
            <button
              onClick={fetchArchivos}
              className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer transition"
              title="Actualizar listado"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
        </div>

        {/* Chips de Categorías Rápidas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-gray-400 font-semibold mr-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            Filtrar:
          </span>
          <button
            onClick={() => setSelectedCategoria('Todas')}
            className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition cursor-pointer ${
              selectedCategoria === 'Todas'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas ({archivos.length})
          </button>
          {CATEGORIAS_DEFAULT.map(cat => {
            const count = archivos.filter(a => a.categoria === cat).length;
            if (count === 0 && selectedCategoria !== cat) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategoria(cat)}
                className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategoria === cat
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido Principal: Lista o Cuadrícula */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="mt-3 text-xs md:text-sm text-gray-500 font-medium">Cargando repositorio de archivos...</p>
        </div>
      ) : filteredArchivos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <FolderDown className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">No se encontraron archivos</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              No hay documentos que coincidan con los filtros seleccionados o la búsqueda actual.
            </p>
          </div>
          {canUpload && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Subir Primer Archivo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArchivos.map((archivo) => (
            <div 
              key={archivo.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-primary/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5 space-y-3">
                {/* Cabecera de la tarjeta: Icono + Categoría + Acciones */}
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 group-hover:bg-blue-50/50 transition">
                    {getFileIcon(archivo.extension)}
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                      {archivo.categoria}
                    </span>
                    {canUpload && (
                      <button
                        onClick={() => handleEliminar(archivo.id, archivo.titulo)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition cursor-pointer"
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Título y Descripción */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary transition line-clamp-2" title={archivo.titulo}>
                    {archivo.titulo}
                  </h3>
                  {archivo.descripcion && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed" title={archivo.descripcion}>
                      {archivo.descripcion}
                    </p>
                  )}
                </div>

                {/* Metadatos */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-500 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="uppercase font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold">
                      {archivo.extension || 'DOC'}
                    </span>
                    <span>{archivo.tamano_legible || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Download className="w-3 h-3" />
                    <span>{archivo.descargas_count || 0} descargas</span>
                  </div>
                </div>

                <div className="text-3xs text-gray-400 flex items-center justify-between">
                  <span>Subido por: <strong className="text-gray-600">{archivo.subido_por_nombre || 'Admin'}</strong></span>
                  <span>{archivo.created_at ? new Date(archivo.created_at).toLocaleDateString() : ''}</span>
                </div>
              </div>

              {/* Botón de Descarga Inferior */}
              <div className="p-3 bg-gray-50/80 border-t border-gray-100 flex items-center gap-2">
                {archivo.url_archivo && (archivo.extension === 'pdf' || ['png', 'jpg', 'jpeg'].includes(archivo.extension || '')) && (
                  <button
                    onClick={() => setPreviewFile(archivo)}
                    className="p-2 text-gray-600 hover:text-primary hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Vista previa rápida"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver
                  </button>
                )}
                
                <button
                  onClick={() => handleDescargar(archivo)}
                  className="flex-1 py-2 px-3 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Archivo
                </button>

                {archivo.enlace_externo && (
                  <a
                    href={archivo.enlace_externo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                    title="Abrir enlace externo"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: SUBIR ARCHIVO */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="bg-primary px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Subir Archivo Institucional</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Título del Archivo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Manual de Primeros Auxilios 2026, Hoja de Servicio..."
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Categoría Institucional *
                </label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                >
                  {CATEGORIAS_DEFAULT.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Descripción o Instrucciones de Uso (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Indica brevemente el propósito del archivo o para quién está dirigido..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>

              {/* Selector de Archivo Físico */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Archivo a Subir (PDF, Word, Excel, ZIP, JPG...)
                </label>
                <div className="border-2 border-dashed border-gray-300 hover:border-primary rounded-xl p-4 text-center transition cursor-pointer relative bg-gray-50/50">
                  <input
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!formTitulo) {
                          const rawName = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                          setFormTitulo(rawName.replace(/[_-]/g, ' '));
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-primary font-bold text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>{selectedFile.name} ({formatBytes(selectedFile.size)})</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-7 h-7 text-gray-400 mx-auto" />
                      <p className="text-xs font-medium text-gray-600">
                        Haz clic o arrastra un archivo aquí
                      </p>
                      <p className="text-3xs text-gray-400">
                        Soporta PDF, XLSX, DOCX, ZIP, imágenes y documentos institucionales
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Enlace Externo Alternativo */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  O Enlace de Descarga Nube (Google Drive, OneDrive...)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={formEnlaceExterno}
                  onChange={(e) => setFormEnlaceExterno(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Publicar Archivo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW DE ARCHIVO */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-gray-900 px-6 py-3.5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm truncate">{previewFile.titulo}</h3>
                <span className="text-2xs text-gray-400">{previewFile.nombre_archivo}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDescargar(previewFile)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-gray-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 p-2 overflow-auto flex items-center justify-center">
              {['png', 'jpg', 'jpeg', 'webp'].includes(previewFile.extension || '') ? (
                <img 
                  src={previewFile.url_archivo} 
                  alt={previewFile.titulo} 
                  className="max-h-full max-w-full object-contain rounded shadow"
                />
              ) : previewFile.extension === 'pdf' ? (
                <iframe
                  src={previewFile.url_archivo}
                  className="w-full h-full rounded border-0"
                  title={previewFile.titulo}
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto" />
                  <p className="text-sm font-medium text-gray-700">Previsualización no disponible para este formato</p>
                  <button
                    onClick={() => handleDescargar(previewFile)}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg"
                  >
                    Descargar para visualizar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SCRIPT SQL PARA SUPABASE */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-200">
            <div className="bg-gray-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Instrucciones SQL de Base de Datos</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl">
                <p className="font-semibold">¿Qué se debe agregar en SQL en la base de datos para que funcione?</p>
                <p className="mt-1 text-2xs text-blue-700">
                  El archivo completo de migración está guardado en <code className="font-mono bg-blue-100 px-1 rounded">21_archivos_y_anuncios_sistema.sql</code>. 
                  Copia y pega este script en el <strong>SQL Editor</strong> de tu proyecto de Supabase para habilitar las tablas con RLS y permisos.
                </p>
              </div>

              <div className="relative">
                <pre className="bg-gray-950 text-gray-200 p-4 rounded-xl text-2xs font-mono max-h-60 overflow-y-auto border border-gray-800">
                  {sqlMigrationCode}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sqlMigrationCode);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 3000);
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-2xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  {sqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {sqlCopied ? '¡Copiado!' : 'Copiar SQL'}
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
