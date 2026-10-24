import React, { useState, useEffect } from 'react';
import { 
  Award, Plus, Search, Filter, Calendar, Users, Building2, 
  Trash2, Edit3, CheckCircle2, AlertCircle, X, Shield, Medal, Star, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Merito, SocorristaAsignadoMerito, CATEGORIAS_MERITO } from '../types/merito';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';

export default function Meritos() {
  const { role, userName } = useAuth();
  const canManageMeritos = role === 'admin' || role === 'director';

  const [meritos, setMeritos] = useState<Merito[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMerito, setEditingMerito] = useState<Merito | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<Merito['categoria']>('Misión Humanitaria');
  const [institucion, setInstitucion] = useState('Cruz Verde Salvadoreña');
  const [fechaMerito, setFechaMerito] = useState(new Date().toISOString().split('T')[0]);
  const [descripcion, setDescripcion] = useState('');
  const [socorristasAsignados, setSocorristasAsignados] = useState<SocorristaAsignadoMerito[]>([]);

  // Búsqueda de Socorristas para agregar
  const [allSocorristas, setAllSocorristas] = useState<any[]>([]);
  const [socorristaSearch, setSocorristaSearch] = useState('');
  const [selectedSocorristaId, setSelectedSocorristaId] = useState<string>('');
  const [fechaAsignacionIndividual, setFechaAsignacionIndividual] = useState(new Date().toISOString().split('T')[0]);
  const [notaIndividual, setNotaIndividual] = useState('');

  useEffect(() => {
    loadMeritos();
    loadSocorristas();
  }, []);

  const loadMeritos = async () => {
    setLoading(true);
    try {
      let list: Merito[] = [];

      // 1. Intentar desde tabla meritos en Supabase
      try {
        const { data, error } = await supabase
          .from('meritos')
          .select('*')
          .order('fecha_merito', { ascending: false });

        if (!error && data) {
          list = data.map((m: any) => ({
            ...m,
            socorristas_asignados: Array.isArray(m.socorristas_asignados) ? m.socorristas_asignados : []
          }));
        }
      } catch (err) {
        console.warn('Tabla meritos aún no inicializada en Supabase:', err);
      }

      // 2. Fallback a configuracion (clave sistema_meritos)
      if (list.length === 0) {
        try {
          const { data: configRow } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', 'sistema_meritos')
            .maybeSingle();

          if (configRow?.valor) {
            list = JSON.parse(configRow.valor);
          }
        } catch (e) {}
      }

      setMeritos(list);
    } catch (err) {
      console.error('Error cargando méritos:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSocorristas = async () => {
    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select(`
          id, carnet, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
          seccionales (nombre)
        `)
        .eq('estado', 'Activo')
        .order('primer_apellido');

      if (!error && data) {
        const formatted = data.map(s => ({
          id: s.id,
          carnet: s.carnet,
          nombreCompleto: `${s.primer_nombre} ${s.primer_apellido}`,
          seccional_nombre: Array.isArray(s.seccionales) ? s.seccionales[0]?.nombre : (s.seccionales as any)?.nombre || 'N/A'
        }));
        setAllSocorristas(formatted);
      }
    } catch (e) {
      console.error('Error cargando socorristas:', e);
    }
  };

  const openCreateModal = () => {
    setEditingMerito(null);
    setTitulo('');
    setCategoria('Misión Humanitaria');
    setInstitucion('Cruz Verde Salvadoreña');
    setFechaMerito(new Date().toISOString().split('T')[0]);
    setDescripcion('');
    setSocorristasAsignados([]);
    setSelectedSocorristaId('');
    setModalOpen(true);
    setErrorMsg(null);
  };

  const openEditModal = (merito: Merito) => {
    setEditingMerito(merito);
    setTitulo(merito.titulo);
    setCategoria(merito.categoria);
    setInstitucion(merito.institucion_otorgante || 'Cruz Verde Salvadoreña');
    setFechaMerito(merito.fecha_merito || new Date().toISOString().split('T')[0]);
    setDescripcion(merito.descripcion || '');
    setSocorristasAsignados(merito.socorristas_asignados || []);
    setSelectedSocorristaId('');
    setModalOpen(true);
    setErrorMsg(null);
  };

  const handleAddSocorristaToMerito = () => {
    if (!selectedSocorristaId) return;
    const soc = allSocorristas.find(s => s.id.toString() === selectedSocorristaId);
    if (!soc) return;

    if (socorristasAsignados.some(s => s.socorrista_id === soc.id)) {
      alert('Este socorrista ya está agregado al reconocimiento.');
      return;
    }

    const newItem: SocorristaAsignadoMerito = {
      socorrista_id: soc.id,
      socorrista_nombre: soc.nombreCompleto,
      socorrista_carnet: soc.carnet,
      seccional_nombre: soc.seccional_nombre,
      fecha_asignacion: fechaAsignacionIndividual || fechaMerito,
      nota_distincion: notaIndividual.trim() || undefined
    };

    setSocorristasAsignados([...socorristasAsignados, newItem]);
    setSelectedSocorristaId('');
    setNotaIndividual('');
  };

  const handleRemoveSocorrista = (socorristaId: number) => {
    setSocorristasAsignados(socorristasAsignados.filter(s => s.socorrista_id !== socorristaId));
  };

  const handleSaveMerito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setErrorMsg('Ingrese el título o nombre del mérito.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload: Merito = {
      titulo: titulo.trim(),
      categoria,
      institucion_otorgante: institucion.trim() || 'Cruz Verde Salvadoreña',
      fecha_merito: fechaMerito,
      descripcion: descripcion.trim(),
      socorristas_asignados: socorristasAsignados,
      updated_at: new Date().toISOString()
    };

    try {
      let savedId = editingMerito?.id;
      let isUpdate = !!editingMerito;

      // 1. Guardar en Supabase tabla meritos
      try {
        if (isUpdate && savedId) {
          await supabase
            .from('meritos')
            .update(payload)
            .eq('id', savedId);
        } else {
          const { data: insData } = await supabase
            .from('meritos')
            .insert([{ ...payload, created_at: new Date().toISOString() }])
            .select('id')
            .single();
          if (insData?.id) savedId = insData.id;
        }
      } catch (err) {
        console.warn('Sync en tabla meritos falló, guardando en configuracion:', err);
      }

      // 2. Actualizar lista local y tabla configuracion como respaldo garantizado
      let updatedList: Merito[] = [];
      if (isUpdate) {
        updatedList = meritos.map(m => m.id === editingMerito?.id ? { ...m, ...payload } : m);
      } else {
        const newMerito: Merito = {
          ...payload,
          id: savedId || `merito_${Date.now()}`,
          created_at: new Date().toISOString()
        };
        updatedList = [newMerito, ...meritos];
      }

      try {
        const { data: existing } = await supabase
          .from('configuracion')
          .select('id')
          .eq('clave', 'sistema_meritos')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('configuracion')
            .update({ valor: JSON.stringify(updatedList) })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('configuracion')
            .insert({ clave: 'sistema_meritos', valor: JSON.stringify(updatedList) });
        }
      } catch (e) {}

      setMeritos(updatedList);
      window.dispatchEvent(new CustomEvent('meritos_updated'));
      await logActivity(
        `${isUpdate ? 'Actualizó' : 'Registró'} reconocimiento/mérito: "${titulo}" con ${socorristasAsignados.length} socorristas`,
        'Operaciones',
        'meritos'
      );

      setModalOpen(false);
      setSuccessMsg(`Mérito "${titulo}" guardado exitosamente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al guardar el mérito: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMerito = async (id: number | string, tit: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el mérito "${tit}"?`)) return;

    try {
      try {
        await supabase.from('meritos').delete().eq('id', id);
      } catch (e) {}

      const filtered = meritos.filter(m => m.id !== id);
      setMeritos(filtered);

      try {
        await supabase
          .from('configuracion')
          .update({ valor: JSON.stringify(filtered) })
          .eq('clave', 'sistema_meritos');
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('meritos_updated'));
      setSuccessMsg(`Mérito "${tit}" eliminado.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      alert('Error eliminando mérito: ' + err.message);
    }
  };

  // Filtrado
  const filteredMeritos = meritos.filter(m => {
    const matchCat = selectedCategoria === 'Todas' || m.categoria === selectedCategoria;
    const term = search.toLowerCase();
    const matchSearch = !term || 
      m.titulo.toLowerCase().includes(term) ||
      m.descripcion?.toLowerCase().includes(term) ||
      m.institucion_otorgante?.toLowerCase().includes(term) ||
      m.socorristas_asignados?.some(s => 
        s.socorrista_nombre.toLowerCase().includes(term) ||
        s.socorrista_carnet.toLowerCase().includes(term)
      );
    return matchCat && matchSearch;
  });

  const totalSocorristasGalardonados = new Set(
    meritos.flatMap(m => (m.socorristas_asignados || []).map(s => s.socorrista_id))
  ).size;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">
            <Award className="w-4 h-4" />
            <span>Operaciones Institucionales</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Méritos, Premios y Reconocimientos
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Registro oficial de misiones humanitarias, condecoraciones al valor, distinciones y reconocimientos otorgados al personal voluntario.
          </p>
        </div>

        {canManageMeritos && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer self-start md:self-auto shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Reconocimiento / Mérito
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tarjetas de Estadísticas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-gray-900">{meritos.length}</span>
            <span className="block text-3xs font-semibold text-gray-400 uppercase">Méritos Registrados</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-gray-900">{totalSocorristasGalardonados}</span>
            <span className="block text-3xs font-semibold text-gray-400 uppercase">Socorristas Distinguidos</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Medal className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-gray-900">
              {meritos.filter(m => m.categoria === 'Misión Humanitaria').length}
            </span>
            <span className="block text-3xs font-semibold text-gray-400 uppercase">Misiones Humanitarias</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por mérito, socorrista o carnet..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-3xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Categoría:</span>
          <select
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
            className="text-xs px-3 py-2 border border-gray-300 rounded-xl outline-none bg-white font-medium"
          >
            <option value="Todas">Todas las categorías</option>
            {CATEGORIAS_MERITO.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Listado de Méritos */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">
          Cargando méritos institucionales...
        </div>
      ) : filteredMeritos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">No se encontraron méritos o reconocimientos</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {search ? 'No hay registros que coincidan con la búsqueda.' : 'Aún no se han registrado reconocimientos u honores institucionales.'}
          </p>
          {canManageMeritos && !search && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Crear Primer Mérito
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMeritos.map((merito) => (
            <div
              key={merito.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:border-emerald-300 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900 tracking-tight">
                        {merito.titulo}
                      </h3>
                      <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {merito.categoria}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-3xs text-gray-500 mt-1">
                      <span className="flex items-center">
                        <Building2 className="w-3 h-3 mr-1 text-gray-400" />
                        Otorgado por: <strong className="ml-1 text-gray-700">{merito.institucion_otorgante}</strong>
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                        Fecha: <strong className="ml-1 text-gray-700">{merito.fecha_merito}</strong>
                      </span>
                      <span className="flex items-center text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                        <Users className="w-3 h-3 mr-1" />
                        {merito.socorristas_asignados?.length || 0} Socorristas Galardonados
                      </span>
                    </div>
                  </div>
                </div>

                {canManageMeritos && (
                  <div className="flex items-center space-x-1.5 self-end sm:self-start">
                    <button
                      type="button"
                      onClick={() => openEditModal(merito)}
                      className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                      title="Editar mérito o socorristas asignados"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMerito(merito.id!, merito.titulo)}
                      className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      title="Eliminar mérito"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Párrafo de Detalles / Descripción */}
              {merito.descripcion && (
                <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/60 text-xs text-gray-700 leading-relaxed">
                  <p className="whitespace-pre-line">{merito.descripcion}</p>
                </div>
              )}

              {/* Socorristas Galardonados con este Mérito */}
              <div>
                <h5 className="text-3xs font-extrabold uppercase tracking-wider text-gray-500 mb-2 flex items-center">
                  <Medal className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  Personal que posee este reconocimiento ({merito.socorristas_asignados?.length || 0}):
                </h5>

                {(!merito.socorristas_asignados || merito.socorristas_asignados.length === 0) ? (
                  <span className="text-3xs text-gray-400 italic block">
                    No se han vinculado socorristas a este mérito aún.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {merito.socorristas_asignados.map((s, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-3xs shadow-2xs hover:border-emerald-300 transition"
                      >
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center mr-1.5 text-4xs">
                          {idx + 1}
                        </span>
                        <strong className="text-gray-900 mr-1">{s.socorrista_nombre}</strong>
                        <span className="font-mono text-emerald-700 font-semibold mr-1.5">({s.socorrista_carnet})</span>
                        {s.seccional_nombre && (
                          <span className="text-gray-400">[{s.seccional_nombre}]</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR MÉRITO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">
                  {editingMerito ? 'Editar Reconocimiento / Mérito' : 'Nuevo Reconocimiento / Mérito Institucional'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-emerald-700 text-emerald-100 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMerito} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">
                    Título o Nombre del Mérito / Reconocimiento: *
                  </label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej. Misión Humanitaria Valencia 2024, Medalla al Valor, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Categoría del Mérito:</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none bg-white font-medium"
                  >
                    {CATEGORIAS_MERITO.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Fecha del Mérito o Condecoración:</label>
                  <input
                    type="date"
                    value={fechaMerito}
                    onChange={(e) => setFechaMerito(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none bg-white font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">Institución u Órgano que Otorga:</label>
                  <input
                    type="text"
                    value={institucion}
                    onChange={(e) => setInstitucion(e.target.value)}
                    placeholder="Cruz Verde Salvadoreña / Protección Civil / Presidencia..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">
                    Párrafo de Detalles y Justificación Institucional:
                  </label>
                  <textarea
                    rows={3}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Describa los actos meritorios, contexto de la misión humanitaria o motivo de la distinción honorífica..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* SECCIÓN: SOCORRISTAS QUE POSEEN ESTE MÉRITO */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center">
                    <Users className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Socorristas Condecorados ({socorristasAsignados.length})
                  </h4>
                  <span className="text-3xs text-gray-400">
                    Aparecerá directamente en el perfil de cada socorrista
                  </span>
                </div>

                {/* Buscador y selector de socorrista */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-6">
                      <select
                        value={selectedSocorristaId}
                        onChange={(e) => setSelectedSocorristaId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none bg-white text-xs"
                      >
                        <option value="">-- Seleccionar Socorrista a Agregar --</option>
                        {allSocorristas.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.nombreCompleto} ({s.carnet}) - {s.seccional_nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={notaIndividual}
                        onChange={(e) => setNotaIndividual(e.target.value)}
                        placeholder="Nota/Rango (ej. Mención Honorífica)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none text-xs bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddSocorristaToMerito}
                        disabled={!selectedSocorristaId}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition disabled:opacity-40 cursor-pointer"
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de socorristas asignados */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {socorristasAsignados.length === 0 ? (
                    <div className="p-3 text-center text-3xs text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                      No hay socorristas asignados aún. Seleccione arriba y haga clic en "+ Agregar".
                    </div>
                  ) : (
                    socorristasAsignados.map(soc => (
                      <div
                        key={soc.socorrista_id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-gray-200 text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-3xs font-bold flex items-center justify-center">
                            ✓
                          </span>
                          <div>
                            <span className="font-bold text-gray-900">{soc.socorrista_nombre}</span>
                            <span className="font-mono text-emerald-700 ml-1.5">({soc.socorrista_carnet})</span>
                            {soc.seccional_nombre && (
                              <span className="text-gray-400 text-3xs ml-1">• {soc.seccional_nombre}</span>
                            )}
                            {soc.nota_distincion && (
                              <span className="text-amber-700 text-3xs block font-medium">Nota: {soc.nota_distincion}</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSocorrista(soc.socorrista_id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition"
                          title="Remover de este mérito"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingMerito ? 'Guardar Cambios' : 'Registrar Reconocimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
