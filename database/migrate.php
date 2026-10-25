<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

echo "=== NMS-GIS ISP Database Migration Runner ===\n";

try {
    $driver = strtolower((string)env('DB_DRIVER', 'mysql'));
    $pdo = Database::getConnection();

    echo "[1/4] Connected to database using driver [{$driver}].\n";

    $schemaFile = ($driver === 'sqlite')
        ? __DIR__ . '/schema_sqlite.sql'
        : __DIR__ . '/schema_mysql.sql';

    if (!file_exists($schemaFile)) {
        throw new RuntimeException("Schema file not found: {$schemaFile}");
    }

    echo "[2/4] Executing schema DDL from " . basename($schemaFile) . "...\n";
    $sql = file_get_contents($schemaFile);
    $pdo->exec($sql);
    echo "      Schema created/verified successfully.\n";

    // 3. Seed Default Users
    echo "[3/4] Checking and seeding default users (Argon2id hashing)...\n";
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $userCount = (int)$stmt->fetchColumn();

    if ($userCount === 0) {
        $users = [
            [
                'name' => 'Super Administrator',
                'email' => 'admin@nms.isp',
                'password' => 'AdminPassword123!',
                'role' => 'super_admin'
            ],
            [
                'name' => 'NOC Operator',
                'email' => 'noc@nms.isp',
                'password' => 'NocPassword123!',
                'role' => 'noc'
            ],
            [
                'name' => 'Teknisi Lapangan 1',
                'email' => 'teknisi@nms.isp',
                'password' => 'TeknisiPassword123!',
                'role' => 'technician'
            ]
        ];

        $insertUser = $pdo->prepare("
            INSERT INTO users (name, email, password_hash, role, is_active)
            VALUES (:name, :email, :password_hash, :role, 1)
        ");

        foreach ($users as $u) {
            $hash = password_hash($u['password'], PASSWORD_ARGON2ID);
            $insertUser->execute([
                ':name' => $u['name'],
                ':email' => $u['email'],
                ':password_hash' => $hash,
                ':role' => $u['role']
            ]);
            echo "      - Created user: {$u['email']} (Role: {$u['role']})\n";
        }
    } else {
        echo "      Users already present ({$userCount} users).\n";
    }

    // 4. Seed Sample GIS Topology Data (POP -> ODC -> JB -> ODP -> Customers)
    echo "[4/4] Checking and seeding initial sample GIS nodes & cables...\n";
    $stmt = $pdo->query("SELECT COUNT(*) FROM gis_nodes");
    $nodeCount = (int)$stmt->fetchColumn();

    if ($nodeCount === 0) {
        $pdo->beginTransaction();

        // 1. POP
        $insertNode = $pdo->prepare("
            INSERT INTO gis_nodes (parent_node_id, node_code, node_name, node_type, latitude, longitude, input_method, port_capacity, address_note)
            VALUES (:parent_id, :code, :name, :type, :lat, :lng, :method, :capacity, :note)
        ");

        $insertNode->execute([
            ':parent_id' => null,
            ':code' => 'POP-SMG-CENTRAL',
            ':name' => 'POP Central Simpang Lima',
            ':type' => 'POP',
            ':lat' => -6.9902850,
            ':lng' => 110.4229100,
            ':method' => 'manual_latlong',
            ':capacity' => 144,
            ':note' => 'Ruang Server NOC Lantai 2'
        ]);
        $popId = (int)$pdo->lastInsertId();

        // 2. ODC-A
        $insertNode->execute([
            ':parent_id' => $popId,
            ':code' => 'ODC-SMG-01',
            ':name' => 'ODC Simpang Lima Tiang 1',
            ':type' => 'ODC',
            ':lat' => -6.9908000,
            ':lng' => 110.4232000,
            ':method' => 'map_marker',
            ':capacity' => 48,
            ':note' => 'Depan Pos Satpam Simpang Lima'
        ]);
        $odcId = (int)$pdo->lastInsertId();

        // 3. JB-01
        $insertNode->execute([
            ':parent_id' => $odcId,
            ':code' => 'JB-SMG-001',
            ':name' => 'Joint Box Simpang Lima 1',
            ':type' => 'JB',
            ':lat' => -6.9911200,
            ':lng' => 110.4235000,
            ':method' => 'gps',
            ':capacity' => 24,
            ':note' => 'Tiang beton samping trotoar, klem stainless'
        ]);
        $jbId = (int)$pdo->lastInsertId();

        // 4. ODP-01 & ODP-02
        $insertNode->execute([
            ':parent_id' => $jbId,
            ':code' => 'ODP-SMG-001',
            ':name' => 'ODP Simpang Lima Ruko A',
            ':type' => 'ODP',
            ':lat' => -6.9915000,
            ':lng' => 110.4241000,
            ':method' => 'map_marker',
            ':capacity' => 16,
            ':note' => 'Tiang besi deretan ruko nomor 3'
        ]);
        $odp1Id = (int)$pdo->lastInsertId();

        $insertNode->execute([
            ':parent_id' => $jbId,
            ':code' => 'ODP-SMG-002',
            ':name' => 'ODP Simpang Lima Ruko B',
            ':type' => 'ODP',
            ':lat' => -6.9918000,
            ':lng' => 110.4238000,
            ':method' => 'map_marker',
            ':capacity' => 16,
            ':note' => 'Tiang PLN depan ruko bank'
        ]);
        $odp2Id = (int)$pdo->lastInsertId();

        // 5. Customer Nodes
        $insertNode->execute([
            ':parent_id' => $odp1Id,
            ':code' => 'CUST-001',
            ':name' => 'Pelanggan: Budi Santoso',
            ':type' => 'CUSTOMER',
            ':lat' => -6.9916500,
            ':lng' => 110.4243500,
            ':method' => 'gps',
            ':capacity' => 0,
            ':note' => 'Ruko No. 5 Lantai 1'
        ]);
        $cust1Id = (int)$pdo->lastInsertId();

        $insertNode->execute([
            ':parent_id' => $odp1Id,
            ':code' => 'CUST-002',
            ':name' => 'Pelanggan: Toko Makmur',
            ':type' => 'CUSTOMER',
            ':lat' => -6.9914200,
            ':lng' => 110.4242100,
            ':method' => 'map_marker',
            ':capacity' => 0,
            ':note' => 'Ruko No. 2'
        ]);
        $cust2Id = (int)$pdo->lastInsertId();

        // 6. Device Current Status
        $insertStatus = $pdo->prepare("
            INSERT INTO device_current_status (node_id, onu_interface, onu_sn, pppoe_username, pppoe_ip, connection_status, rx_power_dbm, tx_power_dbm, last_checked_at)
            VALUES (:node_id, :onu_if, :sn, :username, :ip, :status, :rx, :tx, CURRENT_TIMESTAMP)
        ");

        $insertStatus->execute([
            ':node_id' => $cust1Id,
            ':onu_if' => 'gpon-onu_1/1/1:1',
            ':sn' => 'ZTEGC1234567',
            ':username' => 'budi_santoso',
            ':ip' => '10.10.20.15',
            ':status' => 'ONLINE',
            ':rx' => -19.45,
            ':tx' => 2.15
        ]);

        $insertStatus->execute([
            ':node_id' => $cust2Id,
            ':onu_if' => 'gpon-onu_1/1/1:2',
            ':sn' => 'ZTEGC7654321',
            ':username' => 'toko_makmur',
            ':ip' => '10.10.20.16',
            ':status' => 'ONLINE',
            ':rx' => -20.12,
            ':tx' => 2.20
        ]);

        // 7. Cables (Polylines)
        $insertCable = $pdo->prepare("
            INSERT INTO gis_cables (cable_code, cable_type, core_count, start_node_id, end_node_id, waypoints_json, length_meters, current_visual_status)
            VALUES (:code, :type, :cores, :start_id, :end_id, :waypoints, :length, :status)
        ");

        // Feeder POP -> ODC
        $insertCable->execute([
            ':code' => 'CBL-FDR-POP-ODC01',
            ':type' => 'feeder',
            ':cores' => 48,
            ':start_id' => $popId,
            ':end_id' => $odcId,
            ':waypoints' => json_encode([
                [-6.9902850, 110.4229100],
                [-6.9905500, 110.4230500],
                [-6.9908000, 110.4232000]
            ]),
            ':length' => 75.50,
            ':status' => 'normal'
        ]);

        // Distribution ODC -> JB01
        $insertCable->execute([
            ':code' => 'CBL-DIST-ODC01-JB01',
            ':type' => 'distribution',
            ':cores' => 24,
            ':start_id' => $odcId,
            ':end_id' => $jbId,
            ':waypoints' => json_encode([
                [-6.9908000, 110.4232000],
                [-6.9910000, 110.4233500],
                [-6.9911200, 110.4235000]
            ]),
            ':length' => 48.20,
            ':status' => 'normal'
        ]);

        // Distribution JB01 -> ODP01
        $insertCable->execute([
            ':code' => 'CBL-DIST-JB01-ODP01',
            ':type' => 'distribution',
            ':cores' => 12,
            ':start_id' => $jbId,
            ':end_id' => $odp1Id,
            ':waypoints' => json_encode([
                [-6.9911200, 110.4235000],
                [-6.9913100, 110.4238200],
                [-6.9915000, 110.4241000]
            ]),
            ':length' => 62.10,
            ':status' => 'normal'
        ]);

        // Drop Core ODP01 -> CUST01
        $insertCable->execute([
            ':code' => 'CBL-DROP-ODP01-CUST01',
            ':type' => 'drop_core',
            ':cores' => 1,
            ':start_id' => $odp1Id,
            ':end_id' => $cust1Id,
            ':waypoints' => json_encode([
                [-6.9915000, 110.4241000],
                [-6.9916500, 110.4243500]
            ]),
            ':length' => 25.00,
            ':status' => 'normal'
        ]);

        $pdo->commit();
        echo "      Successfully seeded sample GIS topology and device status.\n";
    } else {
        echo "      GIS nodes already present ({$nodeCount} nodes).\n";
    }

    echo "=== Migration & Seeding Completed Successfully! ===\n";

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "ERROR during migration: " . $e->getMessage() . "\n";
    exit(1);
}
