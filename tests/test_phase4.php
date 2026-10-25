<?php
/**
 * NMS-GIS ISP - Phase 4 Master Hardening & End-to-End Verification Suite
 * Validates Security Audits, Zero-Shell Compliance, Full API Lifecycle, and System Health.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/CryptoService.php';
require_once __DIR__ . '/../src/Services/JwtService.php';
require_once __DIR__ . '/../src/Services/FaultAnalyzerService.php';
require_once __DIR__ . '/../src/Services/LogPurgeService.php';
require_once __DIR__ . '/../src/Adapters/DeviceAdapterInterface.php';
require_once __DIR__ . '/../src/Adapters/MikrotikRosAdapter.php';
require_once __DIR__ . '/../src/Adapters/ZteOltAdapter.php';
require_once __DIR__ . '/../src/Adapters/GenericSnmpAdapter.php';
require_once __DIR__ . '/../src/Controllers/AuthController.php';
require_once __DIR__ . '/../src/Controllers/GisController.php';
require_once __DIR__ . '/../src/Controllers/DeviceController.php';
require_once __DIR__ . '/../src/Controllers/MonitoringController.php';
require_once __DIR__ . '/../workers/poller_worker.php';

$pdo = Database::getConnection();
$passed = 0;
$failed = 0;

function assertCheck(string $desc, bool $condition): void {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

echo "========================================================\n";
echo "   NMS-GIS ISP - Phase 4 Master Hardening & E2E Suite   \n";
echo "========================================================\n\n";

// -----------------------------------------------------------------------------
// 1. Zero-Shell Execution Policy & Codebase Security Audit
// -----------------------------------------------------------------------------
echo "--- 1. Testing Zero-Shell Execution & Hardening Audit ---\n";

$phpFiles = [];
$dirs = [__DIR__ . '/../src', __DIR__ . '/../config', __DIR__ . '/../public', __DIR__ . '/../workers'];
foreach ($dirs as $dir) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $phpFiles[] = $file->getPathname();
        }
    }
}

$forbiddenPatterns = ['/\bshell_exec\s*\(/i', '/\bsystem\s*\(/i', '/\bpassthru\s*\(/i', '/\bproc_open\s*\(/i', '/\bpopen\s*\(/i', '/\beval\s*\(/i'];
$violations = [];

foreach ($phpFiles as $file) {
    $content = file_get_contents($file);
    foreach ($forbiddenPatterns as $pat) {
        if (preg_match($pat, $content)) {
            $violations[] = basename($file) . " matched " . $pat;
        }
    }
    // Check exec() specifically while ignoring $pdo->exec()
    if (preg_match('/(?<!->)\bexec\s*\(/i', $content)) {
        $violations[] = basename($file) . " matched standalone exec()";
    }
}

assertCheck("Zero-Shell Policy: No forbidden system shell calls found in " . count($phpFiles) . " PHP files", count($violations) === 0);

// Check CVE-2024-4577 mitigation in .htaccess
$htaccess = file_get_contents(__DIR__ . '/../public/.htaccess');
assertCheck("public/.htaccess contains CVE-2024-4577 / PHP2Shell argument injection block", str_contains($htaccess, 'CVE-2024-4577') && str_contains($htaccess, '%ad'));

// Check XSS Sanitization in GisMap.jsx
$gisMapJsx = file_get_contents(__DIR__ . '/../frontend/src/components/GisMap.jsx');
assertCheck("frontend/src/components/GisMap.jsx uses escapeHtml for node popups", str_contains($gisMapJsx, 'escapeHtml(node.node_name)'));

// Check Nginx example hardening
$nginxConf = file_get_contents(__DIR__ . '/../nginx.conf.example');
assertCheck("nginx.conf.example contains query string hardening and fastcgi proxy protection", str_contains($nginxConf, 'CVE-2024-4577') && str_contains($nginxConf, 'HTTP_PROXY'));

// -----------------------------------------------------------------------------
// 2. Cryptographic Security & Stateless JWT
// -----------------------------------------------------------------------------
echo "\n--- 2. Testing Cryptography & Authentication Security ---\n";

$secretData = "super_sensitive_olt_snmp_community_v2c";
$encrypted = CryptoService::encrypt($secretData);
$rawDecoded = base64_decode($encrypted, true);
assertCheck("CryptoService: Ciphertext uses AES-256-GCM format (IV 12B + Tag 16B + Ciphertext)", $rawDecoded !== false && strlen($rawDecoded) > 28);
assertCheck("CryptoService: Decrypted matches original community", CryptoService::decrypt($encrypted) === $secretData);

$token = JwtService::generateToken(['sub' => 1, 'role' => 'super_admin'], 3600);
$payload = JwtService::validateToken($token);
assertCheck("JwtService: Generated token validates successfully", $payload !== null && $payload['sub'] === 1);
assertCheck("JwtService: Payload role is super_admin", ($payload['role'] ?? '') === 'super_admin');

// -----------------------------------------------------------------------------
// 3. Multi-Vendor Hardware Adapters
// -----------------------------------------------------------------------------
echo "\n--- 3. Testing Multi-Vendor Adapters & Metric Converters ---\n";

$zteAdapter = new ZteOltAdapter();
$connected = $zteAdapter->connect(['ip_address' => '127.0.0.1', 'snmp_community' => 'public']);
assertCheck("ZteOltAdapter: Socket/UDP connection initializes", $connected === true);

$testResult = $zteAdapter->testConnection();
assertCheck("ZteOltAdapter: Connection test simulation returns success", ($testResult['success'] ?? false) === true);

$opm = $zteAdapter->getOpticalPower('1');
assertCheck("ZteOltAdapter: Optical power returns valid dBm reading", is_array($opm) && isset($opm['rx_power_dbm']));

$mikrotikAdapter = new MikrotikRosAdapter();
assertCheck("MikrotikRosAdapter: Binary socket driver initializes", $mikrotikAdapter instanceof DeviceAdapterInterface);

// -----------------------------------------------------------------------------
// 4. Background Poller Engine Cycle
// -----------------------------------------------------------------------------
echo "\n--- 4. Testing Background Poller Engine Execution ---\n";

$pollerStats = PollerEngine::runCycle($pdo);
assertCheck("PollerEngine: Cycle executed cleanly with total devices polled", ($pollerStats['devices_polled'] ?? 0) > 0);
assertCheck("PollerEngine: Cycle ran with 0 unhandled fatal errors", count($pollerStats['errors'] ?? []) === 0);

// -----------------------------------------------------------------------------
// 5. Smart Fault Localization Engine
// -----------------------------------------------------------------------------
echo "\n--- 5. Testing Smart Fault Localization Engine ---\n";

// Reset baseline
$pdo->exec("UPDATE device_current_status SET connection_status = 'ONLINE', rx_power_dbm = -19.50");
$pdo->exec("UPDATE gis_cables SET current_visual_status = 'normal'");

// Trigger Skenario: 1 customer LOS (Individual Drop Cut)
$custs = $pdo->query("
    SELECT n.id, n.node_code 
    FROM gis_nodes n 
    JOIN gis_nodes p ON n.parent_node_id = p.id 
    WHERE n.node_type = 'CUSTOMER' AND p.node_code = 'ODP-SMG-001'
    LIMIT 2
")->fetchAll();

if (count($custs) >= 2) {
    $pdo->prepare("UPDATE device_current_status SET connection_status = 'LOS', rx_power_dbm = -35.00 WHERE node_id = :id")
        ->execute([':id' => $custs[0]['id']]);
    $pdo->prepare("UPDATE device_current_status SET connection_status = 'ONLINE', rx_power_dbm = -19.50 WHERE node_id = :id")
        ->execute([':id' => $custs[1]['id']]);

    $analysis1 = FaultAnalyzerService::analyze($pdo);
    assertCheck("FaultAnalyzer: Single customer LOS classifies as INDIVIDUAL_DROP_CUT", count($analysis1['suspected_fiber_cuts']) === 1 && $analysis1['suspected_fiber_cuts'][0]['fault_type'] === 'INDIVIDUAL_DROP_CUT');
} else {
    assertCheck("FaultAnalyzer: Single customer LOS classifies as INDIVIDUAL_DROP_CUT (customers found)", false);
}

// Trigger Skenario: ODP Distribution Cut (all customers under ODP-SMG-001 LOS)
$pdo->exec("UPDATE device_current_status SET connection_status = 'LOS', rx_power_dbm = -35.00");
$analysis2 = FaultAnalyzerService::analyze($pdo);
$hasOdpCut = false;
foreach ($analysis2['suspected_fiber_cuts'] as $cut) {
    if ($cut['fault_type'] === 'ODP_DISTRIBUTION_CUT') {
        $hasOdpCut = true;
        break;
    }
}
assertCheck("FaultAnalyzer: >=80% customers LOS under ODP triggers ODP_DISTRIBUTION_CUT", $hasOdpCut);

// Reset back to normal
$pdo->exec("UPDATE device_current_status SET connection_status = 'ONLINE', rx_power_dbm = -19.50");
$pdo->exec("UPDATE gis_cables SET current_visual_status = 'normal'");

// -----------------------------------------------------------------------------
// 6. Log Retention & Auto-Purge Service
// -----------------------------------------------------------------------------
echo "\n--- 6. Testing Log Retention & Auto-Purge Service ---\n";

$statsBefore = LogPurgeService::calculateStats($pdo);
assertCheck("LogPurgeService: Returns valid storage metrics and retention days", $statsBefore['retention_days'] > 0);

// Insert dummy expired log
$pastDate = date('Y-m-d H:i:s', time() - (30 * 86400));
$pdo->exec("INSERT INTO monitoring_temp_logs (node_id, previous_status, new_status, rx_power_dbm, fault_note, created_at) VALUES (1, 'ONLINE', 'LOS', -35.00, 'Test Expired Log', '{$pastDate}')");
$purgedCount = LogPurgeService::purgeExpired($pdo);
assertCheck("LogPurgeService: purgeExpired deletes logs older than retention period", $purgedCount >= 1);

echo "\n========================================================\n";
echo "   Master Test Results: {$passed} Passed, {$failed} Failed\n";
echo "========================================================\n";

if ($failed > 0) {
    exit(1);
}
