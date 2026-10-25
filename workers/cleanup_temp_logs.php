<?php
declare(strict_types=1);

/**
 * Scheduled Cron Worker: Auto-Delete Expired Temporary Logs
 * Compliant with PRD Section 2, FR-5.2, FR-5.3 & Zero-Shell Policy
 * Usage: php workers/cleanup_temp_logs.php
 */

if (php_sapi_name() !== 'cli') {
    die("Error: This cleanup worker must be executed from PHP CLI.\n");
}

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/LogPurgeService.php';

echo "[" . date('Y-m-d H:i:s') . "] Starting NMS-GIS ISP Auto-Delete Temporary Log Worker...\n";

try {
    $pdo = Database::getConnection();

    $statsBefore = LogPurgeService::calculateStats($pdo);
    echo "  -> Current Status: {$statsBefore['total_rows']} rows ({$statsBefore['size_mb']} MB)\n";
    echo "  -> Retention Policy: {$statsBefore['retention_days']} days (Auto-Delete: " . ($statsBefore['auto_delete_enabled'] ? 'ENABLED' : 'DISABLED') . ")\n";

    if (!$statsBefore['auto_delete_enabled']) {
        echo "  -> Auto-delete is disabled in system settings. Exiting.\n";
        exit(0);
    }

    $deletedCount = LogPurgeService::purgeExpired($pdo);
    echo "  -> Successfully purged {$deletedCount} expired temporary log records.\n";

    $statsAfter = LogPurgeService::calculateStats($pdo);
    echo "  -> Remaining: {$statsAfter['total_rows']} rows ({$statsAfter['size_mb']} MB)\n";
    echo "[" . date('Y-m-d H:i:s') . "] Auto-Delete cleanup finished successfully.\n";

} catch (Throwable $e) {
    echo "[" . date('Y-m-d H:i:s') . "] ERROR during log cleanup: " . $e->getMessage() . "\n";
    exit(1);
}
