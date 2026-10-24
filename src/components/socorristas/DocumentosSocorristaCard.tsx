import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, Clock, Download, ExternalLink, 
  Trash2, ChevronDown, ChevronUp, AlertCircle, ShieldCheck, History, Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DocumentoSocorrista, TIPOS_DOCUMENTOS } from '../../types/socorrista';
import { useAuth } from '../../contexts/AuthContext';

interface DocumentosSocorristaCardProps {
  socorristaId: number;
  socorristaNombre?: string;
  readOnly?: boolean;
}

export default function DocumentosSocorristaCard({
  socorristaId,
  socorristaNombre,
  readOnly = false
}: DocumentosSocorristaCardProps) {
  const { role, userName } = useAuth();
  const canUpload = !readOnly && (role === 'admin' || role === 'director' || role === 'jefe_seccional');

  const [documentos, setDocumentos] = useState<DocumentoSocorrista[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadDocumentos();
  }, [socorristaId]);

  const loadDocumentos = async () => {
    setLoading(true);
    try {
      let docs: DocumentoSocorrista[] = [];

      // 1. Intentar cargar desde tabla documentos_socorrista en Supabase
      try {
        const { data, error } = await supabase
          .from('documentos_socorrista')
          .select('*')
          .eq('socorrista_id', socorristaId)
          .order('version', { ascending: false });

        if (!error && data) {
          docs = data as DocumentoSocorrista[];
        }
      } catch (err) {
        console.warn('Tabla documentos_socorrista no disponible aún en Supabase:', err);
      }

      // 2. Fallback a tabla configuracion si la tabla aún no tiene datos o no existe
      if (docs.length === 0) {
        try {
          const { data: configRow } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', `socorrista_docs_${socorristaId}`)
            .maybeSingle();

          if (configRow?.valor) {
            docs = JSON.parse(configRow.valor);
          }
        } catch (e) {}
      }

      setDocumentos(docs);
    } catch (e) {
      console.error('Error cargando documentos del socorrista:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: DocumentoSocorrista['tipo_documento']) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('El documento no debe exceder 25 MB.');
      return;
    }

    setUploadingTipo(tipo);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Calcular nueva versión para este tipo de documento
      const existingVersions = documentos.filter(d => d.tipo_documento === tipo);
      const nextVersion = existingVersions.length > 0 
        ? Math.max(...existingVersions.map(d => d.version || 1)) + 1 
        : 1;

      const fileExt = file.name.split('.').pop() || 'pdf';
      const cleanFileName = `doc_${socorristaId}_${tipo}_v${nextVersion}_${Date.now()}.${fileExt}`;
      const filePath = `documentos/${cleanFileName}`;

      // 1. Subir a Supabase Storage (bucket socorristas con fallback a assets)
      let publicUrl = '';
      let uploadRes = await supabase.storage
        .from('socorristas')
        .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/pdf' });

      if (uploadRes.error) {
        uploadRes = await supabase.storage
          .from('assets')
          .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/pdf' });
        if (uploadRes.error) throw uploadRes.error;
        const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      } else {
        const { data } = supabase.storage.from('socorristas').getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      }

      const newDoc: DocumentoSocorrista = {
        id: `doc_${Date.now()}`,
        socorrista_id: socorristaId,
        tipo_documento: tipo,
        nombre_archivo: file.name,
        archivo_url: publicUrl,
        version: nextVersion,
        es_vigente: true,
        tamanio_bytes: file.size,
        fecha_subida: new Date().toISOString(),
        subido_por: userName || 'Sistema'
      };

      // Desmarcar vigencia de versiones anteriores de este tipo
      const updatedDocs = [
        newDoc,
        ...documentos.map(d => d.tipo_documento === tipo ? { ...d, es_vigente: false } : d)
      ];

      // 2. Guardar en tabla Supabase documentos_socorrista (si existe)
      try {
        await supabase
          .from('documentos_socorrista')
          .update({ es_vigente: false })
          .eq('socorrista_id', socorristaId)
          .eq('tipo_documento', tipo);

        await supabase
          .from('documentos_socorrista')
          .insert([{
            socorrista_id: socorristaId,
            tipo_documento: tipo,
            nombre_archivo: file.name,
            archivo_url: publicUrl,
            version: nextVersion,
            es_vigente: true,
            tamanio_bytes: file.size,
            subido_por: userName || 'Sistema'
          }]);
      } catch (err) {
        console.warn('Inserción en documentos_socorrista table falló, sincronizando en configuracion:', err);
      }

      // 3. Guardar copia en tabla configuracion como respaldo garantizado
      try {
        const { data: existing } = await supabase
          .from('configuracion')
          .select('id')
          .eq('clave', `socorrista_docs_${socorristaId}`)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('configuracion')
            .update({ valor: JSON.stringify(updatedDocs) })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('configuracion')
            .insert({ clave: `socorrista_docs_${socorristaId}`, valor: JSON.stringify(updatedDocs) });
        }
      } catch (e) {}

      setDocumentos(updatedDocs);
      setSuccessMsg(`Documento v${nextVersion} subido y registrado exitosamente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error subiendo documento:', err);
      setErrorMsg('Error al subir el archivo: ' + (err.message || 'Error desconocido'));
    } finally {
      setUploadingTipo(null);
      // Reset input
      e.target.value = '';
    }
  };

  const toggleHistory = (tipo: string) => {
    setExpandedHistory(prev => ({ ...prev, [tipo]: !prev[tipo] }));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white shadow-xs rounded-2xl border border-gray-200 overflow-hidden space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 text-emerald-600 mr-2" />
            Expediente y Documentación Digital del Socorrista
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Gestión y control de versiones de Curriculum Vitae (CV), antecedentes penales, solvencia policial y atestados.
          </p>
        </div>
        <span className="text-3xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
          Control de Versiones Activo
        </span>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-800 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-400">
          Cargando expediente digital...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPOS_DOCUMENTOS.map(tipo => {
            const docsOfType = documentos
              .filter(d => d.tipo_documento === tipo.id)
              .sort((a, b) => (b.version || 1) - (a.version || 1));
            
            const activeDoc = docsOfType.find(d => d.es_vigente) || docsOfType[0];
            const previousDocs = docsOfType.filter(d => d !== activeDoc);
            const isHistoryOpen = !!expandedHistory[tipo.id];
            const isUploadingThis = uploadingTipo === tipo.id;

            return (
              <div 
                key={tipo.id}
                className="rounded-2xl border border-gray-200 bg-slate-50/50 p-4 flex flex-col justify-between hover:border-emerald-300 transition-all shadow-2xs"
              >
                <div>
                  {/* Encabezado del tipo de documento */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 leading-tight">
                          {tipo.titulo}
                        </h4>
                        <span className="text-3xs text-gray-400 block mt-0.5">
                          {tipo.descripcion}
                        </span>
                      </div>
                    </div>

                    {tipo.requeridoAnual && (
                      <span className="text-4xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                        Anual
                      </span>
                    )}
                  </div>

                  {/* Estado de la versión activa */}
                  <div className="mt-3.5 pt-3 border-t border-gray-200/70">
                    {activeDoc ? (
                      <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-3xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Versión Vigente (v{activeDoc.version})
                          </span>
                          <span className="text-3xs text-gray-400">
                            {new Date(activeDoc.fecha_subida).toLocaleDateString('es-SV', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-gray-800 truncate" title={activeDoc.nombre_archivo}>
                          {activeDoc.nombre_archivo}
                        </div>

                        <div className="flex items-center justify-between text-3xs text-gray-500 pt-1 border-t border-gray-100">
                          <span>{formatFileSize(activeDoc.tamanio_bytes)} {activeDoc.subido_por ? `• Por: ${activeDoc.subido_por}` : ''}</span>
                          <div className="flex items-center space-x-2">
                            <a
                              href={activeDoc.archivo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                            >
                              <ExternalLink className="w-3 h-3 mr-0.5" />
                              Ver PDF
                            </a>
                            <a
                              href={activeDoc.archivo_url}
                              download={activeDoc.nombre_archivo}
                              className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium"
                            >
                              <Download className="w-3 h-3 mr-0.5" />
                              Bajar
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-400">
                        Sin documento registrado aún
                      </div>
                    )}
                  </div>

                  {/* Historial de versiones anteriores */}
                  {previousDocs.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleHistory(tipo.id)}
                        className="w-full flex items-center justify-between text-3xs font-bold text-gray-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-white transition cursor-pointer"
                      >
                        <span className="flex items-center">
                          <History className="w-3 h-3 mr-1 text-gray-400" />
                          Versiones Anteriores ({previousDocs.length})
                        </span>
                        {isHistoryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isHistoryOpen && (
                        <div className="mt-1.5 space-y-1.5 bg-white p-2.5 rounded-xl border border-gray-200">
                          {previousDocs.map(prevDoc => (
                            <div 
                              key={prevDoc.id || prevDoc.version}
                              className="flex items-center justify-between text-3xs text-gray-600 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                            >
                              <div className="truncate mr-2">
                                <span className="font-bold text-gray-700 mr-1.5">v{prevDoc.version}</span>
                                <span className="text-gray-400">
                                  ({new Date(prevDoc.fecha_subida).toLocaleDateString('es-SV')})
                                </span>
                                <span className="text-gray-500 ml-1 truncate">{prevDoc.nombre_archivo}</span>
                              </div>
                              <a
                                href={prevDoc.archivo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-700 hover:text-emerald-900 font-bold shrink-0 ml-1"
                              >
                                Descargar
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón de subida de nueva versión */}
                {canUpload && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <label className={`w-full inline-flex items-center justify-center py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                      isUploadingThis
                        ? 'bg-gray-100 text-gray-400 border-gray-300 pointer-events-none'
                        : 'bg-white hover:bg-emerald-50 text-gray-800 hover:text-emerald-800 border-gray-300 hover:border-emerald-400'
                    }`}>
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      <span>{isUploadingThis ? 'Subiendo versión...' : activeDoc ? 'Actualizar / Subir Nueva Versión' : 'Subir Documento PDF'}</span>
                      <input
                        type="file"
                        accept=".pdf,application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, tipo.id)}
                        disabled={isUploadingThis}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
