<?php
/**
 * Cruz Verde Salvadoreña - Endpoint de Envío de Correos SMTP para Hostinger
 * Compatible con PHP 7.4 y 8.x en hosting compartido (Apache / LiteSpeed)
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

// Configuración SMTP predeterminada (Hostinger)
$defaultConfig = [
    'host' => 'smtp.hostinger.com',
    'port' => 465,
    'secure' => true,
    'user' => 'notificaciones@cruzverdesv.org',
    'pass' => 'Cvnoti17$',
    'from' => 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>',
    'replyTo' => 'noreply@cruzverdesv.org'
];

// Si existe la base de datos SQLite cruzverde.db, leer valores configurados
$dbPath = __DIR__ . '/../cruzverde.db';
if (!file_exists($dbPath)) {
    $dbPath = __DIR__ . '/cruzverde.db';
}

if (file_exists($dbPath) && class_exists('PDO')) {
    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $stmt = $pdo->query("SELECT clave, valor FROM configuracion WHERE clave LIKE 'smtp_%'");
        if ($stmt) {
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                if ($r['clave'] === 'smtp_host' && !empty($r['valor'])) $defaultConfig['host'] = $r['valor'];
                if ($r['clave'] === 'smtp_port' && !empty($r['valor'])) $defaultConfig['port'] = intval($r['valor']);
                if ($r['clave'] === 'smtp_secure') $defaultConfig['secure'] = ($r['valor'] === 'true');
                if ($r['clave'] === 'smtp_user' && !empty($r['valor'])) $defaultConfig['user'] = $r['valor'];
                if ($r['clave'] === 'smtp_pass' && !empty($r['valor'])) $defaultConfig['pass'] = $r['valor'];
                if ($r['clave'] === 'smtp_from' && !empty($r['valor'])) $defaultConfig['from'] = $r['valor'];
                if ($r['clave'] === 'smtp_reply_to' && !empty($r['valor'])) $defaultConfig['replyTo'] = $r['valor'];
            }
        }
    } catch (Exception $e) {
        // Usar fallback predeterminado
    }
}

// Obtener cuerpo de la petición POST
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

if (!$body || empty($body['destinatario']) || empty($body['asunto'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Datos incompletos. Se requiere al menos destinatario y asunto.'
    ]);
    exit;
}

$destinatario = trim($body['destinatario']);
$asunto = trim($body['asunto']);
$cuerpoHtml = $body['cuerpoHtml'] ?? '<p>Notificación institucional de Cruz Verde Salvadoreña</p>';
$remitente = !empty($body['remitente']) ? trim($body['remitente']) : $defaultConfig['from'];
$replyTo = !empty($body['replyTo']) ? trim($body['replyTo']) : $defaultConfig['replyTo'];
$cc = !empty($body['cc']) ? trim($body['cc']) : '';
$tipo = $body['tipo'] ?? 'general';
$adjuntos = $body['adjuntos'] ?? [];

// Extraer dirección limpia de correo
function extractEmail($str) {
    if (preg_match('/<([^>]+)>/', $str, $matches)) {
        return trim($matches[1]);
    }
    return trim($str);
}

$cleanFromEmail = extractEmail($remitente);
$cleanReplyToEmail = extractEmail($replyTo);

// Función de envío SMTP nativo mediante sockets
function sendSmtpSocket($config, $cleanFromEmail, $fromName, $toEmails, $ccEmails, $replyTo, $subject, $htmlContent, $attachments = []) {
    $host = $config['host'];
    $port = intval($config['port']);
    $user = $config['user'];
    $pass = $config['pass'];
    $secure = $config['secure'];

    $protocol = $secure ? 'ssl://' : 'tcp://';
    $timeout = 15;

    $socket = @fsockopen($protocol . $host, $port, $errno, $errstr, $timeout);
    if (!$socket) {
        throw new Exception("No se pudo conectar al servidor SMTP {$host}:{$port} ($errno - $errstr)");
    }

    stream_set_timeout($socket, $timeout);

    function readResponse($socket) {
        $data = '';
        while (!feof($socket)) {
            $line = fgets($socket, 512);
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    }

    function sendCmd($socket, $cmd, $expectedCode) {
        fputs($socket, $cmd . "\r\n");
        $res = readResponse($socket);
        $code = substr($res, 0, 3);
        if ($code !== (string)$expectedCode) {
            throw new Exception("Error SMTP al enviar '{$cmd}': respuesta {$res}");
        }
        return $res;
    }

    // 1. Saludo inicial
    readResponse($socket);

    // 2. EHLO
    sendCmd($socket, "EHLO cruzverdesv.org", 250);

    // 3. STARTTLS si no es SSL directo
    if (!$secure && $port === 587) {
        sendCmd($socket, "STARTTLS", 220);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new Exception("Fallo al establecer cifrado TLS");
        }
        sendCmd($socket, "EHLO cruzverdesv.org", 250);
    }

    // 4. Autenticación
    sendCmd($socket, "AUTH LOGIN", 334);
    sendCmd($socket, base64_encode($user), 334);
    sendCmd($socket, base64_encode($pass), 235);

    // 5. Remitente
    sendCmd($socket, "MAIL FROM:<{$cleanFromEmail}>", 250);

    // 6. Destinatarios
    $allRecipients = array_merge($toEmails, $ccEmails);
    foreach ($allRecipients as $rcpt) {
        $rcptClean = extractEmail($rcpt);
        if (!empty($rcptClean) && filter_var($rcptClean, FILTER_VALIDATE_EMAIL)) {
            sendCmd($socket, "RCPT TO:<{$rcptClean}>", 250);
        }
    }

    // 7. DATA
    sendCmd($socket, "DATA", 354);

    // 8. Construir mensaje MIME
    $boundary = "----=_Part_" . md5(uniqid(time()));
    $boundaryAlt = "----=_Alt_" . md5(uniqid(time()));

    $headers = [];
    $headers[] = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <{$cleanFromEmail}>";
    $headers[] = "To: " . implode(', ', $toEmails);
    if (!empty($ccEmails)) {
        $headers[] = "Cc: " . implode(', ', $ccEmails);
    }
    if (!empty($replyTo)) {
        $headers[] = "Reply-To: {$replyTo}";
    }
    $headers[] = "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=";
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Date: " . date('r');
    $headers[] = "Message-ID: <" . md5(uniqid(time())) . "@cruzverdesv.org>";
    $headers[] = "X-Mailer: CruzVerde-HostingerMailer/1.0";

    $hasAttachments = is_array($attachments) && count($attachments) > 0;

    if ($hasAttachments) {
        $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";
        
        $messageBody = "--{$boundary}\r\n";
        $messageBody .= "Content-Type: text/html; charset=UTF-8\r\n";
        $messageBody .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $messageBody .= chunk_split(base64_encode($htmlContent)) . "\r\n";

        foreach ($attachments as $att) {
            $filename = !empty($att['nombre']) ? $att['nombre'] : (!empty($att['filename']) ? $att['filename'] : 'documento.pdf');
            $attType = !empty($att['tipo']) ? $att['tipo'] : 'application/pdf';
            
            $fileData = '';
            if (!empty($att['contenido'])) {
                // Si viene como Data URL o base64
                $content = $att['contenido'];
                if (strpos($content, 'base64,') !== false) {
                    $parts = explode('base64,', $content);
                    $fileData = base64_decode($parts[1]);
                } else {
                    $fileData = $content;
                }
            } elseif (!empty($att['content'])) {
                $fileData = $att['content'];
            }

            if (!empty($fileData)) {
                $messageBody .= "--{$boundary}\r\n";
                $messageBody .= "Content-Type: {$attType}; name=\"=?UTF-8?B?" . base64_encode($filename) . "?=\"\r\n";
                $messageBody .= "Content-Disposition: attachment; filename=\"=?UTF-8?B?" . base64_encode($filename) . "?=\"\r\n";
                $messageBody .= "Content-Transfer-Encoding: base64\r\n\r\n";
                $messageBody .= chunk_split(base64_encode($fileData)) . "\r\n";
            }
        }
        $messageBody .= "--{$boundary}--\r\n";
    } else {
        $headers[] = "Content-Type: text/html; charset=UTF-8";
        $headers[] = "Content-Transfer-Encoding: base64";
        $messageBody = chunk_split(base64_encode($htmlContent));
    }

    $rawEmail = implode("\r\n", $headers) . "\r\n\r\n" . $messageBody . "\r\n.\r\n";
    fputs($socket, $rawEmail);
    $finalRes = readResponse($socket);
    
    if (substr($finalRes, 0, 3) !== '250') {
        throw new Exception("Error al finalizar entrega de correo: {$finalRes}");
    }

    sendCmd($socket, "QUIT", 221);
    fclose($socket);

    return true;
}

// Procesar lista de destinatarios (pueden ser separados por coma)
$toList = array_filter(array_map('trim', explode(',', $destinatario)));
$ccList = !empty($cc) ? array_filter(array_map('trim', explode(',', $cc))) : [];

$fromName = 'Cruz Verde Salvadoreña';
if (preg_match('/^(.*?)\s*<.*?>$/', $remitente, $matches)) {
    $fromName = trim($matches[1], '"\' ');
}

try {
    sendSmtpSocket(
        $defaultConfig,
        $cleanFromEmail,
        $fromName,
        $toList,
        $ccList,
        $cleanReplyToEmail,
        $asunto,
        $cuerpoHtml,
        $adjuntos
    );

    echo json_encode([
        'success' => true,
        'message' => 'Correo enviado exitosamente a través de Hostinger SMTP',
        'isRealSent' => true,
        'provider' => 'Hostinger Webmail (smtp.hostinger.com)',
        'destinatario' => $destinatario,
        'asunto' => $asunto
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'isRealSent' => false,
        'error' => 'Error al enviar correo por Hostinger: ' . $e->getMessage(),
        'sugerencia' => 'Verifique que la cuenta notificaciones@cruzverdesv.org esté activa en hPanel de Hostinger.'
    ]);
}
