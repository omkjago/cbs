<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/env.php';

final class CorsMiddleware
{
    public static function handle(): void
    {
        $allowedOrigins = (string)env('CORS_ALLOWED_ORIGINS', '*');
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';

        if ($allowedOrigins === '*' || in_array($origin, array_map('trim', explode(',', $allowedOrigins)), true)) {
            header("Access-Control-Allow-Origin: {$origin}");
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');

        // Handle preflight requests
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
}
