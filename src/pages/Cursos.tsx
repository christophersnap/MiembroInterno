import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';

export default function Cursos() {
  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    duracion: '',
    vigencia_meses: 12,
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchCursos = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('cursos')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      setCursos(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCursos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('cursos')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
        await logActivity('Actualizó curso', 'Curso', editingId, { nombre: formData.nombre });
      } else {
        // Fetch max ID to avoid sequence out of sync errors
        const { data: maxIdData } = await supabase
          .from('cursos')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);
          
        let nextId = undefined;
        if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
          nextId = maxIdData[0].id + 1;
        }

        const insertData = {
          ...(nextId ? { id: nextId } : {}),
          ...formData
        };

        const { data, error } = await supabase
          .from('cursos')
          .insert([insertData])
          .select();
        if (error) throw error;
        if (data && data[0]) {
          await logActivity('Creó curso', 'Curso', data[0].id, { nombre: formData.nombre });
        }
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ nombre: '', descripcion: '', duracion: '', vigencia_meses: 12 });
      fetchCursos();
    } catch (error: any) {
      console.error(error);
      alert('Error al guardar curso: ' + (error.message || 'Error desconocido'));
    }
  };

  const handleEdit = (curso: any) => {
    setFormData({
      nombre: curso.nombre,
      descripcion: curso.descripcion || '',
      duracion: curso.duracion,
      vigencia_meses: curso.vigencia_meses,
    });
    setEditingId(curso.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number, nombre: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el curso "${nombre}"? Esta acción también eliminará el curso del historial de todos los socorristas que lo hayan tomado.`)) return;
    
    try {
      // First delete associated records in socorrista_cursos to prevent foreign key errors
      const { error: fkError } = await supabase
        .from('socorrista_cursos')
        .delete()
        .eq('curso_id', id);
        
      if (fkError) throw fkError;

      const { error } = await supabase
        .from('cursos')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      await logActivity('Eliminó curso', 'Curso', id, { nombre });
      fetchCursos();
    } catch (error: any) {
      console.error(error);
      alert('Error al eliminar curso: ' + (error.message || 'Error desconocido'));
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ nombre: '', descripcion: '', duracion: '', vigencia_meses: 12 });
  };

  if (loading && cursos.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-gray-500 font-medium">Cargando cursos...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de Cursos</h1>
          <p className="mt-2 text-sm text-gray-700">Administre los cursos y certificaciones disponibles para el personal.</p>
        </div>
        <div className="mt-4 flex sm:mt-0 sm:ml-4">
          <button
            onClick={() => showForm ? handleCancel() : setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            {showForm ? 'Cancelar' : 'Nuevo Curso'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Error al cargar datos:</strong> {errorMsg}
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Nombre del Curso</label>
                <div className="mt-1">
                  <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Duración (ej. 40 horas)</label>
                <div className="mt-1">
                  <input type="text" required value={formData.duracion} onChange={e => setFormData({...formData, duracion: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
              <div className="sm:col-span-6">
                <label className="block text-sm font-medium text-gray-700">Descripción</label>
                <div className="mt-1">
                  <textarea rows={3} value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Vigencia (meses)</label>
                <div className="mt-1">
                  <input type="number" required min="1" value={formData.vigencia_meses} onChange={e => setFormData({...formData, vigencia_meses: parseInt(e.target.value)})} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button 
                type="button"
                onClick={handleCancel}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Cancelar
              </button>
              <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                {editingId ? 'Actualizar Curso' : 'Guardar Curso'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {loading ? (
            <li className="px-4 py-4 sm:px-6 text-center text-gray-500">Cargando cursos...</li>
          ) : cursos.length === 0 ? (
            <li className="px-4 py-4 sm:px-6 text-center text-gray-500">No hay cursos registrados.</li>
          ) : (
            cursos.map((curso) => (
              <li key={curso.id}>
                <div className="px-4 py-4 flex items-center sm:px-6">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div className="truncate">
                      <div className="flex text-sm">
                        <p className="font-medium text-primary truncate">{curso.nombre}</p>
                        <p className="ml-1 flex-shrink-0 font-normal text-gray-500">
                          - {curso.duracion}
                        </p>
                      </div>
                      <div className="mt-2 flex">
                        <div className="flex items-center text-sm text-gray-500">
                          <p>Vigencia: {curso.vigencia_meses} meses</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-5 flex-shrink-0 flex space-x-2">
                    <Link
                      to={`/cursos/${curso.id}`}
                      className="p-2 text-indigo-400 hover:text-indigo-500"
                      title="Ver más detalles"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                    <button 
                      onClick={() => handleEdit(curso)}
                      className="p-2 text-primary hover:text-primary-hover"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(curso.id, curso.nombre)}
                      className="p-2 text-red-400 hover:text-red-500"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
