<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../Middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../Controllers/DeviceController.php';
require_once __DIR__ . '/../Services/LogPurgeService.php';

final class MonitoringController
{
    /**
     * GET /api/v1/monitoring/nodes/{id}/live-opm
     * FR-3.3: On-Demand Live OPM Check
     */
    public static function getLiveOpm(int $nodeId): void
    {
        AuthMiddleware::authenticate();

        try {
            $pdo = Database::getConnection();

            // Fetch node and related OLT device
            $stmt = $pdo->prepare("
                SELECT n.id, n.node_code, n.node_name, n.node_type,
                       s.onu_interface, s.onu_sn, s.rx_power_dbm, s.tx_power_dbm, s.connection_status,
                       d.id AS device_id, d.vendor_driver, d.ip_address, d.snmp_port, d.snmp_community_enc
                FROM gis_nodes n
                LEFT JOIN device_current_status s ON n.id = s.node_id
                LEFT JOIN network_devices d ON s.olt_device_id = d.id
                WHERE n.id = :id
                LIMIT 1
            ");
            $stmt->execute([':id' => $nodeId]);
            $node = $stmt->fetch();

            if (!$node) {
                if (!headers_sent()) http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Node tidak ditemukan.']);
                return;
            }

            $onuId = $node['onu_interface'] ?? ($node['onu_sn'] ?? '1/1/1:1');
            $vendor = $node['vendor_driver'] ?? 'zte_c320';

            // Query via Adapter
            $adapter = DeviceController::createAdapter($vendor);
            $opmData = $adapter->getOpticalPower($onuId);

            $rx = $opmData['rx_power_dbm'] ?? ($node['rx_power_dbm'] ?? -19.50);
            $tx = $opmData['tx_power_dbm'] ?? ($node['tx_power_dbm'] ?? 2.10);

            // Determine status
            $status = 'ONLINE';
            if ($rx === null || $rx < -30.00) {
                $status = 'LOS';
            } elseif ($rx <= -25.00) {
                $status = 'WARNING_DBM';
            }

            // Update device_current_status
            $updateStmt = $pdo->prepare("
                UPDATE device_current_status 
                SET rx_power_dbm = :rx, tx_power_dbm = :tx, connection_status = :status, last_checked_at = CURRENT_TIMESTAMP
                WHERE node_id = :node_id
            ");
            $updateStmt->execute([
                ':rx' => $rx,
                ':tx' => $tx,
                ':status' => $status,
                ':node_id' => $nodeId
            ]);

            if (!headers_sent()) http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => "Pembacaan OPM Realtime untuk {$node['node_code']} berhasil.",
                'data' => [
                    'node_id' => $nodeId,
                    'node_code' => $node['node_code'],
                    'rx_power_dbm' => $rx,
                    'tx_power_dbm' => $tx,
                    'connection_status' => $status,
                    'checked_at' => date('Y-m-d H:i:s')
                ]
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * GET /api/v1/monitoring/active-faults
     * FR-4.2: List of active faults & cut estimations
     */
    public static function getActiveFaults(): void
    {
        AuthMiddleware::authenticate();

        try {
            $pdo = Database::getConnection();

            $stmt = $pdo->query("
                SELECT n.id, n.node_code, n.node_name, n.node_type, n.latitude, n.longitude,
                       s.connection_status, s.rx_power_dbm, s.onu_sn, s.last_checked_at
                FROM gis_nodes n
                JOIN device_current_status s ON n.id = s.node_id
                WHERE s.connection_status IN ('LOS', 'WARNING_DBM', 'DYING_GASP', 'OFFLINE')
                ORDER BY s.last_checked_at DESC
            ");
            $faults = $stmt->fetchAll();

            if (!headers_sent()) http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'count' => count($faults),
                'data' => $faults
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * GET /api/v1/logs/temp
     * FR-5.1 & FR-5.2: Display temporary logs & table size estimate
     */
    public static function getTempLogs(): void
    {
        AuthMiddleware::authenticate(['super_admin', 'noc']);

        try {
            $pdo = Database::getConnection();
            $stats = LogPurgeService::calculateStats($pdo);

            // Recent 50 logs
            $logStmt = $pdo->query("
                SELECT l.id, l.node_id, n.node_code, n.node_name,
                       l.previous_status, l.new_status, l.rx_power_dbm, l.fault_Note, l.created_at
                FROM monitoring_temp_logs l
                LEFT JOIN gis_nodes n ON l.node_id = n.id
                ORDER BY l.id DESC
                LIMIT 50
            ");
            $logs = $logStmt->fetchAll();

            if (!headers_sent()) http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'summary' => $stats,
                'data' => $logs
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * PUT /api/v1/settings/log-retention
     * FR-5.2: Update retention policy
     */
    public static function updateLogRetention(): void
    {
        AuthMiddleware::authenticate(['super_admin']);
        $input = json_decode((string)file_get_contents('php://input'), true);

        $days = isset($input['retention_days']) ? (int)$input['retention_days'] : 7;
        if (!in_array($days, [1, 3, 7, 14, 30], true)) {
            $days = 7;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                UPDATE system_settings 
                SET setting_value = :val, updated_at = CURRENT_TIMESTAMP
                WHERE setting_key = 'temp_log_retention_days'
            ");
            $stmt->execute([':val' => (string)$days]);

            if (!headers_sent()) http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => "Masa simpan log sementara berhasil diatur menjadi {$days} hari."
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/v1/logs/temp/purge
     * FR-5.3: Manual purge of temporary logs
     */
    public static function purgeTempLogs(): void
    {
        AuthMiddleware::authenticate(['super_admin']);

        try {
            $pdo = Database::getConnection();
            $deleted = LogPurgeService::purgeAll($pdo);

            if (!headers_sent()) http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => "Log sementara berhasil dibersihkan ({$deleted} baris dihapus)."
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }
}
