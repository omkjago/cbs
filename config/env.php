<?php
declare(strict_types=1);

/**
 * Lightweight and Secure Environment Configuration Loader
 * Compliant with PHP 8.3+ Native Strict Types
 */

final class Env
{
    private static array $variables = [];
    private static bool $loaded = false;

    public static function load(string $path = __DIR__ . '/../.env'): void
    {
        if (self::$loaded) {
            return;
        }

        if (!file_exists($path)) {
            $fallback = __DIR__ . '/../.env.example';
            if (file_exists($fallback)) {
                $path = $fallback;
            } else {
                self::$loaded = true;
                return;
            }
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            self::$loaded = true;
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Strip enclosing quotes if present
            if ((str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
                $val = substr($val, 1, -1);
            }

            // Convert booleans / null
            $lower = strtolower($val);
            if ($lower === 'true') {
                $val = true;
            } elseif ($lower === 'false') {
                $val = false;
            } elseif ($lower === 'null') {
                $val = null;
            }

            self::$variables[$key] = $val;
            $_ENV[$key] = $val;
        }

        self::$loaded = true;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        if (!self::$loaded) {
            self::load();
        }

        return self::$variables[$key] ?? $_ENV[$key] ?? $default;
    }
}

if (!function_exists('env')) {
    function env(string $key, mixed $default = null): mixed
    {
        return Env::get($key, $default);
    }
}

Env::load();
