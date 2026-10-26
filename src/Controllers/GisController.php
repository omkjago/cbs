<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../Middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../Services/FaultAnalyzerService.php';

final class GisController
{
    /**
     * Map icon determination helper
     */
    private static function determineIconType(string $nodeType, ?string $status, ?float $rxPower): string
    {
        $type = strtolower($nodeType);
        if ($nodeType === 'CUSTOMER') {
            if ($status === 'LOS') {
                return 'icon_customer_red_pulse';
            } elseif ($status === 'DYING_GASP' || $status === 'OFFLINE') {
                return 'icon_customer_gray';
            } elseif ($status === 'WARNING_DBM' || ($rxPower !== null && $rxPower <= -25.00)) {
                return 'icon_customer_yellow';
            }
            return 'icon_customer_green';
        }

        if ($nodeType === 'ODP') {
            return ($status === 'LOS') ? 'icon_odp_red_pulse' : 'icon_odp_normal';
        }

        return match ($nodeType) {
            'POP' => 'icon_pop_tower',
            'ODC' => 'icon_odc_cabinet',
            'JB' => 'icon_jb_jointbox',
            default => 'icon_generic_node'
        };
    }

    /**
     * GET /api/v1/gis/map-data
     * Return all GIS nodes, cables, and current optical statuses
     */
    public static function getMapData(): void
    {
        AuthMiddleware::authenticate();

        try {
            $pdo = Database::getConnection();

            // 1. Fetch all nodes with their current status
            $sqlNodes = "
                SELECT 
                    n.id, 
                    n.parent_node_id, 
                    n.node_code, 
                    n.node_name, 
                    n.node_type, 
                    n.latitude, 
                    n.longitude, 
                    n.input_method, 
                    n.port_capacity, 
                    n.address_note, 
                    n.metadata_json,
                    s.connection_status,
                    s.rx_power_dbm,
                    s.tx_power_dbm,
                    s.onu_interface,
                    s.onu_sn,
                    s.pppoe_username,
                    s.last_checked_at
                FROM gis_nodes n
                LEFT JOIN device_current_status s ON n.id = s.node_id
                ORDER BY n.id ASC
            ";
            $nodesStmt = $pdo->query($sqlNodes);
            $rawNodes = $nodesStmt->fetchAll();

            $nodes = [];
            $totalCustomers = 0;
            $onlineCount = 0;
            $warningCount = 0;
            $dyingGaspCount = 0;
            $losCount = 0;

            foreach ($rawNodes as $row) {
                $status = $row['connection_status'] ?? 'ONLINE';
                $rx = $row['rx_power_dbm'] !== null ? (float)$row['rx_power_dbm'] : null;

                if ($row['node_type'] === 'CUSTOMER') {
                    $totalCustomers++;
                    if ($status === 'LOS') {
                        $losCount++;
                    } elseif ($status === 'DYING_GASP' || $status === 'OFFLINE') {
                        $dyingGaspCount++;
                    } elseif ($status === 'WARNING_DBM' || ($rx !== null && $rx <= -25.00)) {
                        $warningCount++;
                    } else {
                        $onlineCount++;
                    }
                }

                $metadata = null;
                if (!empty($row['metadata_json'])) {
                    $metadata = is_string($row['metadata_json']) 
                        ? json_decode($row['metadata_json'], true) 
                        : $row['metadata_json'];
                }

                $nodes[] = [
                    'id' => (int)$row['id'],
                    'parent_node_id' => $row['parent_node_id'] !== null ? (int)$row['parent_node_id'] : null,
                    'node_code' => $row['node_code'],
                    'node_name' => $row['node_name'],
                    'node_type' => $row['node_type'],
                    'icon_type' => self::determineIconType($row['node_type'], $status, $rx),
                    'latitude' => (float)$row['latitude'],
                    'longitude' => (float)$row['longitude'],
                    'input_method' => $row['input_method'],
                    'port_capacity' => (int)$row['port_capacity'],
                    'address_note' => $row['address_note'],
                    'metadata' => $metadata,
                    'status' => $status,
                    'rx_power_dbm' => $rx,
                    'tx_power_dbm' => $row['tx_power_dbm'] !== null ? (float)$row['tx_power_dbm'] : null,
                    'onu_interface' => $row['onu_interface'],
                    'onu_sn' => $row['onu_sn'],
                    'pppoe_username' => $row['pppoe_username'],
                    'last_checked_at' => $row['last_checked_at']
                ];
            }

            // 2. Fetch all cables
            $sqlCables = "
                SELECT 
                    c.id, 
                    c.cable_code, 
                    c.cable_type, 
                    c.core_count, 
                    c.start_node_id, 
                    c.end_node_id, 
                    c.waypoints_json, 
                    c.length_meters, 
                    c.current_visual_status,
                    sn.node_code AS start_node_code,
                    en.node_code AS end_node_code
                FROM gis_cables c
                LEFT JOIN gis_nodes sn ON c.start_node_id = sn.id
                LEFT JOIN gis_nodes en ON c.end_node_id = en.id
                ORDER BY c.id ASC
            ";
            $cablesStmt = $pdo->query($sqlCables);
            $rawCables = $cablesStmt->fetchAll();

            $analysis = FaultAnalyzerService::analyze($pdo);
            $suspectedCuts = $analysis['suspected_fiber_cuts'];
            $cables = [];


            foreach ($rawCables as $row) {
                $waypoints = is_string($row['waypoints_json'])
                    ? json_decode($row['waypoints_json'], true)
                    : $row['waypoints_json'];

                if (!is_array($waypoints)) {
                    $waypoints = [];
                }

                $statusColor = match ($row['current_visual_status']) {
                    'cut_suspected' => '#EF4444', // Red
                    'warning' => '#F59E0B',       // Amber/Yellow
                    default => '#10B981'         // Green
                };

                $isFlashing = ($row['current_visual_status'] === 'cut_suspected');

                if ($isFlashing) {
                    $checkCoord = !empty($waypoints) ? $waypoints[0] : null;
                    $suspectedCuts[] = [
                        'cable_id' => (int)$row['id'],
                        'cable_code' => $row['cable_code'],
                        'from_node' => $row['start_node_code'],
                        'to_node' => $row['end_node_code'],
                        'affected_customers_count' => 0,
                        'check_coordinates' => [
                            'latitude' => $checkCoord[0] ?? null,
                            'longitude' => $checkCoord[1] ?? null
                        ],
                        'recommendation' => "Segmen kabel {$row['cable_code']} dicurigai putus. Periksa fisik jalur dan splice box."
                    ];
                }

                $cables[] = [
                    'id' => (int)$row['id'],
                    'cable_code' => $row['cable_code'],
                    'cable_type' => $row['cable_type'],
                    'core_count' => (int)$row['core_count'],
                    'start_node_id' => (int)$row['start_node_id'],
                    'end_node_id' => (int)$row['end_node_id'],
                    'start_node_code' => $row['start_node_code'],
                    'end_node_code' => $row['end_node_code'],
                    'length_meters' => (float)$row['length_meters'],
                    'current_visual_status' => $row['current_visual_status'],
                    'status_color' => $statusColor,
                    'is_flashing' => $isFlashing,
                    'waypoints' => $waypoints
                ];
            }

            // Auto-connect any parent-child relationship missing an explicit cable
            $existingConnections = [];
            foreach ($cables as $cb) {
                $existingConnections[$cb['start_node_id'] . '-' . $cb['end_node_id']] = true;
                $existingConnections[$cb['end_node_id'] . '-' . $cb['start_node_id']] = true;
            }

            $nodeLookup = [];
            foreach ($nodes as $n) {
                $nodeLookup[$n['id']] = $n;
            }

            foreach ($nodes as $n) {
                if ($n['parent_node_id'] !== null && isset($nodeLookup[$n['parent_node_id']])) {
                    $p = $nodeLookup[$n['parent_node_id']];
                    $connKey = $p['id'] . '-' . $n['id'];
                    if (!isset($existingConnections[$connKey])) {
                        $cables[] = [
                            'id' => 900000 + (int)$n['id'],
                            'cable_code' => 'AUTO-' . $p['node_code'] . '-' . $n['node_code'],
                            'cable_type' => $n['node_type'] === 'CUSTOMER' ? 'drop_core' : ($n['node_type'] === 'ODP' ? 'distribution' : 'feeder'),
                            'core_count' => $n['node_type'] === 'CUSTOMER' ? 1 : ($n['node_type'] === 'ODP' ? 12 : 24),
                            'start_node_id' => $p['id'],
                            'end_node_id' => $n['id'],
                            'start_node_code' => $p['node_code'],
                            'end_node_code' => $n['node_code'],
                            'length_meters' => 0,
                            'current_visual_status' => 'normal',
                            'status_color' => '#10B981',
                            'is_flashing' => false,
                            'waypoints' => [
                                [$p['latitude'], $p['longitude']],
                                [$n['latitude'], $n['longitude']]
                            ]
                        ];
                        $existingConnections[$connKey] = true;
                    }
                }
            }

            if (!headers_sent()) {
                http_response_code(200);
            }
            echo json_encode([
                'status' => 'success',
                'summary' => [
                    'total_customers' => $totalCustomers,
                    'online' => $onlineCount,
                    'warning_dbm' => $warningCount,
                    'dying_gasp' => $dyingGaspCount,
                    'los_cut' => $losCount
                ],
                'suspected_fiber_cuts' => $suspectedCuts,
                'nodes' => $nodes,
                'cables' => $cables
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mengambil data peta: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * POST /api/v1/gis/nodes
     * Create a new GIS node
     */
    public static function createNode(): void
    {
        $user = AuthMiddleware::authenticate();
        $input = json_decode((string)file_get_contents('php://input'), true);

        $nodeCode = strtoupper(trim((string)($input['node_code'] ?? '')));
        $nodeName = trim((string)($input['node_name'] ?? ''));
        $nodeType = strtoupper(trim((string)($input['node_type'] ?? '')));
        $lat = isset($input['latitude']) ? (float)$input['latitude'] : null;
        $lng = isset($input['longitude']) ? (float)$input['longitude'] : null;
        $inputMethod = (string)($input['input_method'] ?? 'map_marker');
        $parentId = !empty($input['parent_node_id']) ? (int)$input['parent_node_id'] : null;
        $portCapacity = isset($input['port_capacity']) ? (int)$input['port_capacity'] : 0;
        $addressNote = trim((string)($input['address_note'] ?? ''));
        $metadataJson = isset($input['metadata_json']) ? json_encode($input['metadata_json']) : null;

        // Validation
        $errors = [];
        if ($nodeCode === '') {
            $errors[] = 'Kode node wajib diisi.';
        }
        if ($nodeName === '') {
            $errors[] = 'Nama node wajib diisi.';
        }
        if (!in_array($nodeType, ['POP', 'ODC', 'JB', 'ODP', 'CUSTOMER'], true)) {
            $errors[] = 'Tipe node harus salah satu dari: POP, ODC, JB, ODP, CUSTOMER.';
        }
        if ($lat === null || $lat < -90.0 || $lat > 90.0) {
            $errors[] = 'Latitude harus berada dalam rentang -90.0 s/d 90.0.';
        }
        if ($lng === null || $lng < -180.0 || $lng > 180.0) {
            $errors[] = 'Longitude harus berada dalam rentang -180.0 s/d 180.0.';
        }
        if (!in_array($inputMethod, ['gps', 'map_marker', 'manual_latlong'], true)) {
            $inputMethod = 'map_marker';
        }

        if (!empty($errors)) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'errors' => $errors]);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Check unique node_code
            $checkStmt = $pdo->prepare("SELECT id FROM gis_nodes WHERE node_code = :code LIMIT 1");
            $checkStmt->execute([':code' => $nodeCode]);
            if ($checkStmt->fetch()) {
                http_response_code(409);
                echo json_encode([
                    'status' => 'error',
                    'message' => "Kode node '{$nodeCode}' sudah terdaftar. Gunakan kode lain."
                ]);
                return;
            }

            // Verify parent exists if provided
            $parent = null;
            if ($parentId !== null) {
                $pStmt = $pdo->prepare("SELECT id, node_code, node_type, latitude, longitude FROM gis_nodes WHERE id = :id LIMIT 1");
                $pStmt->execute([':id' => $parentId]);
                $parent = $pStmt->fetch();
                if (!$parent) {
                    http_response_code(422);
                    echo json_encode(['status' => 'error', 'message' => 'Parent node ID tidak valid.']);
                    return;
                }
            }

            $pdo->beginTransaction();

            $insertStmt = $pdo->prepare("
                INSERT INTO gis_nodes (
                    parent_node_id, node_code, node_name, node_type, 
                    latitude, longitude, input_method, port_capacity, 
                    address_note, metadata_json, created_by
                ) VALUES (
                    :parent_id, :code, :name, :type, 
                    :lat, :lng, :method, :capacity, 
                    :note, :metadata, :created_by
                )
            ");

            $insertStmt->execute([
                ':parent_id' => $parentId,
                ':code' => $nodeCode,
                ':name' => $nodeName,
                ':type' => $nodeType,
                ':lat' => $lat,
                ':lng' => $lng,
                ':method' => $inputMethod,
                ':capacity' => $portCapacity,
                ':note' => $addressNote !== '' ? $addressNote : null,
                ':metadata' => $metadataJson,
                ':created_by' => $user['id'] ?? null
            ]);

            $newNodeId = (int)$pdo->lastInsertId();

            // Auto-create cable connecting parent to new node
            if ($parent !== null) {
                $cableType = match ($nodeType) {
                    'CUSTOMER' => 'drop_core',
                    'ODP' => 'distribution',
                    default => 'feeder'
                };
                $coreCount = match ($nodeType) {
                    'CUSTOMER' => 1,
                    'ODP' => 12,
                    'JB' => 24,
                    default => 48
                };
                $cableCode = 'CBL-' . $parent['node_code'] . '-' . $nodeCode;
                $checkCbl = $pdo->prepare("SELECT id FROM gis_cables WHERE cable_code = :cbl LIMIT 1");
                $checkCbl->execute([':cbl' => $cableCode]);
                if ($checkCbl->fetch()) {
                    $cableCode .= '-' . substr(bin2hex(random_bytes(2)), 0, 4);
                }

                $parentLat = (float)$parent['latitude'];
                $parentLng = (float)$parent['longitude'];
                $waypoints = [
                    [$parentLat, $parentLng],
                    [$lat, $lng]
                ];

                $earthRadius = 6371000;
                $dLat = deg2rad($lat - $parentLat);
                $dLng = deg2rad($lng - $parentLng);
                $a = sin($dLat / 2) * sin($dLat / 2) +
                     cos(deg2rad($parentLat)) * cos(deg2rad($lat)) *
                     sin($dLng / 2) * sin($dLng / 2);
                $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
                $distanceMeters = round($earthRadius * $c, 2);

                $insertCable = $pdo->prepare("
                    INSERT INTO gis_cables (
                        cable_code, cable_type, core_count, start_node_id, end_node_id,
                        waypoints_json, length_meters, current_visual_status
                    ) VALUES (
                        :code, :type, :core, :start_id, :end_id,
                        :waypoints, :length, 'normal'
                    )
                ");
                $insertCable->execute([
                    ':code' => $cableCode,
                    ':type' => $cableType,
                    ':core' => $coreCount,
                    ':start_id' => $parentId,
                    ':end_id' => $newNodeId,
                    ':waypoints' => json_encode($waypoints),
                    ':length' => $distanceMeters
                ]);
            }

            // If Customer, initialize device_current_status
            if ($nodeType === 'CUSTOMER') {
                $onuSn = trim((string)($input['onu_sn'] ?? ''));
                $pppoe = trim((string)($input['pppoe_username'] ?? ''));
                $onuIf = trim((string)($input['onu_interface'] ?? ''));

                $statusStmt = $pdo->prepare("
                    INSERT INTO device_current_status (
                        node_id, onu_interface, onu_sn, pppoe_username, 
                        connection_status, rx_power_dbm, tx_power_dbm, last_checked_at
                    ) VALUES (
                        :node_id, :onu_if, :onu_sn, :pppoe, 
                        'ONLINE', -19.00, 2.00, CURRENT_TIMESTAMP
                    )
                ");
                $statusStmt->execute([
                    ':node_id' => $newNodeId,
                    ':onu_if' => $onuIf !== '' ? $onuIf : null,
                    ':onu_sn' => $onuSn !== '' ? $onuSn : null,
                    ':pppoe' => $pppoe !== '' ? $pppoe : null,
                ]);
            }

            $pdo->commit();

            http_response_code(201);
            echo json_encode([
                'status' => 'success',
                'message' => "Node '{$nodeName}' ({$nodeCode}) berhasil disimpan.",
                'data' => [
                    'id' => $newNodeId,
                    'node_code' => $nodeCode,
                    'node_name' => $nodeName,
                    'node_type' => $nodeType,
                    'latitude' => $lat,
                    'longitude' => $lng
                ]
            ]);

        } catch (Throwable $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan node: ' . $e->getMessage()]);
        }
    }

    /**
     * PUT /api/v1/gis/nodes/{id}
     * Update node coordinates or attributes
     */
    public static function updateNode(int $id): void
    {
        AuthMiddleware::authenticate();
        $input = json_decode((string)file_get_contents('php://input'), true);

        try {
            $pdo = Database::getConnection();
            $checkStmt = $pdo->prepare("SELECT id, node_type FROM gis_nodes WHERE id = ? LIMIT 1");
            $checkStmt->execute([$id]);
            $node = $checkStmt->fetch();

            if (!$node) {
                http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Node tidak ditemukan.']);
                return;
            }

            $fields = [];
            $values = [];

            if (isset($input['latitude'])) {
                $lat = (float)$input['latitude'];
                if ($lat < -90.0 || $lat > 90.0) {
                    http_response_code(422);
                    echo json_encode(['status' => 'error', 'message' => 'Latitude tidak valid.']);
                    return;
                }
                $fields[] = 'latitude = ?';
                $values[] = $lat;
            }

            if (isset($input['longitude'])) {
                $lng = (float)$input['longitude'];
                if ($lng < -180.0 || $lng > 180.0) {
                    http_response_code(422);
                    echo json_encode(['status' => 'error', 'message' => 'Longitude tidak valid.']);
                    return;
                }
                $fields[] = 'longitude = ?';
                $values[] = $lng;
            }

            if (isset($input['node_name'])) {
                $fields[] = 'node_name = ?';
                $values[] = trim((string)$input['node_name']);
            }

            if (isset($input['address_note'])) {
                $fields[] = 'address_note = ?';
                $values[] = trim((string)$input['address_note']);
            }

            if (array_key_exists('parent_node_id', $input)) {
                $parentId = !empty($input['parent_node_id']) ? (int)$input['parent_node_id'] : null;
                $fields[] = 'parent_node_id = ?';
                $values[] = $parentId;
            }

            if (isset($input['input_method'])) {
                $fields[] = 'input_method = ?';
                $values[] = (string)$input['input_method'];
            }

            if (empty($fields)) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Tidak ada field yang diperbarui.']);
                return;
            }

            $sql = "UPDATE gis_nodes SET " . implode(', ', $fields) . " WHERE id = ?";
            $values[] = $id;

            $updateStmt = $pdo->prepare($sql);
            $updateStmt->execute($values);

            // Synchronize connected FO cables waypoints
            if (isset($input['latitude']) || isset($input['longitude'])) {
                $posStmt = $pdo->prepare("SELECT latitude, longitude FROM gis_nodes WHERE id = ? LIMIT 1");
                $posStmt->execute([$id]);
                $pos = $posStmt->fetch();
                if ($pos) {
                    $curLat = (float)$pos['latitude'];
                    $curLng = (float)$pos['longitude'];

                    $cablesStmt = $pdo->prepare("
                        SELECT id, start_node_id, end_node_id, waypoints_json 
                        FROM gis_cables 
                        WHERE start_node_id = ? OR end_node_id = ?
                    ");
                    $cablesStmt->execute([$id, $id]);
                    $connectedCables = $cablesStmt->fetchAll();

                    $updCbl = $pdo->prepare("UPDATE gis_cables SET waypoints_json = ?, length_meters = ? WHERE id = ?");

                    foreach ($connectedCables as $cRow) {
                        $wps = is_string($cRow['waypoints_json']) ? json_decode($cRow['waypoints_json'], true) : $cRow['waypoints_json'];
                        if (is_array($wps) && count($wps) >= 2) {
                            $changed = false;
                            if ((int)$cRow['start_node_id'] === $id) {
                                $wps[0] = [$curLat, $curLng];
                                $changed = true;
                            }
                            if ((int)$cRow['end_node_id'] === $id) {
                                $wps[count($wps) - 1] = [$curLat, $curLng];
                                $changed = true;
                            }
                            if ($changed) {
                                // Recalculate geodesic length across all winding waypoints
                                $totalMeters = 0.0;
                                $earthRadius = 6371000;
                                for ($i = 0; $i < count($wps) - 1; $i++) {
                                    $p1 = $wps[$i];
                                    $p2 = $wps[$i + 1];
                                    $dLat = deg2rad((float)$p2[0] - (float)$p1[0]);
                                    $dLng = deg2rad((float)$p2[1] - (float)$p1[1]);
                                    $a = sin($dLat / 2) * sin($dLat / 2) +
                                         cos(deg2rad((float)$p1[0])) * cos(deg2rad((float)$p2[0])) *
                                         sin($dLng / 2) * sin($dLng / 2);
                                    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
                                    $totalMeters += ($earthRadius * $c);
                                }
                                $updCbl->execute([json_encode($wps), round($totalMeters, 2), $cRow['id']]);
                            }
                        }
                    }
                }
            }

            if (!headers_sent()) {
                http_response_code(200);
            }
            echo json_encode([
                'status' => 'success',
                'message' => 'Data koordinat/node berhasil diperbarui.'
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal memperbarui node: ' . $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/v1/gis/nodes/{id}
     */
    public static function deleteNode(int $id): void
    {
        AuthMiddleware::authenticate(['super_admin', 'noc']);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM gis_nodes WHERE id = :id");
            $stmt->execute([':id' => $id]);

            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Node tidak ditemukan.']);
                return;
            }

            if (!headers_sent()) {
                http_response_code(200);
            }
            echo json_encode(['status' => 'success', 'message' => 'Node berhasil dihapus.']);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal menghapus node: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/v1/gis/cables
     * Create FO Cable Polyline (supports winding/multi-point waypoints)
     */
    public static function createCable(): void
    {
        AuthMiddleware::authenticate(['super_admin', 'noc']);
        $input = json_decode((string)file_get_contents('php://input'), true);

        $cableCode = strtoupper(trim((string)($input['cable_code'] ?? '')));
        $cableType = strtolower(trim((string)($input['cable_type'] ?? 'distribution')));
        $coreCount = isset($input['core_count']) ? (int)$input['core_count'] : 12;
        $startNodeId = (int)($input['start_node_id'] ?? 0);
        $endNodeId = (int)($input['end_node_id'] ?? 0);
        $waypoints = $input['waypoints'] ?? [];
        $length = isset($input['length_meters']) ? (float)$input['length_meters'] : 0.0;

        if ($cableCode === '' || $startNodeId === 0 || $endNodeId === 0 || empty($waypoints) || count($waypoints) < 2) {
            http_response_code(422);
            echo json_encode([
                'status' => 'error',
                'message' => 'Kode kabel, node awal, node akhir, dan titik waypoints polyline (minimal 2 titik) wajib diisi.'
            ]);
            return;
        }

        // Clean waypoints
        $cleanedWaypoints = [];
        foreach ($waypoints as $wp) {
            if (!is_array($wp) || count($wp) < 2) continue;
            $cleanedWaypoints[] = [(float)$wp[0], (float)$wp[1]];
        }

        if (count($cleanedWaypoints) < 2) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Titik koordinat kabel tidak mencukupi.']);
            return;
        }

        // Calculate accurate geodesic length along winding polyline if not supplied
        if ($length <= 0.0) {
            $totalMeters = 0.0;
            $earthRadius = 6371000;
            for ($i = 0; $i < count($cleanedWaypoints) - 1; $i++) {
                $p1 = $cleanedWaypoints[$i];
                $p2 = $cleanedWaypoints[$i + 1];
                $dLat = deg2rad($p2[0] - $p1[0]);
                $dLng = deg2rad($p2[1] - $p1[1]);
                $a = sin($dLat / 2) * sin($dLat / 2) +
                     cos(deg2rad($p1[0])) * cos(deg2rad($p2[0])) *
                     sin($dLng / 2) * sin($dLng / 2);
                $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
                $totalMeters += ($earthRadius * $c);
            }
            $length = round($totalMeters, 2);
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO gis_cables (
                    cable_code, cable_type, core_count, 
                    start_node_id, end_node_id, waypoints_json, 
                    length_meters, current_visual_status
                ) VALUES (
                    ?, ?, ?, 
                    ?, ?, ?, 
                    ?, 'normal'
                )
            ");

            $stmt->execute([
                $cableCode,
                $cableType,
                $coreCount,
                $startNodeId,
                $endNodeId,
                json_encode($cleanedWaypoints),
                $length
            ]);

            http_response_code(201);
            echo json_encode([
                'status' => 'success',
                'message' => "Jalur kabel '{$cableCode}' berhasil disimpan.",
                'data' => [
                    'id' => (int)$pdo->lastInsertId(),
                    'cable_code' => $cableCode,
                    'length_meters' => $length
                ]
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan kabel: ' . $e->getMessage()]);
        }
    }

    /**
     * PUT /api/v1/gis/cables/{id}
     * Update FO Cable waypoints (bends/turns) or attributes
     */
    public static function updateCable(int $id): void
    {
        AuthMiddleware::authenticate(['super_admin', 'noc']);
        $input = json_decode((string)file_get_contents('php://input'), true);

        try {
            $pdo = Database::getConnection();
            $checkStmt = $pdo->prepare("SELECT id, cable_code, start_node_id, end_node_id FROM gis_cables WHERE id = ? LIMIT 1");
            $checkStmt->execute([$id]);
            $cable = $checkStmt->fetch();

            if (!$cable) {
                http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Kabel tidak ditemukan.']);
                return;
            }

            $fields = [];
            $values = [];
            $totalMeters = null;
            $cleanedWaypoints = null;

            if (isset($input['waypoints']) && is_array($input['waypoints'])) {
                $waypoints = $input['waypoints'];
                if (count($waypoints) < 2) {
                    http_response_code(422);
                    echo json_encode(['status' => 'error', 'message' => 'Jalur kabel minimal harus memiliki 2 titik koordinat.']);
                    return;
                }

                $cleanedWaypoints = [];
                foreach ($waypoints as $wp) {
                    if (!is_array($wp) || count($wp) < 2) continue;
                    $lat = (float)$wp[0];
                    $lng = (float)$wp[1];
                    if ($lat < -90.0 || $lat > 90.0 || $lng < -180.0 || $lng > 180.0) {
                        http_response_code(422);
                        echo json_encode(['status' => 'error', 'message' => 'Terdapat koordinat waypoint tidak valid.']);
                        return;
                    }
                    $cleanedWaypoints[] = [$lat, $lng];
                }

                if (count($cleanedWaypoints) < 2) {
                    http_response_code(422);
                    echo json_encode(['status' => 'error', 'message' => 'Titik koordinat kabel tidak mencukupi.']);
                    return;
                }

                // Calculate total geodesic distance across all segments (berkelok-kelok)
                $totalMeters = 0.0;
                $earthRadius = 6371000;
                for ($i = 0; $i < count($cleanedWaypoints) - 1; $i++) {
                    $p1 = $cleanedWaypoints[$i];
                    $p2 = $cleanedWaypoints[$i + 1];
                    $dLat = deg2rad($p2[0] - $p1[0]);
                    $dLng = deg2rad($p2[1] - $p1[1]);
                    $a = sin($dLat / 2) * sin($dLat / 2) +
                         cos(deg2rad($p1[0])) * cos(deg2rad($p2[0])) *
                         sin($dLng / 2) * sin($dLng / 2);
                    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
                    $totalMeters += ($earthRadius * $c);
                }

                $fields[] = 'waypoints_json = ?';
                $values[] = json_encode($cleanedWaypoints);

                $fields[] = 'length_meters = ?';
                $values[] = round($totalMeters, 2);
            }

            if (isset($input['cable_code'])) {
                $fields[] = 'cable_code = ?';
                $values[] = strtoupper(trim((string)$input['cable_code']));
            }

            if (isset($input['cable_type'])) {
                $fields[] = 'cable_type = ?';
                $values[] = strtolower(trim((string)$input['cable_type']));
            }

            if (isset($input['core_count'])) {
                $fields[] = 'core_count = ?';
                $values[] = (int)$input['core_count'];
            }

            if (empty($fields)) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Tidak ada field kabel yang diperbarui.']);
                return;
            }

            $sql = "UPDATE gis_cables SET " . implode(', ', $fields) . " WHERE id = ?";
            $values[] = $id;

            $updateStmt = $pdo->prepare($sql);
            $updateStmt->execute($values);

            if (!headers_sent()) {
                http_response_code(200);
            }
            echo json_encode([
                'status' => 'success',
                'message' => 'Jalur waypoints kabel berhasil diperbarui.',
                'data' => [
                    'id' => $id,
                    'length_meters' => $totalMeters !== null ? round($totalMeters, 2) : null,
                    'waypoints' => $cleanedWaypoints
                ]
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal memperbarui kabel: ' . $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/v1/gis/cables/{id}
     */
    public static function deleteCable(int $id): void
    {
        AuthMiddleware::authenticate(['super_admin', 'noc']);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM gis_cables WHERE id = :id");
            $stmt->execute([':id' => $id]);

            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Kabel tidak ditemukan.']);
                return;
            }

            if (!headers_sent()) {
                http_response_code(200);
            }
            echo json_encode(['status' => 'success', 'message' => 'Kabel berhasil dihapus.']);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal menghapus kabel: ' . $e->getMessage()]);
        }
    }
}
