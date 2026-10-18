import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Setup Database
const db = new Database('cruzverde.db');

// Configuración SMTP efectiva (obtenida de .env o de la tabla configuracion en la base de datos)
export function getMailConfig() {
  let dbConfig: Record<string, string> = {};
  try {
    const rows = db.prepare("SELECT clave, valor FROM configuracion WHERE clave LIKE 'smtp_%'").all() as { clave: string, valor: string }[];
    rows.forEach(r => { dbConfig[r.clave] = r.valor; });
  } catch (e) {}

  const host = process.env.SMTP_HOST || dbConfig['smtp_host'] || 'smtp.office365.com';
  const defaultPort = (host.includes('hostinger') || host.includes('titan')) ? '465' : '587';
  const port = parseInt(process.env.SMTP_PORT || dbConfig['smtp_port'] || defaultPort, 10);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : (dbConfig['smtp_secure'] ? dbConfig['smtp_secure'] === 'true' : port === 465);
  const user = process.env.SMTP_USER || dbConfig['smtp_user'] || 'notificaciones@cruzverdesv.org';
  const pass = process.env.SMTP_PASS || dbConfig['smtp_pass'] || '';
  const from = process.env.SMTP_FROM || dbConfig['smtp_from'] || `Cruz Verde Salvadoreña (No Responder) <${user}>`;
  const replyTo = process.env.SMTP_REPLY_TO || dbConfig['smtp_reply_to'] || 'noreply@cruzverdesv.org';

  return { host, port, secure, user, pass, from, replyTo };
}

// Transporter para SMTP (Hostinger / Microsoft 365 / Hotmail / etc.)
function getMailTransporter(customConfig?: any) {
  const config = customConfig || getMailConfig();
  if (!config.pass) {
    return null;
  }

  const transportOpts: any = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  // Compatibilidad específica para Microsoft 365, Hotmail, Outlook (STARTTLS)
  if ((config.host.includes('office365') || config.host.includes('outlook') || config.host.includes('hotmail') || config.host.includes('live')) && config.port === 587) {
    transportOpts.requireTLS = true;
  }

  return nodemailer.createTransport(transportOpts);
}

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS seccionales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    direccion TEXT,
    telefono1 TEXT,
    telefono2 TEXT,
    director TEXT,
    subdirector TEXT,
    estado TEXT DEFAULT 'Activa',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS socorristas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carnet TEXT UNIQUE,
    primer_nombre TEXT,
    segundo_nombre TEXT,
    primer_apellido TEXT,
    segundo_apellido TEXT,
    fecha_nacimiento TEXT,
    telefono TEXT,
    direccion TEXT,
    seccional_id INTEGER,
    sexo TEXT,
    fecha_ingreso TEXT,
    foto_url TEXT,
    estado TEXT DEFAULT 'Activo',
    cargo_institucional TEXT,
    cargo_administrativo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seccional_id) REFERENCES seccionales(id)
  );

  CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    descripcion TEXT,
    duracion TEXT,
    vigencia_meses INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS socorrista_cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    socorrista_id INTEGER,
    curso_id INTEGER,
    anio INTEGER,
    fecha_certificacion TEXT,
    fecha_vencimiento TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (socorrista_id) REFERENCES socorristas(id),
    FOREIGN KEY (curso_id) REFERENCES cursos(id)
  );

  CREATE TABLE IF NOT EXISTS historial_carnet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    socorrista_id INTEGER,
    carnet_anterior TEXT,
    carnet_nuevo TEXT,
    motivo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (socorrista_id) REFERENCES socorristas(id)
  );

  CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE,
    valor TEXT
  );

  CREATE TABLE IF NOT EXISTS archivos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT DEFAULT 'General',
    nombre_archivo TEXT NOT NULL,
    url_archivo TEXT NOT NULL,
    tipo_archivo TEXT,
    extension TEXT,
    tamano_bytes INTEGER DEFAULT 0,
    tamano_legible TEXT,
    subido_por_id TEXT,
    subido_por_nombre TEXT,
    seccional_id INTEGER,
    descargas_count INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    enlace_externo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS anuncios (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    tipo TEXT DEFAULT 'info',
    prioridad INTEGER DEFAULT 1,
    mostrar_cuadro_dashboard INTEGER DEFAULT 1,
    mostrar_ticker_dashboard INTEGER DEFAULT 1,
    activo INTEGER DEFAULT 1,
    fecha_expiracion TEXT,
    enlace_url TEXT,
    enlace_texto TEXT DEFAULT 'Más información',
    imagen_url TEXT,
    archivo_nombre TEXT,
    archivo_url TEXT,
    archivo_tamano TEXT,
    autor_id TEXT,
    autor_nombre TEXT,
    vistas_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS formularios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT DEFAULT 'General',
    requiere_autenticacion INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    campos TEXT NOT NULL DEFAULT '[]',
    creado_por TEXT,
    creado_por_nombre TEXT DEFAULT 'Cruz Verde Salvadoreña',
    mensaje_exito TEXT DEFAULT '¡Muchas gracias! Tu respuesta ha sido registrada exitosamente en el sistema.',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS formulario_respuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formulario_id INTEGER NOT NULL,
    usuario_id TEXT,
    usuario_nombre TEXT,
    usuario_email TEXT,
    respuestas TEXT NOT NULL DEFAULT '{}',
    ip_origen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (formulario_id) REFERENCES formularios(id) ON DELETE CASCADE
  );
