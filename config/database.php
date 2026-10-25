<?php
declare(strict_types=1);

require_once __DIR__ . '/env.php';

/**
 * Database Singleton using PDO
 * Enforces strict security standards (emulated prepares disabled, exceptions enabled)
 */
final class Database
{
    private static ?PDO $instance = null;

    private function __construct() {}
    private function __clone() {}

    public static function getConnection(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $driver = strtolower((string)env('DB_DRIVER', 'mysql'));

        if ($driver === 'sqlite') {
            $sqlitePath = (string)env('DB_SQLITE_PATH', 'database/nms_gis.sqlite');
            if (!str_starts_with($sqlitePath, '/') && !preg_match('/^[A-Za-z]:[\\\\\/]/', $sqlitePath)) {
                $sqlitePath = dirname(__DIR__) . '/' . $sqlitePath;
            }

            $dir = dirname($sqlitePath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $dsn = "sqlite:" . $sqlitePath;
            $pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);

            // Enable foreign keys for SQLite
            $pdo->exec('PRAGMA foreign_keys = ON;');
            self::$instance = $pdo;
            return self::$instance;
        }

        // Default: MySQL / MariaDB
        $host = (string)env('DB_HOST', '127.0.0.1');
        $port = (string)env('DB_PORT', '3306');
        $dbname = (string)env('DB_DATABASE', 'nms_gis_db');
        $charset = (string)env('DB_CHARSET', 'utf8mb4');
        $username = (string)env('DB_USERNAME', 'root');
        $password = (string)env('DB_PASSWORD', '');

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset} COLLATE {$charset}_unicode_ci",
        ];

        try {
            self::$instance = new PDO($dsn, $username, $password, $options);
        } catch (PDOException $e) {
            // Provide informative error message without leaking sensitive server credentials
            throw new RuntimeException("Database connection error: " . $e->getMessage(), (int)$e->getCode(), $e);
        }

        return self::$instance;
    }

    public static function setConnection(?PDO $pdo): void
    {
        self::$instance = $pdo;
    }
}
