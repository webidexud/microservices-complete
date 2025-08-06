<?php
// 📂 UBICACIÓN: admin/health.php
// Health check para Admin Service
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

$health = [
    'service' => 'admin-service',
    'status' => 'healthy',
    'timestamp' => date('c'),
    'checks' => []
];

try {
    // Check 1: Verificar conexión a base de datos
    require_once '../config/database.php';
    $db = Database::getInstance();
    
    if ($db->testConnection()) {
        $health['checks']['database'] = 'ok';
    } else {
        $health['checks']['database'] = 'error';
        $health['status'] = 'unhealthy';
    }
    
    // Check 2: Verificar Redis (si está disponible)
    if ($db->testRedis()) {
        $health['checks']['redis'] = 'ok';
    } else {
        $health['checks']['redis'] = 'warning'; // No crítico
    }
    
    // Check 3: Verificar directorios críticos
    $dirs = [
        'uploads' => '../uploads/',
        'generated' => '../generated/',
        'templates' => '../templates/'
    ];
    
    foreach ($dirs as $name => $path) {
        if (is_dir($path) && is_writable($path)) {
            $health['checks'][$name . '_directory'] = 'ok';
        } else {
            $health['checks'][$name . '_directory'] = 'error';
            $health['status'] = 'unhealthy';
        }
    }
    
    // Check 4: Verificar memoria disponible
    $memory_usage = memory_get_usage(true);
    $memory_limit = ini_get('memory_limit');
    $memory_limit_bytes = return_bytes($memory_limit);
    
    if ($memory_usage < ($memory_limit_bytes * 0.8)) {
        $health['checks']['memory'] = 'ok';
    } else {
        $health['checks']['memory'] = 'warning';
    }
    
    $health['details'] = [
        'memory_usage' => format_bytes($memory_usage),
        'memory_limit' => $memory_limit,
        'php_version' => PHP_VERSION,
        'server_load' => sys_getloadavg()[0] ?? 'unknown'
    ];
    
} catch (Exception $e) {
    $health['status'] = 'unhealthy';
    $health['error'] = $e->getMessage();
}

// Responder con código HTTP apropiado
http_response_code($health['status'] === 'healthy' ? 200 : 503);
echo json_encode($health, JSON_PRETTY_PRINT);

function return_bytes($val) {
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = (int)$val;
    switch($last) {
        case 'g': $val *= 1024;
        case 'm': $val *= 1024;
        case 'k': $val *= 1024;
    }
    return $val;
}

function format_bytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    for ($i = 0; $bytes > 1024; $i++) {
        $bytes /= 1024;
    }
    return round($bytes, $precision) . ' ' . $units[$i];
}
?>

