import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';

export default function CursoDetails() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const [curso, setCurso] = useState<any>(null);
  const [socorristas, setSocorristas] = useState<any[]>([]);
  const [instructores, setInstructores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal for adding socorristas/instructores
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'alumno' | 'instructor'>('alumno');
  const [allSocorristas, setAllSocorristas] = useState<any[]>([]);
  const [selectedSocorrista, setSelectedSocorrista] = useState<string>('');
  const [carnetSearch, setCarnetSearch] = useState('');
  const [foundSocorrista, setFoundSocorrista] = useState<any>(null);
  const [searchError, setSearchError] = useState('');

  // fetchDetails logic remains unchanged...
  const fetchDetails = async () => {
    setLoading(true);
    try {
      const { data: cursoData, error: cursoError } = await supabase
        .from('cursos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (cursoError) throw cursoError;
      setCurso(cursoData);

      const { data: asignados, error: asignadosError } = await supabase
        .from('socorrista_cursos')
        .select(`
          fecha_certificacion,
          socorristas:socorrista_id (
            id,
            carnet,
            primer_nombre,
            primer_apellido,
            estado,
            seccionales:seccional_id (
              nombre
            )
          )
        `)
        .eq('curso_id', id);

      if (asignadosError) throw asignadosError;
      
      const formattedAsignados = asignados?.map(a => ({
        ...a.socorristas,
        fecha_asignacion: a.fecha_certificacion
      })) || [];
      
      setSocorristas(formattedAsignados);

      // Fetch Instructores
      // Fallback in case the table doesn't exist yet, we capture error but don't break the whole app
      try {
        const { data: instructoresData, error: instructoresError } = await supabase
          .from('curso_instructores')
          .select(`
            created_at,
            socorristas:socorrista_id (
              id,
              carnet,
              primer_nombre,
              primer_apellido,
              estado,
              seccionales:seccional_id (
                nombre
              )
            )
          `)
          .eq('curso_id', id);
          
        if (!instructoresError) {
          const formattedInstructores = instructoresData?.map(a => ({
            ...a.socorristas,
            fecha_asignacion: a.created_at
          })) || [];
          setInstructores(formattedInstructores);
        }
      } catch (err) {
        console.warn('curso_instructores table might not exist yet');
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCarnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.startsWith('CVS')) {
      val = val.substring(3);
    }
    
    let formatted = 'CVS';
    if (val.length > 0) formatted += '-' + val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 6);
    
    setCarnetSearch(formatted);
  };

  const handleSearchCarnet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError('');
    setFoundSocorrista(null);
    setSelectedSocorrista('');
    if (!carnetSearch.trim()) return;

    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select(`
          id, 
          carnet, 
          primer_nombre, 
          primer_apellido, 
          foto_url,
          seccionales:seccional_id(nombre)
        `)
        .ilike('carnet', carnetSearch.trim())
        .single();
      
      if (error || !data) {
        setSearchError('No se encontró ningún elemento con ese carnet.');
      } else {
        // Check if already assigned
        const isAssignedAlumno = socorristas.some((s: any) => s.id === data.id);
        const isAssignedInstructor = instructores.some((s: any) => s.id === data.id);
        
        if (modalType === 'alumno' && isAssignedAlumno) {
           setSearchError('Este elemento ya está asignado a este curso como alumno.');
           return;
        }
        if (modalType === 'instructor' && isAssignedInstructor) {
           setSearchError('Este elemento ya está asignado a este curso como instructor.');
           return;
        }

        setFoundSocorrista(data);
        setSelectedSocorrista(data.id.toString());
      }
    } catch (err) {
      setSearchError('Error al buscar carnet.');
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  useEffect(() => {
    if (!showAddModal) {
      setCarnetSearch('');
      setSearchError('');
      setFoundSocorrista(null);
      setSelectedSocorrista('');
    }
  }, [showAddModal]);

  const handleAddSocorrista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSocorrista) return;

    try {
      if (modalType === 'alumno') {
        const { error } = await supabase
          .from('socorrista_cursos')
          .insert({
            curso_id: id,
            socorrista_id: parseInt(selectedSocorrista),
            fecha_certificacion: new Date().toISOString().split('T')[0]
          });

        if (error) throw error;
        await logActivity('Asignó socorrista a curso', 'Curso', id, { socorrista_id: selectedSocorrista });
      } else {
        const { error } = await supabase
          .from('curso_instructores')
          .insert({
            curso_id: id,
            socorrista_id: parseInt(selectedSocorrista)
          });

        if (error) throw error;
        await logActivity('Asignó instructor a curso', 'Curso', id, { socorrista_id: selectedSocorrista });
      }

      setShowAddModal(false);
      setSelectedSocorrista('');
      setCarnetSearch('');
      setFoundSocorrista(null);
      fetchDetails();
    } catch (error: any) {
      console.error(error);
      alert('Error al agregar elemento');
    }
  };

  const handleRemove = async (socorristaId: number, nombre: string, type: 'alumno' | 'instructor') => {
    if (!window.confirm(`¿Remover a ${nombre} de este curso como ${type}?`)) return;
    try {
      if (type === 'alumno') {
        const { error } = await supabase
          .from('socorrista_cursos')
          .delete()
          .eq('curso_id', id)
          .eq('socorrista_id', socorristaId);

        if (error) throw error;
        await logActivity('Removió socorrista de curso', 'Curso', id, { socorrista_id: socorristaId });
      } else {
        const { error } = await supabase
          .from('curso_instructores')
          .delete()
          .eq('curso_id', id)
          .eq('socorrista_id', socorristaId);

        if (error) throw error;
        await logActivity('Removió instructor de curso', 'Curso', id, { instructor_id: socorristaId });
      }
      
      fetchDetails();
    } catch (error) {
      console.error(error);
      alert('Error al remover elemento');
    }
  };

  const filteredSocorristas = socorristas.filter(s => {
    const term = searchTerm.toLowerCase();
    const fullName = `${s.primer_nombre} ${s.primer_apellido}`.toLowerCase();
    return s.carnet?.toLowerCase().includes(term) || fullName.includes(term) || s.seccionales?.nombre?.toLowerCase().includes(term);
  });

  if (loading) {
    return <div className="text-center py-10">Cargando...</div>;
  }

  if (!curso) {
    return <div className="text-center py-10 text-red-500">Curso no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/cursos" className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{curso.nombre}</h1>
          <p className="mt-1 text-sm text-gray-500">{curso.descripcion}</p>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Elementos Asignados</h3>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md border p-2"
                placeholder="Buscar por nombre, carnet..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {(role === 'admin' || role === 'instructor') && (
              <button
                onClick={() => { setModalType('alumno'); setShowAddModal(true); }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Agregar Elemento
              </button>
            )}
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md mt-4">
          <ul className="divide-y divide-gray-200">
            {filteredSocorristas.length === 0 ? (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">No hay elementos asignados.</li>
            ) : (
              filteredSocorristas.map((s) => (
                <li key={s.id} className="px-4 py-4 flex items-center justify-between sm:px-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex text-sm">
                      <p className="font-medium text-gray-900 truncate">
                        {s.primer_nombre} {s.primer_apellido}
                      </p>
                      <p className="ml-2 flex-shrink-0 font-normal text-gray-500">
                        {s.carnet}
                      </p>
                    </div>
                    <div className="mt-2 flex text-sm text-gray-500 gap-4">
                      <span>Seccional: {s.seccionales?.nombre || 'N/A'}</span>
                      <span>Fecha: {new Date(s.fecha_asignacion).toLocaleDateString()}</span>
                      <span>Estado: <span className={`px-2 py-0.5 rounded text-xs ${s.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{s.estado}</span></span>
                    </div>
                  </div>
                  {(role === 'admin' || role === 'instructor') && (
                    <div className="ml-5 flex-shrink-0">
                      <button onClick={() => handleRemove(s.id, `${s.primer_nombre} ${s.primer_apellido}`, 'alumno')} className="text-red-400 hover:text-red-500">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Instructores del Curso</h3>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            {(role === 'admin' || role === 'instructor') && (
              <button
                onClick={() => { setModalType('instructor'); setShowAddModal(true); }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Agregar Instructor
              </button>
            )}
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md mt-4">
          <ul className="divide-y divide-gray-200">
            {instructores.length === 0 ? (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">No hay instructores asignados.</li>
            ) : (
              instructores.map((s) => (
                <li key={s.id} className="px-4 py-4 flex items-center justify-between sm:px-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex text-sm">
                      <p className="font-medium text-gray-900 truncate">
                        {s.primer_nombre} {s.primer_apellido}
                      </p>
                      <p className="ml-2 flex-shrink-0 font-normal text-gray-500">
                        {s.carnet}
                      </p>
                    </div>
                    <div className="mt-2 flex text-sm text-gray-500 gap-4">
                      <span>Seccional: {s.seccionales?.nombre || 'N/A'}</span>
                      <span>Fecha: {new Date(s.fecha_asignacion).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {(role === 'admin' || role === 'instructor') && (
                    <div className="ml-5 flex-shrink-0">
                      <button onClick={() => handleRemove(s.id, `${s.primer_nombre} ${s.primer_apellido}`, 'instructor')} className="text-red-400 hover:text-red-500">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden my-8">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900" id="modal-title">
                {modalType === 'alumno' ? 'Asignar Elemento al Curso' : 'Asignar Instructor al Curso'}
              </h3>
              <button 
                type="button" 
                onClick={() => { setShowAddModal(false); setSelectedSocorrista(''); setCarnetSearch(''); setFoundSocorrista(null); }} 
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddSocorrista}>
                <div className="mb-4 flex space-x-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Carnet del Elemento</label>
                    <input 
                      type="text" 
                      value={carnetSearch} 
                      onChange={handleCarnetChange}
                      maxLength={11}
                      placeholder="CVS-0000-AA" 
                      className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border uppercase"
                    />
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={handleSearchCarnet} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-secondary hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary">
                      Buscar
                    </button>
                  </div>
                </div>

                {searchError && (
                  <p className="mb-4 text-sm text-red-600">{searchError}</p>
                )}

                {foundSocorrista && (
                  <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50 flex items-center space-x-4">
                    {foundSocorrista.foto_url ? (
                      <img src={foundSocorrista.foto_url} alt="Foto" className="h-16 w-16 rounded-full object-cover shadow-sm border border-gray-200" />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shadow-sm">Sin Foto</div>
                    )}
                    <div>
                      <h4 className="text-md font-bold text-gray-900">{foundSocorrista.primer_nombre} {foundSocorrista.primer_apellido}</h4>
                      <p className="text-sm text-gray-500">Carnet: {foundSocorrista.carnet}</p>
                      <p className="text-xs text-gray-500">Seccional: {foundSocorrista.seccionales?.nombre || 'N/A'}</p>
                    </div>
                  </div>
                )}

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button type="submit" disabled={!selectedSocorrista} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:col-start-2 sm:text-sm disabled:opacity-50">
                    Confirmar y Agregar
                  </button>
                  <button type="button" onClick={() => {setShowAddModal(false);}} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1 sm:text-sm">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