`);

try {
  const formCount = db.prepare('SELECT COUNT(*) as c FROM formularios').get() as any;
  if (!formCount || formCount.c === 0) {
    db.prepare(`
      INSERT INTO formularios (slug, titulo, descripcion, categoria, requiere_autenticacion, activo, mensaje_exito, campos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'inscripcion-curso-primeros-auxilios',
      'Inscripción Oficial - Curso de Primeros Auxilios y Soporte Vital Básico',
      'Formulario oficial de inscripción para socorristas y voluntarios de Cruz Verde Salvadoreña. Por favor complete todos los datos requeridos para validar su participación.',
      'Cursos y Capacitaciones',
      0,
      1,
      '¡Inscripción registrada con éxito! La Coordinación de Capacitaciones de Cruz Verde Salvadoreña se comunicará vía WhatsApp o correo electrónico para confirmar su sede y horario.',
      JSON.stringify([
        { id: "carnet", tipo: "carnet", label: "Número de Carnet Institucional", placeholder: "Ej: CV-1024", required: false, help: "Si ya eres elemento activo de Cruz Verde, ingresa tu número" },
        { id: "nombre", tipo: "nombre", label: "Nombres", placeholder: "Ingresa tus nombres", required: true },
        { id: "apellido", tipo: "apellido", label: "Apellidos", placeholder: "Ingresa tus apellidos", required: true },
        { id: "seccional", tipo: "seccional", label: "Seccional de Pertenencia / Más cercana", required: true },
        { id: "correo", tipo: "email", label: "Correo Electrónico de Contacto", placeholder: "ejemplo@correo.com", required: true },
        { id: "telefono", tipo: "telefono_internacional", label: "Teléfono Móvil (WhatsApp)", placeholder: "7000-0000", required: true, help: "Selecciona el código de país para el formato automático" },
        { id: "tipo_sangre", tipo: "tipo_sangre", label: "Tipo de Sangre", required: false },
        { id: "experiencia", tipo: "textarea", label: "Experiencia Previa o Motivación", placeholder: "Describe brevemente tu interés o capacitaciones anteriores...", required: false }
      ])
    );
  }
} catch (e) {
  // Ignore if error inserting initial form
}

try {
  db.exec("ALTER TABLE anuncios ADD COLUMN imagen_url TEXT");
} catch (e) {
  // Column might already exist
}

