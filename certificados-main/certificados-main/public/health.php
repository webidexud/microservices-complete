<?php
// 📂 UBICACIÓN: public/health.php
// Health check para Public Service
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

$health = [
    'service' => 'public-service',
    'status' => 'healthy',
    'timestamp' => date('c'),
    'checks' => []
];

try {
    // Check básico de base de datos (solo lectura)
    require_once '../config/database.php';
    $db = Database::getInstance();
    
    if ($db->testConnection()) {
        $health['checks']['database'] = 'ok';
    } else {
        $health['checks']['database'] = 'error';
        $health['status'] = 'unhealthy';
    }
    
    // Check de directorio de certificados generados
    if (is_dir('../generated/')) {
        $health['checks']['generated_directory'] = 'ok';
    } else {
        $health['checks']['generated_directory'] = 'error';
        $health['status'] = 'unhealthy';
    }
    
    // Check simple de funcionalidad pública
    try {
        $stmt = $db->getConnection()->query("SELECT COUNT(*) as count FROM eventos WHERE estado = 'activo'");
        $result = $stmt->fetch();
        if ($result && $result['count'] >= 0) {
            $health['checks']['public_queries'] = 'ok';
            $health['details']['active_events'] = $result['count'];
        }
    } catch (Exception $e) {
        $health['checks']['public_queries'] = 'error';
        $health['status'] = 'unhealthy';
    }
    
    $health['details']['php_version'] = PHP_VERSION;
    $health['details']['memory_usage'] = format_bytes(memory_get_usage(true));
    
} catch (Exception $e) {
    $health['status'] = 'unhealthy';
    $health['error'] = $e->getMessage();
}

http_response_code($health['status'] === 'healthy' ? 200 : 503);
echo json_encode($health, JSON_PRETTY_PRINT);

function format_bytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    for ($i = 0; $bytes > 1024; $i++) {
        $bytes /= 1024;
    }
    return round($bytes, $precision) . ' ' . $units[$i];
}
?>