import React, { useState } from 'react';
import { KeyRound, X, Mail, CheckCircle2, Copy, AlertCircle, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/logger';
import { generarHtmlCorreoPasswordTemporal } from '../../lib/emailNotification';

interface ResetPasswordModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
  remitenteNombre: string;
  remitenteCorreo: string;
}

export default function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
  remitenteNombre,
  remitenteCorreo,
}: ResetPasswordModalProps) {
  const [method, setMethod] = useState<'temporal' | 'manual'>('temporal');
  const [manualPassword, setManualPassword] = useState('');
  const [requireResetOnLogin, setRequireResetOnLogin] = useState(true);
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ passwordGenerada: string; emailEnviado: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'CVS-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetPassword = method === 'temporal' ? generateTempPassword() : manualPassword.trim();
    if (!targetPassword || targetPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      // 1. Actualizar requires_password_reset en user_roles
      const { error: roleUpdateError } = await supabase
        .from('user_roles')
        .update({
          requires_password_reset: requireResetOnLogin,
        })
        .eq('id', user.id);

      if (roleUpdateError) {
        console.warn('Advertencia actualizando requires_password_reset en user_roles:', roleUpdateError);
      }

      // 2. Enviar correo con la clave si está marcado
      let emailSent = false;
      if (sendEmailNotification && user.email) {
        const emailHtml = generarHtmlCorreoPasswordTemporal({
          remitenteNombre,
          remitenteCorreo,
          destinatarioCorreo: user.email,
          destinatarioNombre: user.socorristas ? `${user.socorristas.primer_nombre} ${user.socorristas.primer_apellido}` : user.email.split('@')[0],
          asunto: 'Restablecimiento de Contraseña - Cruz Verde Salvadoreña',
          temporalPassword: targetPassword,
          loginUrl: `${window.location.origin}/login`
        });

        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              remitente: `${remitenteNombre} <${remitenteCorreo}>`,
              destinatario: user.email,
              asunto: 'Restablecimiento de Contraseña - Cruz Verde Salvadoreña',
              cuerpoHtml: emailHtml,
              tipo: 'password_reset'
            })
          });
          emailSent = true;
        } catch (mailErr) {
          console.error('Error enviando correo de reset:', mailErr);
        }
      }

      await logActivity('Restableció contraseña de usuario', 'Usuario', user.id, {
        metodo: method,
        usuario: user.email,
        requiere_cambio: requireResetOnLogin,
        correo_enviado: emailSent
      });

      setSuccessData({
        passwordGenerada: targetPassword,
        emailEnviado: emailSent,
      });

    } catch (err: any) {
      console.error('Error restableciendo contraseña:', err);
      setError(err.message || 'Error al procesar el restablecimiento de contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (successData?.passwordGenerada) {
      navigator.clipboard.writeText(successData.passwordGenerada);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const displayName = user.socorristas 
    ? `${user.socorristas.primer_nombre} ${user.socorristas.primer_apellido}` 
    : user.email;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150">
        
        {/* Cabecera Apple */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200/60 shadow-2xs">
              <KeyRound className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Restablecer Contraseña</h3>
              <p className="text-2xs text-gray-400">Gestión de credenciales de acceso</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resultado Exitoso Estilo Apple */}
        {successData ? (
          <div className="py-4 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 mx-auto flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h4 className="text-sm font-semibold text-gray-900">Contraseña Restablecida</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Clave generada para <strong>{displayName}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center space-y-1.5">
              <span className="text-3xs font-medium text-gray-400 uppercase tracking-wider block">
                Clave Temporal Asignada
              </span>
              <div className="flex items-center justify-center space-x-2">
                <span className="font-mono text-xl font-bold text-gray-900 tracking-widest">
                  {successData.passwordGenerada}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg hover:bg-slate-200/70 text-gray-600 transition-colors cursor-pointer"
                  title="Copiar contraseña"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copied && <span className="text-3xs text-emerald-600 font-semibold block">¡Copiado al portapapeles!</span>}
            </div>

            {successData.emailEnviado ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-2xs text-emerald-800 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instrucciones enviadas a <strong>{user.email}</strong>.</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-2xs text-amber-800 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Copia la clave y compártela de forma segura con el usuario.</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleExecuteReset} className="mt-4 space-y-4 text-xs">
            
            {/* Resumen del Usuario Estilo Inset */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-0.5">
              <span className="text-3xs font-medium text-gray-400 uppercase tracking-wider block">Usuario Seleccionado</span>
              <p className="font-semibold text-gray-900">{displayName}</p>
              <p className="text-gray-500 font-mono text-2xs">{user.email}</p>
              <div className="pt-1 flex items-center">
                <span className="px-2 py-0.5 rounded-full text-3xs font-medium bg-slate-200/70 text-slate-700">
                  Rol: {user.role}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            {/* Segmented Control para Método */}
            <div className="space-y-1.5">
              <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider">Método de Asignación</label>
              
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMethod('temporal')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    method === 'temporal'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Automática
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('manual')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    method === 'manual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {method === 'manual' && (
              <div className="space-y-1">
                <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider">Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Inset Checkboxes Estilo Apple */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireResetOnLogin}
                  onChange={(e) => setRequireResetOnLogin(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-2xs text-gray-700 font-medium leading-tight">
                  Obligar a cambiar contraseña en el primer inicio
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-2xs text-gray-700 font-medium leading-tight">
                  Enviar correo de notificación al usuario
                </span>
              </label>
            </div>

            {/* Botones Apple Footer */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center cursor-pointer"
              >
                {loading ? 'Procesando...' : 'Restablecer'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
