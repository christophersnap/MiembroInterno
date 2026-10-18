import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Phone, Building2, MapPin, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';

const TIPOS_ENTIDAD = [
  'Emergencia',
  'Telefonía',
  'Radio Antena',
  'Agua',
  'Eléctrico',
  'Personal',
  'Otro'
];

export default function Directorio() {
  const { permissions, role } = useAuth();
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const canEdit = permissions?.edit_directorio || role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono_personal: '',
    telefono_base: '',
    direccion: '',
    departamento: '',
    tipo: 'Emergencia'
  });

  const fetchContactos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('directorio_telefonico')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      setContactos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('directorio_telefonico')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);
        
        if (error) throw error;
        await logActivity('Actualizó contacto en directorio', 'Directorio', editingId, { nombre: formData.nombre });
      } else {
        const { data, error } = await supabase
          .from('directorio_telefonico')
          .insert([formData])
          .select();
        
        if (error) throw error;
        if (data && data[0]) {
          await logActivity('Creó contacto en directorio', 'Directorio', data[0].id, { nombre: formData.nombre });
        }
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ nombre: '', telefono_personal: '', telefono_base: '', direccion: '', departamento: '', tipo: 'Emergencia' });
      fetchContactos();
    } catch (error: any) {
      console.error(error);
      alert('Error al guardar el contacto');
    }
  };

  const handleEdit = (contacto: any) => {
    setFormData({
      nombre: contacto.nombre,
      telefono_personal: contacto.telefono_personal || '',
      telefono_base: contacto.telefono_base || '',
      direccion: contacto.direccion || '',
      departamento: contacto.departamento || '',
      tipo: contacto.tipo || 'Emergencia'
    });
    setEditingId(contacto.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!canEdit) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${nombre}?`)) return;

    try {
      const { error } = await supabase.from('directorio_telefonico').delete().eq('id', id);
      if (error) throw error;
      
      await logActivity('Eliminó contacto del directorio', 'Directorio', id, { nombre });
      fetchContactos();
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Hubo un error al eliminar el contacto.');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ nombre: '', telefono_personal: '', telefono_base: '', direccion: '', departamento: '', tipo: 'Emergencia' });
  };

  const filteredContactos = contactos.filter(c => {
    const term = searchTerm.toLowerCase();
    return c.nombre.toLowerCase().includes(term) || 
           (c.telefono_personal && c.telefono_personal.toLowerCase().includes(term)) ||
           (c.telefono_base && c.telefono_base.toLowerCase().includes(term)) ||
           (c.tipo && c.tipo.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Directorio Telefónico</h1>
          <p className="mt-2 text-sm text-gray-700">Listado de contactos clave y entidades de apoyo.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <div className="relative rounded-md shadow-sm max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md border p-2"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {canEdit && (
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setFormData({ nombre: '', telefono_personal: '', telefono_base: '', direccion: '', departamento: '', tipo: 'Emergencia' });
              }}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Nuevo Contacto
            </button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 mb-8 transform transition-all">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <h3 className="text-lg font-medium leading-6 text-gray-900">{editingId ? 'Editar Contacto' : 'Nuevo Contacto'}</h3>
              <p className="mt-1 text-sm text-gray-500">
                Información de contacto para la persona o entidad.
              </p>
            </div>
            <div className="mt-5 md:mt-0 md:col-span-2">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Nombre del Contacto / Director</label>
                    <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2" />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Tipo de Entidad</label>
                    <select required value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2">
                      {TIPOS_ENTIDAD.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Teléfono Personal</label>
                    <input type="text" value={formData.telefono_personal} onChange={e => setFormData({...formData, telefono_personal: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2" />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Teléfono Base</label>
                    <input type="text" value={formData.telefono_base} onChange={e => setFormData({...formData, telefono_base: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2" />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Departamento</label>
                    <input type="text" value={formData.departamento} onChange={e => setFormData({...formData, departamento: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2" />
                  </div>
                  <div className="col-span-6">
                    <label className="block text-sm font-medium text-gray-700">Dirección</label>
                    <input type="text" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button type="button" onClick={handleCancel} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    Cancelar
                  </button>
                  <button type="submit" className="rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    {editingId ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">Cargando...</div>
      ) : (
        <div className="mt-8 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContactos.map((contacto) => (
            <div key={contacto.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 line-clamp-2">{contacto.nombre}</h3>
                    <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {contacto.tipo}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex space-x-2 flex-shrink-0">
                      <button onClick={() => handleEdit(contacto)} className="text-gray-400 hover:text-primary">
                        <Edit className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleDelete(contacto.id, contacto.nombre)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 space-y-3">
                  {contacto.telefono_personal && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Phone className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                      Personal: {contacto.telefono_personal}
                    </div>
                  )}
                  {contacto.telefono_base && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Building2 className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                      Base: {contacto.telefono_base}
                    </div>
                  )}
                  {contacto.direccion && (
                    <div className="flex items-start text-sm text-gray-500">
                      <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="line-clamp-2">{contacto.direccion}</span>
                    </div>
                  )}
                </div>
              </div>
              {contacto.departamento && (
                <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-500">
                    Dep/Depto: <span className="text-gray-900">{contacto.departamento}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredContactos.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-gray-500 bg-white shadow rounded-lg border border-gray-200">
              No se encontraron contactos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
