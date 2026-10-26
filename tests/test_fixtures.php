<?php
/**
 * Test Fixtures Helper for Automated Test Suites
 * Safely creates and tears down isolated test topologies without polluting production data.
 */

declare(strict_types=1);

final class TestFixtures
{
    public static function setup(PDO $pdo): array
    {
        self::cleanup($pdo);

        // 1. POP
        $insertNode = $pdo->prepare("
            INSERT INTO gis_nodes (parent_node_id, node_code, node_name, node_type, latitude, longitude, input_method, port_capacity, address_note)
            VALUES (:parent_id, :code, :name, :type, :lat, :lng, :method, :capacity, :note)
        ");

        $insertNode->execute([
            ':parent_id' => null,
            ':code' => 'POP-TEST-CENTRAL',
            ':name' => 'POP Test Central',
            ':type' => 'POP',
            ':lat' => -6.9902850,
            ':lng' => 110.4229100,
            ':method' => 'manual_latlong',
            ':capacity' => 144,
            ':note' => 'Ruang Server NOC'
        ]);
        $popId = (int)$pdo->lastInsertId();

        // 2. ODC
        $insertNode->execute([
            ':parent_id' => $popId,
            ':code' => 'ODC-SMG-01',
            ':name' => 'ODC Test Tiang 1',
            ':type' => 'ODC',
            ':lat' => -6.9908000,
            ':lng' => 110.4232000,
            ':method' => 'map_marker',
            ':capacity' => 48,
            ':note' => 'Depan Pos Satpam'
        ]);
        $odcId = (int)$pdo->lastInsertId();

        // 3. JB
        $insertNode->execute([
            ':parent_id' => $odcId,
            ':code' => 'JB-SMG-001',
            ':name' => 'Joint Box Test 1',
            ':type' => 'JB',
            ':lat' => -6.9911200,
            ':lng' => 110.4235000,
            ':method' => 'gps',
            ':capacity' => 24,
            ':note' => 'Tiang beton'
        ]);
        $jbId = (int)$pdo->lastInsertId();

        // 4. ODP 1 & ODP 2
        $insertNode->execute([
            ':parent_id' => $jbId,
            ':code' => 'ODP-SMG-001',
            ':name' => 'ODP Test Ruko A',
            ':type' => 'ODP',
            ':lat' => -6.9915000,
            ':lng' => 110.4241000,
            ':method' => 'map_marker',
            ':capacity' => 16,
            ':note' => 'Tiang besi deretan ruko'
        ]);
        $odp1Id = (int)$pdo->lastInsertId();

        $insertNode->execute([
            ':parent_id' => $jbId,
            ':code' => 'ODP-SMG-002',
            ':name' => 'ODP Test Ruko B',
            ':type' => 'ODP',
            ':lat' => -6.9918000,
            ':lng' => 110.4238000,
            ':method' => 'map_marker',
            ':capacity' => 16,
            ':note' => 'Tiang PLN depan ruko bank'
        ]);
        $odp2Id = (int)$pdo->lastInsertId();

        // 5. Customers
        $insertNode->execute([
            ':parent_id' => $odp1Id,
            ':code' => 'CUST-001',
            ':name' => 'Pelanggan Test 1',
            ':type' => 'CUSTOMER',
            ':lat' => -6.9916500,
            ':lng' => 110.4243500,
            ':method' => 'gps',
            ':capacity' => 0,
            ':note' => 'Ruko No. 5'
        ]);
        $cust1Id = (int)$pdo->lastInsertId();

        $insertNode->execute([
            ':parent_id' => $odp1Id,
            ':code' => 'CUST-002',
            ':name' => 'Pelanggan Test 2',
            ':type' => 'CUSTOMER',
            ':lat' => -6.9914200,
            ':lng' => 110.4242100,
            ':method' => 'map_marker',
            ':capacity' => 0,
            ':note' => 'Ruko No. 2'
        ]);
        $cust2Id = (int)$pdo->lastInsertId();

        $insertNode->execute([
            ':parent_id' => $odp2Id,
            ':code' => 'CUST-003',
            ':name' => 'Pelanggan Test 3',
            ':type' => 'CUSTOMER',
            ':lat' => -6.9919500,
            ':lng' => 110.4240000,
            ':method' => 'map_marker',
            ':capacity' => 0,
            ':note' => 'Ruko No. 8'
        ]);
        $cust3Id = (int)$pdo->lastInsertId();

        // Status
        $insertStatus = $pdo->prepare("
            INSERT INTO device_current_status (node_id, onu_interface, onu_sn, pppoe_username, pppoe_ip, connection_status, rx_power_dbm, tx_power_dbm, last_checked_at)
            VALUES (:node_id, :onu_if, :sn, :username, :ip, :status, :rx, :tx, CURRENT_TIMESTAMP)
        ");

        $insertStatus->execute([
            ':node_id' => $cust1Id,
            ':onu_if' => 'gpon-onu_1/1/1:1',
            ':sn' => 'ZTEGC1234567',
            ':username' => 'test_user_1',
            ':ip' => '10.10.20.15',
            ':status' => 'ONLINE',
            ':rx' => -19.45,
            ':tx' => 2.15
        ]);

        $insertStatus->execute([
            ':node_id' => $cust2Id,
            ':onu_if' => 'gpon-onu_1/1/1:2',
            ':sn' => 'ZTEGC7654321',
            ':username' => 'test_user_2',
            ':ip' => '10.10.20.16',
            ':status' => 'ONLINE',
            ':rx' => -20.12,
            ':tx' => 2.20
        ]);

        $insertStatus->execute([
            ':node_id' => $cust3Id,
            ':onu_if' => 'gpon-onu_1/1/1:3',
            ':sn' => 'ZTEGC9988776',
            ':username' => 'test_user_3',
            ':ip' => '10.10.20.17',
            ':status' => 'ONLINE',
            ':rx' => -21.05,
            ':tx' => 2.10
        ]);

        // Cables
        $insertCable = $pdo->prepare("
            INSERT INTO gis_cables (cable_code, cable_type, core_count, start_node_id, end_node_id, waypoints_json, length_meters, current_visual_status)
            VALUES (:code, :type, :cores, :start_id, :end_id, :waypoints, :length, :status)
        ");

        $insertCable->execute([
            ':code' => 'CBL-FDR-POP-ODC01',
            ':type' => 'feeder',
            ':cores' => 48,
            ':start_id' => $popId,
            ':end_id' => $odcId,
            ':waypoints' => json_encode([[-6.9902850, 110.4229100], [-6.9908000, 110.4232000]]),
            ':length' => 75.50,
            ':status' => 'normal'
        ]);

        $insertCable->execute([
            ':code' => 'CBL-DIST-ODC01-JB01',
            ':type' => 'distribution',
            ':cores' => 24,
            ':start_id' => $odcId,
            ':end_id' => $jbId,
            ':waypoints' => json_encode([[-6.9908000, 110.4232000], [-6.9911200, 110.4235000]]),
            ':length' => 48.20,
            ':status' => 'normal'
        ]);

        $insertCable->execute([
            ':code' => 'CBL-DIST-JB01-ODP01',
            ':type' => 'distribution',
            ':cores' => 12,
            ':start_id' => $jbId,
            ':end_id' => $odp1Id,
            ':waypoints' => json_encode([[-6.9911200, 110.4235000], [-6.9915000, 110.4241000]]),
            ':length' => 62.10,
            ':status' => 'normal'
        ]);

        $insertCable->execute([
            ':code' => 'CBL-DIST-JB01-ODP02',
            ':type' => 'distribution',
            ':cores' => 12,
            ':start_id' => $jbId,
            ':end_id' => $odp2Id,
            ':waypoints' => json_encode([[-6.9911200, 110.4235000], [-6.9918000, 110.4238000]]),
            ':length' => 55.00,
            ':status' => 'normal'
        ]);

        $insertCable->execute([
            ':code' => 'CBL-DROP-ODP01-CUST01',
            ':type' => 'drop_core',
            ':cores' => 1,
            ':start_id' => $odp1Id,
            ':end_id' => $cust1Id,
            ':waypoints' => json_encode([[-6.9915000, 110.4241000], [-6.9916500, 110.4243500]]),
            ':length' => 25.00,
            ':status' => 'normal'
        ]);

        // Default test device
        $commEnc = CryptoService::encrypt('public');
        $passEnc = CryptoService::encrypt('admin123');
        $pdo->prepare("
            INSERT INTO network_devices (
                device_name, device_type, vendor_driver, ip_address, 
                api_port, snmp_port, username_enc, password_enc, snmp_community_enc, is_online
            ) VALUES (
                'TEST-OLT-ZTE-01', 'olt', 'zte_c320', '127.0.0.1', 
                8728, 161, null, :pass, :comm, 1
            )
        ")->execute([':pass' => $passEnc, ':comm' => $commEnc]);

        return [
            'pop_id' => $popId,
            'odc_id' => $odcId,
            'jb_id' => $jbId,
            'odp1_id' => $odp1Id,
            'odp2_id' => $odp2Id,
            'cust1_id' => $cust1Id,
            'cust2_id' => $cust2Id,
            'cust3_id' => $cust3Id
        ];
    }

    public static function cleanup(PDO $pdo): void
    {
        $pdo->exec("DELETE FROM gis_cables WHERE cable_code LIKE 'CBL-%'");
        $pdo->exec("DELETE FROM device_current_status WHERE onu_sn IN ('ZTEGC1234567', 'ZTEGC7654321', 'ZTEGC9988776')");
        $pdo->exec("DELETE FROM gis_nodes WHERE node_code IN ('POP-TEST-CENTRAL', 'POP-SMG-CENTRAL', 'ODC-SMG-01', 'JB-SMG-001', 'ODP-SMG-001', 'ODP-SMG-002', 'CUST-001', 'CUST-002', 'CUST-003') OR node_code LIKE 'ODP-TEST-%'");
        $pdo->exec("DELETE FROM network_devices WHERE device_name IN ('TEST-OLT-ZTE-01', 'OLT-ZTE-C320-CENTRAL') OR device_name LIKE 'OLT-ZTE-TEST-%'");
    }
}
