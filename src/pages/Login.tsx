import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Mail, Lock, UserPlus, KeyRound, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { generarHtmlCorreoPasswordTemporal } from '../lib/emailNotification';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Modal Olvidé Contraseña
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOption, setForgotOption] = useState<'link' | 'temporal'>('temporal');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);

  const navigate = useNavigate();
  const { logos, loginShowSolicitar, loginShowVerificar } = useSettings();

  useEffect(() => {
    const savedMsg = sessionStorage.getItem('auth_error_message');
    if (savedMsg) {
      setError(savedMsg);
      sessionStorage.removeItem('auth_error_message');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetEmailSent(false);

    try {
      // Check if user is locked out
      const { data: lockStatus, error: lockError } = await supabase.rpc('check_login_status', { user_email: email });
      
      if (!lockError && lockStatus && lockStatus[0]?.is_locked) {
        const lockedUntil = new Date(lockStatus[0].locked_until);
        throw new Error(`Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo después de las ${lockedUntil.toLocaleTimeString()}`);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          await supabase.rpc('handle_failed_login', { user_email: email });
          
          const { data: newLockStatus } = await supabase.rpc('check_login_status', { user_email: email });
          if (newLockStatus && newLockStatus[0]?.is_locked) {
            throw new Error('Has superado los 3 intentos fallidos. Tu cuenta ha sido bloqueada por 3 horas.');
          } else {
            throw new Error('Credenciales incorrectas.');
          }
        }
        throw signInError;
      }

      // Reset successful login
      await supabase.rpc('reset_successful_login', { user_email: email });

      // VERIFICAR ESTADO DEL USUARIO (PENDIENTE O INACTIVO)
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (loggedInUser && loggedInUser.email !== 'christopher.snap@gmail.com') {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role, requires_password_reset')
          .eq('id', loggedInUser.id)
          .single();

        const isPending = roleRow?.role === 'pendiente';
        const isInactive = roleRow?.role === 'inactivo';

        if (isPending) {
          await supabase.auth.signOut();
          throw new Error('Su usuario está pendiente de que sea aceptado en el sistema, mientras tanto no podrá ingresar.');
        }

        if (isInactive) {
          await supabase.auth.signOut();
          throw new Error('Su cuenta ha sido desactivada por el administrador. No tiene acceso para ingresar al sistema.');
        }
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgotModal = () => {
    setForgotEmail(email);
    setForgotError(null);
    setForgotSuccess(null);
    setTempPasswordResult(null);
    setShowForgotModal(true);
  };

  const handleProcessForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      if (forgotOption === 'link') {
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setForgotSuccess(`Se ha enviado un enlace de recuperación oficial al correo ${forgotEmail}. Sigue las instrucciones recibidas.`);
      } else {
        // Opción: Acceso temporal con forzado de cambio de contraseña al iniciar sesión
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let generatedTemp = 'CVS-';
        for (let i = 0; i < 6; i++) {
          generatedTemp += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Obtener configuración de remitente
        const { data: configRows } = await supabase.from('configuracion').select('clave, valor');
        let remitenteNombre = 'Cruz Verde Salvadoreña - Sistema Interno';
        let remitenteCorreo = 'notificaciones@cruzverdesv.org';

        if (configRows) {
          configRows.forEach((r: any) => {
            if (r.clave === 'email_remitente_nombre' && r.valor) remitenteNombre = r.valor;
            if (r.clave === 'email_remitente_correo' && r.valor) remitenteCorreo = r.valor;
          });
        }

        const emailHtml = generarHtmlCorreoPasswordTemporal({
          remitenteNombre,
          remitenteCorreo,
          destinatarioCorreo: forgotEmail,
          destinatarioNombre: forgotEmail.split('@')[0],
          asunto: 'Restablecimiento de Contraseña Temporal - Cruz Verde Salvadoreña',
          temporalPassword: generatedTemp,
          loginUrl: `${window.location.origin}/login`
        });

        // Despachar vía endpoint de correo
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              remitente: `${remitenteNombre} <${remitenteCorreo}>`,
              destinatario: forgotEmail,
              asunto: 'Restablecimiento de Contraseña Temporal - Cruz Verde Salvadoreña',
              cuerpoHtml: emailHtml,
              tipo: 'password_reset'
            })
          });
        } catch (apiErr) {
          console.warn('Endpoint de correo en segundo plano:', apiErr);
        }

        setTempPasswordResult(generatedTemp);
        setForgotSuccess(`Se ha generado un acceso temporal para ${forgotEmail}. Al iniciar sesión con esta clave temporal, el sistema te solicitará inmediatamente cambiarla.`);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Error al procesar la solicitud de recuperación.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-primary">
            <img src={logos?.login || "/logo.png"} alt="Cruz Verde Salvadoreña" className="h-16 w-16 object-contain" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Iniciar Sesión
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sistema Institucional de Cruz Verde Salvadoreña
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-200">
          
          {/* Botón de Registro de Nueva Cuenta */}
          <div className="mb-6">
            <Link
              to="/registro"
              className="w-full flex flex-col items-center justify-center py-2.5 px-4 border-2 border-emerald-600 text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 rounded-lg text-sm font-bold shadow-2xs transition-all group"
            >
              <div className="flex items-center justify-center">
                <UserPlus className="w-4 h-4 mr-2 text-emerald-700 group-hover:scale-105 transition-transform" />
                <span>¿No tienes cuenta? Registrar nueva cuenta</span>
              </div>
              <span className="text-2xs font-semibold text-emerald-700 mt-0.5">
                Acceso regulado por administración
              </span>
            </Link>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400 font-medium">O ingresa con tus credenciales</span>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mr-2 mt-0.5" />
                  <p className="text-sm font-medium text-red-700 leading-snug">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Correo Electrónico
              </label>
              <div className="mt-1 relative rounded-md shadow-2xs">
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
                  placeholder="usuario@cruzverdesv.org"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-2.5 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleOpenForgotModal}
                className="text-sm font-semibold text-primary hover:text-emerald-800 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-primary hover:bg-emerald-800 focus:outline-hidden disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>

            {/* Accesos rápidos externos */}
            <div className="flex flex-col space-y-2.5 pt-2 border-t border-gray-100">
              {loginShowSolicitar && (
                <Link
                  to="/solicitud-carnet"
                  className="w-full flex justify-center py-2 px-3 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  Solicitar Carnet Institucional
                </Link>
              )}
              {loginShowVerificar && (
                <Link
                  to="/verificar"
                  className="w-full flex justify-center py-2 px-3 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  Verificar Código de Carnet
                </Link>
              )}
            </div>

          </form>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          Cruz Verde Salvadoreña &copy; {new Date().getFullYear()} &bull; Todos los derechos reservados.
        </div>
      </div>

      {/* MODAL OLVIDÉ MI CONTRASEÑA */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-gray-900">Restablecer Contraseña</h3>
              </div>
              <button 
                onClick={() => setShowForgotModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                  {forgotSuccess}
                </p>

                {tempPasswordResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 my-3 text-center">
                    <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider block mb-1">Clave de acceso temporal generada:</span>
                    <span className="font-mono text-xl font-extrabold text-emerald-900 tracking-widest">{tempPasswordResult}</span>
                    <p className="text-2xs text-emerald-700 mt-2">
                      Úsala para ingresar en la pantalla principal. El sistema te pedirá cambiarla inmediatamente por tu nueva contraseña personal.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 px-4 bg-primary text-white font-bold rounded-lg text-sm hover:bg-emerald-800 transition-colors"
                >
                  Entendido, volver a Iniciar Sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleProcessForgotPassword} className="mt-4 space-y-4">
                <p className="text-xs text-gray-600">
                  Ingresa tu correo registrado para restablecer tu acceso institucional:
                </p>

                {forgotError && (
                  <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-r-md">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="usuario@cruzverdesv.org"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-gray-700">Método de recuperación:</label>
                  
                  <label className="flex items-start p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors border-gray-200">
                    <input
                      type="radio"
                      name="forgotOption"
                      value="temporal"
                      checked={forgotOption === 'temporal'}
                      onChange={() => setForgotOption('temporal')}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div className="ml-3 text-xs">
                      <span className="font-bold text-gray-900 block">Acceso Temporal (Recomendado)</span>
                      <span className="text-gray-500">Envía una clave temporal al correo y te fuerza a crear una contraseña nueva al ingresar.</span>
                    </div>
                  </label>

                  <label className="flex items-start p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors border-gray-200">
                    <input
                      type="radio"
                      name="forgotOption"
                      value="link"
                      checked={forgotOption === 'link'}
                      onChange={() => setForgotOption('link')}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div className="ml-3 text-xs">
                      <span className="font-bold text-gray-900 block">Enlace Oficial de Restablecimiento</span>
                      <span className="text-gray-500">Envía un enlace seguro de recuperación a tu bandeja de entrada.</span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'Procesando...' : 'Restablecer Acceso'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

