<?php
/**
 * Cruz Verde Salvadoreña - Prueba de Conexión SMTP en Hostinger
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

$host = !empty($body['host']) ? $body['host'] : 'smtp.hostinger.com';
$port = !empty($body['port']) ? intval($body['port']) : 465;
$secure = isset($body['secure']) ? ($body['secure'] === true || $body['secure'] === 'true') : true;
$user = !empty($body['user']) ? $body['user'] : 'notificaciones@cruzverdesv.org';
$pass = !empty($body['pass']) ? $body['pass'] : 'Cvnoti17$';

$protocol = $secure ? 'ssl://' : 'tcp://';
$timeout = 10;

try {
    $socket = @fsockopen($protocol . $host, $port, $errno, $errstr, $timeout);
    if (!$socket) {
        throw new Exception("No se pudo conectar a {$host}:{$port} ($errno: $errstr)");
    }

    stream_set_timeout($socket, $timeout);

    function readResp($socket) {
        $res = '';
        while (!feof($socket)) {
            $line = fgets($socket, 512);
            $res .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $res;
    }

    $greeting = readResp($socket);
    fputs($socket, "EHLO cruzverdesv.org\r\n");
    $ehlo = readResp($socket);

    if (!$secure && $port === 587) {
        fputs($socket, "STARTTLS\r\n");
        $tlsRes = readResp($socket);
        if (substr($tlsRes, 0, 3) === '220') {
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            fputs($socket, "EHLO cruzverdesv.org\r\n");
            readResp($socket);
        }
    }

    fputs($socket, "AUTH LOGIN\r\n");
    readResp($socket);
    fputs($socket, base64_encode($user) . "\r\n");
    readResp($socket);
    fputs($socket, base64_encode($pass) . "\r\n");
    $authRes = readResp($socket);

    if (substr($authRes, 0, 3) !== '235') {
        throw new Exception("Autenticación fallida con el usuario {$user}: {$authRes}");
    }

    fputs($socket, "QUIT\r\n");
    fclose($socket);

    echo json_encode([
        'success' => true,
        'message' => '¡Conexión SMTP exitosa con el servidor de Hostinger!'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'sugerencia' => 'Verifique que la contraseña sea correcta y el correo esté creado en Hostinger hPanel.'
    ]);
}
