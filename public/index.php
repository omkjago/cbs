<?php
declare(strict_types=1);

/**
 * NMS-GIS ISP - Front Controller & REST API Router
 * Pure Native PHP 8.3+ with Strict Typing & Zero Framework Overhead
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Middlewares/CorsMiddleware.php';
require_once __DIR__ . '/../src/Controllers/AuthController.php';
require_once __DIR__ . '/../src/Controllers/GisController.php';

// Handle CORS Headers & Options Preflight
CorsMiddleware::handle();

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// If root is accessed, serve React SPA or fallback app.html
if ($uri === '/' || $uri === '/index.php' || $uri === '/app') {
    if (file_exists(__DIR__ . '/dist/index.html')) {
        include __DIR__ . '/dist/index.html';
        exit;
    }
    if (file_exists(__DIR__ . '/app.html')) {
        include __DIR__ . '/app.html';
        exit;
    }
}

// REST API Endpoints under /api/v1/
header('Content-Type: application/json; charset=UTF-8');

// Route Dispatcher
try {
    // 1. Auth Routes
    if ($method === 'POST' && $uri === '/api/v1/auth/login') {
        AuthController::login();
        exit;
    }
    if ($method === 'POST' && $uri === '/api/v1/auth/refresh') {
        AuthController::refresh();
        exit;
    }
    if ($method === 'GET' && $uri === '/api/v1/auth/me') {
        AuthController::me();
        exit;
    }

    // 2. GIS Routes
    if ($method === 'GET' && $uri === '/api/v1/gis/map-data') {
        GisController::getMapData();
        exit;
    }
    if ($method === 'POST' && $uri === '/api/v1/gis/nodes') {
        GisController::createNode();
        exit;
    }
    if ($method === 'PUT' && preg_match('#^/api/v1/gis/nodes/(\d+)$#', $uri, $matches)) {
        GisController::updateNode((int)$matches[1]);
        exit;
    }
    if ($method === 'DELETE' && preg_match('#^/api/v1/gis/nodes/(\d+)$#', $uri, $matches)) {
        GisController::deleteNode((int)$matches[1]);
        exit;
    }
    if ($method === 'POST' && $uri === '/api/v1/gis/cables') {
        GisController::createCable();
        exit;
    }
    if ($method === 'DELETE' && preg_match('#^/api/v1/gis/cables/(\d+)$#', $uri, $matches)) {
        GisController::deleteCable((int)$matches[1]);
        exit;
    }

    // 3. Fallback 404 Not Found
    http_response_code(404);
    echo json_encode([
        'status' => 'error',
        'message' => "Endpoint tidak ditemukan: {$method} {$uri}"
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
}
