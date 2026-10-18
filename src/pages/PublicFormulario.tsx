import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, AlertCircle, Lock, ArrowLeft, Send, 
  ShieldAlert, RefreshCw, FileText, Globe, MapPin, User, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Formulario, FormField } from '../types/formulario';
import PhoneInputWithCountry from '../components/formularios/PhoneInputWithCountry';
import { applyDuiMask } from '../utils/phoneMasks';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export default function PublicFormulario() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userName } = useAuth();
  const { logos, colors } = useSettings();

  const [form, setForm] = useState<Formulario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form values state
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seccionales, setSeccionales] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<number | null>(null);

  // Load Form Data
  useEffect(() => {
    if (!slug) return;
    loadForm();
    loadSeccionales();
  }, [slug]);

  const loadForm = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Cargar desde Supabase
      const { data: supaForm, error: supaErr } = await supabase
        .from('formularios')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      let data: Formulario | null = supaForm;

      // 2. Si no se halló en Supabase, consultar endpoint local
      if (!data) {
        const res = await fetch(getApiUrl(`/api/formularios/${slug}`));
        if (res.ok) {
          data = await res.json();
        }
      }

      if (!data) {
        throw new Error('Formulario no encontrado o enlace incorrecto.');
      }

      setForm(data);

      // Initialize default values
      const initialVals: Record<string, any> = {};
      data.campos.forEach((c) => {
        if (c.tipo === 'checkbox') initialVals[c.id] = [];
        else if (c.tipo === 'terminos') initialVals[c.id] = false;
        else initialVals[c.id] = '';
      });
      setValues(initialVals);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const loadSeccionales = async () => {
    try {
      const { data: supaSeccs } = await supabase.from('seccionales').select('nombre');
      if (supaSeccs && supaSeccs.length > 0) {
        setSeccionales(supaSeccs.map((s: any) => s.nombre).filter(Boolean));
        return;
      }
      const res = await fetch(getApiUrl('/api/seccionales'));
      if (res.ok) {
        const data = await res.json();
        setSeccionales(data.map((s: any) => s.nombre).filter(Boolean));
      }
    } catch (err) {
      // Fallback official list
      setSeccionales([
        'Santa Ana', 'San Salvador', 'Antiguo Cuscatlán', 'Soyapango', 
        'Sonsonate', 'San Miguel', 'Apopa', 'Santa Tecla', 'Zacamil', 
        'El Congo', 'Aguilares', 'Chalatenango', 'San Vicente', 'La Paz'
      ]);
    }
  };

  const handleFieldChange = (fieldId: string, val: any) => {
    setValues(prev => ({ ...prev, [fieldId]: val }));
    // Clear error for field
    if (errors[fieldId]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
  };

  const handleCheckboxToggle = (fieldId: string, option: string) => {
    const currentList: string[] = values[fieldId] || [];
    const exists = currentList.includes(option);
    const updated = exists ? currentList.filter(o => o !== option) : [...currentList, option];
    handleFieldChange(fieldId, updated);
  };

  const validate = (): boolean => {
    if (!form) return false;
    const newErrors: Record<string, string> = {};

    form.campos.forEach(c => {
      const val = values[c.id];

      if (c.required) {
        if (c.tipo === 'terminos' && !val) {
          newErrors[c.id] = 'Debes aceptar los términos y condiciones para continuar';
        } else if (c.tipo === 'checkbox' && (!val || val.length === 0)) {
          newErrors[c.id] = 'Debes seleccionar al menos una opción';
        } else if (!val || String(val).trim() === '') {
          newErrors[c.id] = 'Este campo es obligatorio';
        }
      }

      // Email validation
      if (c.tipo === 'email' && val && String(val).trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val).trim())) {
          newErrors[c.id] = 'Por favor ingresa un correo electrónico válido';
        }
      }

      // Phone validation (ensure there are digits)
      if (c.tipo === 'telefono' && c.required && val) {
        const digits = String(val).replace(/\D/g, '');
        if (digits.length < 8) {
          newErrors[c.id] = 'Por favor ingresa un número de teléfono completo';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (!validate()) {
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        formulario_id: form.id,
        usuario_id: user?.id || null,
        usuario_nombre: userName || values['nombre'] || values['nombres'] || 'Público / Externo',
        usuario_email: user?.email || values['email'] || values['correo'] || null,
        respuestas: values,
        created_at: new Date().toISOString()
      };

      // 1. Guardar en Supabase en la nube
      const { data: supaResp, error: supaErr } = await supabase
        .from('formulario_respuestas')
        .insert([payload])
        .select()
        .single();

      if (supaErr) {
        console.warn('Aviso guardando en Supabase:', supaErr);
      }

      // 2. Notificar API local si está disponible
      try {
        await fetch(getApiUrl(`/api/formularios/${form.id}/respuestas`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {}

      setSubmissionId(supaResp?.id || Date.now());
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('Error al registrar formulario: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    if (!form) return;
    const initialVals: Record<string, any> = {};
    form.campos.forEach((c) => {
      if (c.tipo === 'checkbox') initialVals[c.id] = [];
      else if (c.tipo === 'terminos') initialVals[c.id] = false;
      else initialVals[c.id] = '';
    });
    setValues(initialVals);
    setErrors({});
    setSubmitted(false);
    setSubmissionId(null);
  };

  // --------------------------------------------------------------------------
  // Loading & Error States
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-sm font-bold text-gray-700">Cargando formulario oficial...</h3>
        <p className="text-xs text-gray-400 mt-1">Cruz Verde Salvadoreña</p>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-200 shadow-xl text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Formulario no disponible</h2>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            {error || 'El formulario solicitado no existe, ha sido desactivado o el enlace ha caducado.'}
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Ir a la Página Principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Form Inactive State
  // --------------------------------------------------------------------------
  if (!form.activo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-amber-200 shadow-xl text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Recepción Cerrada</h2>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            Este formulario ({form.titulo}) no está recibiendo respuestas en este momento. Por favor contacte a la administración de Cruz Verde Salvadoreña si cree que se trata de un error.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Authentication Required Gate
  // --------------------------------------------------------------------------
  if (form.requiere_autenticacion && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
              Acceso Restringido Institucional
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-2">{form.titulo}</h2>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Este formulario requiere que inicies sesión con tu cuenta de personal o socorrista de <strong>Cruz Verde Salvadoreña</strong> para poder ver y enviar tus datos.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Lock className="w-4 h-4" /> Iniciar Sesión para Responder
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Success Confirmation Screen
  // --------------------------------------------------------------------------
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl p-8 sm:p-10 border border-gray-200 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
              ¡Registro Exitoso!
            </span>
            <h2 className="text-2xl font-black text-gray-900 mt-3">{form.titulo}</h2>
            {submissionId && (
              <p className="text-[11px] font-mono text-gray-400 mt-1">
                Número de Registro: #{submissionId}
              </p>
            )}
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs sm:text-sm text-emerald-900 leading-relaxed text-left">
            {form.mensaje_exito || '¡Muchas gracias! Tu respuesta ha sido registrada exitosamente en el sistema de Cruz Verde Salvadoreña.'}
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
            >
              Enviar otra respuesta
            </button>

            {user ? (
              <Link
                to="/formularios"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Volver a Formularios
              </Link>
            ) : (
              <Link
                to="/"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Ir a la Página Principal
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Main Form Filling View
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100/80 py-8 px-4 sm:px-6 flex flex-col justify-center items-center">
      
      {/* Top Brand Logo */}
      <div className="mb-6 text-center">
        {(logos.dashboard || logos.login) ? (
          <img 
            src={logos.dashboard || logos.login} 
            alt="Cruz Verde Salvadoreña" 
            className="h-16 w-auto mx-auto object-contain filter drop-shadow-sm" 
          />
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white rounded-2xl font-black text-sm tracking-wide shadow-xs">
            <span>CRUZ VERDE SALVADOREÑA</span>
          </div>
        )}
      </div>

      {/* Main Form Card Container */}
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
        
        {/* Decorative Header Banner */}
        <div 
          style={{ backgroundColor: colors.primary || '#001A70' }} 
          className="p-6 sm:p-8 text-white relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-full">
                {form.categoria || 'Institucional'}
              </span>
              {form.requiere_autenticacion ? (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Requiere Inicio de Sesión
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5" /> Formulario Público
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
              {form.titulo}
            </h1>

            {form.descripcion && (
              <p className="mt-2 text-xs sm:text-sm text-white/90 leading-relaxed font-normal">
                {form.descripcion}
              </p>
            )}

            {user && (
              <div className="mt-4 pt-3 border-t border-white/20 text-[11px] text-white/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Conectado como <strong>{userName || user.email}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Form Form Fields */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {form.campos.map((campo) => {
              const hasError = !!errors[campo.id];
              const isFull = campo.width === '100%' || campo.tipo === 'textarea' || campo.tipo === 'terminos';

              return (
                <div 
                  key={campo.id} 
                  id={`field-${campo.id}`} 
                  className={isFull ? 'sm:col-span-2' : 'sm:col-span-1'}
                >
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    {campo.label}
                    {campo.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                  </label>

                  {/* FIELD TYPE: TELÉFONO INTERNACIONAL */}
                  {campo.tipo === 'telefono' ? (
                    <PhoneInputWithCountry
                      value={values[campo.id] || ''}
                      onChange={(val) => handleFieldChange(campo.id, val)}
                      placeholder={campo.placeholder}
                      hasError={hasError}
                    />
                  ) : campo.tipo === 'carnet' ? (
                    <div className="relative rounded-xl shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-bold text-emerald-800">
                        CV-
                      </div>
                      <input
                        type="text"
                        value={(values[campo.id] || '').replace(/^CV-?/i, '')}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
                          handleFieldChange(campo.id, digits ? `CV-${digits}` : '');
                        }}
                        placeholder={campo.placeholder || '1024'}
                        className={`w-full pl-11 pr-3.5 py-2.5 bg-white border rounded-xl text-sm font-semibold tracking-wide text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                          hasError ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  ) : campo.tipo === 'dui' ? (
                    <input
                      type="text"
                      value={values[campo.id] || ''}
                      onChange={(e) => {
                        const formatted = applyDuiMask(e.target.value);
                        handleFieldChange(campo.id, formatted);
                      }}
                      placeholder={campo.placeholder || '00000000-0'}
                      maxLength={10}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-mono tracking-wider text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                        hasError ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
                      }`}
                    />
                  ) : campo.tipo === 'seccional' ? (
                    <select
                      value={values[campo.id] || ''}
                      onChange={(e) => handleFieldChange(campo.id, e.target.value)}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                        hasError ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
                      }`}
                    >
                      <option value="">{campo.placeholder || 'Seleccione su seccional o filial...'}</option>
                      {seccionales.map((sec, i) => (
                        <option key={i} value={sec}>{sec}</option>
                      ))}
                    </select>
                  ) : campo.tipo === 'rango' ? (
                    <select
                      value={values[campo.id] || ''}
                      onChange={(e) => handleFieldChange(campo.id, e.target.value)}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                        hasError ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
                      }`}
                    >
                      <option value="">{campo.placeholder || 'Seleccione su cargo / rango...'}</option>
                      {(campo.options || [
                        'Aspirante / Voluntario Nuevo', 'Socorrista Activo', 'Rescatista', 
                        'Paramédico / TEM', 'Motorista de Ambulancia', 'Guardia Activo', 'Público Externo'
                      ]).map((op, i) => (
                        <option key={i} value={op}>{op}</option>
                      ))}
                    </select>
                  ) : campo.tipo === 'select' ? (
                    <select
                      value={values[campo.id] || ''}
                      onChange={(e) => handleFieldChange(campo.id, e.target.value)}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                        hasError ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
                      }`}
                    >
                      <option value="">{campo.placeholder || 'Seleccione una opción...'}</option>
                      {campo.options?.map((op, i) => (
                        <option key={i} value={op}>{op}</option>
                      ))}
                    </select>
                  ) : campo.tipo === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={values[campo.id] || ''}
                      onChange={(e) => handleFieldChange(campo.id, e.target.value)}
                      placeholder={campo.placeholder}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                        hasError ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
                      }`}
                    />
                  ) : campo.tipo === 'radio' ? (
                    <div className="space-y-2 pt-1">
                      {campo.options?.map((op, i) => (
                        <label key={i} className="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer">
                          <input
                            type="radio"
                            name={campo.id}
                            value={op}
                            checked={values[campo.id] === op}
                            onChange={() => handleFieldChange(campo.id, op)}
                            className="text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                          />
                          <span>{op}</span>
                        </label>
                      ))}
                    </div>
                  ) : campo.tipo === 'checkbox' ? (
                    <div className="space-y-2 pt-1">
                      {campo.options?.map((op, i) => {
                        const checked = (values[campo.id] || []).includes(op);
                        return (
                          <label key={i} className="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleCheckboxToggle(campo.id, op)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                            />
                            <span>{op}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : campo.tipo === 'terminos' ? (
                    <div className={`p-4 rounded-xl border ${hasError ? 'bg-red-50/50 border-red-200' : 'bg-gray-50/80 border-gray-200'}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(values[campo.id])}
                          onChange={(e) => handleFieldChange(campo.id, e.target.checked)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="text-xs text-gray-800 leading-snug">
                          {campo.label}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <input
                      type={campo.tipo === 'email' ? 'email' : campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
                      value={values[campo.id] || ''}
                      onChange={(e) => handleFieldChange(campo.id, e.target.value)}
                      placeholder={campo.placeholder}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                        hasError ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
                      }`}
                    />
                  )}

                  {campo.help && (
                    <p className="mt-1 text-[11px] text-gray-500 italic">{campo.help}</p>
                  )}

                  {hasError && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors[campo.id]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Button Section */}
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-400">
              * Campos obligatorios requeridos para procesar su solicitud.
            </span>

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: colors.primary || '#001A70' }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md hover:opacity-95 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando datos...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Información
                </>
              )}
            </button>
          </div>

        </form>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-400">
          Cruz Verde Salvadoreña • Sistema Integrado de Registro Oficial
        </div>

      </div>
    </div>
  );
}
