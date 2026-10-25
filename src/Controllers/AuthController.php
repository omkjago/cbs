<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../Services/JwtService.php';
require_once __DIR__ . '/../Middlewares/RateLimitMiddleware.php';
require_once __DIR__ . '/../Middlewares/AuthMiddleware.php';

final class AuthController
{
    public static function login(): void
    {
        $input = json_decode((string)file_get_contents('php://input'), true);
        $email = trim((string)($input['email'] ?? ''));
        $password = (string)($input['password'] ?? '');

        if ($email === '' || $password === '') {
            http_response_code(422);
            echo json_encode([
                'status' => 'error',
                'message' => 'Email dan password wajib diisi.'
            ]);
            return;
        }

        $maxAttempts = (int)env('RATE_LIMIT_LOGIN_MAX', 5);
        $windowSeconds = (int)env('RATE_LIMIT_LOGIN_WINDOW', 300);

        if (!RateLimitMiddleware::checkLoginLimit($maxAttempts, $windowSeconds)) {
            http_response_code(429);
            echo json_encode([
                'status' => 'error',
                'message' => 'Terlalu banyak percobaan login gagal. Silakan coba lagi setelah 5 menit.'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT id, name, email, password_hash, role, is_active 
                FROM users 
                WHERE email = :email 
                LIMIT 1
            ");
            $stmt->execute([':email' => $email]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password_hash'])) {
                RateLimitMiddleware::recordFailedLogin($windowSeconds);
                http_response_code(401);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Email atau kata sandi tidak valid.'
                ]);
                return;
            }

            if ((int)$user['is_active'] !== 1) {
                http_response_code(403);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Akun dinonaktifkan. Hubungi Super Admin.'
                ]);
                return;
            }

            // Successful login
            RateLimitMiddleware::resetLoginLimit();

            $accessTtl = (int)env('JWT_EXPIRATION', 3600);
            $refreshTtl = (int)env('JWT_REFRESH_EXPIRATION', 604800);

            $payload = [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'type' => 'access'
            ];

            $refreshPayload = [
                'id' => (int)$user['id'],
                'type' => 'refresh'
            ];

            $accessToken = JwtService::generateToken($payload, $accessTtl);
            $refreshToken = JwtService::generateToken($refreshPayload, $refreshTtl);

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => 'Login berhasil.',
                'data' => [
                    'user' => [
                        'id' => (int)$user['id'],
                        'name' => $user['name'],
                        'email' => $user['email'],
                        'role' => $user['role']
                    ],
                    'token' => [
                        'access_token' => $accessToken,
                        'refresh_token' => $refreshToken,
                        'token_type' => 'Bearer',
                        'expires_in' => $accessTtl
                    ]
                ]
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    public static function refresh(): void
    {
        $input = json_decode((string)file_get_contents('php://input'), true);
        $refreshToken = (string)($input['refresh_token'] ?? '');

        if ($refreshToken === '') {
            http_response_code(422);
            echo json_encode([
                'status' => 'error',
                'message' => 'Refresh token wajib disertakan.'
            ]);
            return;
        }

        $payload = JwtService::validateToken($refreshToken);
        if ($payload === null || ($payload['type'] ?? '') !== 'refresh') {
            http_response_code(401);
            echo json_encode([
                'status' => 'error',
                'message' => 'Refresh token tidak valid atau telah kedaluwarsa.'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT id, name, email, role, is_active FROM users WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $payload['id']]);
            $user = $stmt->fetch();

            if (!$user || (int)$user['is_active'] !== 1) {
                http_response_code(401);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Pengguna tidak ditemukan atau tidak aktif.'
                ]);
                return;
            }

            $accessTtl = (int)env('JWT_EXPIRATION', 3600);
            $newAccessToken = JwtService::generateToken([
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'type' => 'access'
            ], $accessTtl);

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'data' => [
                    'access_token' => $newAccessToken,
                    'token_type' => 'Bearer',
                    'expires_in' => $accessTtl
                ]
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    public static function me(): void
    {
        $user = AuthMiddleware::authenticate();
        http_response_code(200);
        echo json_encode([
            'status' => 'success',
            'data' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role']
            ]
        ]);
    }
}
