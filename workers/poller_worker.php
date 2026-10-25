<?php
declare(strict_types=1);

/**
 * Background Poller Engine for Multi-Vendor Hardware (CLI Worker & OOP Service)
 * Compliant with PRD Section 2, FR-3.1, FR-5.1 & Zero-Shell Policy
 * Usage from CLI: php workers/poller_worker.php [--once]
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/CryptoService.php';
require_once __DIR__ . '/../src/Controllers/DeviceController.php';

final class PollerEngine
{
    public static function runCycle(?PDO $pdo = null): array
    {
        $pdo = $pdo ?? Database::getConnection();
        $results = [
            'devices_polled' => 0,
            'state_changes' => 0,
            'errors' => []
        ];

        // 1. Fetch system threshold settings
        $warnThreshold = (float)(env('RX_POWER_WARNING_THRESHOLD', -25.00));

        // 2. Fetch all registered network devices
        $devStmt = $pdo->query("SELECT * FROM network_devices WHERE is_online = 1");
        $devices = $devStmt->fetchAll();

        foreach ($devices as $dev) {
            $devId = (int)$dev['id'];
            $devName = $dev['device_name'];
            $driver = $dev['vendor_driver'];
            $results['devices_polled']++;

            try {
                $username = $dev['username_enc'] ? CryptoService::decrypt($dev['username_enc']) : '';
                $password = $dev['password_enc'] ? CryptoService::decrypt($dev['password_enc']) : '';
                $community = $dev['snmp_community_enc'] ? CryptoService::decrypt($dev['snmp_community_enc']) : '';

                $adapter = DeviceController::createAdapter($driver);
                $adapter->connect([
                    'ip_address' => $dev['ip_address'],
                    'api_port' => $dev['api_port'],
                    'snmp_port' => $dev['snmp_port'],
                    'username' => $username,
                    'password' => $password,
                    'snmp_community' => $community,
                    'simulation_mode' => true
                ]);

                // Update device last polled timestamp
                $pdo->prepare("UPDATE network_devices SET last_polled_at = CURRENT_TIMESTAMP WHERE id = :id")
                    ->execute([':id' => $devId]);

                // If OLT: Poll ONU optical statuses
                if ($dev['device_type'] === 'olt') {
                    $onus = $adapter->getOnuStatusList();
                    foreach ($onus as $onu) {
                        $onuSn = $onu['onu_sn'] ?? null;
                        if (!$onuSn) continue;

                        $matchStmt = $pdo->prepare("
                            SELECT node_id, connection_status, rx_power_dbm 
                            FROM device_current_status 
                            WHERE onu_sn = :sn 
                            LIMIT 1
                        ");
                        $matchStmt->execute([':sn' => $onuSn]);
                        $curr = $matchStmt->fetch();

                        if ($curr) {
                            $nodeId = (int)$curr['node_id'];
                            $oldStatus = $curr['connection_status'];
                            $newStatus = $onu['status'] ?? 'ONLINE';
                            $rx = isset($onu['rx_power_dbm']) ? (float)$onu['rx_power_dbm'] : null;
                            $tx = isset($onu['tx_power_dbm']) ? (float)$onu['tx_power_dbm'] : null;

                            $isStateChanged = ($oldStatus !== $newStatus);

                            // Update fixed row in device_current_status (FR-5.1)
                            $updateStmt = $pdo->prepare("
                                UPDATE device_current_status 
                                SET olt_device_id = :olt_id,
                                    connection_status = :status,
                                    rx_power_dbm = :rx,
                                    tx_power_dbm = :tx,
                                    last_checked_at = CURRENT_TIMESTAMP
                                    " . ($isStateChanged ? ", last_state_change_at = CURRENT_TIMESTAMP" : "") . "
                                WHERE node_id = :node_id
                            ");
                            $updateStmt->execute([
                                ':olt_id' => $devId,
                                ':status' => $newStatus,
                                ':rx' => $rx,
                                ':tx' => $tx,
                                ':node_id' => $nodeId
                            ]);

                            // Record to monitoring_temp_logs ONLY on state change (FR-5.1)
                            if ($isStateChanged) {
                                $results['state_changes']++;
                                $logStmt = $pdo->prepare("
                                    INSERT INTO monitoring_temp_logs (node_id, previous_status, new_status, rx_power_dbm, fault_Note, created_at)
                                    VALUES (:node_id, :prev, :new, :rx, :note, CURRENT_TIMESTAMP)
                                ");
                                $logStmt->execute([
                                    ':node_id' => $nodeId,
                                    ':prev' => $oldStatus,
                                    ':new' => $newStatus,
                                    ':rx' => $rx,
                                    ':note' => "State change detected by poller engine: {$oldStatus} -> {$newStatus}"
                                ]);
                            }
                        }
                    }
                }

                $adapter->disconnect();

            } catch (Throwable $e) {
                $results['errors'][] = "[{$devName}] " . $e->getMessage();
            }
        }

        return $results;
    }

    public static function runCliLoop(bool $runOnce = false): void
    {
        echo "[" . date('Y-m-d H:i:s') . "] Starting NMS-GIS ISP Poller Engine...\n";
        do {
            echo "[" . date('Y-m-d H:i:s') . "] Running polling cycle...\n";
            $res = self::runCycle();
            echo "[" . date('Y-m-d H:i:s') . "] Polled {$res['devices_polled']} devices. State changes: {$res['state_changes']}.\n";

            if ($runOnce) {
                break;
            }

            $interval = (int)env('POLLING_INTERVAL_SECONDS', 120);
            sleep($interval);
        } while (true);
    }
}

// If invoked directly from CLI
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $args = $_SERVER['argv'] ?? [];
    $once = in_array('--once', $args, true);
    PollerEngine::runCliLoop($once);
}