try {
  // Insert default config if not exists (incluyendo Migración 19 y SMTP)
  const defaultConfigs = [
    ['verificacion_titulo', 'Verificación de Carnet - Cruz Verde Salvadoreña'],
    ['verificacion_mensaje', 'Este carnet es auténtico y pertenece a un elemento activo de la institución.'],
    ['email_remitente_global', 'notificaciones@cruzverdesv.org'],
    ['email_remitente_nombre_global', 'Cruz Verde Salvadoreña (No Responder)'],
    ['email_remitente_no_reply_mode', 'true'],
    ['email_template_header_color', '#15803d'],
    ['email_template_header_text_color', '#ffffff'],
    ['email_template_footer_color', '#f9fafb'],
    ['email_template_footer_text_color', '#6b7280'],
    ['email_template_font_title', 'Plus Jakarta Sans'],
    ['email_template_font_body', 'Inter'],
    ['email_template_mostrar_logo', 'true'],
    ['email_template_legend', 'Este es un mensaje institucional generado automáticamente por el Sistema de Cruz Verde Salvadoreña desde una casilla no monitoreada. Por favor, no responda a este correo electrónico.'],
    ['email_template_telefono_contacto', '2284-0000 / 7695-7911'],
    ['smtp_host', 'smtp.office365.com'],
    ['smtp_port', '587'],
    ['smtp_secure', 'false'],
    ['smtp_user', 'notificaciones@cruzverdesv.org'],
    ['smtp_from', 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>'],
    ['smtp_reply_to', 'noreply@cruzverdesv.org']
  ];
  const insertStmt = db.prepare(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)`);
  for (const [k, v] of defaultConfigs) {
    insertStmt.run(k, v);
  }
} catch (e) {
  console.error(e);
}
try {
  db.exec("ALTER TABLE socorristas ADD COLUMN cargo_institucional TEXT");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE socorristas ADD COLUMN cargo_administrativo TEXT");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE socorristas ADD COLUMN dui TEXT");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE socorristas ADD COLUMN carnet_generado_url TEXT");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE socorristas ADD COLUMN tipo_sangre TEXT");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE socorristas ADD COLUMN email TEXT");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE socorristas ADD COLUMN segundo_cargo_administrativo TEXT");
} catch (e) {
  // Column might already exist
}

// Seed data if empty
const seccionalesCount = db.prepare('SELECT COUNT(*) as count FROM seccionales').get().count;
if (seccionalesCount === 0) {
  db.exec(`
    INSERT INTO seccionales (nombre, direccion, telefono1, director, subdirector) VALUES 
    ('Santa Tecla', '2a Calle Poniente', '2222-2222', 'Juan Perez', 'Maria Lopez'),
    ('San Salvador', 'Centro de Gobierno', '2333-3333', 'Carlos Ramirez', 'Ana Martinez'),
    ('Soyapango', 'Plaza Mundo', '2444-4444', 'Luis Gomez', 'Carmen Diaz');
    
    INSERT INTO cursos (nombre, descripcion, duracion, vigencia_meses) VALUES 
    ('Primeros Auxilios Básicos', 'Curso introductorio', '40 horas', 24),
    ('Rescate Vehicular', 'Extracción de víctimas', '60 horas', 12),
    ('Rescate Vertical', 'Técnicas con cuerdas', '80 horas', 12);
    
    INSERT INTO socorristas (carnet, primer_nombre, primer_apellido, fecha_nacimiento, telefono, seccional_id, sexo, fecha_ingreso) VALUES 
    ('CVS-0001-JP', 'Juan', 'Perez', '1990-01-01', '7777-7777', 1, 'Masculino', '2020-01-01'),
    ('CVS-0002-ML', 'Maria', 'Lopez', '1992-02-02', '7888-8888', 2, 'Femenino', '2021-02-02'),
    ('CVS-0003-CR', 'Carlos', 'Ramirez', '1985-03-03', '7999-9999', 3, 'Masculino', '2019-03-03');
    
    INSERT INTO socorrista_cursos (socorrista_id, curso_id, anio, fecha_certificacion, fecha_vencimiento) VALUES 
    (1, 1, 2023, '2023-01-01', '2025-01-01'),
    (1, 2, 2023, '2023-06-01', '2024-06-01'),
    (2, 1, 2024, '2024-01-01', '2026-01-01'),
  `);
}

// Seed archivos si está vacío
try {
  const archivosCount = db.prepare('SELECT COUNT(*) as count FROM archivos').get().count;
  if (archivosCount === 0) {
    db.prepare(`
      INSERT INTO archivos (id, titulo, descripcion, categoria, nombre_archivo, url_archivo, tipo_archivo, extension, tamano_legible, subido_por_nombre, activo)
      VALUES 
      ('arc-001', 'Manual de Primeros Auxilios Básicos y Avanzados 2026', 'Guía oficial y protocolos estandarizados de atención prehospitalaria de Cruz Verde Salvadoreña.', 'Manuales y Protocolos', 'Manual_Primeros_Auxilios_CVS_2026.pdf', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&auto=format&fit=crop&q=80', 'application/pdf', 'pdf', '4.2 MB', 'Administración Nacional', 1),
      ('arc-002', 'Formato Oficial de Hoja de Servicio y Turnos de Ambulancia', 'Plantilla descargable para registro de emergencias, traslados, kilometraje y firmas de tripulación.', 'Formatos y Formularios', 'Formato_Hoja_Servicio_Ambulancia_CVS.xlsx', 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1200&auto=format&fit=crop&q=80', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', '245 KB', 'Jefatura de Operaciones', 1),
      ('arc-003', 'Reglamento Interno y Código de Ética Institucional', 'Normativa que rige los deberes, derechos, uniformidad y disciplina del personal voluntario y remunerado.', 'Leyes y Normativas', 'Reglamento_Interno_Codigo_Etica_CVS.pdf', 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=1200&auto=format&fit=crop&q=80', 'application/pdf', 'pdf', '1.8 MB', 'Dirección Jurídica', 1)
    `).run();
  }
} catch (e) {
  console.warn('Error seeding archivos:', e);
}

// Seed anuncios si está vacío
try {
  const anunciosCount = db.prepare('SELECT COUNT(*) as count FROM anuncios').get().count;
  if (anunciosCount === 0) {
    db.prepare(`
      INSERT INTO anuncios (id, titulo, contenido, tipo, prioridad, mostrar_cuadro_dashboard, mostrar_ticker_dashboard, activo, enlace_texto, enlace_url, autor_nombre)
      VALUES 
      ('anu-001', '¡Actualización de Protocolos y Sistema Institucional 2026!', 'Se informa a todo el personal socorrista y voluntario que ya está habilitada la nueva sección de Archivos para descargar manuales, formatos de ambulancia y reglamentos oficiales. Favor consultar la pestaña Archivos en el menú lateral.', 'info', 1, 1, 1, 1, 'Ir a Archivos', '/archivos', 'Comandancia General'),
      ('anu-002', 'Convocatoria: Taller de Reanimación Cardiopulmonar (RCP) y DEA', 'Este sábado se llevará a cabo la jornada de certificación obligatoria para las tripulaciones de ambulancia de guardia. Inscripciones abiertas en la sección de Cursos.', 'evento', 2, 0, 1, 1, 'Ver Cursos', '/cursos', 'Escuela de Capacitación')
    `).run();
  }
} catch (e) {
  console.warn('Error seeding anuncios:', e);
}

// Setup Multer for local uploads (Simulating Google Drive for now)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

async function startServer() {
  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // --- Estado de Configuración SMTP (Microsoft 365 / Hostinger / Hotmail) ---
  app.get('/api/smtp-config-status', (req, res) => {
    const config = getMailConfig();
    const isConfigured = !!config.pass;
    const { host, port, secure, user, from, replyTo } = config;

    let provider = 'Servidor SMTP Personalizado';
    if (host.includes('hostinger')) provider = 'Hostinger Webmail';
    else if (host.includes('titan')) provider = 'Titan Email (Hostinger)';
    else if (host.includes('office365')) provider = 'Microsoft 365 Exchange Online';
    else if (host.includes('outlook') || host.includes('hotmail') || host.includes('live')) provider = 'Hotmail / Outlook Personal';
    else if (host.includes('gmail')) provider = 'Google Workspace / Gmail';
    else if (host.includes('brevo')) provider = 'Brevo Relay';

    res.json({
      configured: isConfigured,
      hasPassword: isConfigured,
      host,
      port: String(port),
      secure,
      user,
      from,
      replyTo,
      provider,
      protocol: secure ? `SSL/TLS Seguro (${port})` : `STARTTLS (${port})`
    });
  });

  // --- Probar Conexión SMTP en Vivo (Verificación con Microsoft 365 / Servidor) ---
  app.post('/api/smtp-test-connection', async (req, res) => {
    try {
      const { host, port, secure, user, pass } = req.body || {};
      let transporter: any;
      if (host && user && pass) {
        transporter = getMailTransporter({
          host,
          port: parseInt(port, 10) || 587,
          secure: secure === true || secure === 'true',
          user,
          pass
        });
      } else {
        transporter = getMailTransporter();
      }

      if (!transporter) {
        return res.status(400).json({
          success: false,
          error: 'No se ha configurado la contraseña SMTP. Para probar la conexión con Microsoft 365, ingresa la contraseña o contraseña de aplicación.'
        });
      }

      await transporter.verify();
      res.json({
        success: true,
        message: '¡Conexión SMTP exitosa con el servidor de correo!'
      });
    } catch (err: any) {
      let sugerencia = '';
      const msg = err.message || '';
      if (msg.includes('535') || msg.includes('Authentication unsuccessful') || msg.includes('BadCredentials')) {
        sugerencia = 'Error 535 de Microsoft: Si ya activaste "SMTP autenticado", el bloqueo se debe a: 1) "Valores predeterminados de seguridad" (Security Defaults) activos en Entra ID / Azure que bloquean la autenticación básica globalmente; 2) La cuenta tiene MFA activo (requiere desactivar MFA en este usuario o usar Contraseña de Aplicación); 3) Demora de replicación de Microsoft (15 a 60 min); 4) Contraseña incorrecta.';
      } else if (msg.includes('Tenant') || msg.includes('disabled') || msg.includes('Client was not authenticated')) {
        sugerencia = 'Microsoft 365 tiene deshabilitado SMTP AUTH a nivel de inquilino o la cuenta requiere una Contraseña de Aplicación debido a MFA.';
      } else if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
        sugerencia = 'No se pudo conectar al servidor SMTP. Verifica que el host sea smtp.office365.com y el puerto sea 587.';
      }

      res.status(500).json({
        success: false,
        error: err.message,
        code: err.code,
        sugerencia
      });
    }
  });

  // --- Enviar Correo de Notificación (Aprobación de usuario, solicitudes con PDF adjunto, etc.) ---
  app.post('/api/send-email', async (req, res) => {
    try {
      const { remitente, destinatario, cc, replyTo, asunto, cuerpoHtml, tipo, adjuntos, nombreArchivoPdf } = req.body;
      const countAdjuntos = Array.isArray(adjuntos) ? adjuntos.length : (nombreArchivoPdf ? 1 : 0);
      
      const config = getMailConfig();
      const transporter = getMailTransporter();
      let realSent = false;
      let messageId = null;
      const host = config.host;
      const providerLabel = host.includes('hostinger') 
        ? 'Hostinger' 
        : (host.includes('titan') 
          ? 'Titan' 
          : (host.includes('office365') 
            ? 'Microsoft 365' 
            : (host.includes('outlook') || host.includes('hotmail') || host.includes('live')
              ? 'Hotmail/Outlook'
              : 'SMTP')));

      if (transporter) {
        try {
          const fromAddress = remitente || config.from;
          const replyToAddress = replyTo || config.replyTo;
          
          const mailOptions: any = {
            from: fromAddress,
            to: destinatario,
            replyTo: replyToAddress,
            cc: cc || undefined,
            subject: asunto,
            html: cuerpoHtml
          };

          if (Array.isArray(adjuntos) && adjuntos.length > 0) {
            mailOptions.attachments = adjuntos.map((att: any) => ({
              filename: att.nombre || att.filename || 'archivo.pdf',
              content: att.contenido || att.content,
              path: att.path || att.url || undefined,
              contentType: att.tipo || att.contentType || undefined
            }));
          }

          const info = await transporter.sendMail(mailOptions);
          realSent = true;
          messageId = info.messageId;
          console.log(`[${providerLabel.toUpperCase()} SMTP SUCCESS] Enviado a: ${destinatario} | Reply-To: ${replyToAddress} | ID: ${info.messageId}`);
        } catch (mailErr: any) {
          let sugerencia = '';
          if (mailErr.message?.includes('535') || mailErr.message?.includes('Authentication unsuccessful') || mailErr.message?.includes('BadCredentials')) {
            sugerencia = 'Error 535 de Microsoft: Si ya activaste "SMTP autenticado", el bloqueo se debe a: 1) "Valores predeterminados de seguridad" (Security Defaults) activos en Entra ID / Azure; 2) La cuenta tiene MFA activo (requiere desactivar MFA en este usuario o usar Contraseña de Aplicación); 3) Demora de replicación de Microsoft (15 a 60 min); 4) Contraseña incorrecta.';
          }
          return res.status(500).json({ 
            success: false, 
            isRealSent: false,
            error: `Error al enviar correo por ${providerLabel}: ${mailErr.message}`,
            code: mailErr.code || 'SMTP_ERROR',
            sugerencia
          });
        }
      } else {
        console.log(`[EMAIL NOTIFICATION] (Modo registro/simulado, configure contraseña SMTP). Tipo: ${tipo || 'general'} | De: ${remitente} | Para: ${destinatario} | Asunto: ${asunto}`);
        if (tipo && (tipo.startsWith('test_') || tipo === 'test')) {
          return res.status(400).json({
            success: false,
            isRealSent: false,
            error: `No se envió el correo a ${destinatario} porque la contraseña SMTP aún no está guardada en el sistema. Para recibir correos reales de Microsoft 365, ingresa la contraseña en la configuración SMTP abajo y haz clic en Guardar.`
          });
        }
      }

      res.json({ 
        success: true, 
        message: realSent ? `Correo enviado exitosamente a través de ${providerLabel}` : 'Notificación procesada y registrada en el sistema', 
        isRealSent: realSent,
        messageId,
        detalles: { 
          destinatario, 
          asunto, 
          tipo, 
          tienePdfAdjunto: countAdjuntos > 0,
          nombreArchivoPdf: nombreArchivoPdf || (adjuntos && adjuntos[0]?.nombre),
          timestamp: new Date().toISOString() 
        } 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir));

  // --- Subida Genérica de Archivos (PDF, Word, Excel, Imágenes, etc.) ---
  app.post('/api/upload-file', upload.single('archivo'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se envió ningún archivo' });
      }
      const publicUrl = `/uploads/${req.file.filename}`;
      res.json({
        success: true,
        url: publicUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Sistema de Concurrencia y Presencia en Vivo (Usuarios Conectados) ---
  interface ActiveUserSession {
    id: string;
    name: string;
    role?: string;
    lastSeen: number;
    path?: string;
  }
  const activeUsersMap = new Map<string, ActiveUserSession>();

  // Limpieza periódica de sesiones inactivas (> 90 segundos)
  setInterval(() => {
    const now = Date.now();
    for (const [key, session] of activeUsersMap.entries()) {
      if (now - session.lastSeen > 90000) {
        activeUsersMap.delete(key);
      }
    }
  }, 30000);

  app.post('/api/presence/ping', (req, res) => {
    try {
      const { id = `anon_${Date.now()}`, name = 'Usuario', role = 'usuario', path = '/' } = req.body || {};
      const now = Date.now();
      activeUsersMap.set(id, {
        id,
        name,
        role,
        lastSeen: now,
        path
      });

      const activeThreshold = now - 65000;
      const activeList: ActiveUserSession[] = [];
      for (const session of activeUsersMap.values()) {
        if (session.lastSeen >= activeThreshold) {
          activeList.push(session);
        }
      }

      res.json({
        success: true,
        onlineCount: Math.max(activeList.length, 1),
        activeUsers: activeList.map(u => ({ id: u.id, name: u.name, role: u.role }))
      });
    } catch (e: any) {
      res.json({ success: true, onlineCount: 1, activeUsers: [] });
    }
  });

  app.get('/api/presence', (req, res) => {
    try {
      const now = Date.now();
      const activeThreshold = now - 65000;
      const activeList: ActiveUserSession[] = [];
      for (const session of activeUsersMap.values()) {
        if (session.lastSeen >= activeThreshold) {
          activeList.push(session);
        }
      }
      res.json({
        onlineCount: Math.max(activeList.length, 1),
        activeUsers: activeList.map(u => ({ id: u.id, name: u.name, role: u.role }))
      });
    } catch (e: any) {
      res.json({ onlineCount: 1, activeUsers: [] });
    }
  });

  // --- Endpoints de Archivos Institucionales ---
  app.get('/api/archivos', (req, res) => {
    try {
      const includeInactive = req.query.all === 'true';
      const query = includeInactive 
        ? 'SELECT * FROM archivos ORDER BY created_at DESC' 
        : 'SELECT * FROM archivos WHERE activo = 1 ORDER BY created_at DESC';
      const rows = db.prepare(query).all();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/archivos', (req, res) => {
    try {
      const {
        id = `arc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        titulo,
        descripcion = '',
        categoria = 'General',
        nombre_archivo,
        url_archivo,
        tipo_archivo = '',
        extension = '',
        tamano_bytes = 0,
        tamano_legible = '',
        subido_por_id = null,
        subido_por_nombre = 'Administración',
        seccional_id = null,
        enlace_externo = null
      } = req.body;

      if (!titulo || !url_archivo || !nombre_archivo) {
        return res.status(400).json({ error: 'Título, URL y nombre de archivo son obligatorios' });
      }

      const stmt = db.prepare(`
        INSERT INTO archivos (
          id, titulo, descripcion, categoria, nombre_archivo, url_archivo,
          tipo_archivo, extension, tamano_bytes, tamano_legible,
          subido_por_id, subido_por_nombre, seccional_id, enlace_externo, activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      stmt.run(
        id, titulo, descripcion, categoria, nombre_archivo, url_archivo,
        tipo_archivo, extension, tamano_bytes, tamano_legible,
        subido_por_id, subido_por_nombre, seccional_id, enlace_externo
      );

      const created = db.prepare('SELECT * FROM archivos WHERE id = ?').get(id);
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/archivos/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM archivos WHERE id = ?').run(req.params.id);
      res.json({ success: true, message: 'Archivo eliminado' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/archivos/:id/descarga', (req, res) => {
    try {
      db.prepare('UPDATE archivos SET descargas_count = COALESCE(descargas_count, 0) + 1 WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Endpoints de Anuncios y Noticias ---
  app.get('/api/anuncios', (req, res) => {
    try {
      const includeInactive = req.query.all === 'true';
      const query = includeInactive 
        ? 'SELECT * FROM anuncios ORDER BY prioridad ASC, created_at DESC' 
        : 'SELECT * FROM anuncios WHERE activo = 1 ORDER BY prioridad ASC, created_at DESC';
      const rows = db.prepare(query).all();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/anuncios', (req, res) => {
    try {
      const {
        id = `anu-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        titulo,
        contenido,
        tipo = 'info',
        prioridad = 1,
        mostrar_cuadro_dashboard = 1,
        mostrar_ticker_dashboard = 1,
        activo = 1,
        fecha_expiracion = null,
        enlace_url = null,
        enlace_texto = 'Más información',
        imagen_url = null,
        archivo_nombre = null,
        archivo_url = null,
        archivo_tamano = null,
        autor_id = null,
        autor_nombre = 'Administración'
      } = req.body;

      if (!titulo || !contenido) {
        return res.status(400).json({ error: 'Título y contenido son obligatorios' });
      }

      const stmt = db.prepare(`
        INSERT INTO anuncios (
          id, titulo, contenido, tipo, prioridad,
          mostrar_cuadro_dashboard, mostrar_ticker_dashboard, activo,
          fecha_expiracion, enlace_url, enlace_texto, imagen_url,
          archivo_nombre, archivo_url, archivo_tamano,
          autor_id, autor_nombre
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, titulo, contenido, tipo, prioridad,
        mostrar_cuadro_dashboard ? 1 : 0,
        mostrar_ticker_dashboard ? 1 : 0,
        activo ? 1 : 0,
        fecha_expiracion, enlace_url, enlace_texto, imagen_url,
        archivo_nombre, archivo_url, archivo_tamano,
        autor_id, autor_nombre
      );

      const created = db.prepare('SELECT * FROM anuncios WHERE id = ?').get(id);
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/anuncios/:id', (req, res) => {
    try {
      const {
        titulo,
        contenido,
        tipo,
        prioridad,
        mostrar_cuadro_dashboard,
        mostrar_ticker_dashboard,
        activo,
        fecha_expiracion,
        enlace_url,
        enlace_texto,
        imagen_url,
        archivo_nombre,
        archivo_url,
        archivo_tamano
      } = req.body;

      const current = db.prepare('SELECT * FROM anuncios WHERE id = ?').get(req.params.id);
      if (!current) {
        return res.status(404).json({ error: 'Anuncio no encontrado' });
      }

      const stmt = db.prepare(`
        UPDATE anuncios SET
          titulo = COALESCE(?, titulo),
          contenido = COALESCE(?, contenido),
          tipo = COALESCE(?, tipo),
          prioridad = COALESCE(?, prioridad),
          mostrar_cuadro_dashboard = COALESCE(?, mostrar_cuadro_dashboard),
          mostrar_ticker_dashboard = COALESCE(?, mostrar_ticker_dashboard),
          activo = COALESCE(?, activo),
          fecha_expiracion = ?,
          enlace_url = ?,
          enlace_texto = COALESCE(?, enlace_texto),
          imagen_url = ?,
          archivo_nombre = ?,
          archivo_url = ?,
          archivo_tamano = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        titulo !== undefined ? titulo : null,
        contenido !== undefined ? contenido : null,
        tipo !== undefined ? tipo : null,
        prioridad !== undefined ? prioridad : null,
        mostrar_cuadro_dashboard !== undefined ? (mostrar_cuadro_dashboard ? 1 : 0) : null,
        mostrar_ticker_dashboard !== undefined ? (mostrar_ticker_dashboard ? 1 : 0) : null,
        activo !== undefined ? (activo ? 1 : 0) : null,
        fecha_expiracion !== undefined ? fecha_expiracion : current.fecha_expiracion,
        enlace_url !== undefined ? enlace_url : current.enlace_url,
        enlace_texto !== undefined ? enlace_texto : null,
        imagen_url !== undefined ? imagen_url : current.imagen_url,
        archivo_nombre !== undefined ? archivo_nombre : current.archivo_nombre,
        archivo_url !== undefined ? archivo_url : current.archivo_url,
        archivo_tamano !== undefined ? archivo_tamano : current.archivo_tamano,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM anuncios WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/anuncios/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM anuncios WHERE id = ?').run(req.params.id);
      res.json({ success: true, message: 'Anuncio eliminado' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Dashboard Stats ---
  app.get('/api/stats', (req, res) => {
    try {
      const totalSocorristas = db.prepare('SELECT COUNT(*) as count FROM socorristas').get().count;
      const activos = db.prepare("SELECT COUNT(*) as count FROM socorristas WHERE estado = 'Activo'").get().count;
      const inactivos = db.prepare("SELECT COUNT(*) as count FROM socorristas WHERE estado = 'Inactivo'").get().count;
      const hombres = db.prepare("SELECT COUNT(*) as count FROM socorristas WHERE sexo = 'Masculino'").get().count;
      const mujeres = db.prepare("SELECT COUNT(*) as count FROM socorristas WHERE sexo = 'Femenino'").get().count;
      const seccionalesActivas = db.prepare("SELECT COUNT(*) as count FROM seccionales WHERE estado = 'Activa'").get().count;
      const cursosActivos = db.prepare('SELECT COUNT(*) as count FROM cursos').get().count;
      
      // Certifications near expiration (e.g., within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      
      const certsPorVencer = db.prepare("SELECT COUNT(*) as count FROM socorrista_cursos WHERE fecha_vencimiento BETWEEN ? AND ?").get(todayStr, thirtyDaysStr).count;

      // Chart Data: Elementos por seccional
      const elementosPorSeccional = db.prepare(`
        SELECT s.nombre, COUNT(so.id) as cantidad
        FROM seccionales s
        LEFT JOIN socorristas so ON s.id = so.seccional_id
        GROUP BY s.id
      `).all();

      // Chart Data: Cursos más comunes
      const cursosComunes = db.prepare(`
        SELECT c.nombre, COUNT(sc.id) as cantidad
        FROM cursos c
        LEFT JOIN socorrista_cursos sc ON c.id = sc.curso_id
        GROUP BY c.id
        ORDER BY cantidad DESC
        LIMIT 5
      `).all();

      // Chart Data: Certificaciones vencidas vs activas
      const certsActivas = db.prepare("SELECT COUNT(*) as count FROM socorrista_cursos WHERE fecha_vencimiento >= ?").get(todayStr).count;
      const certsVencidas = db.prepare("SELECT COUNT(*) as count FROM socorrista_cursos WHERE fecha_vencimiento < ?").get(todayStr).count;

      res.json({
        kpis: {
          totalSocorristas, activos, inactivos, hombres, mujeres, seccionalesActivas, cursosActivos, certsPorVencer
        },
        charts: {
          elementosPorSeccional,
          cursosComunes,
          certificaciones: { activas: certsActivas, vencidas: certsVencidas }
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Seccionales ---
  app.get('/api/seccionales', (req, res) => {
    const seccionales = db.prepare('SELECT * FROM seccionales').all();
    res.json(seccionales);
  });

  app.post('/api/seccionales', (req, res) => {
    const { nombre, direccion, telefono1, telefono2, director, subdirector, estado } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO seccionales (nombre, direccion, telefono1, telefono2, director, subdirector, estado) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const info = stmt.run(nombre, direccion, telefono1, telefono2, director, subdirector, estado || 'Activa');
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Cursos ---
  app.get('/api/cursos', (req, res) => {
    const cursos = db.prepare('SELECT * FROM cursos').all();
    res.json(cursos);
  });

  app.post('/api/cursos', (req, res) => {
    const { nombre, descripcion, duracion, vigencia_meses } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO cursos (nombre, descripcion, duracion, vigencia_meses) VALUES (?, ?, ?, ?)');
      const info = stmt.run(nombre, descripcion, duracion, vigencia_meses);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Socorristas ---
  app.get('/api/socorristas', (req, res) => {
    const socorristas = db.prepare(`
      SELECT so.*, s.nombre as seccional_nombre 
      FROM socorristas so
      LEFT JOIN seccionales s ON so.seccional_id = s.id
    `).all();
    res.json(socorristas);
  });

  app.get('/api/socorristas/:id', (req, res) => {
    const socorrista = db.prepare(`
      SELECT so.*, s.nombre as seccional_nombre 
      FROM socorristas so
      LEFT JOIN seccionales s ON so.seccional_id = s.id
      WHERE so.id = ?
    `).get(req.params.id);
    
    if (!socorrista) return res.status(404).json({ error: 'Not found' });

    const cursos = db.prepare(`
      SELECT sc.*, c.nombre as curso_nombre, c.vigencia_meses
      FROM socorrista_cursos sc
      JOIN cursos c ON sc.curso_id = c.id
      WHERE sc.socorrista_id = ?
    `).all(req.params.id);

    res.json({ ...socorrista, cursos });
  });

  app.post('/api/socorristas/:id/cursos', (req, res) => {
    const { curso_id, anio, fecha_certificacion, fecha_vencimiento } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO socorrista_cursos (socorrista_id, curso_id, anio, fecha_certificacion, fecha_vencimiento) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(req.params.id, curso_id, anio, fecha_certificacion, fecha_vencimiento);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto-generate carnet: CVS-0000-AA
  function generateCarnet(primer_nombre, primer_apellido) {
    const lastCarnetRow = db.prepare("SELECT carnet FROM socorristas ORDER BY id DESC LIMIT 1").get();
    let nextNum = 1;
    if (lastCarnetRow && lastCarnetRow.carnet) {
      const parts = lastCarnetRow.carnet.split('-');
      if (parts.length === 3) {
        nextNum = parseInt(parts[1], 10) + 1;
      }
    }
    const numStr = nextNum.toString().padStart(4, '0');
    const initials = ((primer_nombre || '').charAt(0) + (primer_apellido || '').charAt(0)).toUpperCase();
    return `CVS-${numStr}-${initials}`;
  }

  app.post('/api/socorristas', upload.single('foto'), (req, res) => {
    const {
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      fecha_nacimiento, telefono, direccion, seccional_id, sexo, fecha_ingreso, dui
    } = req.body;
    
    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
    const carnet = generateCarnet(primer_nombre, primer_apellido);

    try {
      const stmt = db.prepare(`
        INSERT INTO socorristas 
        (carnet, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, direccion, seccional_id, sexo, fecha_ingreso, foto_url, cargo_institucional, cargo_administrativo, segundo_cargo_administrativo, dui, tipo_sangre, email) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(carnet, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, direccion, seccional_id, sexo, fecha_ingreso, foto_url, req.body.cargo_institucional || null, req.body.cargo_administrativo || null, req.body.segundo_cargo_administrativo || null, dui || null, req.body.tipo_sangre || 'N/A', req.body.email || null);
      res.json({ id: info.lastInsertRowid, carnet });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/socorristas/:id/estado', (req, res) => {
    const { estado } = req.body;
    try {
      const stmt = db.prepare('UPDATE socorristas SET estado = ? WHERE id = ?');
      stmt.run(estado, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/socorristas/:id', upload.single('foto'), (req, res) => {
    const {
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      fecha_nacimiento, telefono, direccion, seccional_id, sexo, fecha_ingreso,
      cargo_institucional, cargo_administrativo, segundo_cargo_administrativo, dui, tipo_sangre, email
    } = req.body;
    
    try {
      let stmt;
      if (req.file) {
        const foto_url = `/uploads/${req.file.filename}`;
        stmt = db.prepare(`
          UPDATE socorristas SET 
          primer_nombre = ?, segundo_nombre = ?, primer_apellido = ?, segundo_apellido = ?, 
          fecha_nacimiento = ?, telefono = ?, direccion = ?, seccional_id = ?, sexo = ?, fecha_ingreso = ?, foto_url = ?,
          cargo_institucional = ?, cargo_administrativo = ?, segundo_cargo_administrativo = ?, dui = ?, tipo_sangre = ?, email = ?
          WHERE id = ?
        `);
        stmt.run(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, direccion, seccional_id, sexo, fecha_ingreso, foto_url, cargo_institucional || null, cargo_administrativo || null, segundo_cargo_administrativo || null, dui || null, tipo_sangre || 'N/A', email || null, req.params.id);
      } else {
        stmt = db.prepare(`
          UPDATE socorristas SET 
          primer_nombre = ?, segundo_nombre = ?, primer_apellido = ?, segundo_apellido = ?, 
          fecha_nacimiento = ?, telefono = ?, direccion = ?, seccional_id = ?, sexo = ?, fecha_ingreso = ?,
          cargo_institucional = ?, cargo_administrativo = ?, segundo_cargo_administrativo = ?, dui = ?, tipo_sangre = ?, email = ?
          WHERE id = ?
        `);
        stmt.run(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, direccion, seccional_id, sexo, fecha_ingreso, cargo_institucional || null, cargo_administrativo || null, segundo_cargo_administrativo || null, dui || null, tipo_sangre || 'N/A', email || null, req.params.id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/socorristas/:id/carnet', upload.single('carnet'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }
      const carnet_generado_url = `/uploads/${req.file.filename}`;
      const stmt = db.prepare('UPDATE socorristas SET carnet_generado_url = ? WHERE id = ?');
      stmt.run(carnet_generado_url, req.params.id);
      res.json({ success: true, carnet_generado_url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/configuracion', (req, res) => {
    try {
      const stmt = db.prepare('SELECT clave, valor FROM configuracion');
      const rows = stmt.all();
      const config = rows.reduce((acc: any, row: any) => {
        acc[row.clave] = row.valor;
        return acc;
      }, {});
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/configuracion', (req, res) => {
    try {
      const config = req.body;
      const stmt = db.prepare('INSERT OR REPLACE INTO configuracion (id, clave, valor) VALUES ((SELECT id FROM configuracion WHERE clave = ?), ?, ?)');
      
      const transaction = db.transaction((conf) => {
        for (const [clave, valor] of Object.entries(conf)) {
          stmt.run(clave, clave, String(valor));
        }
      });
      
      transaction(config);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/verificacion/:carnet', (req, res) => {
    try {
      const stmt = db.prepare(`
        SELECT s.*, sec.nombre as seccional_nombre 
        FROM socorristas s 
        LEFT JOIN seccionales sec ON s.seccional_id = sec.id 
        WHERE s.carnet = ?
      `);
      const socorrista = stmt.get(req.params.carnet);
      if (socorrista) {
        res.json(socorrista);
      } else {
        res.status(404).json({ error: 'Carnet no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- FORMULARIOS API ---
  app.get('/api/formularios', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT f.*, COUNT(r.id) as respuestas_count 
        FROM formularios f 
        LEFT JOIN formulario_respuestas r ON f.id = r.formulario_id 
        GROUP BY f.id 
        ORDER BY f.created_at DESC
      `).all();
      res.json(rows.map((r: any) => ({
        ...r,
        requiere_autenticacion: Boolean(r.requiere_autenticacion),
        activo: Boolean(r.activo),
        campos: JSON.parse(r.campos || '[]')
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/formularios/:idOrSlug', (req, res) => {
    try {
      const { idOrSlug } = req.params;
      const isNum = !isNaN(Number(idOrSlug));
      const row: any = isNum
        ? db.prepare('SELECT * FROM formularios WHERE id = ?').get(idOrSlug)
        : db.prepare('SELECT * FROM formularios WHERE slug = ?').get(idOrSlug);
      
      if (!row) return res.status(404).json({ error: 'Formulario no encontrado' });
      
      const count = db.prepare('SELECT COUNT(*) as c FROM formulario_respuestas WHERE formulario_id = ?').get(row.id) as any;

      res.json({
        ...row,
        respuestas_count: count?.c || 0,
        requiere_autenticacion: Boolean(row.requiere_autenticacion),
        activo: Boolean(row.activo),
        campos: JSON.parse(row.campos || '[]')
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/formularios', (req, res) => {
    try {
      const { titulo, descripcion, categoria, requiere_autenticacion, activo, campos, creado_por, creado_por_nombre, mensaje_exito } = req.body;
      const baseSlug = (req.body.slug || titulo || 'formulario')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const slug = baseSlug + '-' + Math.random().toString(36).substring(2, 6);
      
      const stmt = db.prepare(`
        INSERT INTO formularios (slug, titulo, descripcion, categoria, requiere_autenticacion, activo, campos, creado_por, creado_por_nombre, mensaje_exito)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        slug,
        titulo,
        descripcion || null,
        categoria || 'General',
        requiere_autenticacion ? 1 : 0,
        activo !== false ? 1 : 0,
        JSON.stringify(campos || []),
        creado_por || null,
        creado_por_nombre || 'Cruz Verde Salvadoreña',
        mensaje_exito || '¡Muchas gracias! Tu respuesta ha sido registrada exitosamente en el sistema.'
      );
      res.json({ success: true, id: info.lastInsertRowid, slug });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/formularios/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { titulo, descripcion, categoria, requiere_autenticacion, activo, campos, mensaje_exito } = req.body;
      const stmt = db.prepare(`
        UPDATE formularios 
        SET titulo = ?, descripcion = ?, categoria = ?, requiere_autenticacion = ?, activo = ?, campos = ?, mensaje_exito = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(
        titulo,
        descripcion || null,
        categoria || 'General',
        requiere_autenticacion ? 1 : 0,
        activo !== false ? 1 : 0,
        JSON.stringify(campos || []),
        mensaje_exito || null,
        id
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/formularios/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM formulario_respuestas WHERE formulario_id = ?').run(id);
      db.prepare('DELETE FROM formularios WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/formularios/:id/respuestas', (req, res) => {
    try {
      const { id } = req.params;
      const rows = db.prepare('SELECT * FROM formulario_respuestas WHERE formulario_id = ? ORDER BY created_at DESC').all(id);
      res.json(rows.map((r: any) => ({
        ...r,
        respuestas: JSON.parse(r.respuestas || '{}')
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/formularios/:id/respuestas', (req, res) => {
    try {
      const { id } = req.params;
      const { usuario_id, usuario_nombre, usuario_email, respuestas } = req.body;
      const stmt = db.prepare(`
        INSERT INTO formulario_respuestas (formulario_id, usuario_id, usuario_nombre, usuario_email, respuestas, ip_origen)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const info = stmt.run(
        id,
        usuario_id || null,
        usuario_nombre || null,
        usuario_email || null,
        JSON.stringify(respuestas || {}),
        String(ip)
      );
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/formulario_respuestas/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM formulario_respuestas WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
