<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/env.php';

/**
 * Pure Native PHP Stateless JWT (JSON Web Token) Implementation
 * Algorithm: HMAC-SHA256 (HS256)
 */
final class JwtService
{
    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    private static function getSecret(): string
    {
        return (string)env('JWT_SECRET', 'secret_jwt_key_default_development_change_me');
    }

    /**
     * Generate signed JWT token
     */
    public static function generateToken(array $payload, int $ttlSeconds = 3600): string
    {
        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256'
        ];

        $now = time();
        $payload['iat'] = $now;
        $payload['exp'] = $now + $ttlSeconds;

        $encodedHeader = self::base64UrlEncode((string)json_encode($header));
        $encodedPayload = self::base64UrlEncode((string)json_encode($payload));

        $signature = hash_hmac('sha256', "{$encodedHeader}.{$encodedPayload}", self::getSecret(), true);
        $encodedSignature = self::base64UrlEncode($signature);

        return "{$encodedHeader}.{$encodedPayload}.{$encodedSignature}";
    }

    /**
     * Validate and decode token
     * Returns payload array if valid, or null if invalid or expired
     */
    public static function validateToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        $header = json_decode(self::base64UrlDecode($encodedHeader), true);
        if (!$header || ($header['alg'] ?? '') !== 'HS256') {
            return null;
        }

        $expectedSig = self::base64UrlEncode(
            hash_hmac('sha256', "{$encodedHeader}.{$encodedPayload}", self::getSecret(), true)
        );

        if (!hash_equals($expectedSig, $encodedSignature)) {
            return null;
        }

        $payload = json_decode(self::base64UrlDecode($encodedPayload), true);
        if (!is_array($payload)) {
            return null;
        }

        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null;
        }

        return $payload;
    }
}
