<?php
declare(strict_types=1);

/**
 * Automated Verification & Unit Test Suite for Fase 3
 * Tests: Smart Fault Localization (Topological Tree Correlation) & Temporary Log Auto-Purge
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/CryptoService.php';
require_once __DIR__ . '/../src/Services/FaultAnalyzerService.php';
require_once __DIR__ . '/../src/Services/LogPurgeService.php';
require_once __DIR__ . '/test_fixtures.php';

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
TestFixtures::setup($pdo);

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
}

// -----------------------------------------------------------------------------
// 3. Test FaultAnalyzerService: Skenario 2 - Kabel Distribusi Putus (ODP Cut)
// -----------------------------------------------------------------------------
echo "\n--- 3. Testing FaultAnalyzerService: Skenario 2 (ODP Distribution Cut) ---\n";
// Set SEMUA pelanggan di ODP-SMG-001 menjadi LOS (100% >= 80%)
foreach ($custs as $c) {
    $pdo->prepare("UPDATE device_current_status SET connection_status = 'LOS', rx_power_dbm = -35.00 WHERE node_id = :id")
        ->execute([':id' => $c['id']]);
}

$analysisOdp = FaultAnalyzerService::analyze($pdo);
$cutsOdp = $analysisOdp['suspected_fiber_cuts'];

$hasOdpCut = false;
foreach ($cutsOdp as $cut) {
    if ($cut['fault_type'] === 'ODP_DISTRIBUTION_CUT') {
        $hasOdpCut = true;
        assertTest("ODP distribution cut points to ODP-SMG-001", $cut['to_node'] === 'ODP-SMG-001');
        assertTest("ODP cut reports 2 affected customers", $cut['affected_customers_count'] === 2);
        break;
    }
}
assertTest("ODP distribution cut detected when >= 80% customers LOS", $hasOdpCut);

// Verify DB cable status updated to cut_suspected
$cblCheck = $pdo->query("SELECT current_visual_status FROM gis_cables WHERE cable_code = 'CBL-DIST-JB01-ODP01'")->fetchColumn();
assertTest("Distribution cable marked as cut_suspected in DB", $cblCheck === 'cut_suspected');

// -----------------------------------------------------------------------------
// 4. Test FaultAnalyzerService: Skenario 3 - Kabel Backbone/Feeder Putus
// -----------------------------------------------------------------------------
echo "\n--- 4. Testing FaultAnalyzerService: Skenario 3 (Backbone Feeder Cut) ---\n";
// Matikan SELURUH status pelanggan di seluruh cabang (Simulasi Feeder/Backbone Putus)
$pdo->exec("UPDATE device_current_status SET connection_status = 'LOS', rx_power_dbm = -35.00");

$analysisBackbone = FaultAnalyzerService::analyze($pdo);
$cutsBackbone = $analysisBackbone['suspected_fiber_cuts'];

$hasBackboneCut = false;
foreach ($cutsBackbone as $cut) {
    if ($cut['fault_type'] === 'BACKBONE_FEEDER_CUT') {
        $hasBackboneCut = true;
        assertTest("Backbone cut points to dead Joint Box {$cut['to_node']}", $cut['to_node'] === 'JB-SMG-001');
        assertTest("Upward traversal found healthy ancestor {$cut['from_node']}", $cut['from_node'] === 'ODC-SMG-01');
        break;
    }
}
assertTest("Backbone / Feeder cut identified via upward tree traversal", $hasBackboneCut);

// -----------------------------------------------------------------------------
// 5. Test LogPurgeService
// -----------------------------------------------------------------------------
echo "\n--- 5. Testing LogPurgeService ---\n";
// Reset database status
$pdo->exec("UPDATE device_current_status SET connection_status = 'ONLINE', rx_power_dbm = -19.50");
$pdo->exec("UPDATE gis_cables SET current_visual_status = 'normal'");

// Insert dummy log entries: 5 normal logs, 5 expired logs (> 7 days ago)
$pastDate = date('Y-m-d H:i:s', time() - (10 * 86400)); // 10 days ago
$recentDate = date('Y-m-d H:i:s', time() - (2 * 86400)); // 2 days ago

for ($i = 1; $i <= 5; $i++) {
    $pdo->exec("
        INSERT INTO monitoring_temp_logs (node_id, previous_status, new_status, rx_power_dbm, fault_note, created_at)
        VALUES (1, 'ONLINE', 'LOS', -32.50, 'Expired test log {$i}', '{$pastDate}')
    ");
    $pdo->exec("
        INSERT INTO monitoring_temp_logs (node_id, previous_status, new_status, rx_power_dbm, fault_note, created_at)
        VALUES (1, 'LOS', 'ONLINE', -19.50, 'Recent test log {$i}', '{$recentDate}')
    ");
}

$statsBefore = LogPurgeService::calculateStats($pdo);
assertTest("calculateStats returns positive total_rows", $statsBefore['total_rows'] >= 10);
assertTest("calculateStats calculates size in MB", isset($statsBefore['size_mb']));

// Test purgeExpired (Retention = 7 days)
$pdo->exec("UPDATE system_settings SET setting_value = '7' WHERE setting_key = 'temp_log_retention_days'");
$pdo->exec("UPDATE system_settings SET setting_value = '1' WHERE setting_key = 'temp_log_auto_delete_enabled'");

$purgedCount = LogPurgeService::purgeExpired($pdo);
assertTest("purgeExpired deletes logs older than 7 days", $purgedCount >= 1);

// Test purgeAll
$allPurged = LogPurgeService::purgeAll($pdo);
$statsAfter = LogPurgeService::calculateStats($pdo);
assertTest("purgeAll completely resets temporary logs table", $statsAfter['total_rows'] === 0);

TestFixtures::cleanup($pdo);

echo "\n============================================\n";
echo "   Phase 3 Results: {$passed} Passed, {$failed} Failed\n";
echo "============================================\n";

if ($failed > 0) {
    exit(1);
}
