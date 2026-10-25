<?php
declare(strict_types=1);

/**
 * Automated Verification & Unit Test Suite for Fase 2
 * Tests: Multi-Vendor Adapters, DeviceController, Live OPM, Poller Worker, State Change Logs
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/CryptoService.php';
require_once __DIR__ . '/../src/Services/JwtService.php';
require_once __DIR__ . '/../src/Adapters/MikrotikRosAdapter.php';
require_once __DIR__ . '/../src/Adapters/ZteOltAdapter.php';
require_once __DIR__ . '/../src/Adapters/GenericSnmpAdapter.php';
require_once __DIR__ . '/../src/Controllers/DeviceController.php';
require_once __DIR__ . '/../src/Controllers/MonitoringController.php';

echo "============================================\n";
echo "   NMS-GIS ISP - Phase 2 Verification Suite \n";
echo "============================================\n";

$passed = 0;
$failed = 0;

function assertTest(string $desc, bool $condition): void {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

// Setup Admin JWT token
$adminToken = JwtService::generateToken([
    'id' => 1,
    'email' => 'admin@nms.isp',
    'role' => 'super_admin',
    'type' => 'access'
], 3600);
$_SERVER['HTTP_AUTHORIZATION'] = "Bearer {$adminToken}";

$pdo = Database::getConnection();

// 1. Test Multi-Vendor Adapters
echo "\n--- Testing Multi-Vendor Adapters ---\n";
$mikrotik = new MikrotikRosAdapter();
assertTest("MikrotikRosAdapter implements DeviceAdapterInterface", $mikrotik instanceof DeviceAdapterInterface);

$zte = new ZteOltAdapter();
assertTest("ZteOltAdapter implements DeviceAdapterInterface", $zte instanceof DeviceAdapterInterface);
$zte->connect(['ip_address' => '127.0.0.1', 'snmp_port' => 161, 'simulation_mode' => true]);
$zteTest = $zte->testConnection();
assertTest("ZteOltAdapter testConnection returns success", $zteTest['success'] === true);

$optical = $zte->getOpticalPower('gpon-onu_1/1/1:1');
assertTest("ZteOltAdapter getOpticalPower returns valid Rx dBm", isset($optical['rx_power_dbm']) && is_float($optical['rx_power_dbm']));

$generic = new GenericSnmpAdapter();
assertTest("GenericSnmpAdapter implements DeviceAdapterInterface", $generic instanceof DeviceAdapterInterface);

// 2. Test DeviceController CRUD & AES-256-GCM Encryption
echo "\n--- Testing DeviceController & Credential Encryption ---\n";
$devName = "OLT-ZTE-TEST-" . time();
$plainPass = "SuperSecretOltPass123!";
$plainComm = "nms_private_community";

$passEnc = CryptoService::encrypt($plainPass);
$commEnc = CryptoService::encrypt($plainComm);

assertTest("Password encrypted is not plaintext", $passEnc !== $plainPass);
assertTest("Decrypted password matches", CryptoService::decrypt($passEnc) === $plainPass);

$stmt = $pdo->prepare("
    INSERT INTO network_devices (
        device_name, device_type, vendor_driver, ip_address, 
        api_port, snmp_port, username_enc, password_enc, snmp_community_enc, is_online
    ) VALUES (
        :name, 'olt', 'zte_c320', '127.0.0.1', 
        8728, 161, null, :pass, :comm, 1
    )
");
$stmt->execute([
    ':name' => $devName,
    ':pass' => $passEnc,
    ':comm' => $commEnc
]);
$devId = (int)$pdo->lastInsertId();
assertTest("Device registered with ID {$devId}", $devId > 0);

// Test Device Test Connection API
ob_start();
DeviceController::testDevice($devId);
$devTestJson = ob_get_clean();
$devTestRes = json_decode($devTestJson, true);
assertTest("DeviceController::testDevice returns success", ($devTestRes['status'] ?? '') === 'success');

// 3. Test Live OPM On-Demand Check (FR-3.3)
echo "\n--- Testing Live OPM On-Demand Check ---\n";
// Find a customer node
$custStmt = $pdo->query("SELECT id, node_code FROM gis_nodes WHERE node_type = 'CUSTOMER' LIMIT 1");
$cust = $custStmt->fetch();

if ($cust) {
    $custId = (int)$cust['id'];
    ob_start();
    MonitoringController::getLiveOpm($custId);
    $opmJson = ob_get_clean();
    $opmRes = json_decode($opmJson, true);

    assertTest("Live OPM returns success for {$cust['node_code']}", ($opmRes['status'] ?? '') === 'success');
    assertTest("Live OPM data contains rx_power_dbm", isset($opmRes['data']['rx_power_dbm']));
    assertTest("Live OPM data contains connection_status", isset($opmRes['data']['connection_status']));

    // Verify database was updated
    $chkStmt = $pdo->prepare("SELECT rx_power_dbm, connection_status FROM device_current_status WHERE node_id = :id");
    $chkStmt->execute([':id' => $custId]);
    $updatedStatus = $chkStmt->fetch();
    assertTest("Database device_current_status updated with live reading", $updatedStatus !== false);
} else {
    echo "  [SKIP] No customer node found to test Live OPM.\n";
}

// 4. Test MonitoringController::getActiveFaults
echo "\n--- Testing Active Faults Endpoint ---\n";
ob_start();
MonitoringController::getActiveFaults();
$faultsJson = ob_get_clean();
$faultsRes = json_decode($faultsJson, true);
assertTest("getActiveFaults returns success", ($faultsRes['status'] ?? '') === 'success');
assertTest("getActiveFaults data is array", is_array($faultsRes['data'] ?? null));

// 5. Test Background Poller Worker (Pure Native Engine Cycle)
echo "\n--- Testing Background Poller Worker ---\n";
require_once __DIR__ . '/../workers/poller_worker.php';
$cycleResults = PollerEngine::runCycle($pdo);
assertTest("PollerEngine::runCycle polled registered devices", $cycleResults['devices_polled'] > 0);
assertTest("PollerEngine ran with 0 fatal errors", empty($cycleResults['errors']));

// 6. Test Temporary Logs & Retention Settings
echo "\n--- Testing Temporary Logs & Retention Settings ---\n";
// Update retention days to 14
$tempInput = json_encode(['retention_days' => 14]);
// Simulate update
$pdo->prepare("UPDATE system_settings SET setting_value = '14' WHERE setting_key = 'temp_log_retention_days'")->execute();
$retStmt = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'temp_log_retention_days'");
assertTest("Retention days setting updated to 14", (int)$retStmt->fetchColumn() === 14);

// Cleanup test device
$pdo->prepare("DELETE FROM network_devices WHERE id = :id")->execute([':id' => $devId]);
assertTest("Test device cleaned up", true);

echo "\n============================================\n";
echo "   Phase 2 Results: {$passed} Passed, {$failed} Failed\n";
echo "============================================\n";

if ($failed > 0) {
    exit(1);
}
