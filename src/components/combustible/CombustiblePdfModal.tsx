import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import {
  SolicitudCombustible,
  CombustibleConfig,
  resolveCombustibleLogoUrl,
  formatSolicitudCombustibleFechaHoraSV,
} from '../../types/combustible';
import SmartStorageImage from '../common/SmartStorageImage';
import PdfWatermarkOverlay from '../common/PdfWatermarkOverlay';
import { formatFechaHoraSV } from '../../utils/dateUtils';
import { isSolicitudFinalizada } from '../../utils/solicitudLimite';

interface CombustiblePdfModalProps {
  solicitud: SolicitudCombustible;
  config: CombustibleConfig;
  onClose: () => void;
}

export default function CombustiblePdfModal({
  solicitud,
  config,
  onClose
}: CombustiblePdfModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const fechaHoraSV = formatSolicitudCombustibleFechaHoraSV(solicitud);
  const resolvedLogoUrl = resolveCombustibleLogoUrl(config);

  const getFontFamilyClass = () => {
    switch (config.pdfFontFamily) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      default:
        return 'font-sans';
    }
  };

  const getFontSizeClass = () => {
    switch (config.pdfFontSize) {
      case 'small':
        return 'text-xs';
      case 'large':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  const logoSizeClass =
    config.pdfLogoSize === 'small'
      ? 'w-12 h-12'
      : config.pdfLogoSize === 'large'
        ? 'w-20 h-20'
        : 'w-16 h-16';

  const handlePrint = () => {
    window.print();
  };

  const vehiculoDisplay = [solicitud.vehiculo_marca, solicitud.vehiculo_modelo].filter(Boolean).join(' ').trim();
  const hasOptionalRow =
    (config.mostrarVehiculo && Boolean(vehiculoDisplay)) ||
    (config.mostrarPlaca && Boolean(solicitud.vehiculo_placa)) ||
    (config.mostrarTipoGasolina && Boolean(solicitud.tipo_combustible)) ||
    (config.mostrarGalones && solicitud.galones_solicitados !== undefined && solicitud.galones_solicitados !== null && String(solicitud.galones_solicitados).trim() !== '') ||
    (config.mostrarCantidadDinero && solicitud.cantidad_dinero !== undefined && solicitud.cantidad_dinero !== null && String(solicitud.cantidad_dinero).trim() !== '');

  const nombreJefatura = (config.pdfNombreJefaturaOperaciones || solicitud.autorizado_por || '').trim();
  const cargoJefatura = (config.pdfLabelFirmaAdmin || 'Jefatura de Operaciones').trim();
  const labelFirmaSolicitante = (config.pdfLabelFirmaSolicitante || 'Firma del Solicitante').trim();
  const textoSello = (config.pdfTextoSelloInstitucional || 'Sello Institucional Oficial').trim();
  const esFinalizada = isSolicitudFinalizada(solicitud.estado);
  const estadoDisplay = esFinalizada ? 'Finalizado' : solicitud.estado;
  const fechaResolucionRaw = solicitud.fecha_autorizacion || (esFinalizada ? solicitud.updated_at : null);
  const fechaResolucionTexto = fechaResolucionRaw ? formatFechaHoraSV(fechaResolucionRaw) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex flex-col items-center justify-start p-4 md:p-8">

      {/* Barra de control superior */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-4 mb-4 flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-2">
          <Printer className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-gray-900 text-sm">
            Vista Previa de Documento Oficial PDF (Tamaño Carta / Letter)
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / Guardar como PDF
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* DOCUMENTO OFICIAL PDF */}
      <div
        ref={printAreaRef}
        id="hoja-solicitud-combustible-print"
        className={`w-full max-w-[816px] min-h-[1056px] bg-white text-black p-10 md:p-14 shadow-2xl relative flex flex-col justify-between border border-gray-300 leading-relaxed ${getFontFamilyClass()} ${getFontSizeClass()} print:m-0 print:p-8 print:shadow-none print:border-none print:w-full`}
        style={{ boxSizing: 'border-box' }}
      >
        {/* Marca de agua institucional */}
        <PdfWatermarkOverlay
          enabled={config.pdfWatermark}
          imageUrl={config.pdfWatermarkImgUrl}
          text={config.pdfWatermarkText}
          opacity={config.pdfWatermarkOpacity}
          scale={config.pdfWatermarkScale}
          position={config.pdfWatermarkPosition}
        />

        <div className="relative z-10 space-y-6">

          {/* Encabezado: Logo + Título Oficial + Fecha/Hora (El Salvador) */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4 gap-4">

            <div className="flex items-center space-x-4">
              {config.pdfMostrarLogoHeader && (
                <SmartStorageImage
                  src={resolvedLogoUrl}
                  alt="Logo Institucional Cruz Verde"
                  className={`object-contain shrink-0 ${logoSizeClass}`}
                  fallback={
                    <div className="w-16 h-16 rounded-full border-2 border-green-800 bg-white flex flex-col items-center justify-center text-center p-1 shrink-0 shadow-xs">
                      <span className="text-[7px] font-bold text-green-900 leading-none">CRUZ VERDE</span>
                      <span className="text-2xl font-black text-green-800 leading-none my-0.5">+</span>
                      <span className="text-[7px] font-bold text-green-900 leading-none">EL SALVADOR</span>
                    </div>
                  }
                />
              )}

              <div>
                <h1 className="text-lg md:text-xl font-black text-gray-900 tracking-wider uppercase leading-tight">
                  {config.pdfTitulo}
                </h1>
                <h2 className="text-sm md:text-base font-extrabold text-gray-800 tracking-wide uppercase mt-0.5 leading-tight">
                  {config.pdfSubtitulo}
                </h2>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">
                  {config.pdfSubtituloSecundario || 'Documento Oficial Administrativo'}
                </p>
                <span className="text-xs text-gray-600 block mt-1">
                  Folio: <strong className="text-black font-mono">{solicitud.folio}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4 shrink-0">
              {config.pdfMostrarLogoSecundario && config.pdfLogoSecundarioUrl && (
                <SmartStorageImage
                  src={config.pdfLogoSecundarioUrl}
                  alt="Logo Secundario"
                  className={`object-contain ${
                    config.pdfLogoSecundarioSize === 'small' ? 'w-10 h-10' : config.pdfLogoSecundarioSize === 'large' ? 'w-18 h-18' : 'w-14 h-14'
                  }`}
                />
              )}

              <div className="text-right text-xs space-y-1">
                <span className="text-gray-500 block text-3xs uppercase tracking-wider font-semibold">
                  Fecha de Solicitud
                </span>
                <span className="font-bold text-gray-900 block font-mono">
                  {fechaHoraSV.completa}
                </span>
                {esFinalizada && fechaResolucionTexto && (
                  <div className="pt-0.5">
                    <span className="text-emerald-700 block text-3xs uppercase tracking-wider font-semibold">
                      Fecha de Resolución
                    </span>
                    <span className="font-bold text-emerald-950 block font-mono">
                      {fechaResolucionTexto}
                    </span>
                  </div>
                )}
                <span className="text-[10px] text-gray-500 block">
                  (Hora de El Salvador)
                </span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded font-bold border text-2xs uppercase tracking-wide ${
                    esFinalizada
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-400'
                      : 'bg-gray-100 text-gray-800 border-gray-300'
                  }`}
                >
                  Estado: {estadoDisplay}
                </span>
              </div>
            </div>

          </div>

          {/* Bloque Oficial de Resolución (cuando la solicitud está finalizada) */}
          {esFinalizada && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Fecha de Solicitud
                </span>
                <span className="font-bold font-mono text-gray-900 block mt-0.5">
                  {fechaHoraSV.completa}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Fecha de Resolución
                </span>
                <span className="font-bold font-mono text-emerald-950 block mt-0.5">
                  {fechaResolucionTexto || 'Registrada al finalizar'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Estado de la Solicitud
                </span>
                <span className="font-extrabold uppercase tracking-wide text-emerald-900 block mt-0.5">
                  Finalizado
                </span>
                {solicitud.autorizado_por && (
                  <span className="text-[10px] text-emerald-800 block truncate">
                    Por: {solicitud.autorizado_por}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Grid de 2 Columnas de Datos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

            {/* 1. Nombre del solicitante */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelSolicitante}:
              </span>
              <span className="font-bold text-gray-900 block">
                {solicitud.nombre_solicitante}
              </span>
            </div>

            {/* 2. Seccional */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelSeccional}:
              </span>
              <span className="font-bold text-gray-900 block">
                {solicitud.seccional_nombre}
              </span>
            </div>

            {/* 3. Director de la seccional */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelDirector}:
              </span>
              <span className="font-semibold text-gray-900 block">
                {solicitud.director_nombre}
              </span>
            </div>

            {/* 4. Tipo de Actividad */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelActividad || 'Tipo de Actividad'}:
              </span>
              <span className="font-bold text-gray-900 block">
                {solicitud.actividad}
              </span>
            </div>

            {/* 5. Correo Electrónico */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelCorreo}:
              </span>
              <span className="font-semibold text-gray-900 block break-all">
                {solicitud.correo_electronico}
              </span>
            </div>

            {/* 6. Teléfono / Contacto */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelContacto}:
              </span>
              <span className="font-semibold text-gray-900 block font-mono">
                {solicitud.telefono_solicitante}
              </span>
            </div>

            {/* 7. ¿Entregó liquidación del mes anterior? */}
            <div className={`bg-[#f3f4f6] rounded-xl p-3 border border-gray-200 ${solicitud.entrego_liquidacion_anterior ? 'md:col-span-2' : ''}`}>
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelLiquidacion}
              </span>
              <span className="font-bold text-gray-900 block">
                {solicitud.entrego_liquidacion_anterior ? 'Sí' : 'No'}
              </span>
            </div>

            {/* 8. Motivo (solo se muestra si respondió NO) */}
            {!solicitud.entrego_liquidacion_anterior && (
              <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  {config.pdfLabelMotivo}:
                </span>
                <span className="font-medium text-gray-900 block">
                  {solicitud.motivo_no_liquidacion || 'No especificado'}
                </span>
              </div>
            )}

            {/* Campos Opcionales: solo si están activos en Plantilla */}
            {hasOptionalRow && (
              <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
                {config.mostrarVehiculo && vehiculoDisplay && (
                  <div>
                    <span className="text-3xs font-bold text-gray-600 uppercase block">Vehículo / Unidad:</span>
                    <span className="font-semibold text-gray-900">{vehiculoDisplay}</span>
                  </div>
                )}
                {config.mostrarPlaca && solicitud.vehiculo_placa && (
                  <div>
                    <span className="text-3xs font-bold text-gray-600 uppercase block">Placa:</span>
                    <span className="font-bold font-mono text-gray-900">{solicitud.vehiculo_placa}</span>
                  </div>
                )}
                {config.mostrarTipoGasolina && solicitud.tipo_combustible && (
                  <div>
                    <span className="text-3xs font-bold text-gray-600 uppercase block">Tipo de Gasolina:</span>
                    <span className="font-semibold text-gray-900">{solicitud.tipo_combustible}</span>
                  </div>
                )}
                {config.mostrarGalones && solicitud.galones_solicitados !== undefined && solicitud.galones_solicitados !== null && String(solicitud.galones_solicitados).trim() !== '' && (
                  <div>
                    <span className="text-3xs font-bold text-gray-600 uppercase block">Galones:</span>
                    <span className="font-bold text-gray-900">{solicitud.galones_solicitados} Gl.</span>
                  </div>
                )}
                {config.mostrarCantidadDinero && solicitud.cantidad_dinero !== undefined && solicitud.cantidad_dinero !== null && String(solicitud.cantidad_dinero).trim() !== '' && (
                  <div>
                    <span className="text-3xs font-bold text-gray-600 uppercase block">Cantidad de Dinero:</span>
                    <span className="font-bold text-gray-900">${Number(solicitud.cantidad_dinero).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Observaciones */}
            <div className="md:col-span-2 bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelObservaciones}
              </span>
              <span className="font-medium text-gray-800 block">
                {solicitud.observaciones || 'Sin observaciones adicionales registradas.'}
              </span>
            </div>

          </div>

          {/* Sección de Firmas y Sello Institucional Oficial */}
          <div className="pt-10 grid grid-cols-3 gap-5 items-end text-center">

            {/* Firma 1: Solicitante (F. arriba, nombre abajo) */}
            <div className="flex flex-col items-center justify-end px-2">
              <div className="w-full flex items-end gap-1.5 mb-2">
                <span className="text-sm font-bold text-gray-900 leading-none shrink-0">F.</span>
                <div className="flex-1 border-b border-gray-900 h-7"></div>
              </div>
              <p className="text-xs font-bold text-gray-900 leading-tight">
                {solicitud.nombre_solicitante}
              </p>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mt-0.5">
                {labelFirmaSolicitante}
              </p>
            </div>

            {/* Centro: Cuadro Sutil para Sello Institucional Oficial */}
            <div className="flex flex-col items-center justify-center px-1">
              {config.pdfMostrarSelloImg && config.pdfSelloImgUrl ? (
                <div className="w-36 h-24 rounded-md border border-dashed border-gray-300/60 flex flex-col items-center justify-center p-2">
                  <SmartStorageImage
                    src={config.pdfSelloImgUrl}
                    alt="Sello Institucional Oficial"
                    className="max-h-16 max-w-full object-contain opacity-85"
                  />
                  <span className="text-[9px] text-gray-400/80 uppercase tracking-wider mt-1">
                    {textoSello}
                  </span>
                </div>
              ) : (
                <div className="w-36 h-24 rounded-md border border-dashed border-gray-300/60 flex items-center justify-center p-2">
                  <span className="text-[10px] text-gray-400/75 font-medium uppercase tracking-wider text-center leading-tight">
                    {textoSello}
                  </span>
                </div>
              )}
            </div>

            {/* Firma 2: Jefatura de Operaciones (F. arriba, nombre editable abajo) */}
            <div className="flex flex-col items-center justify-end px-2">
              <div className="w-full flex items-end gap-1.5 mb-2">
                <span className="text-sm font-bold text-gray-900 leading-none shrink-0">F.</span>
                <div className="flex-1 border-b border-gray-900 h-7"></div>
              </div>
              {nombreJefatura ? (
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {nombreJefatura}
                </p>
              ) : (
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {cargoJefatura}
                </p>
              )}
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mt-0.5">
                {nombreJefatura ? cargoJefatura : 'Autorización Institucional'}
              </p>
            </div>

          </div>

        </div>

        {/* Pie de página institucional */}
        <div className="relative z-10 pt-6 mt-8 border-t border-gray-300 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            {config.pdfMostrarLogoFooter && (
              <SmartStorageImage
                src={config.pdfLogoFooterUrl || resolvedLogoUrl}
                alt="Logo"
                className="w-7 h-7 object-contain"
                fallback={
                  <div className="w-7 h-7 rounded-full border border-green-800 flex items-center justify-center font-bold text-green-900 text-xs">
                    +
                  </div>
                }
              />
            )}
            <span className="font-semibold text-3xs uppercase tracking-wider text-gray-800">
              Cruz Verde Salvadoreña • {config.pdfSubtituloSecundario || 'Documento Oficial Administrativo'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="font-mono font-bold text-gray-900 text-xs">
              {config.pdfCodigoFormulario}
            </span>
            <span className="text-3xs text-gray-500">
              Página 1/1
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
