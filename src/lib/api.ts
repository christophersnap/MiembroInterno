/**
 * Cruz Verde Salvadoreña - Utilidades de Conexión a la API y Envío de Correos
 * Compatible tanto con el servidor de desarrollo Vite/Node.js como con Hostinger (Apache/PHP en /miembros)
 */

export function getApiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/miembros') && !clean.startsWith('/miembros')) {
      return `/miembros${clean}`;
    }
  }
  return clean;
}

export interface EmailAttachment {
  nombre?: string;
  filename?: string;
  contenido?: string;
  content?: string;
  tipo?: string;
  contentType?: string;
}

export interface SendEmailPayload {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
  remitente?: string;
  replyTo?: string;
  cc?: string;
  tipo?: string;
  adjuntos?: EmailAttachment[];
  nombreArchivoPdf?: string;
}

/**
 * Envía un correo de notificación institucional por SMTP (Hostinger / Servidor)
 * Detecta automáticamente si el entorno está en la raíz o en el subdirectorio /miembros
 */
export async function sendEmailNotification(payload: SendEmailPayload): Promise<{ success: boolean; message?: string }> {
  const primaryUrl = getApiUrl('/api/send-email');
  const candidates = [
    primaryUrl,
    '/api/send-email',
    '/miembros/api/send-email',
    '/api/send-email.php',
    '/miembros/api/send-email.php'
  ];

  const uniqueCandidates = Array.from(new Set(candidates));
  let lastError = 'No se pudo comunicar con el servicio de correo';

  for (const url of uniqueCandidates) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      // Si el servidor devolvió HTML (ej. template SPA de respaldo), no es respuesta válida del API
      if (text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html')) {
        continue;
      }

      const json = JSON.parse(text);
      if (res.ok && json.success) {
        return json;
      } else if (json.error) {
        lastError = json.error;
      }
    } catch (err: any) {
      lastError = err.message || lastError;
    }
  }

  throw new Error(lastError);
}
