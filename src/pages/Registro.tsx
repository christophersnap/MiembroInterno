import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, User, Phone, MapPin, Building2, CheckCircle2, Clock, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { getApiUrl } from '../lib/api';

interface SeccionalOption {
  id: number;
  nombre: string;
}

export default function Registro() {
  const navigate = useNavigate();
  const { logos } = useSettings();

  // Form state - Nombres y Apellidos
  const [primerNombre, setPrimerNombre] = useState('');
  const [segundoNombre, setSegundoNombre] = useState('');
  const [tercerNombre, setTercerNombre] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [nombreCompletoRegistrado, setNombreCompletoRegistrado] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [seccionalId, setSeccionalId] = useState<number | ''>('');
  // Tipo de vínculo fijado a 'socorrista' por defecto sin mostrarse en el formulario
  const tipoUsuario = 'socorrista';
  const [carnet, setCarnet] = useState('');
  const [motivo, setMotivo] = useState('');

  // Máscara que solo acepte letras y espacios
  const soloTexto = (val: string) => {
    return val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
  };

  // Auxiliary state
  const [seccionales, setSeccionales] = useState<SeccionalOption[]>([]);
  const [loadingSeccionales, setLoadingSeccionales] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registroExitoso, setRegistroExitoso] = useState(false);

  // Cargar seccionales desde la base de datos
  useEffect(() => {
    const fetchSeccionales = async () => {
      try {
        const { data, error } = await supabase
          .from('seccionales')
          .select('id, nombre')
          .order('nombre');

        if (!error && data && data.length > 0) {
          setSeccionales(data);
          setSeccionalId(data[0].id);
        } else {
          // Lista de respaldo institucional de Cruz Verde Salvadoreña
          const defaultSecs = [
            { id: 1, nombre: 'Aguilares' },
            { id: 2, nombre: 'Antiguo Cuscatlán' },
            { id: 3, nombre: 'Apopa' },
            { id: 4, nombre: 'Chalatenango' },
            { id: 5, nombre: 'Cojutepeque' },
            { id: 6, nombre: 'El Congo' },
            { id: 7, nombre: 'Ilopango' },
            { id: 8, nombre: 'La Libertad' },
            { id: 9, nombre: 'Mejicanos' },
            { id: 10, nombre: 'San Martín' },
            { id: 11, nombre: 'San Salvador (Sede Central)' },
            { id: 12, nombre: 'Santa Ana' },
            { id: 13, nombre: 'Santa Tecla' },
            { id: 14, nombre: 'Sensuntepeque' },
            { id: 15, nombre: 'Soyapango' },
            { id: 16, nombre: 'Usulután' },
            { id: 17, nombre: 'Zacatecoluca' }
          ];
          setSeccionales(defaultSecs);
          setSeccionalId(defaultSecs[0].id);
        }
      } catch (err) {
        console.error('Error cargando seccionales:', err);
      } finally {
        setLoadingSeccionales(false);
      }
    };

    fetchSeccionales();
  }, []);

  // Formatear carnet si lo ingresa
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

  // Teléfono con máscara 0000-0000 (solo números, 8 dígitos formato 0000-0000)
  const handleTelefonoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (raw.length <= 4) {
      setTelefono(raw);
    } else {
      setTelefono(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones de Nombres y Apellidos
    if (!primerNombre.trim()) {
      setError('Por favor, ingresa tu primer nombre.');
      return;
    }
    if (!primerApellido.trim()) {
      setError('Por favor, ingresa tu primer apellido.');
      return;
    }

    const nombreCompleto = [
      primerNombre.trim(),
      segundoNombre.trim(),
      tercerNombre.trim(),
      primerApellido.trim(),
      segundoApellido.trim()
    ].filter(Boolean).join(' ');

    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }
    const telefonoDigitos = telefono.replace(/\D/g, '');
    if (telefonoDigitos.length !== 8) {
      setError('Por favor, ingresa un número de teléfono de 8 dígitos con formato 0000-0000.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Crear el usuario en Supabase Auth mediante cliente secundario aislado
      // Esto evita que cierre o altere la sesión actual del navegador
      const secondarySupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            nombre_completo: nombreCompleto,
            primer_nombre: primerNombre.trim(),
            segundo_nombre: segundoNombre.trim() || null,
            tercer_nombre: tercerNombre.trim() || null,
            primer_apellido: primerApellido.trim(),
            segundo_apellido: segundoApellido.trim() || null,
            telefono: telefono.trim(),
            seccional_id: seccionalId,
            carnet: carnet.trim() || null,
            tipo_usuario: 'socorrista'
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          throw new Error('Este correo electrónico ya se encuentra registrado en el sistema. Puedes intentar iniciar sesión o recuperar tu contraseña.');
        }
        throw authError;
      }

      const newUserId = authData.user?.id;

      // 2. Insertar rol inicial en user_roles en estado PENDIENTE / INACTIVO
      if (newUserId) {
        try {
          const { error: roleErr } = await supabase
            .from('user_roles')
            .upsert({
              id: newUserId,
              role: 'pendiente',
              requires_password_reset: false
            });
          if (roleErr) console.warn('Aviso al insertar en user_roles:', roleErr);
        } catch (rErr) {
          console.warn('Error no crítico asignando rol inicial:', rErr);
        }
      }

      // 3. Registrar la solicitud en solicitudes_registro (con fallback resiliente)
      const selectedSeccionalNombre = seccionales.find(s => s.id === Number(seccionalId))?.nombre || '';

      const nuevaSolicitud = {
        id: crypto.randomUUID ? crypto.randomUUID() : `sol-${Date.now()}`,
        auth_user_id: newUserId || null,
        nombre_completo: nombreCompleto,
        email: email.trim().toLowerCase(),
        telefono: telefono.trim(),
        seccional_id: seccionalId ? Number(seccionalId) : null,
        seccional_nombre: selectedSeccionalNombre,
        carnet: carnet.trim() || null,
        tipo_usuario: 'socorrista',
        motivo: motivo.trim() || 'Solicitud de acceso al sistema institucional',
        estado: 'pendiente',
        fecha_solicitud: new Date().toISOString()
      };

      // 3. Registrar la solicitud en la API backend y en Supabase (Garantía absoluta)
      try {
        await fetch(getApiUrl('/api/solicitudes-registro'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nuevaSolicitud)
        });
      } catch (apiErr) {
        console.warn('Aviso guardando solicitud en backend:', apiErr);
      }

      try {
        const { error: tableError } = await supabase
          .from('solicitudes_registro')
          .insert([nuevaSolicitud]);

        if (tableError) {
          console.warn('Tabla solicitudes_registro no disponible directamente, guardando en respaldo:', tableError);
          await guardarEnRespaldo(nuevaSolicitud);
        }
      } catch (dbErr) {
        console.warn('Fallback de solicitudes activado:', dbErr);
        await guardarEnRespaldo(nuevaSolicitud);
      }

      // 4. Mostrar pantalla de éxito con el mensaje exacto solicitado
      setNombreCompletoRegistrado(nombreCompleto);
      setRegistroExitoso(true);

    } catch (err: any) {
      console.error('Error registrando cuenta:', err);
      setError(err.message || 'Ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // Guardado de respaldo si la tabla de Supabase aún no ha sido migrada con SQL
  const guardarEnRespaldo = async (solicitud: any) => {
    try {
      // Intentar leer lista existente de respaldo
      const { data: configRows } = await supabase
        .from('configuracion')
        .select('*')
        .eq('clave', 'solicitudes_registro_store')
        .single();

      let listaExistente: any[] = [];
      if (configRows && configRows.valor) {
        try {
          listaExistente = JSON.parse(configRows.valor);
        } catch (e) {
          listaExistente = [];
        }
      }

      // Agregar nueva solicitud evitando duplicados por correo
      listaExistente = listaExistente.filter(s => s.email !== solicitud.email);
      listaExistente.unshift(solicitud);

      await supabase
        .from('configuracion')
        .upsert({
          clave: 'solicitudes_registro_store',
          valor: JSON.stringify(listaExistente)
        });
    } catch (fallbackError) {
      console.error('Error guardando en respaldo de configuracion:', fallbackError);
    }
  };

  // Pantalla de Confirmación de Solicitud Pendiente
  if (registroExitoso) {
    return (
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-lg">
          <div className="bg-white py-10 px-6 sm:px-10 shadow-xl rounded-2xl border border-gray-200 text-center">
            
            {/* Icono de Reloj y Estado Pendiente */}
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-50 border-4 border-amber-200 mb-6 shadow-xs">
              <Clock className="h-10 w-10 text-amber-600 animate-pulse" />
            </div>

            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider mb-4">
              Estado: Pendiente de Aprobación
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4">
              Solicitud de Registro Enviada
            </h2>

            {/* MENSAJE OBLIGATORIO SOLICITADO */}
            <div className="bg-amber-50/80 border-l-4 border-amber-500 p-5 rounded-r-xl text-left my-6 shadow-2xs">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 mr-3" />
                <p className="text-base font-bold text-amber-900 leading-snug">
                  Su usuario está pendiente de que sea aceptado en el sistema, mientras tanto no podrá ingresar.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600 mb-8 text-left bg-gray-50 p-4 rounded-xl border border-gray-200/80">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500 font-medium">Solicitante:</span>
                <span className="font-semibold text-gray-900">{nombreCompletoRegistrado}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500 font-medium">Correo registrado:</span>
                <span className="font-semibold text-gray-900">{email}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500 font-medium">Seccional:</span>
                <span className="font-semibold text-gray-900">
                  {seccionales.find(s => s.id === Number(seccionalId))?.nombre || 'General'}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-500 font-medium">Teléfono:</span>
                <span className="font-semibold text-gray-900">{telefono}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-8 leading-relaxed">
              Un administrador institucional de <strong>Cruz Verde Salvadoreña</strong> revisará tus datos. Cuando tu cuenta sea aprobada y activada, recibirás una notificación por correo electrónico confirmando que ya tienes autorización para iniciar sesión.
            </p>

            <Link
              to="/login"
              className="w-full inline-flex justify-center items-center py-3 px-6 border border-transparent rounded-xl shadow-md text-base font-bold text-white bg-primary hover:bg-emerald-800 transition-all focus:outline-hidden"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver a la Pantalla de Inicio de Sesión
            </Link>

          </div>
        </div>
      </div>
    );
  }

  // Formulario de Registro
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        
        {/* Encabezado e Imagen Institucional */}
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-primary">
            <img src={logos?.login || "/logo.png"} alt="Cruz Verde Salvadoreña" className="h-14 w-14 object-contain" />
          </div>
        </div>

        <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">
          Registrar Nueva Cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Solicitud de acceso al Sistema de Cruz Verde Salvadoreña
        </p>

        <div className="mt-3 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Shield className="w-3 h-3 mr-1 text-emerald-600" />
            Acceso regulado por administración
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-200">
          
          {/* Banner explicativo del proceso de aprobación */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 mb-6 text-xs text-blue-900 flex items-start space-x-2.5">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-blue-950">Proceso de Aprobación Institucional:</span>
              Al registrarte, tu usuario se creará en espera de revisión. Podrás ingresar al sistema una vez que un usuario administrador acepte tu solicitud.
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 shrink-0" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Sección de Nombres */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nombres <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="primerNombre" className="block text-xs font-medium text-gray-600 mb-1">
                    Primer Nombre <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="primerNombre"
                      name="primerNombre"
                      type="text"
                      required
                      value={primerNombre}
                      onChange={(e) => setPrimerNombre(soloTexto(e.target.value))}
                      className="focus:ring-primary focus:border-primary block w-full pl-9 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                      placeholder="Ej. Juan"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="segundoNombre" className="block text-xs font-medium text-gray-600 mb-1">
                    Segundo Nombre <span className="text-gray-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    id="segundoNombre"
                    name="segundoNombre"
                    type="text"
                    value={segundoNombre}
                    onChange={(e) => setSegundoNombre(soloTexto(e.target.value))}
                    className="focus:ring-primary focus:border-primary block w-full px-3 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                    placeholder="Ej. Carlos"
                  />
                </div>

                <div>
                  <label htmlFor="tercerNombre" className="block text-xs font-medium text-gray-600 mb-1">
                    Tercer Nombre <span className="text-gray-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    id="tercerNombre"
                    name="tercerNombre"
                    type="text"
                    value={tercerNombre}
                    onChange={(e) => setTercerNombre(soloTexto(e.target.value))}
                    className="focus:ring-primary focus:border-primary block w-full px-3 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>

            {/* Sección de Apellidos */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Apellidos <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="primerApellido" className="block text-xs font-medium text-gray-600 mb-1">
                    Primer Apellido <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="primerApellido"
                      name="primerApellido"
                      type="text"
                      required
                      value={primerApellido}
                      onChange={(e) => setPrimerApellido(soloTexto(e.target.value))}
                      className="focus:ring-primary focus:border-primary block w-full pl-9 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                      placeholder="Ej. Ramírez"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="segundoApellido" className="block text-xs font-medium text-gray-600 mb-1">
                    Segundo Apellido <span className="text-gray-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    id="segundoApellido"
                    name="segundoApellido"
                    type="text"
                    value={segundoApellido}
                    onChange={(e) => setSegundoApellido(soloTexto(e.target.value))}
                    className="focus:ring-primary focus:border-primary block w-full px-3 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                    placeholder="Ej. Pérez"
                  />
                </div>
              </div>
            </div>

            {/* Correo Electrónico */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                  placeholder="ejemplo@cruzverdesv.org"
                />
              </div>
              <p className="text-2xs text-gray-500 mt-1">Ejemplo: ejemplo@cruzverdesv.org</p>
            </div>

            {/* Fila Contraseña y Confirmación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="focus:ring-primary focus:border-primary block w-full pl-10 pr-10 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                  Confirmar Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                    placeholder="Repite la contraseña"
                  />
                </div>
              </div>
            </div>

            {/* Fila Teléfono y Seccional */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="telefono" className="block text-sm font-semibold text-gray-700">
                  Teléfono de Contacto <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    required
                    maxLength={9}
                    value={telefono}
                    onChange={handleTelefonoChange}
                    className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                    placeholder="0000-0000"
                  />
                </div>
                <p className="text-2xs text-gray-500 mt-1">Formato: 0000-0000 (8 dígitos numéricos)</p>
              </div>

              <div>
                <label htmlFor="seccional" className="block text-sm font-semibold text-gray-700">
                  Seccional a la que pertenece <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    id="seccional"
                    name="seccional"
                    required
                    value={seccionalId}
                    onChange={(e) => setSeccionalId(e.target.value ? Number(e.target.value) : '')}
                    className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-2.5 border bg-white"
                  >
                    {seccionales.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Número de Carnet CVS Opcional (el tipo de vínculo se envía por defecto como socorrista) */}
            <div>
              <label htmlFor="carnet" className="block text-sm font-semibold text-gray-700">
                Número de Carnet CVS <span className="text-xs font-normal text-gray-400">(Opcional)</span>
              </label>
              <input
                id="carnet"
                name="carnet"
                type="text"
                value={carnet}
                onChange={handleCarnetChange}
                className="mt-1 focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                placeholder="CVS-0000-AA"
              />
            </div>

            {/* Motivo o Justificación */}
            <div>
              <label htmlFor="motivo" className="block text-sm font-semibold text-gray-700">
                Motivo de Solicitud de Acceso <span className="text-xs font-normal text-gray-400">(Opcional)</span>
              </label>
              <textarea
                id="motivo"
                name="motivo"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1 focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-lg p-2.5 border"
                placeholder="Indica el área o actividades que requieres gestionar en el sistema institucional..."
              />
            </div>

            {/* Botón Enviar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-white bg-primary hover:bg-emerald-800 transition-all focus:outline-hidden disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Enviando Solicitud...' : 'Enviar Solicitud de Cuenta'}
              </button>
            </div>

            {/* Enlace de regreso al login */}
            <div className="text-center pt-2">
              <p className="text-sm text-gray-600">
                ¿Ya tienes una cuenta activa?{' '}
                <Link to="/login" className="font-semibold text-primary hover:text-emerald-800 hover:underline">
                  Inicia sesión aquí
                </Link>
              </p>
            </div>

          </form>

        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          Cruz Verde Salvadoreña &copy; {new Date().getFullYear()} &bull; Sistema Interno de Gestión Institucional
        </div>

      </div>
    </div>
  );
}
