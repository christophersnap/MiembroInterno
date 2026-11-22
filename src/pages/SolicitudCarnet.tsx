import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import {
  IdCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Send,
  Camera,
  RefreshCw,
  ShieldCheck,
  Clock,
  Layers,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import CarnetPhotoCaptureModal from '../components/common/CarnetPhotoCaptureModal';
import CarnetSubmitConfirmModal from '../components/common/CarnetSubmitConfirmModal';
import SmartStorageImage from '../components/common/SmartStorageImage';
import {
  CarnetRequestStatusInfo,
  createCarnetSolicitudSafe,
  fetchLatestCarnetRequestsMap,
  formatCarnetRequestDate,
  isBlockingCarnetState,
  resubmitCarnetSolicitudSafe,
  uploadCarnetPhotoWithFallback,
  validateSocorristaNameForCarnet,
} from '../utils/solicitudesCarnet';
import { getElSalvadorDateTime } from '../utils/dateUtils';

export default function SolicitudCarnet() {
  const { user, userName } = useAuth();
  const { logos } = useSettings();

  const [carnet, setCarnet] = useState('');
  const [socorrista, setSocorrista] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [blockedRequestInfo, setBlockedRequestInfo] = useState<{
    request: CarnetRequestStatusInfo;
    nombreCompleto: string;
    seccionalNombre: string;
    carnet: string;
  } | null>(null);
  const [previousReviewInfo, setPreviousReviewInfo] = useState<CarnetRequestStatusInfo | null>(null);
  const [resubmitMode, setResubmitMode] = useState<'modify' | 'new'>('modify');
  
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
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const nameValidation = useMemo(
    () => (socorrista ? validateSocorristaNameForCarnet(socorrista) : null),
    [socorrista]
  );

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
    setBlockedRequestInfo(null);
    setPreviousReviewInfo(null);
    setSocorrista(null);

    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select(`
          id,
          carnet,
          dui,
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
        const reqMap = await fetchLatestCarnetRequestsMap([data.id]);
        const latestReq = reqMap[data.id];
        const secObj = Array.isArray(data.seccionales) ? data.seccionales[0] : data.seccionales;
        const nombreCompleto = `${data.primer_nombre || ''} ${data.segundo_nombre || ''} ${data.primer_apellido || ''} ${data.segundo_apellido || ''}`
          .replace(/\s+/g, ' ')
          .trim();

        if (latestReq && isBlockingCarnetState(latestReq.estado_solicitud)) {
          setBlockedRequestInfo({
            request: latestReq,
            nombreCompleto,
            seccionalNombre: secObj?.nombre || 'N/A',
            carnet: data.carnet || carnet,
          });
          setSocorrista(null);
        } else {
          setSocorrista(data);
          setFotoFile(null);
          setFotoPreview(null);
          if (latestReq && (latestReq.estado_solicitud === 'Observada' || latestReq.estado_solicitud === 'Rechazada')) {
            setPreviousReviewInfo(latestReq);
            setResubmitMode('modify');
            setTipoSolicitud(latestReq.tipo_solicitud || 'Nuevo');
            setMotivo(latestReq.motivo || '');
            setDetallesMotivo(latestReq.detalles_motivo || '');
            setPhotoDecision('replace');
          } else {
            setPreviousReviewInfo(null);
            setResubmitMode('new');
            setTipoSolicitud('Nuevo');
            setMotivo('');
            setDetallesMotivo('');
            setPhotoDecision(data.foto_url ? 'keep' : 'replace');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!socorrista) return;
    const currentNameCheck = validateSocorristaNameForCarnet(socorrista);
    if (!currentNameCheck.isValid) {
      setSubmitError(currentNameCheck.message);
      return;
    }
    if (['Cambio', 'Reposición'].includes(tipoSolicitud) && !motivo) {
      setSubmitError("Por favor seleccione el motivo de la reposición/cambio.");
      return;
    }
    if (motivo === 'Otro' && !detallesMotivo) {
      setSubmitError("Por favor detalle el motivo.");
      return;
    }
    const hasValidPhoto = Boolean(
      fotoFile ||
      (photoDecision === 'keep' && socorrista.foto_url) ||
      (previousReviewInfo?.foto_url && resubmitMode === 'modify')
    );
    if (!hasValidPhoto) {
      setSubmitError("Por favor toma o sube una fotografía oficial para el carnet antes de continuar.");
      return;
    }
    if (!confirmInformation || !confirmValidation || !confirmTime) {
      setSubmitError("Debe confirmar todos los términos para continuar.");
      return;
    }

    setShowSubmitConfirmModal(true);
  };

  const executeSubmit = async () => {
    if (!socorrista) return;
    setSubmitError('');
    setLoadingSubmit(true);

    try {
      // Re-verificar que no haya entrado una solicitud activa (individual o en lote) entretanto
      const latestMap = await fetchLatestCarnetRequestsMap([socorrista.id]);
      const latestReq = latestMap[socorrista.id];
      if (latestReq && isBlockingCarnetState(latestReq.estado_solicitud)) {
        const secObjCheck = Array.isArray(socorrista.seccionales) ? socorrista.seccionales[0] : socorrista.seccionales;
        setBlockedRequestInfo({
          request: latestReq,
          nombreCompleto: `${socorrista.primer_nombre} ${socorrista.primer_apellido}`.trim(),
          seccionalNombre: secObjCheck?.nombre || 'N/A',
          carnet: socorrista.carnet || carnet,
        });
        setSocorrista(null);
        setLoadingSubmit(false);
        return;
      }

      let fotoUrl: string | null = null;
      if (fotoFile) {
        fotoUrl = await uploadCarnetPhotoWithFallback(
          fotoFile,
          `${socorrista.carnet || carnet || `SOC_${socorrista.id}`}_solicitud`
        );
      } else if (photoDecision === 'keep' && socorrista.foto_url) {
        fotoUrl = socorrista.foto_url;
      } else if (previousReviewInfo?.foto_url) {
        fotoUrl = previousReviewInfo.foto_url;
      } else if (socorrista.foto_url) {
        fotoUrl = socorrista.foto_url;
      }

      const secObj = Array.isArray(socorrista.seccionales) ? socorrista.seccionales[0] : socorrista.seccionales;
      const seccionalIdResolved = socorrista.seccional_id || secObj?.id || null;
      const seccionalNombreResolved = secObj?.nombre || null;
      const nombreElemento = [
        socorrista.primer_nombre,
        socorrista.segundo_nombre,
        socorrista.primer_apellido,
        socorrista.segundo_apellido,
      ]
        .filter((p) => Boolean(p && String(p).trim()))
        .join(' ');

      const commonInput = {
        socorrista_id: socorrista.id,
        carnet: socorrista.carnet || carnet,
        nombre_completo: nombreElemento,
        seccional_id: seccionalIdResolved,
        seccional_nombre: seccionalNombreResolved,
        tipo_solicitud: tipoSolicitud,
        motivo: ['Cambio', 'Reposición'].includes(tipoSolicitud) ? motivo : null,
        detalles_motivo: motivo === 'Otro' ? detallesMotivo : null,
        foto_url: fotoUrl,
        solicitado_por: userName || nombreElemento,
        solicitado_por_email: user?.email || null,
        es_lote: false,
      };

      const saveRes =
        previousReviewInfo && resubmitMode === 'modify'
          ? await resubmitCarnetSolicitudSafe({
              ...commonInput,
              previousRequest: previousReviewInfo,
            })
          : await createCarnetSolicitudSafe(commonInput);

      if (!saveRes.ok) {
        throw new Error(saveRes.error || 'No se pudo registrar la solicitud.');
      }

      window.dispatchEvent(new Event('solicitudes_updated'));
      setShowSubmitConfirmModal(false);
      setSubmitSuccess(true);
      window.scrollTo(0, 0);
    } catch (error: any) {
      console.error("Error submitting request:", error);
      setShowSubmitConfirmModal(false);
      setSubmitError("Ocurrió un error al enviar la solicitud: " + (error?.message || "Error de red"));
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

              {blockedRequestInfo && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-amber-950">
                          Solicitud de Carnet Activa en Proceso
                        </h3>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-amber-900 border border-amber-300">
                          {blockedRequestInfo.request.es_lote
                            ? `Incluido en Lote${blockedRequestInfo.request.lote_id ? ` (${blockedRequestInfo.request.lote_id})` : ''}`
                            : 'Solicitud Individual'}
                        </span>
                      </div>
                      <p className="text-xs text-amber-900">
                        <strong>{blockedRequestInfo.nombreCompleto}</strong> ({blockedRequestInfo.carnet}) — Seccional {blockedRequestInfo.seccionalNombre}
                      </p>
                      <div className="text-xs text-amber-900 bg-white/80 rounded-lg p-2.5 border border-amber-200 space-y-1">
                        <p>
                          <strong>Fecha de solicitud:</strong> {formatCarnetRequestDate(blockedRequestInfo.request.fecha_solicitud)}
                        </p>
                        <p>
                          <strong>Estado actual:</strong> {blockedRequestInfo.request.estado_solicitud} ({blockedRequestInfo.request.tipo_solicitud})
                        </p>
                        {blockedRequestInfo.request.solicitado_por && (
                          <p>
                            <strong>Solicitado por:</strong> {blockedRequestInfo.request.solicitado_por}
                          </p>
                        )}
                      </div>
                      <p className="text-xs font-medium text-amber-900 leading-relaxed pt-0.5">
                        Ya existe una solicitud reciente para este elemento. Debe esperar hasta que un usuario autorizado complete o finalice el trámite, o registre una observación en la solicitud para poder enviar una nueva.
                      </p>
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
              {previousReviewInfo && (
                <div
                  className={`rounded-2xl border p-4 space-y-3 ${
                    previousReviewInfo.estado_solicitud === 'Rechazada'
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-orange-50 border-orange-300 text-orange-950'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        previousReviewInfo.estado_solicitud === 'Rechazada'
                          ? 'text-rose-600'
                          : 'text-orange-600'
                      }`}
                    />
                    <div className="flex-1 min-w-0 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-sm">
                          {previousReviewInfo.estado_solicitud === 'Rechazada'
                            ? 'Tu solicitud anterior fue Rechazada'
                            : 'Tu solicitud anterior recibió una Observación'}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            previousReviewInfo.estado_solicitud === 'Rechazada'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-orange-100 text-orange-800 border-orange-300'
                          }`}
                        >
                          {previousReviewInfo.estado_solicitud}
                        </span>
                      </div>

                      <p>
                        Fecha de solicitud previa:{' '}
                        <strong>{formatCarnetRequestDate(previousReviewInfo.fecha_solicitud)}</strong>
                      </p>

                      {previousReviewInfo.observaciones && (
                        <div className="p-2.5 rounded-xl bg-white/85 border border-black/10">
                          <strong className="block mb-0.5">
                            {previousReviewInfo.estado_solicitud === 'Rechazada'
                              ? 'Motivo del rechazo:'
                              : 'Observación registrada:'}
                          </strong>
                          <p className="leading-relaxed">{previousReviewInfo.observaciones}</p>
                        </div>
                      )}

                      <div className="pt-1 flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoDecision('replace');
                            setShowPhotoModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>
                            {fotoPreview
                              ? 'Cambiar Nueva Fotografía'
                              : 'Cambiar / Actualizar Fotografía Ahora'}
                          </span>
                        </button>
                        {fotoPreview && (
                          <span className="text-[11px] font-bold text-emerald-700">
                            ✓ Nueva fotografía lista para reenviar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Elegir entre modificar la solicitud existente o crear una nueva */}
                  <div className="pt-2 border-t border-black/10 space-y-2">
                    <span className="text-[11px] font-bold block">
                      ¿Cómo deseas proceder con esta solicitud?
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setResubmitMode('modify')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          resubmitMode === 'modify'
                            ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 text-slate-900 shadow-2xs'
                            : 'bg-white/60 border-slate-300/80 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                          Modificar y reenviar esta solicitud
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Actualiza la fotografía/datos de esta solicitud y la envía nuevamente a revisión.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setResubmitMode('new')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          resubmitMode === 'new'
                            ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 text-slate-900 shadow-2xs'
                            : 'bg-white/60 border-slate-300/80 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-slate-700" />
                          Enviar como nueva solicitud
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Registra una nueva solicitud independiente conservando el historial previo.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-blue-900 border-b border-blue-200 pb-1 mb-2">Elemento Identificado</h3>
                    <p className="text-sm text-blue-800">
                      <strong>Nombre:</strong> {socorrista.primer_nombre} {socorrista.segundo_nombre} {socorrista.primer_apellido} {socorrista.segundo_apellido}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>DUI / Carnet Minoridad:</strong> {socorrista.dui || 'No registrado'}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Seccional:</strong> {socorrista.seccionales?.nombre || 'N/A'}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Cargo:</strong> {socorrista.cargo_institucional || 'Socorrista'}
                    </p>
                  </div>
                  {nameValidation && !nameValidation.isValid ? (
                    <AlertTriangle className="h-8 w-8 text-rose-500 shrink-0" />
                  ) : (
                    <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
                  )}
                </div>
              </div>

              {nameValidation && !nameValidation.isValid && (
                <div className="rounded-xl bg-rose-50 border border-rose-300 p-4 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-rose-950">
                        Nombre con caracteres no permitidos para carnet
                      </h4>
                      <p className="text-xs text-rose-900 leading-relaxed">
                        {nameValidation.message}
                      </p>
                      {nameValidation.invalidFields.length > 0 && (
                        <div className="bg-white/90 rounded-lg border border-rose-200 p-2.5 space-y-1 text-xs text-rose-900">
                          {nameValidation.invalidFields.map((field) => (
                            <p key={field.field}>
                              <strong>{field.label}:</strong>{' '}
                              <span className="font-mono bg-rose-100 px-1.5 py-0.5 rounded text-rose-950">
                                {field.value}
                              </span>{' '}
                              <span className="text-rose-700">
                                (Símbolo{field.symbols.length === 1 ? '' : 's'}:{' '}
                                {field.symbols.map((s) => `"${s}"`).join(', ')})
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        {user ? (
                          <Link
                            to={`/socorristas/${socorrista.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Corregir nombre en perfil del elemento
                          </Link>
                        ) : (
                          <p className="text-[11px] font-semibold text-rose-800">
                            Solicita a tu Director o Administrador corregir el nombre del elemento en el sistema antes de tramitar el carnet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-400 bg-white flex items-center justify-center shrink-0">
                        <SmartStorageImage
                          src={socorrista.foto_url}
                          alt="Fotografía actual en perfil"
                          className="w-full h-full object-cover"
                          fallback={<Camera className="w-6 h-6 text-emerald-500" />}
                        />
                      </div>
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

              {submitError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

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
                  disabled={
                    loadingSubmit ||
                    !confirmInformation ||
                    !confirmValidation ||
                    !confirmTime ||
                    Boolean(nameValidation && !nameValidation.isValid)
                  }
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

        {/* Botón de Solicitud en Lote: visible ÚNICAMENTE cuando el usuario ha iniciado sesión */}
        {user && (
          <div className="mt-5 bg-white rounded-xl border border-emerald-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">¿Necesitas solicitar varios carnets a la vez?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Usa la solicitud en lote para seleccionar elementos de tu(s) seccional(es) habilitada(s) desde una sola tabla.
                </p>
              </div>
            </div>
            <Link
              to="/solicitud-carnet/lote"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Layers className="w-4 h-4" />
              Solicitud de Carnet en Lote
            </Link>
          </div>
        )}
      </div>
      </div>

      <CarnetPhotoCaptureModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onPhotoReady={handlePhotoReady}
        title="Fotografía para Solicitud de Carnet"
      />

      <CarnetSubmitConfirmModal
        isOpen={showSubmitConfirmModal}
        onClose={() => setShowSubmitConfirmModal(false)}
        onConfirmFinal={executeSubmit}
        loading={loadingSubmit}
        isBatch={false}
        items={
          socorrista
            ? [
                {
                  id: socorrista.id,
                  nombre: `${socorrista.primer_nombre || ''} ${socorrista.segundo_nombre || ''} ${socorrista.primer_apellido || ''} ${socorrista.segundo_apellido || ''}`
                    .replace(/\s+/g, ' ')
                    .trim(),
                  carnet: socorrista.carnet || carnet,
                  dui: socorrista.dui || null,
                  fotoUrl:
                    fotoPreview ||
                    (photoDecision === 'keep' ? socorrista.foto_url : previousReviewInfo?.foto_url || null),
                },
              ]
            : []
        }
      />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; {getElSalvadorDateTime().year} Cruz Verde Salvadoreña</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
