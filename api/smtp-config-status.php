<?php
/**
 * Cruz Verde Salvadoreña - Estado de Configuración SMTP en Hostinger
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

echo json_encode([
    'configured' => true,
    'hasPassword' => true,
    'host' => 'smtp.hostinger.com',
    'port' => '465',
    'secure' => true,
    'user' => 'notificaciones@cruzverdesv.org',
    'from' => 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>',
    'replyTo' => 'noreply@cruzverdesv.org',
    'provider' => 'Hostinger Webmail (smtp.hostinger.com)',
    'protocol' => 'SSL Seguro (465)'
]);
