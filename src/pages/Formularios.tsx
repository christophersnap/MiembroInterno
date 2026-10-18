import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Globe, Lock, Share2, Copy, Check, ExternalLink, 
  Trash2, Edit3, Eye, FileSpreadsheet, Layers, Filter, RefreshCw, 
  CheckCircle2, AlertCircle, FileText, Sparkles, BookOpen, Users
} from 'lucide-react';
import { Formulario } from '../types/formulario';
import FormBuilderModal from '../components/formularios/FormBuilderModal';
import FormResponsesModal from '../components/formularios/FormResponsesModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export default function Formularios() {
  const { user, userName, role, permissions } = useAuth();
  const canManageForms = role === 'admin' || Boolean(permissions?.crear_formularios);
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('Todas');
  const [selectedAcceso, setSelectedAcceso] = useState<'todos' | 'publico' | 'privado'>('todos');

  // Modals state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<Formulario | null>(null);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [responsesForm, setResponsesForm] = useState<Formulario | null>(null);

  // Copy toast state
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [seccionalesList, setSeccionalesList] = useState<string[]>([]);

  useEffect(() => {
    loadFormularios();
    loadSeccionales();
  }, []);

  const getOfficialShareUrl = (slug: string) => {
    return `https://cruzverdesv.org/miembros/f/${slug}`;
  };

  const loadFormularios = async () => {
    setLoading(true);
    try {
      // 1. Cargar desde base de datos Supabase en la nube
      const { data: supaForms, error: supaErr } = await supabase
        .from('formularios')
        .select(`
          *,
          formulario_respuestas (id)
        `)
        .order('id', { ascending: false });

      if (!supaErr && supaForms && supaForms.length > 0) {
        const formatted = supaForms.map((f: any) => ({
          ...f,
          respuestas_count: Array.isArray(f.formulario_respuestas) ? f.formulario_respuestas.length : 0
        }));
        setFormularios(formatted);
        return;
      }

      // 2. Fallback a endpoint local SQLite
      const res = await fetch(getApiUrl('/api/formularios'));
      if (res.ok) {
        const data = await res.json();
        setFormularios(data);
      }
    } catch (err) {
      console.error('Error al cargar formularios:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSeccionales = async () => {
    try {
      const { data: supaSeccs } = await supabase.from('seccionales').select('nombre');
      if (supaSeccs && supaSeccs.length > 0) {
        setSeccionalesList(supaSeccs.map((s: any) => s.nombre).filter(Boolean));
        return;
      }
      const res = await fetch(getApiUrl('/api/seccionales'));
      if (res.ok) {
        const data = await res.json();
        setSeccionalesList(data.map((s: any) => s.nombre).filter(Boolean));
      }
    } catch (e) {
      // fallback
    }
  };

  const handleCopyLink = (slug: string) => {
    const shareUrl = getOfficialShareUrl(slug);
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2500);
    });
  };

  const handleToggleActivo = async (form: Formulario) => {
    try {
      const updatedActivo = !form.activo;
      // 1. Actualizar en Supabase
      await supabase
        .from('formularios')
        .update({ activo: updatedActivo, updated_at: new Date().toISOString() })
        .eq('id', form.id);

      // 2. Notificar API local si aplica
      try {
        await fetch(getApiUrl(`/api/formularios/${form.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, activo: updatedActivo })
        });
      } catch (e) {}

      setFormularios(prev => prev.map(f => f.id === form.id ? { ...f, activo: updatedActivo } : f));
    } catch (err) {
      console.error('Error al cambiar estado:', err);
    }
  };

  const handleDeleteFormulario = async (id: number, titulo: string) => {
    if (!confirm(`¿Está seguro de eliminar el formulario "${titulo}" y todas sus respuestas asociadas? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      // 1. Eliminar respuestas y formulario en Supabase
      await supabase.from('formulario_respuestas').delete().eq('formulario_id', id);
      const { error: delErr } = await supabase.from('formularios').delete().eq('id', id);

      if (delErr) {
        console.warn('Aviso Supabase delete:', delErr);
      }

      // 2. Notificar API local
      try {
        await fetch(getApiUrl(`/api/formularios/${id}`), { method: 'DELETE' });
      } catch (e) {}

      setFormularios(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      alert('Error de red: ' + err.message);
    }
  };

  const handleSaveForm = async (formData: Partial<Formulario>) => {
    try {
      if (editingForm) {
        // Actualizar en Supabase
        const { error: upErr } = await supabase
          .from('formularios')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingForm.id);

        if (upErr) throw upErr;

        try {
          await fetch(getApiUrl(`/api/formularios/${editingForm.id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        } catch (e) {}
      } else {
        // Crear en Supabase
        const payload = {
          ...formData,
          creado_por: user?.id || null,
          creado_por_nombre: userName || 'Administración Cruz Verde',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insErr } = await supabase
          .from('formularios')
          .insert([payload]);

        if (insErr) throw insErr;

        try {
          await fetch(getApiUrl('/api/formularios'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (e) {}
      }
      await loadFormularios();
    } catch (err: any) {
      console.error('Error guardando formulario:', err);
      throw new Error(err.message || 'Error guardando formulario');
    }
  };

  // Filtered list
  const filteredFormularios = formularios.filter(f => {
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchTitle = f.titulo.toLowerCase().includes(term);
      const matchDesc = (f.descripcion || '').toLowerCase().includes(term);
      const matchSlug = f.slug.toLowerCase().includes(term);
      if (!matchTitle && !matchDesc && !matchSlug) return false;
    }

    if (selectedCategoria !== 'Todas' && f.categoria !== selectedCategoria) {
      return false;
    }

    if (selectedAcceso === 'publico' && f.requiere_autenticacion) return false;
    if (selectedAcceso === 'privado' && !f.requiere_autenticacion) return false;

    return true;
  });

  const totalRespuestas = formularios.reduce((sum, f) => sum + (f.respuestas_count || 0), 0);
  const totalPublicos = formularios.filter(f => !f.requiere_autenticacion).length;
  const totalPrivados = formularios.filter(f => f.requiere_autenticacion).length;

  return (
    <div className="space-y-6">
      
      {/* ========================================================================= */}
      {/* HEADER SECTION                                                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Operaciones & Capacitaciones
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Estilo Fluent Forms
            </span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-1">
            Formularios Dinámicos e Inscripciones
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Crea formularios con campos institucionales (carnet, DUI, seccional, teléfono internacional con código de país), enlaces para compartir y control de acceso.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={loadFormularios}
            disabled={loading}
            title="Recargar formularios"
            className="p-2.5 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {canManageForms && (
            <button
              type="button"
              onClick={() => {
                setEditingForm(null);
                setBuilderOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Formulario
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STATS STRIP                                                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Formularios</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{formularios.length}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
            <Globe className="w-3 h-3" /> Formularios Públicos
          </span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{totalPublicos}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Requieren Sesión
          </span>
          <p className="text-2xl font-black text-amber-700 mt-1">{totalPrivados}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> Respuestas Recibidas
          </span>
          <p className="text-2xl font-black text-blue-700 mt-1">{totalRespuestas}</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTERS & SEARCH                                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, categoría o slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-gray-800"
          />
        </div>

        {/* Category Pills & Privacy Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
            className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-hidden focus:border-emerald-600"
          >
            <option value="Todas">Todas las Categorías</option>
            <option value="Cursos y Capacitaciones">Cursos y Capacitaciones</option>
            <option value="Voluntariado y Aspirantes">Voluntariado y Aspirantes</option>
            <option value="Eventos y Operativos">Eventos y Operativos</option>
            <option value="Emergencias y Desastres">Emergencias y Desastres</option>
            <option value="General">General</option>
          </select>

          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedAcceso('todos')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                selectedAcceso === 'todos' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedAcceso('publico')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedAcceso === 'publico' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Globe className="w-3 h-3 text-emerald-600" /> Públicos
            </button>
            <button
              type="button"
              onClick={() => setSelectedAcceso('privado')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedAcceso === 'privado' ? 'bg-white text-amber-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Lock className="w-3 h-3 text-amber-600" /> Con Sesión
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* FORMULARIOS LIST / GRID                                                   */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-gray-200 shadow-xs">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-gray-500">Cargando formularios...</p>
        </div>
      ) : filteredFormularios.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-gray-800">No se encontraron formularios</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            {search || selectedCategoria !== 'Todas' || selectedAcceso !== 'todos'
              ? 'No hay formularios que coincidan con los filtros aplicados. Intenta cambiar los criterios de búsqueda.'
              : 'Aún no has creado ningún formulario. Comienza ahora creando tu primer formulario de inscripción con Fluent Forms.'}
          </p>
          {canManageForms && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  setEditingForm(null);
                  setBuilderOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" /> Crear Primer Formulario
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredFormularios.map((form) => {
            const shareUrl = getOfficialShareUrl(form.slug);
            const isCopied = copiedSlug === form.slug;

            return (
              <div
                key={form.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar of card */}
                  <div className="flex items-center justify-between p-4 bg-gray-50/70 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                        {form.categoria}
                      </span>

                      {/* Access Badge */}
                      {form.requiere_autenticacion ? (
                        <span 
                          title="Solo usuarios con cuenta activa en Cruz Verde pueden responder"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md"
                        >
                          <Lock className="w-3 h-3" /> Requiere Sesión
                        </span>
                      ) : (
                        <span 
                          title="Cualquier persona con el enlace puede responder sin registrarse"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md"
                        >
                          <Globe className="w-3 h-3" /> Público
                        </span>
                      )}
                    </div>

                    {/* Active Toggle Switch */}
                    {canManageForms ? (
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(form)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                          form.activo 
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${form.activo ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {form.activo ? 'Activo' : 'Pausado'}
                      </button>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        form.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${form.activo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {form.activo ? 'Activo' : 'Pausado'}
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-snug hover:text-emerald-800 transition-colors">
                        {form.titulo}
                      </h3>
                      {form.descripcion && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                          {form.descripcion}
                        </p>
                      )}
                    </div>

                    {/* Fields & Responses counts */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <strong>{form.campos?.length || 0}</strong> campos
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <Users className="w-3.5 h-3.5" />
                        <strong>{form.respuestas_count || 0}</strong> respuestas
                      </span>
                    </div>

                    {/* Quick Share Link Box */}
                    <div className="p-2.5 bg-gray-50/80 rounded-xl border border-gray-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Share2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-[11px] font-mono text-gray-600 truncate select-all">
                          {shareUrl}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(form.slug)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                            isCopied 
                              ? 'bg-emerald-700 text-white' 
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-200" />
                              ¡Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copiar
                            </>
                          )}
                        </button>

                        <a
                          href={`/f/${form.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir formulario en nueva pestaña"
                          className="p-1.5 bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-colors shadow-2xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResponsesForm(form);
                      setResponsesOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200/60 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    Respuestas ({form.respuestas_count || 0})
                  </button>

                  <div className="flex items-center gap-1.5">
                    {canManageForms && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingForm(form);
                            setBuilderOpen(true);
                          }}
                          className="p-2 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Editar formulario"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteFormulario(form.id, form.titulo)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Eliminar formulario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM BUILDER MODAL (FLUENT FORMS STYLE)                                   */}
      {/* ========================================================================= */}
      <FormBuilderModal
        form={editingForm}
        isOpen={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          setEditingForm(null);
        }}
        onSave={handleSaveForm}
        seccionalesList={seccionalesList}
      />

      {/* ========================================================================= */}
      {/* FORM RESPONSES MODAL                                                      */}
      {/* ========================================================================= */}
      <FormResponsesModal
        form={responsesForm}
        isOpen={responsesOpen}
        onClose={() => {
          setResponsesOpen(false);
          setResponsesForm(null);
        }}
      />

    </div>
  );
}
