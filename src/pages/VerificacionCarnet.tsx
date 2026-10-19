import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Loader2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateSecureQrToken } from '../utils/qrSecurity';

export default function VerificacionCarnet() {
  const { carnetId } = useParams<{ carnetId: string }>();
  const [socorrista, setSocorrista] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [config, setConfig] = useState<any>({});
  const [allowedFields, setAllowedFields] = useState<Record<string, boolean>>({
    foto: true,
    carnetId: true,
    nombre: true,
    cargoInstitucional: true,
    cargoAdministrativo: true,
    seccional: true,
    estado: true,
    dui: true,
    telefono: true,
    email: true,
    fechaNacimiento: true,
    fechaIngreso: true,
    tipoSangre: true,
    motoristaAutorizado: true,
    licencias: true,
    cursos: true,
    carnetImagen: true
  });
  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutos = 300 segundos
  const [isExpired, setIsExpired] = useState(false);

  // Temporizador de 5 minutos
  useEffect(() => {
    if (loading || error || !socorrista) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsExpired(true);
          setSocorrista(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, error, !socorrista]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data: { publicUrl } } = supabase.storage
          .from('socorristas')
          .getPublicUrl('public_config.json');

        try {
          const res = await fetch(`${publicUrl}?t=${Date.now()}`);
          if (res.ok) {
            const data = await res.json();
            setConfig(data);
            if (data.verificacion_fields) {
              setAllowedFields(prev => ({ ...prev, ...data.verificacion_fields }));
            }
            return;
          }
        } catch (e) {
          console.warn('Could not fetch public_config.json', e);
        }

        const { data, error: confErr } = await supabase.from('configuracion').select('*');
        if (confErr) throw confErr;
        if (data) {
          const confObj: any = {};
          data.forEach(item => {
            if (item.clave === 'verificacion_titulo') confObj.verificacion_titulo = item.valor;
            if (item.clave === 'verificacion_mensaje') confObj.verificacion_mensaje = item.valor;
            if (item.clave === 'logos' && item.valor) {
              try { confObj.logos = JSON.parse(item.valor); } catch (e) {}
            }
            if (item.clave === 'verificacion_fields' && item.valor) {
              try { setAllowedFields(prev => ({ ...prev, ...JSON.parse(item.valor) })); } catch (e) {}
            }
          });
          setConfig(confObj);
        }
      } catch (err) {
        console.error('Error loading config from Supabase', err);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!carnetId) return;

    const fetchSocorrista = async () => {
      try {
        const cleanParam = (carnetId || '').trim();
        let targetCarnet = cleanParam;

        // Si es un token criptográfico no secuencial de 16 caracteres hex del QR
        if (/^[0-9a-fA-F]{16}$/.test(cleanParam)) {
          const { data: allSocs, error: socListErr } = await supabase
            .from('socorristas')
            .select('id, carnet');

          if (!socListErr && allSocs && allSocs.length > 0) {
            const matched = allSocs.find(s => 
              generateSecureQrToken(s.carnet, s.id).toLowerCase() === cleanParam.toLowerCase()
            );
            if (matched) {
              targetCarnet = matched.carnet;
            } else {
              throw new Error('Código QR de verificación no válido o expirado.');
            }
          }
        } else {
          // Consulta directa por código de carnet institucional
          targetCarnet = cleanParam;
        }

        const { data, error: fetchErr } = await supabase
          .from('socorristas')
          .select(`
            *,
            seccionales (
              nombre
            )
          `)
          .eq('carnet', targetCarnet)
          .single();

        if (fetchErr || !data) {
          throw new Error('Carnet no encontrado o código no válido.');
        }

        const { data: cursosData } = await supabase
          .from('socorrista_cursos')
          .select(`
            cursos (
              nombre
            )
          `)
          .eq('socorrista_id', data.id);

        setSocorrista({
          ...data,
          seccional_nombre: Array.isArray(data.seccionales) ? data.seccionales[0]?.nombre || 'N/A' : data.seccionales?.nombre || 'N/A',
          cursos: (cursosData || []).map((c: any) => ({
            nombre: c.cursos?.nombre || 'N/A'
          }))
        });

        if (data.carnet_generado_url) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = img.width * 0.5;
            canvas.height = img.height * 0.5;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            const stepX = 200;
            const stepY = 150;
            for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
              for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(-Math.PI / 6);
                ctx.fillText('COPIA DIGITAL NO VÁLIDA', 0, 0);
                ctx.restore();
              }
            }
            ctx.restore();
            setWatermarkedImage(canvas.toDataURL('image/jpeg', 0.4));
          };
          img.src = data.carnet_generado_url;
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSocorrista();
  }, [carnetId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-gray-600">Verificando credencial...</p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border-t-4 border-amber-500 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 mb-2">
            Sesión Temporal Finalizada (5 min)
          </span>
          <h1 className="text-xl font-black text-gray-950 mb-2">Verificación Temporal Expirada</h1>
          <p className="text-xs text-gray-600 leading-relaxed mb-6">
            Por estrictas políticas de seguridad y protección de datos institucionales de Cruz Verde Salvadoreña, la consulta temporal generada por el código QR ha expirado tras transcurrir 5 minutos.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-gray-700">
            <p className="font-semibold text-gray-900 mb-1">¿Desea consultar nuevamente?</p>
            <p className="text-2xs text-gray-500">Por favor, vuelva a escanear el código QR físico impreso en el carnet oficial del elemento.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !socorrista) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <ShieldAlert className="h-20 w-20 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verificación Fallida</h1>
          <p className="text-gray-600">{error || 'El carnet escaneado no existe en nuestros registros.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="bg-primary px-6 py-8 text-center relative">
          <div className="mb-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-2xs font-bold bg-white/20 backdrop-blur-xs text-white border border-white/30 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
            <span>Consulta Temporal Segura: {formatTimer(timeLeft)}</span>
          </div>

          {config.logos?.verificacion ? (
            <img 
              src={config.logos.verificacion} 
              alt="Logo" 
              className="h-20 w-auto mx-auto mb-4 object-contain rounded bg-white p-1"
            />
          ) : (
            <ShieldCheck className="h-16 w-16 text-green-400 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-white mb-2">
            {config.verificacion_titulo || 'Verificación de Carnet'}
          </h1>
          <p className="text-blue-100 text-sm">
            {config.verificacion_mensaje || 'Este carnet es auténtico y pertenece a un elemento activo de la institución.'}
          </p>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            {allowedFields.foto !== false && (
              <div className="relative inline-block">
                {socorrista.foto_url ? (
                  <img
                    src={socorrista.foto_url}
                    alt="Foto del Socorrista"
                    className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg mx-auto"
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl border-4 border-white shadow-lg mx-auto">
                    {(socorrista.primer_nombre?.[0] || '') + (socorrista.primer_apellido?.[0] || '')}
                  </div>
                )}
                {allowedFields.estado !== false && (
                  socorrista.estado === 'Activo' ? (
                    <span className="absolute bottom-0 right-0 block h-6 w-6 rounded-full bg-green-400 border-2 border-white" title="Activo" />
                  ) : (
                    <span className="absolute bottom-0 right-0 block h-6 w-6 rounded-full bg-red-400 border-2 border-white" title="Inactivo" />
                  )
                )}
              </div>
            )}
            {allowedFields.nombre !== false && (
              <h2 className="mt-4 text-xl font-bold text-gray-900">
                {socorrista.primer_nombre} {socorrista.primer_apellido}
              </h2>
            )}
            {allowedFields.cargoInstitucional !== false && (
              <p className="text-sm font-medium text-primary mt-1">
                {socorrista.cargo_institucional || 'SOCORRISTA'}
              </p>
            )}
            {allowedFields.cargoAdministrativo !== false && socorrista.cargo_administrativo && (
              <p className="text-xs font-medium text-gray-500 mt-1">
                {socorrista.cargo_administrativo}
              </p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <dl className="divide-y divide-gray-200">
              {allowedFields.carnetId !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">ID Carnet</dt>
                  <dd className="text-sm font-bold text-gray-900">{socorrista.carnet}</dd>
                </div>
              )}
              {allowedFields.dui !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">DUI</dt>
                  <dd className="text-sm text-gray-900">{socorrista.dui || '-'}</dd>
                </div>
              )}
              {allowedFields.seccional !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Seccional</dt>
                  <dd className="text-sm text-gray-900">{socorrista.seccional_nombre || '-'}</dd>
                </div>
              )}
              {allowedFields.fechaIngreso !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Fecha de Ingreso</dt>
                  <dd className="text-sm text-gray-900">
                    {socorrista.fecha_ingreso ? new Date(socorrista.fecha_ingreso).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '-'}
                  </dd>
                </div>
              )}
              {allowedFields.fechaNacimiento !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Cumpleaños / Fecha Nac.</dt>
                  <dd className="text-sm text-gray-900">
                    {socorrista.fecha_nacimiento ? new Date(socorrista.fecha_nacimiento).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '-'}
                  </dd>
                </div>
              )}
              {allowedFields.telefono !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
                  <dd className="text-sm text-gray-900">{socorrista.telefono || '-'}</dd>
                </div>
              )}
              {allowedFields.motoristaAutorizado !== false && (
                <div className="py-3 flex justify-between items-center">
                  <dt className="text-sm font-medium text-gray-500">Autorización Vehicular</dt>
                  <dd className="text-sm text-gray-900 text-right">
                    {socorrista.motorista_autorizado ? (
                      <span className="text-green-600 font-medium">Conductor Autorizado</span>
                    ) : (
                      <span className="text-red-600 font-medium">Conductor No Autorizado</span>
                    )}
                  </dd>
                </div>
              )}
              {allowedFields.licencias !== false && (
                <div className="py-3 flex flex-col">
                  <dt className="text-sm font-medium text-gray-500 mb-1">Licencias</dt>
                  <dd className="text-sm text-gray-900">
                    {socorrista.licencia_vehiculo_numero || socorrista.licencia_moto_numero ? (
                      <div className="space-y-1">
                        {socorrista.licencia_vehiculo_numero && (
                          <div>
                            <span className="font-medium text-xs text-gray-500">Vehículo:</span>{' '}
                            {socorrista.licencia_vehiculo_numero}
                            {socorrista.licencia_vehiculo_clase ? ` (${socorrista.licencia_vehiculo_clase})` : ''}
                          </div>
                        )}
                        {socorrista.licencia_moto_numero && (
                          <div>
                            <span className="font-medium text-xs text-gray-500">Motocicleta:</span>{' '}
                            {socorrista.licencia_moto_numero}
                          </div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
              )}
              {allowedFields.tipoSangre !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Tipo de Sangre</dt>
                  <dd className="text-sm text-gray-900">{socorrista.tipo_sangre || '-'}</dd>
                </div>
              )}
              {allowedFields.email !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{socorrista.email || '-'}</dd>
                </div>
              )}
              {allowedFields.estado !== false && (
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Estado</dt>
                  <dd className="text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      socorrista.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {socorrista.estado}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {allowedFields.cursos !== false && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Cursos Realizados</h3>
              {socorrista.cursos && socorrista.cursos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {socorrista.cursos.map((c: any, index: number) => (
                    <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-md border border-blue-100">
                      {c.nombre}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">-</p>
              )}
            </div>
          )}

          {allowedFields.carnetImagen !== false && (socorrista.carnet_generado_url || watermarkedImage) && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4 text-center">Imagen del Carnet</h3>
              <div className="relative rounded-lg overflow-hidden shadow-md max-w-[200px] mx-auto min-h-[150px] flex items-center justify-center bg-gray-100">
                {watermarkedImage ? (
                  <img src={watermarkedImage} alt="Carnet" className="w-full h-auto block" />
                ) : (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Verificación oficial. Cruz Verde Salvadoreña © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
