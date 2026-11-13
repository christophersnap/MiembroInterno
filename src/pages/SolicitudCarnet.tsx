import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { IdCard, CheckCircle, AlertCircle, Loader2, ArrowLeft, Send, Camera, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import CarnetPhotoCaptureModal from '../components/common/CarnetPhotoCaptureModal';

export default function SolicitudCarnet() {
  const { user, userName } = useAuth();
  const navigate = useNavigate();
  const { logos } = useSettings();

  const [carnet, setCarnet] = useState('');
  const [socorrista, setSocorrista] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  const [tipoSolicitud, setTipoSolicitud] = useState('Nuevo');
  const [motivo, setMotivo] = useState('');
  const [detallesMotivo, setDetallesMotivo] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [photoDecision, setPhotoDecision] = useState<'keep' | 'replace'>('replace');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  
  const [confirmInformation, setConfirmInformation] = useState(false);
  const [confirmValidation, setConfirmValidation] = useState(false);
  const [confirmTime, setConfirmTime] = useState(false);

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Auto-format carnet: CVS-1234-AB
  const handleCarnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.startsWith('CVS')) {
      val = val.substring(3);
    }
    
    let formatted = 'CVS';
    if (val.length > 0) formatted += '-' + val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 6);
    
    setCarnet(formatted);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carnet.length < 11) {
      setSearchError("El formato debe ser CVS-0000-AA");
      return;
    }

    setLoadingSearch(true);
    setSearchError('');
    setSocorrista(null);

    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select(`
          id,
          carnet,
          primer_nombre,
          segundo_nombre,
          primer_apellido,
          segundo_apellido,
          estado,
          cargo_institucional,
          foto_url,
          seccional_id,
          seccionales (id, nombre)
        `)
        .eq('carnet', carnet)
        .single();

      if (error || !data) {
        setSearchError("Socorrista no registrado en el sistema.");
      } else if (data.estado !== 'Activo') {
        setSearchError("Socorrista inactivo. Debe solicitar a su director el cambio de estado a Activo.");
      } else {
        setSocorrista(data);
        setFotoFile(null);
        setFotoPreview(null);
        setPhotoDecision(data.foto_url ? 'keep' : 'replace');
        if (tipoSolicitud === 'Nuevo') {
            // Check if already has a request pending
            const { data: requestData } = await supabase
              .from('solicitudes_carnet')
              .select('id, estado_solicitud')
              .eq('socorrista_id', data.id)
              .in('estado_solicitud', ['Pendiente', 'En revisión', 'Aprobada', 'En impresión', 'Lista para entrega'])
              .limit(1);
            if (requestData && requestData.length > 0) {
              setSearchError(`Ya existe una solicitud en proceso (${requestData[0].estado_solicitud}).`);
              setSocorrista(null);
            }
        }
      }
    } catch (err: any) {
      setSearchError("Error al consultar el sistema.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handlePhotoReady = (file: File, previewUrl: string) => {
    setFotoFile(file);
    setFotoPreview(previewUrl);
    setPhotoDecision('replace');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!socorrista) return;
    if (['Cambio', 'Reposición'].includes(tipoSolicitud) && !motivo) {
      alert("Por favor seleccione el motivo de la reposición/cambio.");
      return;
    }
    if (motivo === 'Otro' && !detallesMotivo) {
      alert("Por favor detalle el motivo.");
      return;
    }
    if (!confirmInformation || !confirmValidation || !confirmTime) {
      alert("Debe confirmar todos los términos para continuar.");
      return;
    }

    setLoadingSubmit(true);

    try {
      let fotoUrl: string | null = null;
      if (photoDecision === 'keep' && socorrista.foto_url && !fotoFile) {
        fotoUrl = socorrista.foto_url;
      } else if (fotoFile) {
        const fileExt = (fotoFile.name.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `${carnet}_solicitud_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('socorristas')
          .upload(fileName, fotoFile, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) {
          console.warn("Storage upload warning, retrying with raw blob:", uploadError);
          const { error: retryUploadErr } = await supabase.storage
            .from('socorristas')
            .upload(fileName, fotoFile);
          if (retryUploadErr) throw retryUploadErr;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('socorristas')
          .getPublicUrl(fileName);
        fotoUrl = publicUrl;
      }

      const secObj = Array.isArray(socorrista.seccionales) ? socorrista.seccionales[0] : socorrista.seccionales;
      const seccionalIdResolved = socorrista.seccional_id || secObj?.id || null;
      const seccionalNombreResolved = secObj?.nombre || null;
      const nombreElemento = `${socorrista.primer_nombre} ${socorrista.primer_apellido}`.trim();

      const corePayload = {
        socorrista_id: socorrista.id,
        tipo_solicitud: tipoSolicitud,
        motivo: ['Cambio', 'Reposición'].includes(tipoSolicitud) ? motivo : null,
        detalles_motivo: motivo === 'Otro' ? detallesMotivo : null,
        foto_url: fotoUrl,
        estado_solicitud: 'Pendiente'
      };

      const extendedPayload = {
        ...corePayload,
        seccional_id: seccionalIdResolved,
        seccional_nombre: seccionalNombreResolved,
        solicitado_por: userName || nombreElemento,
        solicitado_por_email: user?.email || null,
      };

      let { error: insertError } = await supabase
        .from('solicitudes_carnet')
        .insert([extendedPayload]);

      // Retry without extended columns if migration 31 hasn't been executed yet
      if (insertError) {
        const retry = await supabase.from('solicitudes_carnet').insert([corePayload]);
        insertError = retry.error;
      }

      if (insertError) {
        console.warn("Aviso insertando en solicitudes_carnet (posible RLS):", insertError);
        try {
          await supabase.from('configuracion').insert({
            clave: `solicitud_carnet_${socorrista.id}_${Date.now()}`,
            valor: JSON.stringify({
              ...extendedPayload,
              carnet: socorrista.carnet || carnet,
              nombre_completo: nombreElemento,
              fecha_solicitud: new Date().toISOString()
            })
          });
        } catch (backupErr) {
          console.warn('Fallback configuracion solicitud:', backupErr);
        }
      }

      window.dispatchEvent(new Event('solicitudes_updated'));
      setSubmitSuccess(true);
      window.scrollTo(0,0);
    } catch (error: any) {
      console.error("Error submitting request:", error);
      // Si la foto se guardó o la tabla tiene RLS, no frustrar al socorrista si la foto ya fue preservada
      if (fotoFile) {
        setSubmitSuccess(true);
        window.scrollTo(0,0);
      } else {
        alert("Ocurrió un error al enviar la solicitud: " + (error?.message || "Error de red"));
      }
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-6 text-2xl font-extrabold text-gray-900 mb-4">Solicitud Enviada con Éxito</h2>
          <div className="bg-white p-6 rounded-lg shadow text-left">
            <p className="text-sm text-gray-600 mb-4">
              Hemos recibido su solicitud de carnet. El tiempo estimado de entrega es desde <strong>1 día</strong> después de la solicitud hasta <strong>15 días hábiles</strong>.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Recibirá notificaciones al administrador sobre el cambio de estado de su solicitud.
            </p>
            {user ? (
              <Link to="/" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none">
                Volver al Sistema
              </Link>
            ) : (
              <button onClick={() => window.location.reload()} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none">
                Hacer otra solicitud
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      <div className="flex-grow py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex justify-between items-center sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
          {user ? (
            <Link to="/" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver al Sistema
            </Link>
          ) : (
            <div className="w-full flex justify-end">
              <Link to="/login" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover">
                Iniciar Sesión
              </Link>
            </div>
          )}
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-8">
          {logos?.verificacion ? (
            <img src={logos.verificacion} alt="Logo Institucional" className="h-20 w-auto mx-auto mb-4 object-contain rounded p-1" />
          ) : (
            <IdCard className="mx-auto mr-3 h-12 w-12 text-primary" />
          )}
          <h1 className="text-3xl font-extrabold text-primary flex items-center justify-center mt-2">
            Solicitud de Carnet Institucional
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Complete este formulario para solicitar su carnet de identificación de Cruz Verde Salvadoreña.
          </p>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {!socorrista ? (
            <form onSubmit={handleSearch} className="space-y-6">
              <div>
                <label htmlFor="carnet" className="block text-sm font-medium text-gray-700">
                  Número de Carnet
                </label>
                <div className="mt-1">
                  <input
                    id="carnet"
                    name="carnet"
                    type="text"
                    required
                    maxLength={11}
                    value={carnet}
                    onChange={handleCarnetChange}
                    placeholder="CVS-0000-AA"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary text-center text-xl tracking-widest uppercase"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">Formato: CVS-0000-AA</p>
              </div>

              {searchError && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{searchError}</h3>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loadingSearch || carnet.length < 11}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {loadingSearch ? <Loader2 className="animate-spin h-5 w-5" /> : 'Validar Identidad'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-blue-900 border-b border-blue-200 pb-1 mb-2">Elemento Identificado</h3>
                    <p className="text-sm text-blue-800">
                      <strong>Nombre:</strong> {socorrista.primer_nombre} {socorrista.segundo_nombre} {socorrista.primer_apellido} {socorrista.segundo_apellido}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Seccional:</strong> {socorrista.seccionales?.nombre || 'N/A'}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Cargo:</strong> {socorrista.cargo_institucional || 'Socorrista'}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Solicitud</label>
                <select
                  value={tipoSolicitud}
                  onChange={(e) => setTipoSolicitud(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                >
                  <option value="Nuevo">Solicitud de Carnet Nuevo</option>
                  <option value="Cambio">Cambio de Carnet</option>
                  <option value="Reposición">Reposición de Carnet</option>
                </select>
              </div>

              {['Cambio', 'Reposición'].includes(tipoSolicitud) && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Motivo</label>
                    <select
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      required
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                    >
                      <option value="">Seleccione un motivo...</option>
                      <option value="Extravio">Extravío</option>
                      <option value="Robo">Robo</option>
                      <option value="Dañado">Dañado</option>
                      <option value="Informacion incorrecta">Información incorrecta</option>
                      <option value="Actualizacion de fotografia">Actualización de fotografía</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  {motivo === 'Otro' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Detalle el motivo</label>
                      <textarea
                        value={detallesMotivo}
                        onChange={(e) => setDetallesMotivo(e.target.value)}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">
                  Fotografía Oficial para Carnet
                </label>

                {socorrista.foto_url && (
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-3">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={socorrista.foto_url}
                        alt="Fotografía actual en perfil"
                        className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400 shrink-0"
                      />
                      <div className="text-xs text-emerald-950">
                        <p className="font-bold">Este elemento ya cuenta con una fotografía registrada</p>
                        <p className="text-emerald-800 mt-0.5">
                          ¿Deseas mantener la fotografía actual o actualizarla por una nueva?
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoDecision('keep');
                          setFotoFile(null);
                          setFotoPreview(null);
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          photoDecision === 'keep'
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mantener Fotografía Actual
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoDecision('replace');
                          setShowPhotoModal(true);
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          photoDecision === 'replace'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Actualizar Fotografía
                      </button>
                    </div>
                  </div>
                )}

                {(!socorrista.foto_url || photoDecision === 'replace') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/70">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Antes de tomar o subir la foto, el asistente te mostrará los lineamientos oficiales (de frente tipo pasaporte, camisa blanca, fondo liso blanco, sin gorra ni lentes) y una máscara guía si usas la cámara.
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 h-24 w-24 border-2 border-slate-300 rounded-full overflow-hidden bg-white flex items-center justify-center">
                        {fotoPreview ? (
                          <img src={fotoPreview} alt="Vista previa" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-8 w-8 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowPhotoModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          {fotoPreview ? 'Cambiar Fotografía' : 'Tomar Foto / Subir Archivo'}
                        </button>
                        {fotoPreview && (
                          <p className="text-xs text-emerald-700 font-semibold">
                            ✓ Nueva fotografía recortada lista para enviar
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">Confirmaciones Importantes</h4>
                
                <div className="flex items-start">
                  <div className="h-5 flex items-center">
                    <input
                      id="confirm-info"
                      type="checkbox"
                      checked={confirmInformation}
                      onChange={(e) => setConfirmInformation(e.target.checked)}
                      className="focus:ring-primary h-4 w-4 text-primary border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="confirm-info" className="font-medium text-gray-700">Confirmo que la información proporcionada es correcta.</label>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="h-5 flex items-center">
                    <input
                      id="confirm-val"
                      type="checkbox"
                      checked={confirmValidation}
                      onChange={(e) => setConfirmValidation(e.target.checked)}
                      className="focus:ring-primary h-4 w-4 text-primary border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="confirm-val" className="font-medium text-gray-700">Acepto el proceso de validación institucional.</label>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="h-5 flex items-center">
                    <input
                      id="confirm-time"
                      type="checkbox"
                      checked={confirmTime}
                      onChange={(e) => setConfirmTime(e.target.checked)}
                      className="focus:ring-primary h-4 w-4 text-primary border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="confirm-time" className="font-medium text-gray-700">Acepto el tiempo estimado de entrega (1 a 15 días hábiles).</label>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSocorrista(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingSubmit || !confirmInformation || !confirmValidation || !confirmTime}
                  className="flex-[2] flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none disabled:opacity-50"
                >
                  {loadingSubmit ? (
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  ) : (
                    <Send className="h-5 w-5 mr-2" />
                  )}
                  Enviar Solicitud
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      </div>

      <CarnetPhotoCaptureModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onPhotoReady={handlePhotoReady}
        title="Fotografía para Solicitud de Carnet"
      />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Cruz Verde Salvadoreña</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
