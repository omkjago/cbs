<?php
declare(strict_types=1);

/**
 * Automated Verification & Unit Test Suite for Fase 3
 * Tests: Smart Fault Localization (Topological Tree Correlation) & Temporary Log Auto-Purge
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/FaultAnalyzerService.php';
require_once __DIR__ . '/../src/Services/LogPurgeService.php';

echo "============================================\n";
echo "   NMS-GIS ISP - Phase 3 Verification Suite \n";
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

$pdo = Database::getConnection();

// -----------------------------------------------------------------------------
// 1. Test FaultAnalyzerService: Normal Baseline State
// -----------------------------------------------------------------------------
echo "\n--- 1. Testing FaultAnalyzerService: Normal Baseline ---\n";
// Ensure all customers are currently ONLINE
$pdo->exec("UPDATE device_current_status SET connection_status = 'ONLINE', rx_power_dbm = -19.50");
$pdo->exec("UPDATE gis_cables SET current_visual_status = 'normal'");

$baseline = FaultAnalyzerService::analyze($pdo);
assertTest("Normal baseline reports 0 suspected fiber cuts", count($baseline['suspected_fiber_cuts']) === 0);

// -----------------------------------------------------------------------------
// 2. Test FaultAnalyzerService: Skenario 1 - Gangguan Individual (Drop Core Cut)
// -----------------------------------------------------------------------------
echo "\n--- 2. Testing FaultAnalyzerService: Skenario 1 (Drop Core Cut) ---\n";
// Ambil 2 pelanggan di ODP-SMG-001
$custs = $pdo->query("
    SELECT n.id, n.node_code 
    FROM gis_nodes n 
    JOIN gis_nodes p ON n.parent_node_id = p.id 
    WHERE n.node_type = 'CUSTOMER' AND p.node_code = 'ODP-SMG-001'
    LIMIT 2
")->fetchAll();

if (count($custs) >= 2) {
    // Set 1 pelanggan LOS, 1 pelanggan tetap ONLINE
    $pdo->prepare("UPDATE device_current_status SET connection_status = 'LOS' WHERE node_id = :id")
        ->execute([':id' => $custs[0]['id']]);
    $pdo->prepare("UPDATE device_current_status SET connection_status = 'ONLINE' WHERE node_id = :id")
        ->execute([':id' => $custs[1]['id']]);

    $analysisDrop = FaultAnalyzerService::analyze($pdo);
    $cuts = $analysisDrop['suspected_fiber_cuts'];

    assertTest("Drop cut detected when only 1 customer is LOS", count($cuts) === 1);
    assertTest("Fault type is INDIVIDUAL_DROP_CUT", ($cuts[0]['fault_type'] ?? '') === 'INDIVIDUAL_DROP_CUT');
    assertTest("Affected customer count is 1", ($cuts[0]['affected_customers_count'] ?? 0) === 1);
    assertTest("Cut target points to affected customer {$custs[0]['node_code']}", ($cuts[0]['to_node'] ?? '') === $custs[0]['node_code']);
} else {
    echo "  [SKIP] Minimum 2 customers required under ODP-SMG-001.\n";
}

// -----------------------------------------------------------------------------
// 3. Test FaultAnalyzerService: Skenario 2 - Gangguan ODP Massal (Distribution Cut)
// -----------------------------------------------------------------------------
echo "\n--- 3. Testing FaultAnalyzerService: Skenario 2 (ODP Distribution Cut) ---\n";
if (count($custs) >= 2) {
    // Set kedua pelanggan di ODP-SMG-001 menjadi LOS (100% loss >= 80%)
    $pdo->prepare("UPDATE device_current_status SET connection_status = 'LOS' WHERE node_id = :id")
        ->execute([':id' => $custs[0]['id']]);
    $pdo->prepare("UPDATE device_current_status SET connection_status = 'LOS' WHERE node_id = :id")
        ->execute([':id' => $custs[1]['id']]);

    $analysisOdp = FaultAnalyzerService::analyze($pdo);
    $cuts = $analysisOdp['suspected_fiber_cuts'];

    $hasOdpCut = false;
    foreach ($cuts as $c) {
        if ($c['fault_type'] === 'ODP_DISTRIBUTION_CUT') {
            $hasOdpCut = true;
            assertTest("ODP distribution cut points to ODP-SMG-001", $c['to_node'] === 'ODP-SMG-001');
            assertTest("ODP cut reports 2 affected customers", $c['affected_customers_count'] === 2);
            break;
        }
    }
    assertTest("ODP distribution cut detected when >= 80% customers LOS", $hasOdpCut);

    // Verify cable in database was marked as cut_suspected
    $cableCheck = $pdo->query("SELECT current_visual_status FROM gis_cables WHERE cable_code = 'CBL-DIST-JB01-ODP01'")->fetch();
    assertTest("Distribution cable marked as cut_suspected in DB", ($cableCheck['current_visual_status'] ?? '') === 'cut_suspected');
}

// -----------------------------------------------------------------------------
// 4. Test FaultAnalyzerService: Skenario 3 - Upward Tree Traversal (Backbone/Feeder Cut)
// -----------------------------------------------------------------------------
echo "\n--- 4. Testing FaultAnalyzerService: Skenario 3 (Backbone Feeder Cut) ---\n";
// Buat pelanggan di ODP-SMG-002 dan set semua turunan JB-SMG-001 menjadi LOS
$odp2Stmt = $pdo->query("SELECT id FROM gis_nodes WHERE node_code = 'ODP-SMG-002'")->fetch();
if ($odp2Stmt) {
    $odp2Id = (int)$odp2Stmt['id'];
    $pdo->prepare("
        INSERT INTO gis_nodes (parent_node_id, node_code, node_name, node_type, latitude, longitude, input_method)
        VALUES (:pid, 'CUST-TEST-99', 'Pelanggan ODP2 Test', 'CUSTOMER', -6.99185, 110.4239, 'map_marker')
    ")->execute([':pid' => $odp2Id]);
    $newCustId = (int)$pdo->lastInsertId();

    $pdo->prepare("
        INSERT INTO device_current_status (node_id, connection_status, last_checked_at)
        VALUES (:id, 'LOS', CURRENT_TIMESTAMP)
    ")->execute([':id' => $newCustId]);

    // Sekarang seluruh ODP (ODP-01 dan ODP-02) di bawah JB-SMG-001 mati 100%
    $analysisBackbone = FaultAnalyzerService::analyze($pdo);
    $cuts = $analysisBackbone['suspected_fiber_cuts'];

    $hasBackboneCut = false;
    foreach ($cuts as $c) {
        if ($c['fault_type'] === 'BACKBONE_FEEDER_CUT') {
            $hasBackboneCut = true;
            assertTest("Backbone cut points to dead Joint Box JB-SMG-001", $c['to_node'] === 'JB-SMG-001');
            assertTest("Upward traversal found healthy ancestor ODC-SMG-01", $c['from_node'] === 'ODC-SMG-01');
            break;
        }
    }
    assertTest("Backbone / Feeder cut identified via upward tree traversal", $hasBackboneCut);

    // Clean up temporary test node
    $pdo->prepare("DELETE FROM gis_nodes WHERE id = :id")->execute([':id' => $newCustId]);
}

// Reset customer status back to normal
$pdo->exec("UPDATE device_current_status SET connection_status = 'ONLINE', rx_power_dbm = -19.50");
$pdo->exec("UPDATE gis_cables SET current_visual_status = 'normal'");

// -----------------------------------------------------------------------------
// 5. Test LogPurgeService & Auto-Delete Logic
// -----------------------------------------------------------------------------
echo "\n--- 5. Testing LogPurgeService ---\n";
// Insert test logs: 1 old log (10 days ago) and 1 recent log (today)
$pdo->exec("
    INSERT INTO monitoring_temp_logs (node_id, previous_status, new_status, rx_power_dbm, fault_Note, created_at)
    VALUES 
    (1, 'ONLINE', 'LOS', -32.00, 'Old log for purge test', datetime('now', '-10 days')),
    (1, 'LOS', 'ONLINE', -19.50, 'Recent log', CURRENT_TIMESTAMP)
");

$statsBefore = LogPurgeService::calculateStats($pdo);
assertTest("calculateStats returns positive total_rows", $statsBefore['total_rows'] >= 2);
assertTest("calculateStats calculates size in MB", is_float($statsBefore['size_mb']));

// Set retention to 7 days and run purgeExpired
$pdo->exec("UPDATE system_settings SET setting_value = '7' WHERE setting_key = 'temp_log_retention_days'");
$pdo->exec("UPDATE system_settings SET setting_value = '1' WHERE setting_key = 'temp_log_auto_delete_enabled'");

$purgedCount = LogPurgeService::purgeExpired($pdo);
assertTest("purgeExpired deletes logs older than 7 days", $purgedCount >= 1);

// Test purgeAll
$allPurged = LogPurgeService::purgeAll($pdo);
$statsAfter = LogPurgeService::calculateStats($pdo);
assertTest("purgeAll completely resets temporary logs table", $statsAfter['total_rows'] === 0);

echo "\n============================================\n";
echo "   Phase 3 Results: {$passed} Passed, {$failed} Failed\n";
echo "============================================\n";

if ($failed > 0) {
    exit(1);
}
