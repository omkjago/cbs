<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/env.php';

final class RateLimitMiddleware
{
    private static function getStorageDir(): string
    {
        $dir = dirname(__DIR__, 2) . '/storage/rate_limits';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir;
    }

    public static function getClientIp(): string
    {
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            return $_SERVER['HTTP_CF_CONNECTING_IP'];
        }
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    /**
     * Check if client IP is currently rate-limited
     */
    public static function checkLoginLimit(int $maxAttempts = 5, int $windowSeconds = 300): bool
    {
        $ip = self::getClientIp();
        $file = self::getStorageDir() . '/' . md5('login_fail_' . $ip) . '.json';

        if (!file_exists($file)) {
            return true;
        }

        $data = json_decode((string)file_get_contents($file), true);
        if (!is_array($data)) {
            return true;
        }

        $now = time();
        // Filter out timestamps outside the window
        $recentAttempts = array_filter($data, fn(int $ts) => ($now - $ts) < $windowSeconds);

        if (count($recentAttempts) >= $maxAttempts) {
            return false;
        }

        return true;
    }

    /**
     * Record a failed login attempt
     */
    public static function recordFailedLogin(int $windowSeconds = 300): void
    {
        $ip = self::getClientIp();
        $file = self::getStorageDir() . '/' . md5('login_fail_' . $ip) . '.json';

        $attempts = [];
        if (file_exists($file)) {
            $data = json_decode((string)file_get_contents($file), true);
            if (is_array($data)) {
                $now = time();
                $attempts = array_filter($data, fn(int $ts) => ($now - $ts) < $windowSeconds);
            }
        }

        $attempts[] = time();
        file_put_contents($file, json_encode(array_values($attempts)), LOCK_EX);
    }

    /**
     * Clear failed attempts on successful login
     */
    public static function resetLoginLimit(): void
    {
        $ip = self::getClientIp();
        $file = self::getStorageDir() . '/' . md5('login_fail_' . $ip) . '.json';
        if (file_exists($file)) {
            @unlink($file);
        }
    }
}
