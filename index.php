<?php
/**
 * Cruz Verde Salvadoreña - Enrutador PHP para Hostinger
 * 
 * Permite servir la aplicación compilada (dist/) de forma nativa
 * en Hostinger cuando se utiliza la integración automática con GitHub.
 */

$distDir = __DIR__ . '/dist';
$distIndex = $distDir . '/index.html';

// 1. Obtener la ruta limpia de la petición
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$requestUri = urldecode($requestUri);

// Evitar Directory Traversal
$cleanUri = ltrim($requestUri, '/');
if (strpos($cleanUri, '..') !== false) {
    http_response_code(400);
    exit('Petición no válida');
}

// 2. Si se solicita un archivo estático compilado en assets/ o dist/assets/
$possiblePaths = [
    $distDir . '/' . $cleanUri,
    __DIR__ . '/' . $cleanUri,
];

// Si la URL empieza con dist/, también buscar directo
if (strpos($cleanUri, 'dist/') === 0) {
    $possiblePaths[] = __DIR__ . '/' . substr($cleanUri, 5);
}

foreach ($possiblePaths as $file) {
    if (!empty($cleanUri) && file_exists($file) && !is_dir($file)) {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mimes = [
            'js'    => 'application/javascript; charset=UTF-8',
            'mjs'   => 'application/javascript; charset=UTF-8',
            'css'   => 'text/css; charset=UTF-8',
            'svg'   => 'image/svg+xml',
            'png'   => 'image/png',
            'jpg'   => 'image/jpeg',
            'jpeg'  => 'image/jpeg',
            'gif'   => 'image/gif',
            'webp'  => 'image/webp',
            'ico'   => 'image/x-icon',
            'json'  => 'application/json; charset=UTF-8',
            'woff'  => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf'   => 'font/ttf',
            'txt'   => 'text/plain; charset=UTF-8',
        ];

        if (isset($mimes[$ext])) {
            header('Content-Type: ' . $mimes[$ext]);
        }
        
        // Cache agresivo para assets compilados por Vite con hash en el nombre
        if (strpos($file, '/assets/') !== false) {
            header('Cache-Control: public, max-age=31536000, immutable');
        } else {
            header('Cache-Control: no-cache, must-revalidate');
        }
        
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
}

// 3. Servir la aplicación React compilada (dist/index.html)
if (file_exists($distIndex)) {
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('X-CruzVerde-Host: Hostinger-Production');
    readfile($distIndex);
    exit;
}

// 4. Si la carpeta dist/ aún no existe, mostrar pantalla instructiva
http_response_code(503);
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cruz Verde Salvadoreña - Configuración Pendiente</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: white;
      max-width: 520px;
      padding: 32px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: #dcfce7;
      color: #15803d;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    h1 { font-size: 20px; margin: 0 0 12px 0; color: #111827; }
    p { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0; }
    .box {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 14px;
      font-family: monospace;
      font-size: 13px;
      text-align: left;
      color: #334155;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      background: #008f39;
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Cruz Verde Salvadoreña</span>
    <h1>Preparando Sistema en Hostinger</h1>
    <p>El código fuente se ha descargado correctamente desde GitHub, pero falta subir o compilar la carpeta <strong>dist/</strong> que contiene la aplicación para producción.</p>
    <div class="box">
      <strong>Opción rápida:</strong><br>
      Asegúrate de que la carpeta <code>dist/</code> esté commiteada en tu repositorio de GitHub para que Hostinger la descargue automáticamente.
    </div>
    <a href="javascript:location.reload()" class="btn">Recargar página</a>
  </div>
</body>
</html>
