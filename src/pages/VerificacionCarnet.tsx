import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function VerificacionCarnet() {
  const { carnetId } = useParams<{ carnetId: string }>();
  const [socorrista, setSocorrista] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<any>({});
  const [verificationFields, setVerificationFields] = useState<any>({
    dui: true,
    seccional: true,
    cargoInstitucional: true,
    cargoAdministrativo: true,
    fechaIngreso: true,
    fechaNacimiento: true,
    telefono: true,
    cursos: true,
    tipoSangre: true,
    email: true
  });

  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Try fetching public config first to bypass RLS for unauthenticated users
        const { data: { publicUrl } } = supabase.storage.from('socorristas').getPublicUrl('public_config.json');
        
        try {
          // Attach timestamp to avoid cache
          const res = await fetch(`${publicUrl}?t=${Date.now()}`);
          if (res.ok) {
            const publicConfig = await res.json();
            setConfig(publicConfig);
            if (publicConfig.verificacion_fields) {
              setVerificationFields((prev: any) => ({ ...prev, ...publicConfig.verificacion_fields }));
            }
            return; // Successfully loaded from public json
          }
        } catch (e) {
          console.warn("Could not fetch public_config.json", e);
        }

        // Fallback to DB (might fail due to RLS for unauthenticated)
        const { data, error } = await supabase.from('configuracion').select('*');
        if (error) throw error;
        
        if (data) {
          let newConfig: any = {};
          data.forEach(row => {
            if (row.clave === 'verificacion_titulo') newConfig.verificacion_titulo = row.valor;
            if (row.clave === 'verificacion_mensaje') newConfig.verificacion_mensaje = row.valor;
            if (row.clave === 'logos' && row.valor) {
              try { newConfig.logos = JSON.parse(row.valor); } catch(e){}
            }
            if (row.clave === 'verificacion_fields' && row.valor) {
              try { setVerificationFields((prev: any) => ({ ...prev, ...JSON.parse(row.valor) })); } catch(e){}
            }
          });
          setConfig(newConfig);
        }
      } catch (err) {
        console.error("Error loading config from Supabase", err);
      }
    };

    loadConfig();

    // Fetch socorrista
    if (carnetId) {
      const fetchSocorrista = async () => {
        try {
          const { data: socData, error: socError } = await supabase
            .from('socorristas')
            .select(`
              *,
              seccionales (
                nombre
              )
            `)
            .eq('carnet', carnetId)
            .single();

          if (socError) throw new Error('Carnet no encontrado o inválido');

          const { data: cursosData } = await supabase
            .from('socorrista_cursos')
            .select(`
              cursos (
                nombre
              )
            `)
            .eq('socorrista_id', socData.id);

          setSocorrista({
            ...socData,
            seccional_nombre: Array.isArray(socData.seccionales)
              ? (socData.seccionales[0]?.nombre || 'N/A')
              : ((socData.seccionales as any)?.nombre || 'N/A'),
            cursos: (cursosData || []).map(c => ({
              nombre: (c.cursos as any)?.nombre || 'N/A'
            }))
          });

          // Hide carnetId from URL immediately to prevent sharing the direct link
          window.history.replaceState({}, document.title, '/verificar/carnet');

          // Generate watermarked image dynamically
          if (socData.carnet_generado_url) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Scale down for low quality
                const scale = 0.5;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
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
                
                // Save as low quality JPEG
                setWatermarkedImage(canvas.toDataURL('image/jpeg', 0.4));
              }
            };
            img.src = socData.carnet_generado_url;
          }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchSocorrista();
    }
  }, [carnetId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-gray-600">Verificando credencial...</p>
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
        <div className="bg-primary px-6 py-8 text-center">
          {config.logos?.verificacion ? (
            <img src={config.logos.verificacion} alt="Logo" className="h-20 w-auto mx-auto mb-4 object-contain rounded bg-white p-1" />
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
              {socorrista.estado === 'Activo' ? (
                <span className="absolute bottom-0 right-0 block h-6 w-6 rounded-full bg-green-400 border-2 border-white" title="Activo"></span>
              ) : (
                <span className="absolute bottom-0 right-0 block h-6 w-6 rounded-full bg-red-400 border-2 border-white" title="Inactivo"></span>
              )}
            </div>
            
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              {socorrista.primer_nombre} {socorrista.primer_apellido}
            </h2>
            <p className="text-sm font-medium text-primary mt-1">
              {socorrista.cargo_institucional || 'SOCORRISTA'}
            </p>
            <p className="text-xs font-medium text-gray-500 mt-1">
              {socorrista.cargo_administrativo || '-'}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <dl className="divide-y divide-gray-200">
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">ID Carnet</dt>
                <dd className="text-sm font-bold text-gray-900">{socorrista.carnet}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">DUI</dt>
                <dd className="text-sm text-gray-900">{socorrista.dui || '-'}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Seccional</dt>
                <dd className="text-sm text-gray-900">{socorrista.seccional_nombre || '-'}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Fecha de Ingreso</dt>
                <dd className="text-sm text-gray-900">{socorrista.fecha_ingreso ? new Date(socorrista.fecha_ingreso).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '-'}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Cumpleaños / Fecha Nac.</dt>
                <dd className="text-sm text-gray-900">{socorrista.fecha_nacimiento ? new Date(socorrista.fecha_nacimiento).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '-'}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
                <dd className="text-sm text-gray-900">{socorrista.telefono || '-'}</dd>
              </div>
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
              <div className="py-3 flex flex-col">
                <dt className="text-sm font-medium text-gray-500 mb-1">Licencias</dt>
                <dd className="text-sm text-gray-900">
                  {socorrista.licencia_vehiculo_numero || socorrista.licencia_moto_numero ? (
                    <div className="space-y-1">
                      {socorrista.licencia_vehiculo_numero && (
                        <div>
                          <span className="font-medium text-xs text-gray-500">Vehículo:</span> {socorrista.licencia_vehiculo_numero} 
                          {socorrista.licencia_vehiculo_clase ? ` (${socorrista.licencia_vehiculo_clase})` : ''}
                        </div>
                      )}
                      {socorrista.licencia_moto_numero && (
                        <div>
                          <span className="font-medium text-xs text-gray-500">Motocicleta:</span> {socorrista.licencia_moto_numero}
                        </div>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Tipo de Sangre</dt>
                <dd className="text-sm text-gray-900">{socorrista.tipo_sangre || '-'}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{socorrista.email || '-'}</dd>
              </div>
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
            </dl>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Cursos Realizados</h3>
            {socorrista.cursos && socorrista.cursos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {socorrista.cursos.map((curso: any, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-md border border-blue-100">
                    {curso.nombre}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">-</p>
            )}
          </div>

          {(socorrista.carnet_generado_url || watermarkedImage) && (
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
