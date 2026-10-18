import React, { useState } from 'react';
import { X, Mail, CheckCircle2, Copy, Send, RefreshCw, Check, FileText, ShieldAlert } from 'lucide-react';
import { SolicitudCombustible, CombustibleConfig } from '../../types/combustible';
import { generarHtmlCorreoCombustible } from '../../lib/emailNotification';

interface CombustibleEmailModalProps {
  solicitud: SolicitudCombustible;
  config: CombustibleConfig;
  onClose: () => void;
  onSendEmail?: (destinatarios: string, cc: string, asunto: string, cuerpoHtml: string) => Promise<void>;
}

export default function CombustibleEmailModal({
  solicitud,
  config,
  onClose,
  onSendEmail
}: CombustibleEmailModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'enviar'>('preview');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Parsear placeholders
  const asuntoParsed = config.asuntoPlantilla
    .replace('[SOLICITANTE]', solicitud.nombre_solicitante)
    .replace('[SECCIONAL]', solicitud.seccional_nombre)
    .replace('[FECHA]', solicitud.fecha_solicitud || new Date().toISOString().split('T')[0])
    .replace('[DIRECTOR]', solicitud.director_nombre)
    .replace('[FOLIO]', solicitud.folio);

  const [destinatario, setDestinatario] = useState(solicitud.correo_electronico || config.correoDestino);
  const [cc, setCc] = useState(config.correoCcDefault);
  const [asunto, setAsunto] = useState(asuntoParsed);

  const fechaEnvioFormateada = solicitud.fecha_envio_completa || `${solicitud.fecha_solicitud || new Date().toISOString().split('T')[0]} ${solicitud.hora_solicitud || '12:00:00'}`;

  const handleCopyText = () => {
    const rawText = `¡Confirmamos de recibido tu solicitud de Combustible!

Estimado(a): ${solicitud.nombre_solicitante}
Comunícate con Oficina Central para ver el estado de tu solicitud

DETALLE DE LA SOLICITUD (${solicitud.folio}):
• Nombre del Solicitante: ${solicitud.nombre_solicitante}
• Seccional: ${solicitud.seccional_nombre}
• Director(a): ${solicitud.director_nombre}
• Actividad: ${solicitud.actividad}
• Ingresa el teléfono del solicitante: ${solicitud.telefono_solicitante}
• Correo Electronico: ${solicitud.correo_electronico}
• ¿A entregado la liquidación de combustible del mes anterior?: ${solicitud.entrego_liquidacion_anterior ? 'Si' : 'No'}${!solicitud.entrego_liquidacion_anterior && solicitud.motivo_no_liquidacion ? ` (Motivo: ${solicitud.motivo_no_liquidacion})` : ''}
• Fecha de envío: ${fechaEnvioFormateada}

${config.correoFooterTexto}`;

    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const pdfFileName = `Solicitud_Combustible_${solicitud.folio}.pdf`;
      const htmlEmail = generarHtmlCorreoCombustible({
        remitenteNombre: 'Cruz Verde Salvadoreña (No Responder)',
        remitenteCorreo: 'no-reply@cruzverdesv.org',
        destinatarioCorreo: destinatario,
        destinatarioNombre: solicitud.nombre_solicitante,
        asunto: asunto,
        seccionalNombre: solicitud.seccional_nombre,
        numeroSolicitud: solicitud.folio
      }, {
        codigoSolicitud: solicitud.folio,
        seccionalNombre: solicitud.seccional_nombre,
        solicitante: solicitud.nombre_solicitante,
        telefonoSolicitante: solicitud.telefono_solicitante,
        correoSolicitante: solicitud.correo_electronico,
        actividad: solicitud.actividad,
        entregoLiquidacionAnterior: !!solicitud.entrego_liquidacion_anterior,
        motivoNoLiquidacion: solicitud.motivo_no_liquidacion,
        fechaEnvio: fechaEnvioFormateada,
        nombreArchivoPdf: pdfFileName
      });

      if (onSendEmail) {
        await onSendEmail(destinatario, cc, asunto, htmlEmail);
      }

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remitente: 'Cruz Verde Salvadoreña (No Responder) <no-reply@cruzverdesv.org>',
          destinatario,
          cc,
          asunto,
          cuerpoHtml: htmlEmail,
          tipo: 'solicitud_combustible',
          nombreArchivoPdf: pdfFileName
        })
      });

      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        setActiveTab('preview');
      }, 1800);
    } catch (err: any) {
      alert(`Error al enviar correo: ${err.message || 'Error de conexión'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 md:p-6">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in flex flex-col max-h-[92vh]">
        
        {/* Barra superior modal */}
        <div className="p-4 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-bold text-gray-900 text-sm md:text-base">
                Acuse de Recibo por Correo Electrónico
              </h3>
              <span className="text-2xs text-gray-500 font-mono">
                Folio: {solicitud.folio}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-gray-200 p-0.5 rounded-lg flex text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  activeTab === 'preview' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                }`}
              >
                Vista Correo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('enviar')}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  activeTab === 'enviar' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                }`}
              >
                Reenviar
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
          
          {activeTab === 'preview' ? (
            <div className="space-y-4">
              
              {/* VISTA IDÉNTICA A LA IMAGEN 2 */}
              <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden font-sans">
                
                {/* Cabecera con Logo Cruz Verde */}
                <div className="bg-[#f3f4f6] p-4 text-center border-b border-gray-200 flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-2 border-green-700 bg-white flex flex-col items-center justify-center text-center p-1 shadow-xs">
                    <span className="text-[7px] font-bold text-green-800 leading-none">CRUZ VERDE</span>
                    <span className="text-xl font-black text-green-700 leading-none my-0.5">+</span>
                    <span className="text-[7px] font-bold text-green-800 leading-none">EL SALVADOR</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-widest mt-1.5">
                    Cruz Verde Salvadoreña
                  </span>
                </div>

                {/* Contenido del Correo */}
                <div className="p-6 md:p-8 space-y-6">
                  
                  {/* Título de Confirmación con Resaltador Amarillo (Imagen 2) */}
                  <div className="text-center space-y-1">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 leading-snug">
                      ¡Confirmamos de recibido tu{' '}
                      <mark className="bg-yellow-200 text-gray-900 px-1.5 py-0.5 rounded">solicitud</mark>
                      <br />
                      de{' '}
                      <mark className="bg-yellow-200 text-gray-900 px-1.5 py-0.5 rounded">Combustible</mark>!
                    </h2>
                  </div>

                  {/* Saludo */}
                  <div className="text-center space-y-1 text-sm text-gray-800">
                    <p className="font-bold text-base text-gray-900">
                      Estimado(a): {solicitud.nombre_solicitante}
                    </p>
                    <p className="text-gray-700">
                      Comunícate con Oficina Central para ver el estado de tu{' '}
                      <mark className="bg-yellow-200 text-gray-900 px-1 rounded">solicitud</mark>
                    </p>
                  </div>

                  {/* Tabla Zebra Idéntica a la Imagen 2 */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden text-xs md:text-sm">
                    <div className="bg-gray-100/90 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                      <span className="font-bold text-gray-700">Nombre del Solicitante:</span>
                      <span className="font-semibold text-gray-900">{solicitud.nombre_solicitante}</span>
                    </div>

                    <div className="bg-white px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                      <span className="font-bold text-gray-700">Seccional:</span>
                      <span className="font-semibold text-gray-900">{solicitud.seccional_nombre}</span>
                    </div>

                    <div className="bg-gray-100/90 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                      <span className="font-bold text-gray-700">Director(a):</span>
                      <span className="font-semibold text-gray-900">{solicitud.director_nombre}</span>
                    </div>

                    <div className="bg-white px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                      <span className="font-bold text-gray-700">Actividad:</span>
                      <span className="font-semibold text-gray-900">{solicitud.actividad}</span>
                    </div>

                    <div className="bg-gray-100/90 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                      <span className="font-bold text-gray-700">Ingresa el teléfono del solicitante:</span>
                      <span className="font-semibold text-gray-900">{solicitud.telefono_solicitante}</span>
                    </div>

                    <div className="bg-white px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                      <span className="font-bold text-gray-700">Correo Electronico:</span>
                      <span className="font-semibold text-blue-700 break-all">{solicitud.correo_electronico}</span>
                    </div>

                    <div className="bg-gray-100/90 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                      <span className="font-bold text-gray-700">¿A entregado la liquidación de combustible del mes anterior?:</span>
                      <span className="font-bold text-gray-900">
                        {solicitud.entrego_liquidacion_anterior ? 'Si' : 'No'}
                        {!solicitud.entrego_liquidacion_anterior && solicitud.motivo_no_liquidacion && (
                          <span className="block text-2xs text-red-700 font-normal">
                            Motivo: {solicitud.motivo_no_liquidacion}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="bg-white px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between">
                      <span className="font-bold text-gray-700">Fecha de envío:</span>
                      <span className="font-semibold text-gray-900">{fechaEnvioFormateada}</span>
                    </div>
                  </div>

                  {/* Pie institucional de soporte (Imagen 2) */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-xs text-gray-700">
                    <p>
                      Cualquier duda o consulta puedes enviar un correo a{' '}
                      <span className="font-bold text-blue-800">{config.correoDestino}</span> o{' '}
                      <span className="font-semibold">llama/whatsapp al {config.correoContactoTelefono}</span>
                    </p>
                  </div>

                  {/* Documento PDF adjunto */}
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-900">
                    <div className="flex items-center space-x-2">
                      <span className="bg-red-600 text-white text-3xs font-extrabold px-1.5 py-0.5 rounded">PDF</span>
                      <div>
                        <span className="font-bold">Solicitud_Combustible_{solicitud.folio}.pdf</span>
                        <span className="block text-3xs text-gray-500">Documento oficial membretado y tabulado adjunto</span>
                      </div>
                    </div>
                    <span className="text-3xs text-red-700 bg-red-100 px-2 py-0.5 rounded font-bold">Adjunto Oficial</span>
                  </div>

                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-white text-xs font-medium transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 mr-1.5" />
                      Copiado al portapapeles
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1.5" />
                      Copiar Contenido
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('enviar')}
                  className="inline-flex items-center px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Enviar o Reenviar Correo
                </button>
              </div>

            </div>
          ) : (
            /* PESTAÑA ENVIAR / REENVIAR CORREO */
            <form onSubmit={handleSend} className="space-y-4">
              {sentSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-base">
                    ¡Notificación de Correo Enviada!
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Se remitió la copia oficial al solicitante y al equipo de control de combustible.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Destinatario Principal (Para:):
                    </label>
                    <input
                      type="email"
                      required
                      value={destinatario}
                      onChange={(e) => setDestinatario(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <span className="text-3xs text-gray-500">
                      Correo del solicitante o de la jefatura que requiere la dotación.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      En Copia (CC:):
                    </label>
                    <input
                      type="text"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="control_combustible@cruzverdesv.org, presidencia@cruzverdesv.org"
                    />
                    <span className="text-3xs text-gray-500">
                      Correos configurados para recibir copia automática institucional.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Asunto:
                    </label>
                    <input
                      type="text"
                      required
                      value={asunto}
                      onChange={(e) => setAsunto(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                    />
                  </div>

                  <div className="p-3 bg-gray-100 rounded-lg text-xs text-gray-700 border border-gray-200">
                    <p className="font-semibold mb-1">Cuerpo automático del correo:</p>
                    <p className="text-3xs text-gray-500 font-mono">
                      Se enviará el formato HTML oficial de acuse de recibo de Cruz Verde Salvadoreña con todos los datos tabulados de la solicitud {solicitud.folio}.
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-900">
                    <div className="flex items-center space-x-2">
                      <span className="bg-red-600 text-white text-3xs font-extrabold px-1.5 py-0.5 rounded">PDF</span>
                      <div>
                        <span className="font-bold">Solicitud_Combustible_{solicitud.folio}.pdf</span>
                        <span className="block text-3xs text-gray-500">Documento oficial adjunto automáticamente al mensaje</span>
                      </div>
                    </div>
                    <span className="text-3xs text-red-700 bg-red-100 px-2 py-0.5 rounded font-bold">Adjunto Oficial</span>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2 text-2xs text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span><strong>Remitente No-Reply:</strong> Despachado institucionalmente desde <code>no-reply@cruzverdesv.org</code> para salvaguardar la bandeja oficial y prevenir respuestas accidentales.</span>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-white"
                    >
                      Volver a Vista
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                    >
                      {sending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Enviar Ahora
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
