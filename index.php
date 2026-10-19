<?php
/**
 * Cruz Verde Salvadoreña - Enrutador PHP para Hostinger
 * 
 * Permite servir la aplicación compilada (dist/) de forma nativa
 * en Hostinger cuando se utiliza la integración automática con GitHub.
 */

// Posibles ubicaciones de la compilación dist
$candidates = [
    __DIR__ . '/dist',
    __DIR__ . '/public_html/dist',
    dirname(__DIR__) . '/dist',
];

$distDir = null;
$distIndex = null;

foreach ($candidates as $cand) {
    if (file_exists($cand . '/index.html')) {
        $distDir = $cand;
        $distIndex = $cand . '/index.html';
        break;
    }
}

// 1. Obtener la ruta limpia de la petición
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$requestUri = urldecode($requestUri);

// Evitar Directory Traversal
$cleanUri = ltrim($requestUri, '/');
if (strpos($cleanUri, '..') !== false) {
    http_response_code(400);
    exit('Petición no válida');
}

// Soporte para subcarpetas (ej: /miembros/)
$scriptDir = trim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if (!empty($scriptDir) && strpos($cleanUri, $scriptDir . '/') === 0) {
    $cleanUri = substr($cleanUri, strlen($scriptDir) + 1);
} elseif (strpos($cleanUri, 'miembros/') === 0) {
    $cleanUri = substr($cleanUri, 9);
} elseif ($cleanUri === 'miembros') {
    // Redirección canónica con trailing slash si se accede sin la barra final
    if (substr($requestUri, -1) !== '/' && strpos($requestUri, '?') === false) {
        header('Location: /miembros/', true, 301);
        exit;
    }
    $cleanUri = '';
}

// 1.5. Soporte nativo para Endpoints de API en Hostinger (Envío de correos SMTP, verificación)
if (strpos($cleanUri, 'api/') === 0) {
    $apiPath = substr($cleanUri, 4);
    $apiPathClean = preg_replace('/[^a-zA-Z0-9_-]/', '', $apiPath);
    $apiScript = __DIR__ . '/api/' . $apiPathClean . '.php';
    if (file_exists($apiScript)) {
        require $apiScript;
        exit;
    }
}

