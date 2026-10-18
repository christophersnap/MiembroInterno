import React, { useState, useEffect } from 'react';
import { 
  X, Download, Trash2, Search, Eye, Calendar, User, 
  Mail, Phone, FileSpreadsheet, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Formulario, FormularioRespuesta } from '../../types/formulario';
import { supabase } from '../../lib/supabase';
import { getApiUrl } from '../../lib/api';

interface FormResponsesModalProps {
  form: Formulario | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FormResponsesModal({
  form,
  isOpen,
  onClose
}: FormResponsesModalProps) {
  const [respuestas, setRespuestas] = useState<FormularioRespuesta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRespuesta, setSelectedRespuesta] = useState<FormularioRespuesta | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (form && isOpen) {
      loadRespuestas();
      setSelectedRespuesta(null);
      setSearch('');
    }
  }, [form, isOpen]);

  if (!isOpen || !form) return null;

  const loadRespuestas = async () => {
    setLoading(true);
    try {
      // 1. Cargar desde Supabase en la nube
      const { data: supaResp, error: supaErr } = await supabase
        .from('formulario_respuestas')
        .select('*')
        .eq('formulario_id', form.id)
        .order('id', { ascending: false });

      if (!supaErr && supaResp) {
        setRespuestas(supaResp);
        return;
      }

      // 2. Fallback a endpoint local SQLite
      const res = await fetch(getApiUrl(`/api/formularios/${form.id}/respuestas`));
      if (res.ok) {
        const data = await res.json();
        setRespuestas(data);
      }
    } catch (err) {
      console.error('Error al cargar respuestas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRespuesta = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta respuesta registrada?')) return;
    setDeletingId(id);
    try {
      // 1. Eliminar en Supabase
      await supabase.from('formulario_respuestas').delete().eq('id', id);

      // 2. Notificar API local si aplica
      try {
        await fetch(getApiUrl(`/api/formulario_respuestas/${id}`), { method: 'DELETE' });
      } catch (e) {}

      setRespuestas(prev => prev.filter(r => r.id !== id));
      if (selectedRespuesta?.id === id) setSelectedRespuesta(null);
    } catch (err: any) {
      alert('Error al eliminar respuesta: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Export to Excel / CSV with UTF-8 BOM
  const exportToCsv = () => {
    if (respuestas.length === 0) {
      alert('No hay respuestas para exportar');
      return;
    }

    // Build headers from form fields
    const headers = ['ID', 'Fecha de Registro', 'Nombre Usuario', 'Correo Usuario', 'IP'];
    form.campos.forEach(c => {
      headers.push(c.label);
    });

    const rows: string[][] = [];
    rows.push(headers);

    respuestas.forEach(r => {
      const row = [
        String(r.id),
        new Date(r.created_at).toLocaleString('es-SV'),
        r.usuario_nombre || 'Público / Anónimo',
        r.usuario_email || '',
        r.ip_origen || ''
      ];

      form.campos.forEach(c => {
        const val = r.respuestas ? r.respuestas[c.id] : '';
        if (Array.isArray(val)) {
          row.push(val.join('; '));
        } else if (typeof val === 'boolean') {
          row.push(val ? 'Sí' : 'No');
        } else {
          row.push(String(val ?? ''));
        }
      });

      rows.push(row);
    });

    const csvContent = '\uFEFF' + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `respuestas_${form.slug}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter submissions by search term
  const filteredRespuestas = respuestas.filter(r => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    if (r.usuario_nombre?.toLowerCase().includes(term)) return true;
    if (r.usuario_email?.toLowerCase().includes(term)) return true;
    const valuesString = JSON.stringify(r.respuestas || {}).toLowerCase();
    return valuesString.includes(term);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
                {form.categoria}
              </span>
              <h3 className="text-base font-bold text-gray-900">{form.titulo}</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {respuestas.length} {respuestas.length === 1 ? 'respuesta registrada' : 'respuestas registradas'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportToCsv}
              disabled={respuestas.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Descargar Excel / CSV
            </button>

            <button
              type="button"
              onClick={loadRespuestas}
              disabled={loading}
              title="Recargar respuestas"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, carnet, teléfono, correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-gray-800"
            />
          </div>
          {search && (
            <span className="text-xs text-gray-500">
              {filteredRespuestas.length} de {respuestas.length} resultados
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500">Cargando respuestas registradas...</p>
            </div>
          ) : filteredRespuestas.length === 0 ? (
            <div className="py-16 text-center">
              <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-gray-700">No se encontraron respuestas</h4>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Ninguna respuesta coincide con el criterio de búsqueda.' : 'Aún no se han recibido registros en este formulario.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-2xs">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    {form.campos.slice(0, 4).map((c) => (
                      <th key={c.id} className="px-4 py-3 truncate max-w-[150px]">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRespuestas.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {new Date(r.created_at).toLocaleString('es-SV', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      {form.campos.slice(0, 4).map((c) => {
                        const val = r.respuestas ? r.respuestas[c.id] : null;
                        const display = Array.isArray(val) ? val.join(', ') : typeof val === 'boolean' ? (val ? 'Sí' : 'No') : String(val || '-');
                        return (
                          <td key={c.id} className="px-4 py-3 font-medium text-gray-900 truncate max-w-[150px]" title={display}>
                            {display}
                          </td>
                        );
                      })}

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedRespuesta(r)}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-medium text-xs flex items-center gap-1"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Todo
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === r.id}
                            onClick={() => handleDeleteRespuesta(r.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL DETALLE DE RESPUESTA INDIVIDUAL (HOJA IMPRESA / FICHA)               */}
        {/* ========================================================================= */}
        {selectedRespuesta && (
          <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-xs p-6 overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="max-w-2xl mx-auto w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sm:p-8 space-y-5">
              
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Registro #{selectedRespuesta.id}
                  </span>
                  <h4 className="text-base font-bold text-gray-900 mt-1">{form.titulo}</h4>
                  <p className="text-xs text-gray-500">
                    Recibido el {new Date(selectedRespuesta.created_at).toLocaleString('es-SV')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRespuesta(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid of answers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form.campos.map((campo) => {
                  const val = selectedRespuesta.respuestas ? selectedRespuesta.respuestas[campo.id] : null;
                  const display = Array.isArray(val) 
                    ? val.join(', ') 
                    : typeof val === 'boolean' 
                      ? (val ? 'Sí' : 'No') 
                      : String(val || '(No provisto)');

                  const isFull = campo.width === '100%' || campo.tipo === 'textarea';

                  return (
                    <div 
                      key={campo.id} 
                      className={`p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 ${isFull ? 'sm:col-span-2' : ''}`}
                    >
                      <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                        {campo.label}
                      </span>
                      <span className="block text-sm font-semibold text-gray-900 mt-1 break-words">
                        {display}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>IP Origen: {selectedRespuesta.ip_origen || '127.0.0.1'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedRespuesta(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cerrar Ficha
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
