<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/CryptoService.php';

echo "=== NMS-GIS ISP Database Migration Runner ===\n";

try {
    $driver = strtolower((string)env('DB_DRIVER', 'mysql'));
    $pdo = Database::getConnection();

    echo "[1/3] Connected to database using driver [{$driver}].\n";

    $schemaFile = ($driver === 'sqlite')
        ? __DIR__ . '/schema_sqlite.sql'
        : __DIR__ . '/schema_mysql.sql';

    if (!file_exists($schemaFile)) {
        throw new RuntimeException("Schema file not found: {$schemaFile}");
    }

    echo "[2/3] Executing schema DDL from " . basename($schemaFile) . "...\n";
    $sql = file_get_contents($schemaFile);
    $pdo->exec($sql);
    echo "      Schema created/verified successfully.\n";

    // 3. Seed Default Super Admin User (Essential for login, not dummy data)
    echo "[3/3] Checking and seeding default Super Admin user (Argon2id hashing)...\n";
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $userCount = (int)$stmt->fetchColumn();

    if ($userCount === 0) {
        $insertUser = $pdo->prepare("
            INSERT INTO users (name, email, password_hash, role, is_active)
            VALUES (:name, :email, :password_hash, :role, 1)
        ");

        $superAdminPass = password_hash('AdminPassword123!', PASSWORD_ARGON2ID);
        $insertUser->execute([
            ':name' => 'Super Administrator',
            ':email' => 'admin@nms.isp',
            ':password_hash' => $superAdminPass,
            ':role' => 'super_admin'
        ]);
        echo "      Created Super Admin account: admin@nms.isp\n";
    } else {
        echo "      Users already present ({$userCount} users).\n";
    }

    // Clean existing dummy nodes/cables/devices if requested or if flag --clean-dummy
    if (in_array('--clean-dummy', $argv ?? [])) {
        echo "  -> Purging dummy GIS and device data...\n";
        $pdo->exec("DELETE FROM gis_cables");
        $pdo->exec("DELETE FROM device_current_status");
        $pdo->exec("DELETE FROM gis_nodes");
        $pdo->exec("DELETE FROM network_devices");
        $pdo->exec("DELETE FROM monitoring_temp_logs");
        echo "      Successfully purged dummy data.\n";
    }

    echo "=== Migration Completed Successfully (Zero Dummy Data) ===\n";

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "ERROR during migration: " . $e->getMessage() . "\n";
    exit(1);
}
