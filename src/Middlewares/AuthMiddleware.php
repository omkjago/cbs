<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/JwtService.php';

final class AuthMiddleware
{
    /**
     * Authenticate request and optionally verify RBAC role permissions
     * Returns array user payload: ['id' => ..., 'email' => ..., 'name' => ..., 'role' => ...]
     */
    public static function authenticate(?array $allowedRoles = null): array
    {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($authHeader === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }

        if (!preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode([
                'status' => 'error',
                'message' => 'Unauthorized: Missing or malformed Bearer token.'
            ]);
            exit;
        }

        $token = $matches[1];
        $payload = JwtService::validateToken($token);

        if ($payload === null) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode([
                'status' => 'error',
                'message' => 'Unauthorized: Invalid or expired token.'
            ]);
            exit;
        }

        if (($payload['type'] ?? '') !== 'access') {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode([
                'status' => 'error',
                'message' => 'Unauthorized: Access token required.'
            ]);
            exit;
        }

        // RBAC check
        if ($allowedRoles !== null && !empty($allowedRoles)) {
            $userRole = $payload['role'] ?? '';
            if (!in_array($userRole, $allowedRoles, true)) {
                http_response_code(403);
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Forbidden: You do not have permission to access this resource.'
                ]);
                exit;
            }
        }

        return $payload;
    }
}
