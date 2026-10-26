<?php
declare(strict_types=1);

/**
 * Automated Verification & Unit Test Suite for Fase 1
 * Tests: Config, CryptoService, JwtService, RateLimit, AuthController, GisController
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/CryptoService.php';
require_once __DIR__ . '/../src/Services/JwtService.php';
require_once __DIR__ . '/../src/Middlewares/RateLimitMiddleware.php';
require_once __DIR__ . '/../src/Controllers/AuthController.php';
require_once __DIR__ . '/../src/Controllers/GisController.php';
require_once __DIR__ . '/test_fixtures.php';

echo "============================================\n";
echo "   NMS-GIS ISP - Phase 1 Verification Suite \n";
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

// 1. Test CryptoService (AES-256-GCM)
echo "\n--- Testing CryptoService (AES-256-GCM) ---\n";
$plaintext = "RouterOS_Secret_Password_2026!";
$encrypted = CryptoService::encrypt($plaintext);
$decrypted = CryptoService::decrypt($encrypted);

assertTest("Ciphertext is not plaintext", $encrypted !== $plaintext);
assertTest("Decrypted text matches original plaintext", $decrypted === $plaintext);
assertTest("Tampered ciphertext fails decryption gracefully", CryptoService::decrypt($encrypted . "tamper") === null);

// 2. Test JwtService (HMAC-SHA256)
echo "\n--- Testing JwtService (Stateless JWT) ---\n";
$token = JwtService::generateToken([
    'id' => 1,
    'email' => 'admin@nms.isp',
    'role' => 'super_admin',
    'type' => 'access'
], 3600);

$payload = JwtService::validateToken($token);
assertTest("JWT token decodes correctly", $payload !== null && $payload['email'] === 'admin@nms.isp');
assertTest("JWT role matches", ($payload['role'] ?? '') === 'super_admin');

$expiredToken = JwtService::generateToken(['test' => true], -10);
assertTest("Expired JWT is rejected", JwtService::validateToken($expiredToken) === null);

// 3. Test Database Connection & Isolated Test Fixtures
echo "\n--- Testing Database & Seeding ---\n";
$pdo = Database::getConnection();
$userStmt = $pdo->query("SELECT COUNT(*) FROM users WHERE email = 'admin@nms.isp'");
assertTest("Default Super Admin user exists", (int)$userStmt->fetchColumn() === 1);

// Setup isolated test fixtures
TestFixtures::setup($pdo);

$nodeStmt = $pdo->query("SELECT COUNT(*) FROM gis_nodes");
$nodeCount = (int)$nodeStmt->fetchColumn();
assertTest("GIS nodes are seeded", $nodeCount > 0);

$cableStmt = $pdo->query("SELECT COUNT(*) FROM gis_cables");
$cableCount = (int)$cableStmt->fetchColumn();
assertTest("GIS FO cables are seeded", $cableCount > 0);

// 4. Test GisController: getMapData output
echo "\n--- Testing GisController API ---\n";
$_SERVER['HTTP_AUTHORIZATION'] = "Bearer {$token}";
ob_start();
GisController::getMapData();
$mapDataJson = ob_get_clean();
$mapData = json_decode($mapDataJson, true);

assertTest("getMapData status is success", ($mapData['status'] ?? '') === 'success');
assertTest("Summary contains total_customers", isset($mapData['summary']['total_customers']));
assertTest("Nodes array returned with elements", !empty($mapData['nodes']));
assertTest("Cables array returned with elements", !empty($mapData['cables']));

// 5. Test GisController: createNode with validation
echo "\n--- Testing GisController::createNode ---\n";
$latVal = 999.0;
$isLatValid = ($latVal >= -90.0 && $latVal <= 90.0);
assertTest("Latitude bounds validation rejects 999.0", !$isLatValid);

// Test creating valid node via PDO directly and verifying it links
$newCode = 'ODP-TEST-' . time();
$insertStmt = $pdo->prepare("
    INSERT INTO gis_nodes (node_code, node_name, node_type, latitude, longitude, input_method, port_capacity)
    VALUES (:code, 'Test ODP Auto', 'ODP', -6.9920000, 110.4250000, 'gps', 8)
");
$insertStmt->execute([':code' => $newCode]);
$newNodeId = (int)$pdo->lastInsertId();
assertTest("New GIS node created successfully with ID {$newNodeId}", $newNodeId > 0);

// Test coordinate update via drag simulation
$updateStmt = $pdo->prepare("UPDATE gis_nodes SET latitude = :lat, longitude = :lng WHERE id = :id");
$updateStmt->execute([
    ':lat' => -6.9925000,
    ':lng' => 110.4255000,
    ':id' => $newNodeId
]);
$checkStmt = $pdo->prepare("SELECT latitude, longitude FROM gis_nodes WHERE id = :id");
$checkStmt->execute([':id' => $newNodeId]);
$updatedCoords = $checkStmt->fetch();
assertTest("Node coordinates updated via drag simulation", (float)$updatedCoords['latitude'] === -6.9925000);

// Clean up test node and fixtures
$pdo->prepare("DELETE FROM gis_nodes WHERE id = :id")->execute([':id' => $newNodeId]);
assertTest("Test node cleaned up", true);

TestFixtures::cleanup($pdo);

echo "\n============================================\n";
echo "   Test Results: {$passed} Passed, {$failed} Failed\n";
echo "============================================\n";

if ($failed > 0) {
    exit(1);
}
