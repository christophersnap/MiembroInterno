<?php
/**
 * Cruz Verde Salvadoreña - Enrutador PHP de Producción
 *
 * Sirve la aplicación compilada (dist/) y mantiene únicamente la pantalla
 * institucional de carga mientras el repositorio sincroniza una actualización.
 */

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

// Verificar que tanto dist/index.html como su bundle principal de JS estén completos en disco
$isBuildComplete = false;
if ($distIndex && file_exists($distIndex)) {
    $htmlCheck = @file_get_contents($distIndex);
    if ($htmlCheck !== false && strlen(trim($htmlCheck)) > 0) {
        if (preg_match('/assets\/(index-[a-zA-Z0-9_-]+\.js)/', $htmlCheck, $matches)) {
            $mainJsFile = $matches[1];
            if (
                ($distDir && file_exists($distDir . '/assets/' . $mainJsFile)) ||
                file_exists(__DIR__ . '/assets/' . $mainJsFile)
            ) {
                $isBuildComplete = true;
            }
        } else {
            $isBuildComplete = true;
        }
    }
}

// Endpoint ligero para consultar si la actualización terminó sin recargar en falso
if (isset($_GET['__cv_ready']) || isset($_SERVER['HTTP_X_CV_READY_CHECK'])) {
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode(['ready' => $isBuildComplete]);
    exit;
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
    if (substr($requestUri, -1) !== '/' && strpos($requestUri, '?') === false) {
        header('Location: /miembros/', true, 301);
        exit;
    }
    $cleanUri = '';
}

// 1.5. Soporte nativo para Endpoints de API en PHP (Envío de correos SMTP, verificación)
if (strpos($cleanUri, 'api/') === 0) {
    $apiPath = substr($cleanUri, 4);
    $apiPathClean = preg_replace('/[^a-zA-Z0-9_-]/', '', $apiPath);
    $apiScript = __DIR__ . '/api/' . $apiPathClean . '.php';
    if (file_exists($apiScript)) {
        require $apiScript;
        exit;
    }
}

// 2. Servir archivos estáticos si existen en dist/ o en la carpeta raíz
if (!empty($cleanUri)) {
    $possiblePaths = [];
    if ($distDir) {
        $possiblePaths[] = $distDir . '/' . $cleanUri;
    }
    $possiblePaths[] = __DIR__ . '/' . $cleanUri;

    if (strpos($cleanUri, 'assets/') !== false) {
        $assetSub = substr($cleanUri, strpos($cleanUri, 'assets/'));
        if ($distDir) {
            $possiblePaths[] = $distDir . '/' . $assetSub;
        }
        $possiblePaths[] = __DIR__ . '/' . $assetSub;
    }

    if (strpos($cleanUri, 'dist/') === 0) {
        if ($distDir) {
            $possiblePaths[] = $distDir . '/' . substr($cleanUri, 5);
        }
        $possiblePaths[] = __DIR__ . '/' . substr($cleanUri, 5);
    }

    // Respaldo inteligente si cambió el hash del bundle durante una actualización
    if (preg_match('/assets\/index-[a-zA-Z0-9_-]+\.js$/', $cleanUri)) {
        $jsFiles = array_merge(
            $distDir ? (glob($distDir . '/assets/index-*.js') ?: []) : [],
            glob(__DIR__ . '/assets/index-*.js') ?: []
        );
        if (!empty($jsFiles)) {
            $possiblePaths[] = end($jsFiles);
        }
    }
    if (preg_match('/assets\/index-[a-zA-Z0-9_-]+\.css$/', $cleanUri)) {
        $cssFiles = array_merge(
            $distDir ? (glob($distDir . '/assets/index-*.css') ?: []) : [],
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

    $ext = strtolower(pathinfo($cleanUri, PATHINFO_EXTENSION));
    $staticExts = ['js', 'mjs', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'json', 'map'];
    if (in_array($ext, $staticExts)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        header('Access-Control-Allow-Origin: *');
        exit('');
    }
}

// 3. Servir la aplicación React compilada (dist/index.html) cuando está lista
if ($isBuildComplete && $distIndex && file_exists($distIndex)) {
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');

    $html = file_get_contents($distIndex);
    if (strpos($html, '<base ') === false) {
        $html = str_replace('<head>', "<head>\n    <base href=\"/miembros/\">", $html);
    }
    echo $html;
    exit;
}

// 4. Mientras el repositorio se actualiza / sincroniza, mantener únicamente el círculo de carga institucional
// (Usamos 200 + no-store para evitar que el servidor de hosting sustituya la respuesta por su propia página 503)
http_response_code(200);
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
?>
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cruz Verde Salvadoreña - Admin</title>
    <noscript>
      <meta http-equiv="refresh" content="4" />
    </noscript>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f9fafb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .app-loader {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: #f9fafb;
        position: fixed;
        inset: 0;
        z-index: 9999;
      }
      .app-spinner {
        width: 44px;
        height: 44px;
        border: 4px solid #e5e7eb;
        border-top-color: #008f39;
        border-radius: 50%;
        animation: cv-spin 0.8s linear infinite;
        margin-bottom: 16px;
      }
      @keyframes cv-spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="app-loader" role="status" aria-live="polite">
      <div class="app-spinner"></div>
      <div style="color: #374151; font-size: 14px; font-weight: 600; letter-spacing: 0.01em;">Cargando Cruz Verde Salvadoreña...</div>
    </div>
    <script>
      (function () {
        var checking = false;
        function checkReady() {
          if (checking) return;
          checking = true;
          var sep = window.location.search ? '&' : '?';
          var checkUrl = window.location.pathname + window.location.search + sep + '__cv_ready=1&_t=' + Date.now();
          fetch(checkUrl, {
            method: 'GET',
            cache: 'no-store',
            headers: { 'X-CV-Ready-Check': '1' }
          })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
              if (data && data.ready === true) {
                window.location.replace(window.location.href);
                return;
              }
              checking = false;
            })
            .catch(function () {
              checking = false;
            });
        }
        setInterval(checkReady, 2000);
        setTimeout(checkReady, 1200);
      })();
    </script>
  </body>
</html>
