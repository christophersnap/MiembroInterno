<?php
/**
 * Cruz Verde Salvadoreña - Enrutador PHP para Hostinger
 * 
 * Este archivo permite servir la versión compilada (dist/index.html)
 * de forma nativa e inmediata cuando se utiliza la integración automática
 * de GitHub en Hostinger.
 */

$distIndexPath = __DIR__ . '/dist/index.html';

// 1. Si existe la compilación en dist/index.html, servirla directamente
if (file_exists($distIndexPath)) {
    header('Content-Type: text/html; charset=UTF-8');
    header('X-App-Engine: CruzVerde-Hostinger-Production');
    readfile($distIndexPath);
    exit;
}

// 2. Si no existe dist/ aún, mostrar guía paso a paso
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cruz Verde Salvadoreña - Despliegue en Proceso</title>
  <style>
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #0f172a;
    }
    .card {
      background: white;
      max-width: 540px;
      width: 100%;
      padding: 36px 32px;
      border-radius: 20px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #001A70;
      margin: 0 0 12px 0;
    }
    p {
      color: #475569;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .step-box {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      text-align: left;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .step-box ol {
      margin: 0;
      padding-left: 20px;
      color: #334155;
    }
    .step-box li {
      margin-bottom: 8px;
    }
    .step-box code {
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: 600;
      color: #001A70;
    }
    .btn {
      display: inline-block;
      background: #001A70;
      color: white;
      padding: 12px 24px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #001250;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span>⚙️</span> Configuración de GitHub en Hostinger
    </div>
    <h1>Despliegue recibido en Hostinger</h1>
    <p>
      Hostinger ha sincronizado tu repositorio de GitHub exitosamente. Sin embargo, para que el sistema funcione en línea, necesita incluir la carpeta compilada <strong>dist/</strong>.
    </p>

    <div class="step-box">
      <strong>Pasos sencillos para activar el sistema:</strong>
      <ol style="margin-top: 10px;">
        <li>En tu computadora o terminal ejecuta: <code>npm run build</code></li>
        <li>Haz commit y push a GitHub:
          <br><code>git add . && git commit -m "Compilación para Hostinger" && git push</code>
        </li>
        <li>Hostinger sincronizará automáticamente la carpeta <strong>dist/</strong> y el sistema cargará al instante.</li>
      </ol>
    </div>

    <a href="javascript:location.reload()" class="btn">Recargar y Verificar</a>
  </div>
</body>
</html>
