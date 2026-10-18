import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';

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
    waze_url: ''
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterZona, setFilterZona] = useState<string>('');
  const [filterDepartamento, setFilterDepartamento] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');

  const fetchDirectors = async () => {
    try {
      // Fetch users with the "director" role from usuarios_view
      const { data, error } = await supabase
        .from('usuarios_view')
        .select('id, email, primer_nombre, primer_apellido')
        .eq('role', 'director');
      
      if (error) throw error;
      setDirectorsList(data || []);
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
      const preparedData = {
        ...formData,
        correo: formData.correo?.trim().toLowerCase() || null,
        director_id: formData.director_id || null,
      };

      if (editingId) {
        let { error } = await supabase
          .from('seccionales')
          .update(preparedData)
          .eq('id', editingId);

        // Fallback si la columna correo aún no ha sido creada en la base de datos
        if (error && error.message?.includes('correo')) {
          console.warn('Columna correo no existe aún en seccionales. Guardando sin columna correo.');
          const { correo, ...withoutCorreo } = preparedData;
          const retry = await supabase
            .from('seccionales')
            .update(withoutCorreo)
            .eq('id', editingId);
          error = retry.error;
        }

        if (error) throw error;
        await logActivity('Actualizó seccional', 'Seccional', editingId, { nombre: formData.nombre, correo: formData.correo });
      } else {
        // Fetch max ID to avoid sequence out of sync errors
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

        // Fallback si la columna correo aún no existe
        if (error && error.message?.includes('correo')) {
          console.warn('Columna correo no existe aún en seccionales. Insertando sin columna correo.');
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
          await logActivity('Creó seccional', 'Seccional', data[0].id, { nombre: formData.nombre, correo: formData.correo });
        }
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ nombre: '', direccion: '', telefono1: '', telefono2: '', director: '', subdirector: '', estado: 'Activa', correo: '', director_id: '', departamento: '', zona: 'Central', google_maps_url: '', waze_url: '' });
      setSubmitError('');
      fetchSeccionales();
    } catch (error: any) {
      console.error(error);
      setSubmitError(error.message || 'Error desconocido al guardar la seccional.');
    }
  };

  const handleEdit = (seccional: any) => {
    setFormData({
      nombre: seccional.nombre,
      direccion: seccional.direccion,
      telefono1: seccional.telefono1,
      telefono2: seccional.telefono2 || '',
      director: seccional.director,
      subdirector: seccional.subdirector,
      estado: seccional.estado,
      correo: seccional.correo || '',
      director_id: seccional.director_id || '',
      departamento: seccional.departamento || '',
      zona: seccional.zona || 'Central',
      google_maps_url: seccional.google_maps_url || '',
      waze_url: seccional.waze_url || ''
    });
    setEditingId(seccional.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setSubmitError('');
    setFormData({ nombre: '', direccion: '', telefono1: '', telefono2: '', director: '', subdirector: '', estado: 'Activa', correo: '', director_id: '', departamento: '', zona: 'Central', google_maps_url: '', waze_url: '' });
  };

  if (loading && seccionales.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-gray-500 font-medium">Cargando seccionales...</p>
    </div>
  );

  const filteredSeccionales = seccionales.filter(s => {
    let match = true;
    if (filterZona && s.zona !== filterZona) match = false;
    if (filterDepartamento && s.departamento !== filterDepartamento) match = false;
    return match;
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Seccionales</h1>
          <p className="mt-2 text-sm text-gray-700">Administre las diferentes seccionales de Cruz Verde Salvadoreña.</p>
        </div>
        <div className="mt-4 flex sm:mt-0 sm:ml-4">
          {canEdit && (
            <button
              onClick={() => showForm ? handleCancel() : setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              {showForm ? 'Cancelar' : 'Nueva Seccional'}
            </button>
          )}
        </div>
      </div>
      
      {!showForm && (
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-gray-700 mb-1">Filtrar por Zona</label>
            <select value={filterZona} onChange={e => setFilterZona(e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm border p-2">
              <option value="">Todas las Zonas</option>
              <option value="Central">Central</option>
              <option value="Occidental">Occidental</option>
              <option value="Oriental">Oriental</option>
              <option value="Paracentral">Paracentral</option>
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-gray-700 mb-1">Filtrar por Departamento</label>
            <select value={filterDepartamento} onChange={e => setFilterDepartamento(e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm border p-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900" id="modal-title">
                {editingId ? 'Actualizar Seccional' : 'Nueva Seccional'}
              </h3>
              <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-gray-500">
                <Plus className="h-6 w-6 transform rotate-45" />
              </button>
            </div>
            <div className="p-6">
              {submitError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {submitError}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Nombre de Seccional</label>
                      <div className="mt-1">
                        <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Estado</label>
                      <div className="mt-1">
                        <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2">
                          <option value="Activa">Activa</option>
                          <option value="Inactiva">Inactiva</option>
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Zona</label>
                      <div className="mt-1">
                        <select required value={formData.zona} onChange={e => setFormData({...formData, zona: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2">
                          <option value="Central">Central</option>
                          <option value="Occidental">Occidental</option>
                          <option value="Oriental">Oriental</option>
                          <option value="Paracentral">Paracentral</option>
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Departamento</label>
                      <div className="mt-1">
                        <select required value={formData.departamento} onChange={e => setFormData({...formData, departamento: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2">
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
                    </div>
                    <div className="sm:col-span-6">
                      <label className="block text-sm font-medium text-gray-700">Dirección</label>
                      <div className="mt-1">
                        <input type="text" required value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Teléfono 1</label>
                      <div className="mt-1">
                        <input type="text" required value={formData.telefono1} onChange={e => setFormData({...formData, telefono1: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Teléfono 2 (Opcional)</label>
                      <div className="mt-1">
                        <input type="text" value={formData.telefono2} onChange={e => setFormData({...formData, telefono2: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Enlace de Google Maps</label>
                      <div className="mt-1">
                        <input type="url" placeholder="https://maps.google.com/..." value={formData.google_maps_url} onChange={e => setFormData({...formData, google_maps_url: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Enlace de Waze</label>
                      <div className="mt-1">
                        <input type="url" placeholder="https://waze.com/ul/..." value={formData.waze_url} onChange={e => setFormData({...formData, waze_url: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Director Asignado (Usuario)</label>
                      <div className="mt-1">
                        <select value={formData.director_id} onChange={e => setFormData({...formData, director_id: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2">
                          <option value="">Ninguno</option>
                          {directorsList.map(d => (
                            <option key={d.id} value={d.id}>{d.primer_nombre} {d.primer_apellido} ({d.email})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Director (Nombre - Texto)</label>
                      <div className="mt-1">
                        <input type="text" value={formData.director} onChange={e => setFormData({...formData, director: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Subdirector</label>
                      <div className="mt-1">
                        <input type="text" value={formData.subdirector} onChange={e => setFormData({...formData, subdirector: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Correo Institucional de la Seccional</label>
                      <div className="mt-1">
                        <input 
                          type="email" 
                          placeholder="santaanita@cruzverdesv.org" 
                          value={formData.correo} 
                          onChange={e => setFormData({...formData, correo: e.target.value})} 
                          className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" 
                        />
                      </div>
                      <p className="text-2xs text-gray-500 mt-1">Correo oficial precargado en solicitudes de combustible y compra</p>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:col-start-2 sm:text-sm">
                      {editingId ? 'Actualizar Seccional' : 'Guardar Seccional'}
                    </button>
                    <button type="button" onClick={handleCancel} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:col-start-1 sm:text-sm">
                      Cancelar
                    </button>
                  </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center py-10 text-gray-500">Cargando seccionales...</div>
        ) : filteredSeccionales.length === 0 ? (
          <div className="col-span-full text-center py-10 text-gray-500">No hay seccionales registradas.</div>
        ) : (
          filteredSeccionales.map((seccional) => (
            <div key={seccional.id} className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-primary mr-2" />
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{seccional.nombre}</h3>
                </div>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  seccional.estado === 'Activa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {seccional.estado}
                </span>
              </div>
              <div className="px-4 py-5 sm:p-6 space-y-3">
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">Ubicación:</span> {seccional.zona} - {seccional.departamento}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">Dirección:</span> {seccional.direccion}
                </p>
                <div className="flex space-x-2 mt-2">
                  {seccional.google_maps_url && (
                    <a href={seccional.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Google Maps
                    </a>
                  )}
                  {seccional.waze_url && (
                    <a href={seccional.waze_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      Waze
                    </a>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-medium text-gray-900">Teléfonos:</span> {seccional.telefono1} {seccional.telefono2 ? ` / ${seccional.telefono2}` : ''}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">Usuario Asignado:</span> {directorsList.find(d => d.id === seccional.director_id)?.email || 'Ninguno'}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">Correo Seccional:</span>{' '}
                  {seccional.correo ? (
                    <span className="text-primary font-semibold">{seccional.correo}</span>
                  ) : (
                    <span className="text-gray-400 italic">No asignado</span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">Director (Texto):</span> {seccional.director}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">Subdirector:</span> {seccional.subdirector}
                </p>
              </div>
              {canEdit && (
                <div className="px-4 py-4 sm:px-6 bg-gray-50 flex justify-end space-x-2">
                  <button 
                    onClick={() => handleEdit(seccional)}
                    className="text-primary hover:text-primary-hover"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
