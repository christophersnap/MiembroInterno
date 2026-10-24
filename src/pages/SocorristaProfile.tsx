import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, XCircle, Plus, Save, X, Crop, Camera, Shield, Award, PhoneCall, Sparkles, FileText, Phone } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';
import WatermarkImage from '../components/WatermarkImage';
import DateInput from '../components/DateInput';
import DocumentosSocorristaCard from '../components/socorristas/DocumentosSocorristaCard';

export default function SocorristaProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, permissions, watermarkEnabled, userName } = useAuth();
  const [socorrista, setSocorrista] = useState<any>(null);
  const [meritosList, setMeritosList] = useState<any[]>([]);
  const [loadingMeritos, setLoadingMeritos] = useState<boolean>(false);

  const downloadImageWithWatermark = async (format: 'png' | 'jpeg') => {
    if (!carnetGeneradoUrl) return;
    
    // Create a toast/alert or just straight download
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (format === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, 0, 0);
        
        if (watermarkEnabled && role !== 'admin') {
          ctx.save();
          // Draw watermark
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 4); // -45 degrees
          ctx.textAlign = 'center';
          
          // Main text
          ctx.font = 'bold 36px Arial';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          // Add drop shadow
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText('CRUZ VERDE SALVADOREÑA', 0, -20);
          ctx.fillText('SISTEMA INTERNO', 0, 20);
          
          // Subtext
          ctx.font = '16px Arial';
          ctx.fillText(`Visualizado por: ${userName || 'Usuario'}`, 0, 50);
          
          ctx.restore();
        }
        
        const dataUrl = canvas.toDataURL(`image/${format}`, 0.9);
        const link = document.createElement('a');
        link.download = `carnet_${socorrista.carnet}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    img.src = carnetGeneradoUrl;
  };
  const [loading, setLoading] = useState(true);
  const [showAddCurso, setShowAddCurso] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [availableCursos, setAvailableCursos] = useState<any[]>([]);
  const [seccionales, setSeccionales] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<any>({});
  const [countryCode, setCountryCode] = useState('+503');
  const [fotoFile, setFotoFile] = useState<File | null>(null);

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

  const [seccionalOccupants, setSeccionalOccupants] = useState<{
    director: { id: string | number; name: string } | null;
    subdirector: { id: string | number; name: string } | null;
    loading: boolean;
  }>({ director: null, subdirector: null, loading: false });
  const [transferNotice, setTransferNotice] = useState<string | null>(null);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;
    
    if (name === 'dui' || name === 'licencia_vehiculo_numero' || name === 'licencia_moto_numero') {
      value = formatDUI(value);
    }
    
    if (name === 'telefono') {
      const currentCountry = countries.find(c => c.code === countryCode) || countries[0];
      value = formatPhone(value, currentCountry.mask);
    }

    if (name === 'seccional_id') {
      const isDifferent = String(value) !== String(socorrista?.seccional_id);
      if (isDifferent) {
        if (socorrista?.segundo_cargo_administrativo) {
          setTransferNotice(`Al transferir de seccional, el cargo de "${socorrista.segundo_cargo_administrativo}" se liberará y quedará disponible para la seccional anterior.`);
        } else {
          setTransferNotice(null);
        }
        setEditForm((prev: any) => ({
          ...prev,
          seccional_id: value,
          segundo_cargo_administrativo: ''
        }));
        return;
      } else {
        setTransferNotice(null);
        setEditForm((prev: any) => ({
          ...prev,
          seccional_id: value,
          segundo_cargo_administrativo: socorrista?.segundo_cargo_administrativo || ''
        }));
        return;
      }
    }

    setEditForm({ ...editForm, [name]: value });
  };
  
  // Cropper state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

  const [newCurso, setNewCurso] = useState({
    curso_id: '',
    anio: new Date().getFullYear(),
    fecha_certificacion: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
  });

  const fetchProfile = async () => {
    try {
      const { data: socData, error: socError } = await supabase
        .from('socorristas')
        .select(`
          *,
          seccionales (
            nombre
          )
        `)
        .eq('id', id)
        .single();

      if (socError) throw socError;

      const { data: cursosData, error: cursosError } = await supabase
        .from('socorrista_cursos')
        .select(`
          *,
          cursos (
            nombre
          )
        `)
        .eq('socorrista_id', id);

      if (cursosError) throw cursosError;

      // Cargar contactos de emergencia (desde socData o fallback configuracion)
      let contactoNombre = socData.contacto_emergencia_nombre || '';
      let contactoTelefono = socData.contacto_emergencia_telefono || '';
      let contactoNombre2 = socData.contacto_emergencia_nombre_2 || '';
      let contactoTelefono2 = socData.contacto_emergencia_telefono_2 || '';

      if (!contactoNombre && !contactoTelefono) {
        try {
          const { data: confRow } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', `socorrista_emergencia_${id}`)
            .maybeSingle();
          if (confRow && confRow.valor) {
            const parsed = JSON.parse(confRow.valor);
            contactoNombre = parsed.contacto_emergencia_nombre || '';
            contactoTelefono = parsed.contacto_emergencia_telefono || '';
            contactoNombre2 = parsed.contacto_emergencia_nombre_2 || '';
            contactoTelefono2 = parsed.contacto_emergencia_telefono_2 || '';
          }
        } catch (confErr) {
          console.warn('Fallback emergencia config:', confErr);
        }
      }

      const formattedSocorrista = {
        ...socData,
        contacto_emergencia_nombre: contactoNombre,
        contacto_emergencia_telefono: contactoTelefono,
        contacto_emergencia_nombre_2: contactoNombre2,
        contacto_emergencia_telefono_2: contactoTelefono2,
        seccional_nombre: Array.isArray(socData.seccionales) 
          ? (socData.seccionales[0]?.nombre || 'N/A') 
          : (socData.seccionales?.nombre || 'N/A'),
        cursos: (cursosData || []).map(c => ({
          ...c,
          curso_nombre: c.cursos?.nombre || 'N/A'
        }))
      };

      setSocorrista(formattedSocorrista);
      setEditForm({
        ...formattedSocorrista,
        tiene_licencia_vehiculo: !!formattedSocorrista.licencia_vehiculo_numero,
        tiene_licencia_moto: !!formattedSocorrista.licencia_moto_numero
      });

      // Cargar Méritos asignados a este socorrista
      fetchSocorristaMeritos(Number(id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocorristaMeritos = async (socId: number) => {
    setLoadingMeritos(true);
    try {
      let allMerits: any[] = [];
      const { data: dbData, error: dbErr } = await supabase
        .from('meritos')
        .select('*')
        .eq('activo', true)
        .order('fecha_otorgamiento', { ascending: false });

      if (!dbErr && dbData) {
        allMerits = dbData;
      } else {
        // Fallback desde configuracion sistema_meritos
        const { data: confRow } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'sistema_meritos')
          .maybeSingle();
        if (confRow && confRow.valor) {
          try {
            allMerits = JSON.parse(confRow.valor);
          } catch (e) {}
        }
      }

      // Filtrar aquellos donde este socorrista fue galardonado
      const filtered = allMerits.filter(m => {
        if (!m.socorristas_asignados || !Array.isArray(m.socorristas_asignados)) return false;
        return m.socorristas_asignados.some((a: any) => Number(a.socorrista_id) === Number(socId));
      });

      setMeritosList(filtered);
    } catch (err) {
      console.error('Error fetching meritos de socorrista:', err);
    } finally {
      setLoadingMeritos(false);
    }
  };

  const [fechaGeneracion, setFechaGeneracion] = useState<string | null>(null);
  const [carnetGeneradoUrl, setCarnetGeneradoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    
    const fetchAuxData = async () => {
      try {
        const { data: cData } = await supabase.from('cursos').select('*').eq('estado', 'Activo');
        if (cData) setAvailableCursos(cData);
        
        const { data: sData } = await supabase.from('seccionales').select('*').eq('estado', 'Activa').order('nombre');
        if (sData) setSeccionales(sData);
      } catch (err) {
        console.error('Error fetching aux data:', err);
      }
    };
    
    fetchAuxData();
  }, [id]);

  useEffect(() => {
    if (socorrista) {
      if (socorrista.carnet_generado_url) {
        setCarnetGeneradoUrl(socorrista.carnet_generado_url);
        if (socorrista.fecha_generacion_carnet) {
          setFechaGeneracion(socorrista.fecha_generacion_carnet);
        } else {
          // Fallback to activity_logs if column doesn't exist
          const fetchFecha = async () => {
            try {
              const { data } = await supabase
                .from('activity_logs')
                .select('created_at')
                .eq('entity_type', 'Socorrista')
                .eq('entity_id', String(id))
                .eq('action', 'Generó carnet')
                .order('created_at', { ascending: false })
                .limit(1);
              if (data && data.length > 0) {
                setFechaGeneracion(data[0].created_at);
              }
            } catch (err) {
              console.error('Error fetching fecha generacion:', err);
            }
          };
          fetchFecha();
        }
      } else {
        // Fallback to activity_logs if carnet_generado_url column doesn't exist or is empty
        const fetchFallback = async () => {
          try {
            const { data } = await supabase
              .from('activity_logs')
              .select('created_at, details')
              .eq('entity_type', 'Socorrista')
              .eq('entity_id', String(id))
              .eq('action', 'Generó carnet')
              .order('created_at', { ascending: false })
              .limit(1);
            if (data && data.length > 0) {
              setFechaGeneracion(data[0].created_at);
              if (data[0].details && data[0].details.url) {
                setCarnetGeneradoUrl(data[0].details.url);
              }
            }
          } catch (err) {
            console.error('Error fetching fallback data:', err);
          }
        };
        fetchFallback();
      }
    }
  }, [socorrista, id]);

  useEffect(() => {
    if (!editForm.seccional_id) {
      setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      return;
    }

    const checkOccupants = async () => {
      setSeccionalOccupants(prev => ({ ...prev, loading: true }));
      const targetSecId = parseInt(editForm.seccional_id, 10);
      try {
        let dir: { id: string | number; name: string } | null = null;
        let subdir: { id: string | number; name: string } | null = null;

        const { data, error } = await supabase
          .from('socorristas')
          .select('id, primer_nombre, primer_apellido, segundo_cargo_administrativo')
          .eq('seccional_id', targetSecId)
          .eq('estado', 'Activo')
          .in('segundo_cargo_administrativo', ['Director de Seccional', 'Subdirector de Seccional']);

        if (!error && data) {
          data.forEach(s => {
            if (String(s.id) !== String(id)) {
              const fullName = `${s.primer_nombre} ${s.primer_apellido}`.trim();
              if (s.segundo_cargo_administrativo === 'Director de Seccional') {
                dir = { id: s.id, name: fullName };
              } else if (s.segundo_cargo_administrativo === 'Subdirector de Seccional') {
                subdir = { id: s.id, name: fullName };
              }
            }
          });
        } else {
          // Fallback a tabla seccionales si segundo_cargo_administrativo aún no está en Supabase
          const { data: secc } = await supabase
            .from('seccionales')
            .select('director, subdirector')
            .eq('id', targetSecId)
            .maybeSingle();

          if (secc) {
            const currentName = `${socorrista?.primer_nombre || ''} ${socorrista?.primer_apellido || ''}`.trim();
            if (secc.director && secc.director !== currentName) {
              dir = { id: 'secc-dir', name: secc.director };
            }
            if (secc.subdirector && secc.subdirector !== currentName) {
              subdir = { id: 'secc-subdir', name: secc.subdirector };
            }
          }
        }
        setSeccionalOccupants({ director: dir, subdirector: subdir, loading: false });
      } catch (err) {
        console.error('Error verificando cupos de seccional:', err);
        setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      }
    };

    checkOccupants();
  }, [editForm.seccional_id, id, socorrista]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check for duplicate DUI if it has changed
      if (editForm.dui !== socorrista?.dui) {
        const { data: existingDui, error: duiError } = await supabase
          .from('socorristas')
          .select('id')
          .eq('dui', editForm.dui)
          .neq('id', id)
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
      }

      const targetSeccionalId = parseInt(editForm.seccional_id, 10);

      // Validar que solo haya un Director o Subdirector en la seccional seleccionada
      if (editForm.segundo_cargo_administrativo) {
        let conflictName: string | null = null;
        try {
          const { data: conflict, error: confErr } = await supabase
            .from('socorristas')
            .select('id, primer_nombre, primer_apellido')
            .eq('seccional_id', targetSeccionalId)
            .eq('segundo_cargo_administrativo', editForm.segundo_cargo_administrativo)
            .eq('estado', 'Activo')
            .neq('id', id)
            .limit(1);

          if (!confErr && conflict && conflict.length > 0) {
            conflictName = `${conflict[0].primer_nombre} ${conflict[0].primer_apellido}`.trim();
          } else if (confErr) {
            const { data: secc } = await supabase
              .from('seccionales')
              .select('director, subdirector')
              .eq('id', targetSeccionalId)
              .maybeSingle();
            const currentName = `${socorrista?.primer_nombre || ''} ${socorrista?.primer_apellido || ''}`.trim();
            if (editForm.segundo_cargo_administrativo === 'Director de Seccional' && secc?.director && secc.director !== currentName) {
              conflictName = secc.director;
            } else if (editForm.segundo_cargo_administrativo === 'Subdirector de Seccional' && secc?.subdirector && secc.subdirector !== currentName) {
              conflictName = secc.subdirector;
            }
          }
        } catch (err) {
          console.warn('Error verificando conflicto de cupo:', err);
        }

        if (conflictName) {
          alert(`La plaza de "${editForm.segundo_cargo_administrativo}" en esta seccional ya está ocupada por ${conflictName}. Solo se permite un cupo activo por seccional.`);
          setLoading(false);
          return;
        }
      }

      let foto_url = editForm.foto_url;
      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop();
        const fileName = `${id}_${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('socorristas')
          .upload(filePath, fotoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('socorristas')
          .getPublicUrl(filePath);
        
        foto_url = publicUrl;
      }

      const updatePayload: any = {
        primer_nombre: editForm.primer_nombre,
        segundo_nombre: editForm.segundo_nombre,
        primer_apellido: editForm.primer_apellido,
        segundo_apellido: editForm.segundo_apellido,
        fecha_nacimiento: editForm.fecha_nacimiento,
        sexo: editForm.sexo,
        telefono: editForm.telefono,
        dui: editForm.dui,
        direccion: editForm.direccion,
        seccional_id: targetSeccionalId,
        fecha_ingreso: editForm.fecha_ingreso,
        cargo_institucional: editForm.cargo_institucional,
        cargo_administrativo: editForm.cargo_administrativo,
        segundo_cargo_administrativo: editForm.segundo_cargo_administrativo || null,
        tipo_sangre: editForm.tipo_sangre,
        email: editForm.email,
        foto_url: foto_url,
        motorista_autorizado: editForm.motorista_autorizado,
        licencia_vehiculo_numero: editForm.tiene_licencia_vehiculo ? editForm.licencia_vehiculo_numero : null,
        licencia_vehiculo_clase: editForm.tiene_licencia_vehiculo ? editForm.licencia_vehiculo_clase : null,
        licencia_vehiculo_vencimiento: (editForm.tiene_licencia_vehiculo && editForm.licencia_vehiculo_vencimiento) ? editForm.licencia_vehiculo_vencimiento : null,
        licencia_moto_numero: editForm.tiene_licencia_moto ? editForm.licencia_moto_numero : null,
        licencia_moto_vencimiento: (editForm.tiene_licencia_moto && editForm.licencia_moto_vencimiento) ? editForm.licencia_moto_vencimiento : null,
        contacto_emergencia_nombre: editForm.contacto_emergencia_nombre || null,
        contacto_emergencia_telefono: editForm.contacto_emergencia_telefono || null,
        contacto_emergencia_nombre_2: editForm.contacto_emergencia_nombre_2 || null,
        contacto_emergencia_telefono_2: editForm.contacto_emergencia_telefono_2 || null
      };

      // Guardar también siempre en configuracion como respaldo garantizado
      try {
        const emergenciaData = {
          contacto_emergencia_nombre: editForm.contacto_emergencia_nombre || '',
          contacto_emergencia_telefono: editForm.contacto_emergencia_telefono || '',
          contacto_emergencia_nombre_2: editForm.contacto_emergencia_nombre_2 || '',
          contacto_emergencia_telefono_2: editForm.contacto_emergencia_telefono_2 || '',
          updated_at: new Date().toISOString()
        };
        const { data: existingConf } = await supabase
          .from('configuracion')
          .select('id')
          .eq('clave', `socorrista_emergencia_${id}`)
          .maybeSingle();

        if (existingConf) {
          await supabase
            .from('configuracion')
            .update({ valor: JSON.stringify(emergenciaData) })
            .eq('id', existingConf.id);
        } else {
          await supabase
            .from('configuracion')
            .insert({ clave: `socorrista_emergencia_${id}`, valor: JSON.stringify(emergenciaData) });
        }
      } catch (confErr) {
        console.warn('Error guardando respaldo de contactos de emergencia en configuracion:', confErr);
      }

      const { error } = await supabase
        .from('socorristas')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        if (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('segundo_cargo_administrativo') || error.message?.includes('contacto_emergencia')) {
          const { 
            segundo_cargo_administrativo, 
            contacto_emergencia_nombre,
            contacto_emergencia_telefono,
            contacto_emergencia_nombre_2,
            contacto_emergencia_telefono_2,
            ...fallbackPayload 
          } = updatePayload;
          const { error: retryError } = await supabase
            .from('socorristas')
            .update(fallbackPayload)
            .eq('id', id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      // Sincronizar seccionales:
      // Si cambió de seccional, liberar el cargo en la seccional previa
      const prevSeccionalId = socorrista?.seccional_id;
      const seccionalChanged = String(prevSeccionalId) !== String(targetSeccionalId);
      const fullName = `${editForm.primer_nombre} ${editForm.primer_apellido}`.trim();

      try {
        if (seccionalChanged && prevSeccionalId) {
          if (socorrista?.segundo_cargo_administrativo === 'Director de Seccional') {
            await supabase.from('seccionales').update({ director: null }).eq('id', prevSeccionalId);
          } else if (socorrista?.segundo_cargo_administrativo === 'Subdirector de Seccional') {
            await supabase.from('seccionales').update({ subdirector: null }).eq('id', prevSeccionalId);
          }
        }

        // Asignar en la nueva seccional si corresponde
        if (editForm.segundo_cargo_administrativo === 'Director de Seccional') {
          await supabase.from('seccionales').update({ director: fullName }).eq('id', targetSeccionalId);
        } else if (editForm.segundo_cargo_administrativo === 'Subdirector de Seccional') {
          await supabase.from('seccionales').update({ subdirector: fullName }).eq('id', targetSeccionalId);
        } else if (socorrista?.segundo_cargo_administrativo && !editForm.segundo_cargo_administrativo) {
          // Si el usuario removió el segundo cargo
          if (socorrista.segundo_cargo_administrativo === 'Director de Seccional') {
            await supabase.from('seccionales').update({ director: null }).eq('id', targetSeccionalId);
          } else if (socorrista.segundo_cargo_administrativo === 'Subdirector de Seccional') {
            await supabase.from('seccionales').update({ subdirector: null }).eq('id', targetSeccionalId);
          }
        }
      } catch (seccErr) {
        console.warn('Error al sincronizar datos de la seccional:', seccErr);
      }

      const changes: any = {};
      if (socorrista.primer_nombre !== editForm.primer_nombre || socorrista.primer_apellido !== editForm.primer_apellido) {
        changes.nombre = `${editForm.primer_nombre} ${editForm.primer_apellido}`;
      }
      if (fotoFile) {
        changes.foto = 'Cambió fotografía';
      }

      await logActivity('Actualizó perfil', 'Socorrista', id, {
        ...changes,
        mensaje: 'Se actualizaron los datos del socorrista'
      });

      setIsEditing(false);
      fetchProfile();
    } catch (error: any) {
      console.error(error);
      alert('Error al actualizar el perfil: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Fetch max ID to avoid sequence out of sync errors
      const { data: maxIdData } = await supabase
        .from('socorrista_cursos')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      let nextId = undefined;
      if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
        nextId = maxIdData[0].id + 1;
      }

      const { error } = await supabase
        .from('socorrista_cursos')
        .insert([
          {
            ...(nextId ? { id: nextId } : {}),
            socorrista_id: id,
            curso_id: newCurso.curso_id,
            anio: newCurso.anio,
            fecha_certificacion: newCurso.fecha_certificacion,
            fecha_vencimiento: newCurso.fecha_vencimiento
          }
        ]);

      if (error) throw error;

      const cursoNombre = availableCursos.find(c => c.id.toString() === newCurso.curso_id)?.nombre;
      await logActivity('Agregó curso', 'Curso', newCurso.curso_id, {
        socorrista_id: id,
        curso_nombre: cursoNombre
      });

      setShowAddCurso(false);
      fetchProfile();
    } catch (error: any) {
      console.error(error);
      alert('Error al agregar curso: ' + (error.message || 'Error desconocido'));
    }
  };

  const handleCursoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cursoId = e.target.value;
    const curso = availableCursos.find(c => c.id.toString() === cursoId);
    if (curso) {
      const certDate = new Date(newCurso.fecha_certificacion);
      certDate.setMonth(certDate.getMonth() + curso.vigencia_meses);
      setNewCurso({
        ...newCurso,
        curso_id: cursoId,
        fecha_vencimiento: certDate.toISOString().split('T')[0]
      });
    } else {
      setNewCurso({ ...newCurso, curso_id: cursoId });
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageBlob) {
        const file = new File([croppedImageBlob], 'cropped_image.jpg', { type: 'image/jpeg' });
        setFotoFile(file);
        setShowCropper(false);
      }
    } catch (e) {
      console.error(e);
      alert('Error al recortar la imagen');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-gray-500 font-medium">Cargando perfil...</p>
    </div>
  );
  if (!socorrista || socorrista.error) return <div className="text-center py-10 text-red-500">Elemento no encontrado.</div>;

  const isVigente = (fecha_vencimiento: string) => {
    return new Date(fecha_vencimiento) >= new Date();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Perfil del Elemento</h1>
        </div>
        <div className="flex space-x-3">
          {!isEditing ? (
            role === 'admin' && (
              <button 
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <Edit className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                Editar
              </button>
            )
          ) : (
            <>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setEditForm(socorrista);
                  setFotoFile(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <X className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                Cancelar
              </button>
              <button 
                onClick={handleEditSubmit}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <Save className="-ml-1 mr-2 h-5 w-5" />
                Guardar
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <form className="space-y-8 divide-y divide-gray-200">
            <div className="space-y-8 divide-y divide-gray-200">
              <div>
                <div className="flex flex-col items-center mb-8">
                  <div className="relative">
                    <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-gray-200 bg-gray-100 flex items-center justify-center">
                      {fotoFile ? (
                        <img src={URL.createObjectURL(fotoFile)} alt="Preview" className="h-full w-full object-cover" />
                      ) : socorrista.foto_url ? (
                        <img src={socorrista.foto_url} alt="Current" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-4xl font-bold">
                          {(socorrista.primer_nombre?.[0] || '') + (socorrista.primer_apellido?.[0] || '')}
                        </span>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-primary rounded-full p-2 cursor-pointer hover:bg-primary-hover transition-colors shadow-lg">
                      <Camera className="h-5 w-5 text-white" />
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 font-medium">
                    {socorrista.foto_url || fotoFile ? 'Cambiar fotografía' : 'Agregar fotografía'}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Editar Información Personal</h3>
                  <p className="mt-1 text-sm text-gray-500">Actualice la información del socorrista.</p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700">Carnet (No modificable)</label>
                    <div className="mt-1">
                      <input type="text" disabled value={editForm.carnet || ''} className="shadow-sm block w-full sm:text-sm border-gray-300 rounded-md bg-gray-100 p-2 border text-gray-500" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Primer Nombre</label>
                    <div className="mt-1">
                      <input type="text" required value={editForm.primer_nombre || ''} name="primer_nombre" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Segundo Nombre</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.segundo_nombre || ''} name="segundo_nombre" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Primer Apellido</label>
                    <div className="mt-1">
                      <input type="text" required value={editForm.primer_apellido || ''} name="primer_apellido" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Segundo Apellido</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.segundo_apellido || ''} name="segundo_apellido" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                    <div className="mt-1">
                      <DateInput required maxDate={maxDateStr} value={editForm.fecha_nacimiento || ''} name="fecha_nacimiento" onChange={(val) => setEditForm(p => ({...p, fecha_nacimiento: val}))} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                      <p className="mt-1 text-xs text-gray-500">Mínimo 15 años de edad.</p>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Sexo</label>
                    <div className="mt-1">
                      <select required value={editForm.sexo || ''} name="sexo" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border">
                        <option value="">Seleccione...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Tipo de Sangre</label>
                    <div className="mt-1">
                      <select value={editForm.tipo_sangre || 'N/A'} name="tipo_sangre" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border">
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

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                    <div className="mt-1">
                      <input type="email" value={editForm.email || ''} name="email" onChange={handleEditChange} placeholder="ejemplo@cruzverdesv.org" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Licencias de Conducir</label>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center">
                          <input 
                            type="checkbox" 
                            name="tiene_licencia_vehiculo" 
                            checked={editForm.tiene_licencia_vehiculo || false} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, tiene_licencia_vehiculo: e.target.checked }))} 
                            disabled={role !== 'admin' && role !== 'director'}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                          />
                          <span className="ml-2 text-sm text-gray-700">Tiene licencia de vehículo</span>
                        </label>
                        {editForm.tiene_licencia_vehiculo && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border">
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Número</label>
                              <input 
                                type="text" 
                                name="licencia_vehiculo_numero" 
                                value={editForm.licencia_vehiculo_numero || ''} 
                                onChange={handleEditChange} 
                                disabled={role !== 'admin' && role !== 'director'}
                                placeholder="00000000-0"
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Clase</label>
                              <select 
                                name="licencia_vehiculo_clase" 
                                value={editForm.licencia_vehiculo_clase || 'Liviana'} 
                                onChange={handleEditChange}
                                disabled={role !== 'admin' && role !== 'director'}
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500"
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
                                value={editForm.licencia_vehiculo_vencimiento || ''} 
                                onChange={(val) => setEditForm(p => ({...p, licencia_vehiculo_vencimiento: val}))} 
                                disabled={role !== 'admin' && role !== 'director'}
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
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
                            checked={editForm.tiene_licencia_moto || false} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, tiene_licencia_moto: e.target.checked }))} 
                            disabled={role !== 'admin' && role !== 'director'}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                          />
                          <span className="ml-2 text-sm text-gray-700">Tiene licencia de motocicleta</span>
                        </label>
                        {editForm.tiene_licencia_moto && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Número</label>
                              <input 
                                type="text" 
                                name="licencia_moto_numero" 
                                value={editForm.licencia_moto_numero || ''} 
                                onChange={handleEditChange} 
                                disabled={role !== 'admin' && role !== 'director'}
                                placeholder="00000000-0"
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Vencimiento</label>
                              <DateInput 
                                name="licencia_moto_vencimiento" 
                                value={editForm.licencia_moto_vencimiento || ''} 
                                onChange={(val) => setEditForm(p => ({...p, licencia_moto_vencimiento: val}))} 
                                disabled={role !== 'admin' && role !== 'director'}
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="motorista_autorizado" 
                        checked={editForm.motorista_autorizado || false} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, motorista_autorizado: e.target.checked }))} 
                        disabled={role !== 'admin' && role !== 'director'}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                      />
                      <label className="ml-2 block text-sm font-medium text-gray-700">
                        ¿Es Motorista Autorizado en la Institución?
                      </label>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <div className="mt-1 flex space-x-2">
                      <select 
                        value={countryCode} 
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="block w-24 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border-gray-300 rounded-md border p-2"
                      >
                        {countries.map(c => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                      <input type="text" required value={editForm.telefono || ''} name="telefono" onChange={handleEditChange} placeholder={countries.find(c => c.code === countryCode)?.mask} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">DUI</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.dui || ''} name="dui" onChange={handleEditChange} placeholder="00000000-0" maxLength={10} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700">Dirección</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.direccion || ''} name="direccion" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  {/* Contactos de Emergencia (Máximo 2) */}
                  <div className="sm:col-span-6 bg-red-50/50 p-4 rounded-xl border border-red-200/80">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                        <PhoneCall className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Contactos de Emergencia (Máximo 2)</h4>
                        <p className="text-xs text-gray-500">Aparecerán disponibles para llamada rápida en la verificación oficial del carnet.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Contacto 1 */}
                      <div className="p-3 bg-white rounded-lg border border-red-100 space-y-3">
                        <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 1 (Principal)</span>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo / Parentesco</label>
                          <input 
                            type="text" 
                            name="contacto_emergencia_nombre"
                            value={editForm.contacto_emergencia_nombre || ''} 
                            onChange={handleEditChange}
                            placeholder="Ej. María Pérez (Madre)"
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs border-gray-300 rounded-md p-2 border"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono de Emergencia</label>
                          <input 
                            type="text" 
                            name="contacto_emergencia_telefono"
                            value={editForm.contacto_emergencia_telefono || ''} 
                            onChange={handleEditChange}
                            placeholder="Ej. 7000-0000 o +503 7000-0000"
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs border-gray-300 rounded-md p-2 border"
                          />
                        </div>
                      </div>

                      {/* Contacto 2 */}
                      <div className="p-3 bg-white rounded-lg border border-red-100 space-y-3">
                        <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 2 (Secundario)</span>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo / Parentesco</label>
                          <input 
                            type="text" 
                            name="contacto_emergencia_nombre_2"
                            value={editForm.contacto_emergencia_nombre_2 || ''} 
                            onChange={handleEditChange}
                            placeholder="Ej. Carlos Gómez (Hermano)"
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs border-gray-300 rounded-md p-2 border"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono de Emergencia</label>
                          <input 
                            type="text" 
                            name="contacto_emergencia_telefono_2"
                            value={editForm.contacto_emergencia_telefono_2 || ''} 
                            onChange={handleEditChange}
                            placeholder="Ej. 7111-2222 o +503 7111-2222"
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs border-gray-300 rounded-md p-2 border"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Información Institucional</h3>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Seccional</label>
                    <div className="mt-1">
                      <select disabled={role === 'socorrista' || role === 'director'} required value={editForm.seccional_id || ''} name="seccional_id" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500">
                        <option value="">Seleccione...</option>
                        {seccionales.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Fecha de Ingreso</label>
                    <div className="mt-1">
                      <DateInput required value={editForm.fecha_ingreso || ''} name="fecha_ingreso" onChange={(val) => setEditForm(p => ({...p, fecha_ingreso: val}))} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Cargo Institucional</label>
                    <div className="mt-1">
                      <input disabled={role === 'socorrista'} type="text" value={editForm.cargo_institucional || ''} name="cargo_institucional" onChange={handleEditChange} placeholder="Ej. Socorrista, Jefe de Brigada..." className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Cargo Administrativo</label>
                    <div className="mt-1">
                      <input disabled={role === 'socorrista'} type="text" value={editForm.cargo_administrativo || ''} name="cargo_administrativo" onChange={handleEditChange} placeholder="Ej. Tesorero, Secretario..." className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Segundo Cargo Administrativo</label>
                    <p className="text-xs text-gray-500 mt-0.5">Dirección de Seccional (1 cupo por seccional)</p>
                    <div className="mt-1 space-y-2">
                      <select
                        disabled={role === 'socorrista'}
                        value={editForm.segundo_cargo_administrativo || ''}
                        name="segundo_cargo_administrativo"
                        onChange={handleEditChange}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="">Ninguno / Sin segundo cargo</option>
                        <option
                          value="Director de Seccional"
                          disabled={!!seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id)}
                        >
                          Director de Seccional {seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id) ? `(Ocupado: ${seccionalOccupants.director.name})` : '(Disponible)'}
                        </option>
                        <option
                          value="Subdirector de Seccional"
                          disabled={!!seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id)}
                        >
                          Subdirector de Seccional {seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id) ? `(Ocupado: ${seccionalOccupants.subdirector.name})` : '(Disponible)'}
                        </option>
                      </select>

                      {transferNotice && (
                        <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                          ⚠️ {transferNotice}
                        </div>
                      )}

                      {editForm.seccional_id && (
                        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id) ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                            {seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id) ? `🔒 Director: ${seccionalOccupants.director.name}` : '✓ Cupo Director disponible'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id) ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                            {seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id) ? `🔒 Subdirector: ${seccionalOccupants.subdirector.name}` : '✓ Cupo Subdirector disponible'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </form>

          {showCropper && imageSrc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Recortar Fotografía</h3>
                  <button onClick={() => setShowCropper(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="relative flex-1 bg-gray-900">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                  <div className="flex-1 mr-4">
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={handleCropSave}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Crop className="-ml-1 mr-2 h-5 w-5" />
                    Aplicar Recorte
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-24 w-24">
                {socorrista.foto_url ? (
                  <img src={socorrista.foto_url} alt="" className="h-24 w-24 border-4 border-gray-200 rounded-full object-cover" />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl border-4 border-gray-200">
                    {(socorrista.primer_nombre?.[0] || '') + (socorrista.primer_apellido?.[0] || '')}
                  </div>
                )}
              </div>
              <div className="ml-6">
                <h3 className="text-2xl leading-6 font-bold text-gray-900">
                  {socorrista.primer_nombre} {socorrista.segundo_nombre} {socorrista.primer_apellido} {socorrista.segundo_apellido}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 font-mono text-lg">
                  Carnet: <span className="font-bold text-gray-900">{socorrista.carnet}</span>
                </p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    socorrista.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {socorrista.estado}
                  </span>
                  <span className="ml-4 text-gray-500">Seccional: {socorrista.seccional_nombre}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Fecha de Nacimiento</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.fecha_nacimiento}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Sexo</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.sexo}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Tipo de Sangre</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-bold text-primary">{socorrista.tipo_sangre || 'N/A'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Correo Electrónico</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.email || 'No registrado'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Licencias de Conducir</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 space-y-4">
                  {socorrista.licencia_vehiculo_numero && (
                    <div className="bg-gray-50 p-3 rounded border">
                      <p className="font-medium text-gray-900 mb-1">Vehículo ({socorrista.licencia_vehiculo_clase || 'Liviana'})</p>
                      <ul className="text-sm text-gray-600">
                        <li><span className="font-semibold">Número:</span> {socorrista.licencia_vehiculo_numero}</li>
                        <li><span className="font-semibold">Vencimiento:</span> {socorrista.licencia_vehiculo_vencimiento || 'N/A'}</li>
                      </ul>
                    </div>
                  )}
                  {socorrista.licencia_moto_numero && (
                    <div className="bg-gray-50 p-3 rounded border">
                      <p className="font-medium text-gray-900 mb-1">Motocicleta</p>
                      <ul className="text-sm text-gray-600">
                        <li><span className="font-semibold">Número:</span> {socorrista.licencia_moto_numero}</li>
                        <li><span className="font-semibold">Vencimiento:</span> {socorrista.licencia_moto_vencimiento || 'N/A'}</li>
                      </ul>
                    </div>
                  )}
                  {!socorrista.licencia_vehiculo_numero && !socorrista.licencia_moto_numero && (
                    <span className="text-gray-500 italic">No tiene licencias registradas</span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-t border-gray-200">
                <dt className="text-sm font-medium text-gray-500">Autorización Institucional</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {socorrista.motorista_autorizado ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Autorizado como Motorista
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      No autorizado
                    </span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.telefono}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">DUI</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.dui || 'No registrado'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Dirección</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.direccion}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-red-50/30">
                <dt className="text-sm font-medium text-gray-700 flex items-center">
                  <PhoneCall className="w-4 h-4 mr-1.5 text-red-600" />
                  Contactos de Emergencia
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {(socorrista.contacto_emergencia_telefono || socorrista.contacto_emergencia_telefono_2) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {socorrista.contacto_emergencia_telefono && (
                        <div className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-red-200 shadow-2xs">
                          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-gray-900 block text-xs truncate">{socorrista.contacto_emergencia_nombre || 'Contacto Principal'}</span>
                            <a 
                              href={`tel:${socorrista.contacto_emergencia_telefono}`}
                              className="text-emerald-700 hover:text-emerald-900 font-mono font-medium inline-flex items-center text-xs mt-0.5"
                            >
                              <Phone className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                              {socorrista.contacto_emergencia_telefono}
                            </a>
                          </div>
                        </div>
                      )}
                      {socorrista.contacto_emergencia_telefono_2 && (
                        <div className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-red-200 shadow-2xs">
                          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-gray-900 block text-xs truncate">{socorrista.contacto_emergencia_nombre_2 || 'Contacto Secundario'}</span>
                            <a 
                              href={`tel:${socorrista.contacto_emergencia_telefono_2}`}
                              className="text-emerald-700 hover:text-emerald-900 font-mono font-medium inline-flex items-center text-xs mt-0.5"
                            >
                              <Phone className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                              {socorrista.contacto_emergencia_telefono_2}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-xs">No se han registrado contactos de emergencia aún.</span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Cargo Institucional</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.cargo_institucional || 'N/A'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Cargo Administrativo</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.cargo_administrativo || 'N/A'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Segundo Cargo Administrativo</dt>
                <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                  {socorrista.segundo_cargo_administrativo ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      <Shield className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      {socorrista.segundo_cargo_administrativo}
                    </span>
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Fecha de Ingreso</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.fecha_ingreso}</dd>
              </div>
              {carnetGeneradoUrl && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Carnet Generado</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {(permissions.ver_imagenes_socorristas || role === 'admin') ? (
                      <WatermarkImage src={carnetGeneradoUrl} alt="Carnet" className="max-w-xs shadow-md border border-gray-200" isRounded={false} />
                    ) : (
                      <span className="text-sm text-gray-500 italic">No tienes permiso para ver esta imagen.</span>
                    )}
                    {fechaGeneracion && (
                      <p className="mt-2 text-xs text-gray-500">
                        Generado el: {new Date(fechaGeneracion).toLocaleString('es-SV')}
                      </p>
                    )}
                    <div className="mt-2 flex space-x-4">
                      {(permissions.descargar_carnet || role === 'admin') && (
                        <>
                          <button onClick={() => downloadImageWithWatermark('png')} className="text-primary hover:text-primary-hover text-sm font-medium">
                            Descargar PNG
                          </button>
                          <button onClick={() => downloadImageWithWatermark('jpeg')} className="text-primary hover:text-primary-hover text-sm font-medium">
                            Descargar JPG
                          </button>
                        </>
                      )}
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {/* Cursos Section */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Cursos y Certificaciones</h3>
          {role !== 'socorrista' && (
            <button 
              onClick={() => setShowAddCurso(!showAddCurso)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
              <Plus className="-ml-0.5 mr-1 h-4 w-4" />
              {showAddCurso ? 'Cancelar' : 'Agregar Curso'}
            </button>
          )}
        </div>

        {showAddCurso && (
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200 bg-gray-50">
            <form onSubmit={handleAddCurso} className="space-y-4">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Curso</label>
                  <select required value={newCurso.curso_id} onChange={handleCursoChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border">
                    <option value="">Seleccione...</option>
                    {availableCursos.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Año</label>
                  <input type="number" required value={newCurso.anio} onChange={e => setNewCurso({...newCurso, anio: parseInt(e.target.value)})} className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Fecha Certificación</label>
                  <DateInput required value={newCurso.fecha_certificacion} onChange={val => {
                    if (!val) {
                      setNewCurso({...newCurso, fecha_certificacion: '', fecha_vencimiento: ''});
                      return;
                    }
                    const certDate = new Date(val + 'T00:00:00');
                    const curso = availableCursos.find(c => c.id.toString() === newCurso.curso_id);
                    if (curso) {
                      certDate.setMonth(certDate.getMonth() + curso.vigencia_meses);
                      const y = certDate.getFullYear();
                      const m = String(certDate.getMonth() + 1).padStart(2, '0');
                      const d = String(certDate.getDate()).padStart(2, '0');
                      setNewCurso({...newCurso, fecha_certificacion: val, fecha_vencimiento: `${y}-${m}-${d}`});
                    } else {
                      setNewCurso({...newCurso, fecha_certificacion: val});
                    }
                  }} className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Fecha Vencimiento</label>
                  <DateInput required value={newCurso.fecha_vencimiento} onChange={val => setNewCurso({...newCurso, fecha_vencimiento: val})} className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="px-4 py-5 sm:p-6">
          {socorrista.cursos && socorrista.cursos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Curso</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Año</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certificación</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {socorrista.cursos.map((curso: any) => {
                    const vigente = isVigente(curso.fecha_vencimiento);
                    return (
                      <tr key={curso.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{curso.curso_nombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{curso.anio}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{curso.fecha_certificacion}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{curso.fecha_vencimiento}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {vigente ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="-ml-0.5 mr-1.5 h-4 w-4 text-green-600" />
                              Vigente
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="-ml-0.5 mr-1.5 h-4 w-4 text-red-600" />
                              Vencida
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No hay cursos registrados para este elemento.</p>
          )}
        </div>
      </div>

      {/* Sección de Méritos, Premios y Reconocimientos */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-slate-200/80">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 bg-linear-to-r from-amber-500/10 via-yellow-500/5 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg leading-6 font-bold text-gray-900">Méritos, Premios y Condecoraciones</h3>
              <p className="text-xs text-gray-500">Distinciones institucionales, misiones humanitarias y reconocimientos oficiales</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
            {meritosList.length} {meritosList.length === 1 ? 'Reconocimiento' : 'Reconocimientos'}
          </span>
        </div>

        <div className="p-4 sm:p-6">
          {loadingMeritos ? (
            <div className="py-6 text-center text-xs text-gray-500">Cargando condecoraciones...</div>
          ) : meritosList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meritosList.map(merito => {
                const asignacion = (merito.socorristas_asignados || []).find((a: any) => Number(a.socorrista_id) === Number(id));
                return (
                  <div 
                    key={merito.id} 
                    className="p-4 rounded-xl border border-amber-200/90 bg-linear-to-br from-amber-50/50 via-white to-yellow-50/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-2xs font-bold bg-amber-500 text-white shadow-2xs">
                          {merito.categoria || 'Honor al Mérito'}
                        </span>
                        <span className="text-xs font-semibold text-gray-500">
                          {asignacion?.fecha_asignacion || merito.fecha_otorgamiento || 'Condecorado'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-950 mb-1">{merito.titulo}</h4>
                      {merito.descripcion && (
                        <p className="text-xs text-gray-700 leading-relaxed mb-3">{merito.descripcion}</p>
                      )}
                      {asignacion?.observaciones && (
                        <div className="p-2 rounded bg-amber-100/60 text-amber-900 text-2xs mb-2">
                          <strong>Mención especial:</strong> {asignacion.observaciones}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-amber-100/80 flex items-center justify-between text-2xs text-gray-500">
                      <span>Otorgado por: <strong className="text-gray-800">{merito.institucion_otorgante || 'Cruz Verde Salvadoreña'}</strong></span>
                      {merito.numero_acuerdo && (
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">
                          Acuerdo: {merito.numero_acuerdo}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Sin méritos o condecoraciones registradas</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Los méritos otorgados desde el módulo de Operaciones &gt; Méritos y Premios aparecerán reflejados aquí automáticamente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sección de Documentos Oficiales Versionados (CV, Antecedentes Penales, Policiales, Solvencias) */}
      <DocumentosSocorristaCard 
        socorristaId={Number(id)} 
        socorristaNombre={`${socorrista.primer_nombre} ${socorrista.primer_apellido}`} 
      />

    </div>
  );
}
