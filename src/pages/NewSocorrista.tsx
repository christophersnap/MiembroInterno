import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Upload, X, Check, PhoneCall } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import DateInput from '../components/DateInput';

export default function NewSocorrista() {
  const navigate = useNavigate();
  const { role, directorSeccionalId } = useAuth();
  const [seccionales, setSeccionales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    fecha_nacimiento: '',
    telefono: '',
    direccion: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    contacto_emergencia_nombre_2: '',
    contacto_emergencia_telefono_2: '',
    seccional_id: directorSeccionalId ? directorSeccionalId.toString() : '',
    sexo: 'Masculino',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    cargo_institucional: '',
    cargo_administrativo: '',
    segundo_cargo_administrativo: '',
    dui: '',
    tipo_sangre: 'N/A',
    email: '',
    motorista_autorizado: false,
    licencia_vehiculo_numero: '',
    licencia_vehiculo_clase: 'Liviana',
    licencia_vehiculo_vencimiento: '',
    licencia_moto_numero: '',
    licencia_moto_vencimiento: '',
    tiene_licencia_vehiculo: false,
    tiene_licencia_moto: false
  });
  const [esMayorDeEdad, setEsMayorDeEdad] = useState(true);
  const [tieneCarnetMinoridad, setTieneCarnetMinoridad] = useState(false);
  const [countryCode, setCountryCode] = useState('+503');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  
  // Occupants of Director/Subdirector for the selected seccional
  const [seccionalOccupants, setSeccionalOccupants] = useState<{
    director: string | null;
    subdirector: string | null;
    loading: boolean;
  }>({ director: null, subdirector: null, loading: false });
  
  // Cropper state
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

  const countries = [
    { code: '+503', name: 'El Salvador', mask: '####-####' },
    { code: '+502', name: 'Guatemala', mask: '####-####' },
    { code: '+504', name: 'Honduras', mask: '####-####' },
    { code: '+505', name: 'Nicaragua', mask: '####-####' },
    { code: '+506', name: 'Costa Rica', mask: '####-####' },
    { code: '+507', name: 'Panamá', mask: '####-####' },
    { code: '+1', name: 'USA/Canada', mask: '(###) ###-####' },
    { code: '+52', name: 'México', mask: '## #### ####' },
  ];

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 15;
  const maxDateStr = `${maxYear}-12-31`;

  useEffect(() => {
    const fetchSeccionales = async () => {
      try {
        const { data, error } = await supabase
          .from('seccionales')
          .select('*')
          .eq('estado', 'Activa')
          .order('nombre');
        
        if (data) setSeccionales(data);
        if (error) console.error(error);
      } catch (err) {
        console.error('Error fetching seccionales:', err);
      }
    };
    fetchSeccionales();
  }, []);

  const formatDUI = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 8) return digits;
    return `${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
  };

  const formatPhone = (value: string, mask: string) => {
    const digits = value.replace(/\D/g, '');
    let formatted = '';
    let digitIndex = 0;
    for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
      if (mask[i] === '#') {
        formatted += digits[digitIndex];
        digitIndex++;
      } else {
        formatted += mask[i];
      }
    }
    return formatted;
  };

  const handleAgeChange = (esMayor: boolean) => {
    setEsMayorDeEdad(esMayor);
    if (!esMayor) {
      setFormData(prev => ({
        ...prev,
        cargo_institucional: 'Aspirante a Socorrista',
        dui: tieneCarnetMinoridad ? prev.dui : 'Menor de edad'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        cargo_institucional: prev.cargo_institucional === 'Aspirante a Socorrista' ? '' : prev.cargo_institucional,
        dui: prev.dui === 'Menor de edad' ? '' : prev.dui
      }));
    }
  };

  const handleCarnetMinoridadChange = (tiene: boolean) => {
    setTieneCarnetMinoridad(tiene);
    if (!tiene) {
      setFormData(prev => ({ ...prev, dui: 'Menor de edad' }));
    } else {
      setFormData(prev => ({ ...prev, dui: '' }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;
    
    if (name === 'dui' || name === 'licencia_vehiculo_numero' || name === 'licencia_moto_numero') {
      value = formatDUI(value);
    }
    
    if (name === 'telefono') {
      const currentCountry = countries.find(c => c.code === countryCode) || countries[0];
      value = formatPhone(value, currentCountry.mask);
    }

    setFormData({ ...formData, [name]: value });
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error('Canvas is empty'));
        else resolve(blob);
      }, 'image/jpeg');
    });
  };

  const handleCropSave = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
        const croppedFile = new File([croppedBlob], 'photo.jpg', { type: 'image/jpeg' });
        setFoto(croppedFile);
        setFotoPreview(URL.createObjectURL(croppedBlob));
        setShowCropper(false);
      } catch (e) {
        console.error('Error cropping image:', e);
      }
    }
  };

  const generateCarnet = async (primer_nombre: string, primer_apellido: string) => {
    const { data, error } = await supabase
      .from('socorristas')
      .select('carnet');

    let maxNum = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        if (row.carnet) {
          const parts = row.carnet.split('-');
          if (parts.length === 3) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    }
    const nextNum = maxNum + 1;
    const numStr = nextNum.toString().padStart(4, '0');
    const initials = ((primer_nombre || '').charAt(0) + (primer_apellido || '').charAt(0)).toUpperCase();
    return `CVS-${numStr}-${initials}`;
  };

  // Consultar ocupantes de Director y Subdirector de la seccional elegida
  useEffect(() => {
    if (!formData.seccional_id) {
      setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      return;
    }
    const checkOccupants = async () => {
      setSeccionalOccupants(prev => ({ ...prev, loading: true }));
      const targetSecId = parseInt(formData.seccional_id, 10);
      try {
        let dir: string | null = null;
        let subdir: string | null = null;

        const { data, error } = await supabase
          .from('socorristas')
          .select('id, primer_nombre, primer_apellido, segundo_cargo_administrativo')
          .eq('seccional_id', targetSecId)
          .eq('estado', 'Activo')
          .in('segundo_cargo_administrativo', ['Director de Seccional', 'Subdirector de Seccional']);

        if (!error && data) {
          data.forEach(s => {
            const fullName = `${s.primer_nombre} ${s.primer_apellido}`.trim();
            if (s.segundo_cargo_administrativo === 'Director de Seccional') {
              dir = fullName;
            } else if (s.segundo_cargo_administrativo === 'Subdirector de Seccional') {
              subdir = fullName;
            }
          });
        } else {
          // Fallback a consultar tabla seccionales si segundo_cargo_administrativo aún no está en Supabase
          const { data: secc } = await supabase
            .from('seccionales')
            .select('director, subdirector')
            .eq('id', targetSecId)
            .maybeSingle();

          if (secc) {
            dir = secc.director || null;
            subdir = secc.subdirector || null;
          }
        }

        setSeccionalOccupants({ director: dir, subdirector: subdir, loading: false });

        // Si el cargo seleccionado ya está ocupado en la nueva seccional, resetearlo
        setFormData(prev => {
          if (prev.segundo_cargo_administrativo === 'Director de Seccional' && dir) {
            return { ...prev, segundo_cargo_administrativo: '' };
          }
          if (prev.segundo_cargo_administrativo === 'Subdirector de Seccional' && subdir) {
            return { ...prev, segundo_cargo_administrativo: '' };
          }
          return prev;
        });
      } catch (err) {
        console.error('Error verificando cupos de seccional:', err);
        setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      }
    };

    checkOccupants();
  }, [formData.seccional_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('--- INICIO SUBMIT ---');
    console.log('Datos del formulario:', formData);
    
    // Validation
    const requiredFields = ['primer_nombre', 'primer_apellido', 'fecha_nacimiento', 'sexo', 'dui', 'seccional_id', 'cargo_institucional'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      console.warn('Validación fallida. Campos faltantes:', missingFields);
      alert(`ATENCIÓN: Faltan campos obligatorios:\n${missingFields.map(f => `- ${f}`).join('\n')}`);
      return;
    }

    setLoading(true);
    console.log('Estado: Cargando...');

    try {
      // Check for duplicate DUI
      const { data: existingDui, error: duiError } = await supabase
        .from('socorristas')
        .select('id')
        .eq('dui', formData.dui)
        .limit(1);

      if (duiError) {
        console.error('Error checking DUI:', duiError);
        alert('Error al verificar el número de identidad.');
        setLoading(false);
        return;
      }

      if (existingDui && existingDui.length > 0) {
        alert('Numero de identidad ya ingresado.');
        setLoading(false);
        return;
      }

      // Validar cupo de segundo cargo administrativo (1 Director y 1 Subdirector por seccional)
      const seccionalId = parseInt(formData.seccional_id, 10);
      if (isNaN(seccionalId)) {
        console.error('ID de seccional inválido:', formData.seccional_id);
        throw new Error('La seccional seleccionada no es válida (ID no numérico).');
      }

      if (formData.segundo_cargo_administrativo) {
        let conflictName: string | null = null;
        try {
          const { data: conflict, error: confErr } = await supabase
            .from('socorristas')
            .select('id, primer_nombre, primer_apellido')
            .eq('seccional_id', seccionalId)
            .eq('segundo_cargo_administrativo', formData.segundo_cargo_administrativo)
            .eq('estado', 'Activo')
            .limit(1);

          if (!confErr && conflict && conflict.length > 0) {
            conflictName = `${conflict[0].primer_nombre} ${conflict[0].primer_apellido}`.trim();
          } else if (confErr) {
            const { data: secc } = await supabase
              .from('seccionales')
              .select('director, subdirector')
              .eq('id', seccionalId)
              .maybeSingle();
            if (formData.segundo_cargo_administrativo === 'Director de Seccional' && secc?.director) {
              conflictName = secc.director;
            } else if (formData.segundo_cargo_administrativo === 'Subdirector de Seccional' && secc?.subdirector) {
              conflictName = secc.subdirector;
            }
          }
        } catch (err) {
          console.warn('Error verificando cupo previo:', err);
        }

        if (conflictName) {
          alert(`La plaza de "${formData.segundo_cargo_administrativo}" en esta seccional ya está ocupada por ${conflictName}. Solo se permite un cupo activo por seccional.`);
          setLoading(false);
          return;
        }
      }

      let foto_url = null;
      if (foto) {
        console.log('Iniciando subida de foto...');
        const fileName = `${Date.now()}_photo.jpg`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('socorristas')
          .upload(filePath, foto);

        if (uploadError) {
          console.error('Error en upload de storage:', uploadError);
          throw new Error(`Error al subir la foto: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('socorristas')
          .getPublicUrl(filePath);
        
        foto_url = publicUrl;
        console.log('Foto subida con éxito. URL:', foto_url);
      }

      console.log('Consultando último carnet para generar el siguiente...');
      const carnet = await generateCarnet(formData.primer_nombre, formData.primer_apellido);
      console.log('Nuevo carnet generado:', carnet);

      // Fetch max ID to avoid sequence out of sync errors
      const { data: maxIdData } = await supabase
        .from('socorristas')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      let nextId = undefined;
      if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
        nextId = maxIdData[0].id + 1;
      }

      const { tiene_licencia_vehiculo, tiene_licencia_moto, ...restFormData } = formData;

      const insertData = {
        ...(nextId ? { id: nextId } : {}),
        ...restFormData,
        licencia_vehiculo_numero: tiene_licencia_vehiculo ? restFormData.licencia_vehiculo_numero : null,
        licencia_vehiculo_clase: tiene_licencia_vehiculo ? restFormData.licencia_vehiculo_clase : null,
        licencia_vehiculo_vencimiento: tiene_licencia_vehiculo && restFormData.licencia_vehiculo_vencimiento ? restFormData.licencia_vehiculo_vencimiento : null,
        licencia_moto_numero: tiene_licencia_moto ? restFormData.licencia_moto_numero : null,
        licencia_moto_vencimiento: tiene_licencia_moto && restFormData.licencia_moto_vencimiento ? restFormData.licencia_moto_vencimiento : null,
        fecha_ingreso: restFormData.fecha_ingreso || null,
        seccional_id: seccionalId,
        carnet,
        foto_url,
        estado: 'Activo'
      };

      console.log('Intentando insertar en Supabase...', insertData);

      let insertedRecord: any = null;
      const { data, error } = await supabase
        .from('socorristas')
        .insert([insertData])
        .select();

      if (error) {
        if (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('segundo_cargo_administrativo') || error.message?.includes('contacto_emergencia')) {
          // La columna aún no existe en Supabase, reintentar sin ella para no romper el registro
          const { 
            segundo_cargo_administrativo, 
            contacto_emergencia_nombre,
            contacto_emergencia_telefono,
            contacto_emergencia_nombre_2,
            contacto_emergencia_telefono_2,
            ...fallbackData 
          } = insertData;
          const { data: retryData, error: retryError } = await supabase
            .from('socorristas')
            .insert([fallbackData])
            .select();
          if (retryError) {
            console.error('Error al reintentar sin columnas nuevas:', retryError);
            throw new Error(`Error de base de datos: ${retryError.message} (Código: ${retryError.code})`);
          }
          insertedRecord = retryData?.[0];
        } else {
          console.error('Error de Supabase al insertar:', error);
          throw new Error(`Error de base de datos: ${error.message} (Código: ${error.code})`);
        }
      } else if (data && data.length > 0) {
        insertedRecord = data[0];
      }

      console.log('Respuesta de Supabase exitosa:', insertedRecord);

      // Guardar también siempre los contactos de emergencia en configuracion para disponibilidad inmediata
      if (insertedRecord && (formData.contacto_emergencia_telefono || formData.contacto_emergencia_telefono_2)) {
        try {
          const emergenciaData = {
            contacto_emergencia_nombre: formData.contacto_emergencia_nombre || '',
            contacto_emergencia_telefono: formData.contacto_emergencia_telefono || '',
            contacto_emergencia_nombre_2: formData.contacto_emergencia_nombre_2 || '',
            contacto_emergencia_telefono_2: formData.contacto_emergencia_telefono_2 || '',
            created_at: new Date().toISOString()
          };
          await supabase
            .from('configuracion')
            .upsert({ clave: `socorrista_emergencia_${insertedRecord.id}`, valor: JSON.stringify(emergenciaData) }, { onConflict: 'clave' });
        } catch (confErr) {
          console.warn('Error guardando contacto de emergencia en configuracion:', confErr);
        }
      }

      if (insertedRecord) {
        // Sincronizar con la tabla seccionales si se le asignó Director o Subdirector
        try {
          const fullName = `${formData.primer_nombre} ${formData.primer_apellido}`.trim();
          if (formData.segundo_cargo_administrativo === 'Director de Seccional') {
            await supabase.from('seccionales').update({ director: fullName }).eq('id', seccionalId);
          } else if (formData.segundo_cargo_administrativo === 'Subdirector de Seccional') {
            await supabase.from('seccionales').update({ subdirector: fullName }).eq('id', seccionalId);
          }
        } catch (seccErr) {
          console.warn('Error actualizando seccionales:', seccErr);
        }

        console.log('Elemento guardado correctamente. Redirigiendo...');
        setSuccessMessage('Elemento agregado con éxito');
        
        await logActivity('Creó socorrista', 'Socorrista', insertedRecord.id, {
          nombre: `${formData.primer_nombre} ${formData.primer_apellido}`,
          carnet: carnet
        });

        setTimeout(() => {
          navigate(`/socorristas/${insertedRecord.id}`);
        }, 2000);
      } else {
        console.warn('Inserción completada pero no se devolvieron datos.');
        throw new Error('La base de datos no devolvió el registro creado. Verifique si se guardó correctamente.');
      }
    } catch (error: any) {
      console.error('ERROR CRÍTICO EN SUBMIT:', error);
      alert('ERROR AL GUARDAR:\n\n' + (error.message || 'Error desconocido. Revise la consola del navegador para más detalles.'));
    } finally {
      setLoading(false);
      console.log('--- FIN SUBMIT ---');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-bounce">
          <Check className="h-5 w-5" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {showCropper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium">Recortar Fotografía</h3>
              <button onClick={() => setShowCropper(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="relative flex-1 bg-gray-200">
              <Cropper
                image={imageToCrop || ''}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-4 border-t space-y-4">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCropper(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCropSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover"
                >
                  Aplicar Recorte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Registro de Nuevo Elemento</h1>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-gray-200">
          <div className="space-y-6 sm:space-y-5">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Información Personal</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Complete los datos del nuevo socorrista. El carnet se generará automáticamente.
              </p>
            </div>

            <div className="space-y-6 sm:space-y-5">
              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">
                  Fotografía
                </label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <div className="max-w-lg flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors overflow-hidden">
                    {fotoPreview ? (
                      <div className="relative group">
                        <img src={fotoPreview} alt="Preview" className="h-32 w-32 rounded-full object-cover border-2 border-primary" />
                        <button 
                          type="button"
                          onClick={() => {
                            setFoto(null);
                            setFotoPreview(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                            <span>Subir un archivo</span>
                            <input type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                          </label>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 10MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Nombres <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 grid grid-cols-2 gap-4">
                  <input type="text" name="primer_nombre" required value={formData.primer_nombre} onChange={handleChange} placeholder="Primer Nombre" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                  <input type="text" name="segundo_nombre" value={formData.segundo_nombre} onChange={handleChange} placeholder="Segundo Nombre" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Apellidos <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 grid grid-cols-2 gap-4">
                  <input type="text" name="primer_apellido" required value={formData.primer_apellido} onChange={handleChange} placeholder="Primer Apellido" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                  <input type="text" name="segundo_apellido" value={formData.segundo_apellido} onChange={handleChange} placeholder="Segundo Apellido" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Fecha de Nacimiento <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <DateInput name="fecha_nacimiento" required maxDate={maxDateStr} value={formData.fecha_nacimiento} onChange={(val) => setFormData(p => ({...p, fecha_nacimiento: val}))} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                  <p className="mt-1 text-xs text-gray-500">Mínimo 15 años de edad.</p>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Sexo <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <select name="sexo" required value={formData.sexo} onChange={handleChange} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2">
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Teléfono</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 flex space-x-2">
                  <select 
                    value={countryCode} 
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="block w-24 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border-gray-300 rounded-md border p-2"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                    ))}
                  </select>
                  <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} placeholder={countries.find(c => c.code === countryCode)?.mask} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Tipo de Sangre</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <select name="tipo_sangre" value={formData.tipo_sangre} onChange={handleChange} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2">
                    <option value="N/A">N/A</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Correo Electrónico</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="ejemplo@cruzverdesv.org" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">¿Es Motorista Autorizado?</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 flex items-center h-full">
                  <input 
                    type="checkbox" 
                    name="motorista_autorizado" 
                    checked={formData.motorista_autorizado} 
                    onChange={(e) => setFormData(prev => ({ ...prev, motorista_autorizado: e.target.checked }))} 
                    disabled={role !== 'admin' && role !== 'director'}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                  />
                  <span className="ml-2 text-sm text-gray-500">Marcar si tiene autorización de manejar ambulancias / vehículos institucionales.</span>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Licencias de Conducir</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-4">
                  <div>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="tiene_licencia_vehiculo" 
                        checked={formData.tiene_licencia_vehiculo} 
                        onChange={(e) => setFormData(prev => ({ ...prev, tiene_licencia_vehiculo: e.target.checked }))} 
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                      />
                      <span className="ml-2 text-sm text-gray-700">Tiene licencia de vehículo</span>
                    </label>
                    {formData.tiene_licencia_vehiculo && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Número</label>
                          <input 
                            type="text" 
                            name="licencia_vehiculo_numero" 
                            value={formData.licencia_vehiculo_numero} 
                            onChange={handleChange} 
                            placeholder="00000000-0"
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Clase</label>
                          <select 
                            name="licencia_vehiculo_clase" 
                            value={formData.licencia_vehiculo_clase} 
                            onChange={handleChange}
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                          >
                            <option value="Particular">Particular</option>
                            <option value="Liviana">Liviana</option>
                            <option value="Pesada">Pesada</option>
                            <option value="Pesada T">Pesada T</option>
                            <option value="Agricola">Agrícola</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Vencimiento</label>
                          <DateInput 
                            name="licencia_vehiculo_vencimiento" 
                            value={formData.licencia_vehiculo_vencimiento} 
                            onChange={(val) => setFormData(p => ({...p, licencia_vehiculo_vencimiento: val}))} 
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="tiene_licencia_moto" 
                        checked={formData.tiene_licencia_moto} 
                        onChange={(e) => setFormData(prev => ({ ...prev, tiene_licencia_moto: e.target.checked }))} 
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                      />
                      <span className="ml-2 text-sm text-gray-700">Tiene licencia de motocicleta</span>
                    </label>
                    {formData.tiene_licencia_moto && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Número</label>
                          <input 
                            type="text" 
                            name="licencia_moto_numero" 
                            value={formData.licencia_moto_numero} 
                            onChange={handleChange} 
                            placeholder="00000000-0"
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Vencimiento</label>
                          <DateInput 
                            name="licencia_moto_vencimiento" 
                            value={formData.licencia_moto_vencimiento} 
                            onChange={(val) => setFormData(p => ({...p, licencia_moto_vencimiento: val}))} 
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">¿Es mayor de edad?</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => handleAgeChange(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-md border ${esMayorDeEdad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Mayor de edad
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAgeChange(false)}
                    className={`px-4 py-2 text-sm font-medium rounded-md border ${!esMayorDeEdad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Menor de edad
                  </button>
                </div>
              </div>

              {!esMayorDeEdad && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                  <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">¿Tiene carnet de minoridad?</label>
                  <div className="mt-1 sm:mt-0 sm:col-span-2 flex space-x-4">
                    <button
                      type="button"
                      onClick={() => handleCarnetMinoridadChange(true)}
                      className={`px-4 py-2 text-sm font-medium rounded-md border ${tieneCarnetMinoridad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCarnetMinoridadChange(false)}
                      className={`px-4 py-2 text-sm font-medium rounded-md border ${!tieneCarnetMinoridad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">DUI / Carnet Minoridad <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <input
                    type="text"
                    name="dui"
                    required
                    value={formData.dui}
                    onChange={handleChange}
                    placeholder={esMayorDeEdad ? "00000000-0" : "Ingrese carnet o 'Menor de edad'"}
                    maxLength={esMayorDeEdad ? 10 : 50}
                    disabled={!esMayorDeEdad && !tieneCarnetMinoridad}
                    className={`max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 ${(!esMayorDeEdad && !tieneCarnetMinoridad) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Dirección</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <textarea name="direccion" rows={3} value={formData.direccion} onChange={handleChange} className="max-w-lg shadow-sm block w-full focus:ring-primary focus:border-primary sm:text-sm border border-gray-300 rounded-md p-2" />
                </div>
              </div>

              {/* Contactos de Emergencia (Máximo 2) */}
              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <div>
                  <label className="block text-sm font-medium text-gray-900 flex items-center">
                    <PhoneCall className="w-4 h-4 mr-1 text-red-600" />
                    Contactos de Emergencia
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Hasta 2 números telefónicos de familiares o tutores para contacto rápido ante emergencias o validación en carnet.
                  </p>
                </div>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-4 max-w-lg">
                  {/* Contacto 1 */}
                  <div className="p-3 bg-red-50/40 rounded-xl border border-red-200/80 space-y-3">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 1 (Principal)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">Nombre y Parentesco</label>
                        <input
                          type="text"
                          name="contacto_emergencia_nombre"
                          value={formData.contacto_emergencia_nombre}
                          onChange={handleChange}
                          placeholder="Ej. Ana Pérez (Madre)"
                          className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">Teléfono</label>
                        <input
                          type="text"
                          name="contacto_emergencia_telefono"
                          value={formData.contacto_emergencia_telefono}
                          onChange={handleChange}
                          placeholder="Ej. 7000-0000"
                          className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contacto 2 */}
                  <div className="p-3 bg-red-50/40 rounded-xl border border-red-200/80 space-y-3">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 2 (Opcional)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">Nombre y Parentesco</label>
                        <input
                          type="text"
                          name="contacto_emergencia_nombre_2"
                          value={formData.contacto_emergencia_nombre_2}
                          onChange={handleChange}
                          placeholder="Ej. Roberto Gómez (Hermano)"
                          className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">Teléfono</label>
                        <input
                          type="text"
                          name="contacto_emergencia_telefono_2"
                          value={formData.contacto_emergencia_telefono_2}
                          onChange={handleChange}
                          placeholder="Ej. 7111-2222"
                          className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Seccional <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <select disabled={role === 'director'} name="seccional_id" required value={formData.seccional_id} onChange={handleChange} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 disabled:bg-gray-100 disabled:text-gray-500">
                    <option value="">Seleccione una seccional</option>
                    {seccionales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Cargo Institucional <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <input
                    type="text"
                    name="cargo_institucional"
                    required
                    value={formData.cargo_institucional}
                    onChange={handleChange}
                    disabled={!esMayorDeEdad}
                    placeholder="Ej. Socorrista, Jefe de Brigada..."
                    className={`max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 ${!esMayorDeEdad ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Cargo Administrativo</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <input type="text" name="cargo_administrativo" value={formData.cargo_administrativo} onChange={handleChange} placeholder="Ej. Tesorero, Secretario, etc." className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Segundo Cargo Administrativo</label>
                  <p className="text-xs text-gray-500 mt-1">Dirección de Seccional (1 cupo máximo por seccional)</p>
                </div>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-2">
                  <select
                    name="segundo_cargo_administrativo"
                    value={formData.segundo_cargo_administrativo}
                    onChange={handleChange}
                    className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2"
                  >
                    <option value="">Ninguno / Sin segundo cargo</option>
                    <option value="Director de Seccional" disabled={!!seccionalOccupants.director}>
                      Director de Seccional {seccionalOccupants.director ? `(Ocupado por: ${seccionalOccupants.director})` : '(Disponible)'}
                    </option>
                    <option value="Subdirector de Seccional" disabled={!!seccionalOccupants.subdirector}>
                      Subdirector de Seccional {seccionalOccupants.subdirector ? `(Ocupado por: ${seccionalOccupants.subdirector})` : '(Disponible)'}
                    </option>
                  </select>

                  {formData.seccional_id ? (
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.director ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                        {seccionalOccupants.director ? `🔒 Director: ${seccionalOccupants.director}` : '✓ Cupo Director disponible'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.subdirector ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                        {seccionalOccupants.subdirector ? `🔒 Subdirector: ${seccionalOccupants.subdirector}` : '✓ Cupo Subdirector disponible'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Seleccione una seccional primero para verificar cupos disponibles.</p>
                  )}
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Fecha de Ingreso</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <DateInput name="fecha_ingreso" required value={formData.fecha_ingreso} onChange={(val) => setFormData(p => ({...p, fecha_ingreso: val}))} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex justify-end">
              <button type="button" onClick={() => navigate(-1)} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50">
                <Save className="-ml-1 mr-2 h-5 w-5" />
                {loading ? 'Guardando...' : 'Guardar Elemento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