// 2. Si se localizó dist/ y se solicita un archivo estático
if ($distDir && !empty($cleanUri)) {
    $possiblePaths = [
        $distDir . '/' . $cleanUri,
        __DIR__ . '/' . $cleanUri,
    ];

    if (strpos($cleanUri, 'assets/') !== false) {
        $assetSub = substr($cleanUri, strpos($cleanUri, 'assets/'));
        $possiblePaths[] = $distDir . '/' . $assetSub;
        $possiblePaths[] = __DIR__ . '/' . $assetSub;
    }

    if (strpos($cleanUri, 'dist/') === 0) {
        $possiblePaths[] = $distDir . '/' . substr($cleanUri, 5);
        $possiblePaths[] = __DIR__ . '/' . substr($cleanUri, 5);
    }

    // Respaldo Inteligente: Si el navegador solicita un bundle principal (ej: index-*.js o index-*.css)
    // que fue reemplazado por un nuevo hash o proviene de una caché anterior, localizar el bundle actual disponible
    if (preg_match('/assets\/index-[a-zA-Z0-9_-]+\.js$/', $cleanUri)) {
        $jsFiles = array_merge(
            glob($distDir . '/assets/index-*.js') ?: [],
            glob(__DIR__ . '/assets/index-*.js') ?: []
        );
        if (!empty($jsFiles)) {
            $possiblePaths[] = end($jsFiles);
        }
    }
    if (preg_match('/assets\/index-[a-zA-Z0-9_-]+\.css$/', $cleanUri)) {
        $cssFiles = array_merge(
            glob($distDir . '/assets/index-*.css') ?: [],
            glob(__DIR__ . '/assets/index-*.css') ?: []
        );
        if (!empty($cssFiles)) {
            $possiblePaths[] = end($cssFiles);
        }
    }

    foreach ($possiblePaths as $file) {
        if (file_exists($file) && !is_dir($file)) {
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
            
            header('Access-Control-Allow-Origin: *');

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

    // 2.5. Si se solicitó un archivo estático específico (.js, .css, etc.) y NO se encontró
    // devolver 404 en texto plano para que el navegador sepa el estado y no intente parsear HTML
    $ext = strtolower(pathinfo($cleanUri, PATHINFO_EXTENSION));
    $staticExts = ['js', 'mjs', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'json', 'map'];
    if (in_array($ext, $staticExts)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        header('Access-Control-Allow-Origin: *');
        exit("Archivo estático no encontrado en el servidor: {$cleanUri}");
    }
}

// 3. Servir la aplicación React compilada (dist/index.html) para rutas SPA
if ($distIndex && file_exists($distIndex)) {
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('X-CruzVerde-Host: Hostinger-Production');
    
    $html = file_get_contents($distIndex);
    // Asegurar que la etiqueta <base href="/miembros/"> esté presente para la correcta resolución de rutas relativas
    if (strpos($html, '<base ') === false) {
        $html = str_replace('<head>', "<head>\n    <base href=\"/miembros/\">", $html);
    }
    echo $html;
    exit;
}

// 4. Si la carpeta dist/ aún no existe en el servidor, mostrar pantalla instructiva clara
http_response_code(503);
header('Content-Type: text/html; charset=UTF-8');

$dirContents = @scandir(__DIR__) ?: [];
$foldersOnly = array_filter($dirContents, function($item) {
    return $item !== '.' && $item !== '..' && is_dir(__DIR__ . '/' . $item);
});
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cruz Verde Salvadoreña - Despliegue en Hostinger</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      max-width: 600px;
      width: 100%;
      padding: 36px 32px;
      border-radius: 20px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    h1 {
      font-size: 22px;
      margin: 16px 0 8px 0;
      color: #111827;
      font-weight: 800;
    }
    p.subtitle {
      font-size: 14px;
      color: #475569;
      line-height: 1.5;
      margin: 0;
    }
    .solution-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 20px;
      text-align: left;
    }
    .solution-title {
      font-size: 14px;
      font-weight: 700;
      color: #008f39;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .steps {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      color: #334155;
      line-height: 1.7;
    }
    .steps code {
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #0f172a;
    }
    .diagnostics {
      background: #0f172a;
      color: #94a3b8;
      border-radius: 10px;
      padding: 14px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      margin-bottom: 24px;
      text-align: left;
      overflow-x: auto;
    }
    .diagnostics strong {
      color: #f8fafc;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #008f39;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(0, 143, 57, 0.2);
    }
    .btn:hover {
      background: #007a31;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">
        <span>🚑</span> Cruz Verde Salvadoreña
      </div>
      <h1>Despliegue en Hostinger</h1>
      <p class="subtitle">
        El repositorio se ha sincronizado correctamente en Hostinger, pero la carpeta compilada <strong>dist/</strong> aún no ha sido descargada.
      </p>
    </div>

    <div class="solution-box">
      <div class="solution-title">
        <span>🔑</span> Paso necesario en GitHub (Permiso de Escritura para GitHub Actions):
      </div>
      <ol class="steps">
        <li>Abre tu repositorio en <strong>GitHub</strong>.</li>
        <li>Entra a <strong>Settings</strong> (pestaña superior derecha de la rueda dentada).</li>
        <li>En la barra lateral izquierda, haz clic en <strong>Actions</strong> &gt; <strong>General</strong>.</li>
        <li>Baja hasta la sección <strong>Workflow permissions</strong>.</li>
        <li>Marca la opción: <strong>"Read and write permissions"</strong>.</li>
        <li>Haz clic en el botón verde <strong>Save</strong>.</li>
        <li>Vuelve a la pestaña <strong>Actions</strong> de tu repositorio, entra al último workflow y haz clic en <strong>Re-run all jobs</strong>.</li>
      </ol>
    </div>

    <div class="diagnostics">
      <div><strong>Ubicación actual:</strong> <?php echo htmlspecialchars(__DIR__); ?></div>
      <div><strong>Carpetas encontradas:</strong> <?php echo htmlspecialchars(implode(', ', $foldersOnly) ?: 'Ninguna'); ?></div>
      <div><strong>Buscando:</strong> <?php echo htmlspecialchars(__DIR__ . '/dist/index.html'); ?> (No encontrado aún)</div>
    </div>

    <div class="actions">
      <button onclick="location.reload()" class="btn">🔄 Recargar Página</button>
    </div>
  </div>
</body>
</html>
