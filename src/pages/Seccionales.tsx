import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  MapPin,
  Phone,
  Copy,
  Check,
  Navigation,
  ExternalLink,
  Mail,
  UserCheck,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import {
  formatInternationalPhone,
  applyInternationalPhoneMask,
  buildTelHref,
  buildGoogleMapsHref,
  buildWazeHref,
} from '../utils/phoneFormat';

export default function Seccionales() {
  const { role, permissions } = useAuth();

  const canEdit = permissions?.edit_seccionales || role === 'admin';
  const [seccionales, setSeccionales] = useState<any[]>([]);
  const [directorsList, setDirectorsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono1: '',
    telefono2: '',
    director: '',
    subdirector: '',
    estado: 'Activa',
    correo: '',
    director_id: '',
    departamento: '',
    zona: 'Central',
    google_maps_url: '',
    waze_url: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterZona, setFilterZona] = useState<string>('');
  const [filterDepartamento, setFilterDepartamento] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');

  // Menú interactivo al tocar un teléfono o dirección (llamar / copiar / abrir mapa)
  const [activePhoneMenuKey, setActivePhoneMenuKey] = useState<string | null>(null);
  const [activeAddressMenuId, setActiveAddressMenuId] = useState<string | number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } catch {
      // Fallback silencioso
    }
  };

  const fetchDirectors = async () => {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_directores_list');
      if (!rpcErr && Array.isArray(rpcData)) {
        setDirectorsList(rpcData);
        return;
      }

      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('id, nombre_usuario, nombre_completo, socorristas (primer_nombre, primer_apellido, email)')
        .eq('role', 'director');

      if (!roleErr && roleRows) {
        const mapped = roleRows.map((r: any) => {
          const soc = Array.isArray(r.socorristas) ? r.socorristas[0] : r.socorristas;
          return {
            id: r.id,
            email: soc?.email || '',
            primer_nombre: soc?.primer_nombre || r.nombre_usuario || r.nombre_completo || 'Director',
            primer_apellido: soc?.primer_apellido || '',
          };
        });
        setDirectorsList(mapped);
      }
    } catch (err) {
      console.error('Error fetching directors:', err);
    }
  };

  const fetchSeccionales = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seccionales')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setSeccionales(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeccionales();
    fetchDirectors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedTel1 = formatInternationalPhone(formData.telefono1);
      const formattedTel2 = formData.telefono2.trim()
        ? formatInternationalPhone(formData.telefono2)
        : '';

      const preparedData = {
        ...formData,
        telefono1: formattedTel1 || formData.telefono1.trim(),
        telefono2: formattedTel2,
        direccion: formData.direccion.trim(),
        correo: formData.correo?.trim().toLowerCase() || null,
        director_id: formData.director_id || null,
      };

      if (editingId) {
        let { error } = await supabase
          .from('seccionales')
          .update(preparedData)
          .eq('id', editingId);

        if (error && error.message?.includes('correo')) {
          const { correo, ...withoutCorreo } = preparedData;
          const retry = await supabase
            .from('seccionales')
            .update(withoutCorreo)
            .eq('id', editingId);
          error = retry.error;
        }

        if (error) throw error;
        await logActivity('Actualizó seccional', 'Seccional', editingId, {
          nombre: formData.nombre,
          correo: formData.correo,
          telefono1: preparedData.telefono1,
        });
      } else {
        const { data: maxIdData } = await supabase
          .from('seccionales')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);

        let nextId = undefined;
        if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
          nextId = maxIdData[0].id + 1;
        }

        const insertData = {
          ...(nextId ? { id: nextId } : {}),
          ...preparedData,
        };

        let { data, error } = await supabase
          .from('seccionales')
          .insert([insertData])
          .select();

        if (error && error.message?.includes('correo')) {
          const { correo, ...withoutCorreo } = insertData;
          const retry = await supabase
            .from('seccionales')
            .insert([withoutCorreo])
            .select();
          data = retry.data;
          error = retry.error;
        }

        if (error) throw error;
        if (data && data[0]) {
          await logActivity('Creó seccional', 'Seccional', data[0].id, {
            nombre: formData.nombre,
            correo: formData.correo,
            telefono1: preparedData.telefono1,
          });
        }
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        nombre: '',
        direccion: '',
        telefono1: '',
        telefono2: '',
        director: '',
        subdirector: '',
        estado: 'Activa',
        correo: '',
        director_id: '',
        departamento: '',
        zona: 'Central',
        google_maps_url: '',
        waze_url: '',
      });
      setSubmitError('');
      fetchSeccionales();
    } catch (error: any) {
      console.error(error);
      setSubmitError(error.message || 'Error desconocido al guardar la seccional.');
    }
  };

  const handleEdit = (seccional: any) => {
    setFormData({
      nombre: seccional.nombre || '',
      direccion: seccional.direccion || '',
      telefono1: formatInternationalPhone(seccional.telefono1),
      telefono2: formatInternationalPhone(seccional.telefono2),
      director: seccional.director || '',
      subdirector: seccional.subdirector || '',
      estado: seccional.estado || 'Activa',
      correo: seccional.correo || '',
      director_id: seccional.director_id || '',
      departamento: seccional.departamento || '',
      zona: seccional.zona || 'Central',
      google_maps_url: seccional.google_maps_url || '',
      waze_url: seccional.waze_url || '',
    });
    setEditingId(seccional.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setSubmitError('');
    setFormData({
      nombre: '',
      direccion: '',
      telefono1: '',
      telefono2: '',
      director: '',
      subdirector: '',
      estado: 'Activa',
      correo: '',
      director_id: '',
      departamento: '',
      zona: 'Central',
      google_maps_url: '',
      waze_url: '',
    });
  };

  if (loading && seccionales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-500 font-medium text-sm">Cargando seccionales...</p>
      </div>
    );
  }

  const filteredSeccionales = seccionales.filter((s) => {
    if (filterZona && s.zona !== filterZona) return false;
    if (filterDepartamento && s.departamento !== filterDepartamento) return false;
    return true;
  });

  const renderInteractivePhone = (seccionalId: string | number, slot: 'tel1' | 'tel2', rawPhone: string) => {
    const formatted = formatInternationalPhone(rawPhone);
    if (!formatted) return null;

    const telHref = buildTelHref(rawPhone);
    const key = `${seccionalId}-${slot}`;
    const isOpen = activePhoneMenuKey === key;
    const isCopied = copiedKey === key;

    return (
      <div key={key} className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActivePhoneMenuKey(isOpen ? null : key)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline decoration-emerald-300 underline-offset-2 tabular-nums cursor-pointer transition-colors"
            title="Toca para llamar o copiar número"
          >
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{formatted}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyText(key, formatted)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
            title="Copiar número"
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700">Copiado</span>
              </>
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>

        {isOpen && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/90">
            {telHref && (
              <a
                href={telHref}
                onClick={() => setActivePhoneMenuKey(null)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Llamar</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                handleCopyText(key, formatted);
                setActivePhoneMenuKey(null);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar número</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Seccionales</h1>
          <p className="mt-1 text-sm text-slate-600">
            Administra las seccionales de Cruz Verde Salvadoreña, teléfonos directos y ubicación.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {canEdit && (
            <button
              type="button"
              onClick={() => (showForm ? handleCancel() : setShowForm(true))}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
              <span>{showForm ? 'Cancelar' : 'Nueva Seccional'}</span>
            </button>
          )}
        </div>
      </div>

      {!showForm && (
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200/80">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrar por Zona</label>
            <select
              value={filterZona}
              onChange={(e) => setFilterZona(e.target.value)}
              className="block w-full border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm border px-3 py-2 outline-none"
            >
              <option value="">Todas las Zonas</option>
              <option value="Central">Central</option>
              <option value="Occidental">Occidental</option>
              <option value="Oriental">Oriental</option>
              <option value="Paracentral">Paracentral</option>
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Filtrar por Departamento
            </label>
            <select
              value={filterDepartamento}
              onChange={(e) => setFilterDepartamento(e.target.value)}
              className="block w-full border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm border px-3 py-2 outline-none"
            >
              <option value="">Todos los Departamentos</option>
              <option value="San Salvador">San Salvador</option>
              <option value="La Libertad">La Libertad</option>
              <option value="Chalatenango">Chalatenango</option>
              <option value="Cuscatlán">Cuscatlán</option>
              <option value="Santa Ana">Santa Ana</option>
              <option value="Ahuachapán">Ahuachapán</option>
              <option value="Sonsonate">Sonsonate</option>
              <option value="San Miguel">San Miguel</option>
              <option value="Usulután">Usulután</option>
              <option value="Morazán">Morazán</option>
              <option value="La Unión">La Unión</option>
              <option value="La Paz">La Paz</option>
              <option value="Cabañas">Cabañas</option>
              <option value="San Vicente">San Vicente</option>
            </select>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900" id="modal-title">
                {editingId ? 'Actualizar Seccional' : 'Nueva Seccional'}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                aria-label="Cerrar formulario"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 sm:p-6 max-h-[80vh] overflow-y-auto">
              {submitError && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                  {submitError}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre de Seccional
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="Activa">Activa</option>
                      <option value="Inactiva">Inactiva</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Zona</label>
                    <select
                      required
                      value={formData.zona}
                      onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="Central">Central</option>
                      <option value="Occidental">Occidental</option>
                      <option value="Oriental">Oriental</option>
                      <option value="Paracentral">Paracentral</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Departamento
                    </label>
                    <select
                      required
                      value={formData.departamento}
                      onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="">Seleccione Departamento</option>
                      <option value="San Salvador">San Salvador</option>
                      <option value="La Libertad">La Libertad</option>
                      <option value="Chalatenango">Chalatenango</option>
                      <option value="Cuscatlán">Cuscatlán</option>
                      <option value="Santa Ana">Santa Ana</option>
                      <option value="Ahuachapán">Ahuachapán</option>
                      <option value="Sonsonate">Sonsonate</option>
                      <option value="San Miguel">San Miguel</option>
                      <option value="Usulután">Usulután</option>
                      <option value="Morazán">Morazán</option>
                      <option value="La Unión">La Unión</option>
                      <option value="La Paz">La Paz</option>
                      <option value="Cabañas">Cabañas</option>
                      <option value="San Vicente">San Vicente</option>
                    </select>
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Calle Principal #12, Colonia..."
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Al guardar una dirección, se habilitará acceso directo para abrir en Google Maps, Waze o copiarla.
                    </p>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teléfono 1 (+503 0000-0000)
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+503 2284-5792"
                      value={formData.telefono1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          telefono1: applyInternationalPhoneMask(e.target.value),
                        })
                      }
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 font-mono tabular-nums focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teléfono 2 (Opcional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+503 7000-0000"
                      value={formData.telefono2}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          telefono2: applyInternationalPhoneMask(e.target.value),
                        })
                      }
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 font-mono tabular-nums focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enlace de Google Maps (Opcional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://maps.google.com/..."
                      value={formData.google_maps_url}
                      onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enlace de Waze (Opcional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://waze.com/ul/..."
                      value={formData.waze_url}
                      onChange={(e) => setFormData({ ...formData, waze_url: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Director Asignado (Usuario)
                    </label>
                    <select
                      value={formData.director_id}
                      onChange={(e) => setFormData({ ...formData, director_id: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="">Ninguno</option>
                      {directorsList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.primer_nombre} {d.primer_apellido} ({d.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Director (Nombre - Texto)
                    </label>
                    <input
                      type="text"
                      value={formData.director}
                      onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subdirector
                    </label>
                    <input
                      type="text"
                      value={formData.subdirector}
                      onChange={(e) => setFormData({ ...formData, subdirector: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Correo Institucional de la Seccional
                    </label>
                    <input
                      type="email"
                      placeholder="santaanita@cruzverdesv.org"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      className="block w-full text-sm border-slate-300 rounded-xl border px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary-hover cursor-pointer"
                  >
                    {editingId ? 'Actualizar Seccional' : 'Guardar Seccional'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center py-10 text-slate-500 text-sm">
            Cargando seccionales...
          </div>
        ) : filteredSeccionales.length === 0 ? (
          <div className="col-span-full text-center py-10 text-slate-500 text-sm bg-white rounded-2xl border border-slate-200/80">
            No hay seccionales registradas con los filtros seleccionados.
          </div>
        ) : (
          filteredSeccionales.map((seccional) => {
            const hasAddress = Boolean(String(seccional.direccion || '').trim());
            const mapsHref = buildGoogleMapsHref(
              seccional.google_maps_url,
              seccional.direccion,
              seccional.departamento,
              seccional.nombre
            );
            const wazeHref = buildWazeHref(
              seccional.waze_url,
              seccional.direccion,
              seccional.departamento
            );
            const addressMenuOpen = activeAddressMenuId === seccional.id;
            const addressCopyKey = `addr-${seccional.id}`;
            const addressCopied = copiedKey === addressCopyKey;
            const directorEmail = directorsList.find((d) => d.id === seccional.director_id)?.email;

            return (
              <div
                key={seccional.id}
                className="bg-white rounded-2xl border border-slate-200/80 flex flex-col justify-between overflow-hidden"
              >
                <div className="divide-y divide-slate-100">
                  {/* Cabecera */}
                  <div className="px-5 py-4 flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {seccional.nombre}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {seccional.zona} · {seccional.departamento || 'Sin departamento'}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        seccional.estado === 'Activa' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {seccional.estado}
                    </span>
                  </div>

                  {/* Dirección y Mapas (interactivo cuando tiene dirección o enlaces) */}
                  <div className="px-5 py-3.5 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-400">Dirección</p>
                    {hasAddress ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveAddressMenuId(addressMenuOpen ? null : seccional.id)
                          }
                          className="w-full text-left flex items-start gap-2 group cursor-pointer"
                          title="Toca para abrir en mapas o copiar dirección"
                        >
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-800 group-hover:text-emerald-800 underline decoration-slate-300 group-hover:decoration-emerald-400 underline-offset-2 leading-snug">
                            {seccional.direccion}
                          </span>
                        </button>

                        {addressMenuOpen && (
                          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                            {mapsHref && (
                              <a
                                href={mapsHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-colors whitespace-nowrap"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Google Maps</span>
                              </a>
                            )}
                            {wazeHref && (
                              <a
                                href={wazeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>Waze</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                handleCopyText(addressCopyKey, seccional.direccion);
                                setActiveAddressMenuId(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {addressCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copiada</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {!addressMenuOpen && (
                          <div className="flex items-center gap-3 pl-6 text-xs">
                            {mapsHref && (
                              <a
                                href={mapsHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
                              >
                                <span>Google Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {wazeHref && (
                              <a
                                href={wazeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-600 hover:text-sky-700 font-medium inline-flex items-center gap-1"
                              >
                                <span>Waze</span>
                                <Navigation className="w-3 h-3" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopyText(addressCopyKey, seccional.direccion)}
                              className="text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              {addressCopied ? (
                                <span className="text-emerald-700">Copiada</span>
                              ) : (
                                <span>Copiar</span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-400 italic">Sin dirección registrada</p>
                        {(seccional.google_maps_url || seccional.waze_url) && (
                          <div className="flex items-center gap-3 text-xs">
                            {seccional.google_maps_url && (
                              <a
                                href={seccional.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
                              >
                                <span>Google Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {seccional.waze_url && (
                              <a
                                href={seccional.waze_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-600 hover:text-sky-700 font-medium inline-flex items-center gap-1"
                              >
                                <span>Waze</span>
                                <Navigation className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Teléfonos con máscara internacional (+503 0000-0000) */}
                  <div className="px-5 py-3.5 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-400">
                      Teléfonos (toca para llamar o copiar)
                    </p>
                    {seccional.telefono1 || seccional.telefono2 ? (
                      <div className="space-y-2">
                        {seccional.telefono1 &&
                          renderInteractivePhone(seccional.id, 'tel1', seccional.telefono1)}
                        {seccional.telefono2 &&
                          renderInteractivePhone(seccional.id, 'tel2', seccional.telefono2)}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Sin teléfono registrado</p>
                    )}
                  </div>

                  {/* Contacto y Autoridades */}
                  <div className="px-5 py-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">Correo:</span>
                      {seccional.correo ? (
                        <a
                          href={`mailto:${seccional.correo}`}
                          className="text-emerald-700 hover:underline font-semibold truncate"
                        >
                          {seccional.correo}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No asignado</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">Director:</span>
                      <span className="truncate">{seccional.director || 'No asignado'}</span>
                    </div>

                    {seccional.subdirector && (
                      <div className="pl-5">
                        <span className="font-medium text-slate-700">Subdirector:</span>{' '}
                        <span>{seccional.subdirector}</span>
                      </div>
                    )}

                    {directorEmail && (
                      <div className="pl-5 text-[11px] text-slate-500 truncate">
                        Cuenta asignada: {directorEmail}
                      </div>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleEdit(seccional)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
