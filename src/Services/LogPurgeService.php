<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';

/**
 * Log Purge Service - Automatic & Manual Temporary Log Optimization
 * Compliant with PRD Modul 5 (FR-5.1, FR-5.2, FR-5.3)
 */
final class LogPurgeService
{
    /**
     * Calculate current temporary log statistics & storage footprint
     */
    public static function calculateStats(?PDO $pdo = null): array
    {
        $pdo = $pdo ?? Database::getConnection();

        $countStmt = $pdo->query("SELECT COUNT(*) FROM monitoring_temp_logs");
        $totalRows = (int)$countStmt->fetchColumn();

        $dateStmt = $pdo->query("SELECT MIN(created_at) AS oldest, MAX(created_at) AS newest FROM monitoring_temp_logs");
        $dates = $dateStmt->fetch() ?: [];

        $setStmt = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'temp_log_retention_days'");
        $retentionDays = (int)($setStmt->fetchColumn() ?: 7);

        $autoStmt = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'temp_log_auto_delete_enabled'");
        $autoEnabled = (bool)((int)($autoStmt->fetchColumn() ?: 1));

        // Average log row size: ~120 bytes (InnoDB overhead + indexing)
        $sizeMb = round(($totalRows * 120) / (1024 * 1024), 3);

        return [
            'total_rows' => $totalRows,
            'size_mb' => $sizeMb,
            'oldest_log' => $dates['oldest'] ?? null,
            'newest_log' => $dates['newest'] ?? null,
            'retention_days' => $retentionDays,
            'auto_delete_enabled' => $autoEnabled
        ];
    }

    /**
     * Purge logs older than the configured retention days
     * Returns the number of deleted rows
     */
    public static function purgeExpired(?PDO $pdo = null): int
    {
        $pdo = $pdo ?? Database::getConnection();
        $stats = self::calculateStats($pdo);

        if (!$stats['auto_delete_enabled']) {
            return 0;
        }

        $days = (int)$stats['retention_days'];
        $driver = strtolower((string)env('DB_DRIVER', 'mysql'));

        if ($driver === 'sqlite') {
            $sql = "DELETE FROM monitoring_temp_logs WHERE created_at < datetime('now', '-' || :days || ' days')";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':days' => $days]);
        } else {
            // MySQL / MariaDB - Safe parameterized date subtraction
            $sql = "DELETE FROM monitoring_temp_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL " . $days . " DAY)";
            $stmt = $pdo->query($sql);
        }

        return $stmt->rowCount();
    }

    /**
     * Instantly purge all temporary logs (Manual Purge by Super Admin)
     */
    public static function purgeAll(?PDO $pdo = null): int
    {
        $pdo = $pdo ?? Database::getConnection();
        $count = $pdo->exec("DELETE FROM monitoring_temp_logs");
        return (int)$count;
    }
}
