<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';

/**
 * Smart Fault Localization Engine (Pohon Topologi & Upward Tree Traversal)
 * Compliant with PRD Modul 4 & FR-4.1
 */
final class FaultAnalyzerService
{
    /**
     * Analyze network topology and customer alarms to pinpoint fiber cut locations
     * Returns:
     * [
     *   'suspected_fiber_cuts' => [...],
     *   'cable_status_updates' => [...],
     *   'node_fault_summaries' => [...]
     * ]
     */
    public static function analyze(?PDO $pdo = null): array
    {
        $pdo = $pdo ?? Database::getConnection();

        // 1. Fetch all nodes with their status and parent relationships
        $nodesStmt = $pdo->query("
            SELECT n.id, n.parent_node_id, n.node_code, n.node_name, n.node_type, 
                   n.latitude, n.longitude,
                   COALESCE(s.connection_status, 'ONLINE') AS status,
                   s.rx_power_dbm
            FROM gis_nodes n
            LEFT JOIN device_current_status s ON n.id = s.node_id
            ORDER BY n.id ASC
        ");
        $rawNodes = $nodesStmt->fetchAll();

        $nodesById = [];
        $childrenByParentId = [];
        $customersByOdp = [];

        foreach ($rawNodes as $node) {
            $id = (int)$node['id'];
            $parentId = $node['parent_node_id'] !== null ? (int)$node['parent_node_id'] : null;
            $nodesById[$id] = $node;

            if ($parentId !== null) {
                $childrenByParentId[$parentId][] = $id;
            }

            if ($node['node_type'] === 'CUSTOMER' && $parentId !== null) {
                $customersByOdp[$parentId][] = $node;
            }
        }

        // 2. Fetch all cables
        $cablesStmt = $pdo->query("
            SELECT c.id, c.cable_code, c.cable_type, c.core_count,
                   c.start_node_id, c.end_node_id, c.waypoints_json, c.length_meters,
                   c.current_visual_status
            FROM gis_cables c
        ");
        $cables = $cablesStmt->fetchAll();

        // Map cables by pair [start_node_id, end_node_id] (both directions)
        $cableByNodePair = [];
        foreach ($cables as $cable) {
            $start = (int)$cable['start_node_id'];
            $end = (int)$cable['end_node_id'];
            $cableByNodePair["{$start}-{$end}"] = $cable;
            $cableByNodePair["{$end}-{$start}"] = $cable;
        }

        $suspectedCuts = [];
        $updatedCableStatuses = []; // cable_id => status

        // ---------------------------------------------------------------------
        // ALGORITMA 1 & 2: Evaluasi Status ODP & Pelanggan (Drop vs Distribution)
        // ---------------------------------------------------------------------
        $deadOdpIds = [];
        $healthyOdpIds = [];

        foreach ($customersByOdp as $odpId => $custs) {
            $totalCust = count($custs);
            if ($totalCust === 0) continue;

            $losCount = 0;
            $losCustIds = [];

            foreach ($custs as $c) {
                if ($c['status'] === 'LOS') {
                    $losCount++;
                    $losCustIds[] = (int)$c['id'];
                }
            }

            $losRatio = $losCount / $totalCust;
            $odpNode = $nodesById[$odpId] ?? null;
            if (!$odpNode) continue;

            // Kasus 2: Distribution Cut (>= 80% pelanggan di ODP mengalami LOS)
            if ($losRatio >= 0.8 && $totalCust >= 1) {
                $deadOdpIds[] = $odpId;

                // Temukan kabel menuju parent (misal ODP -> JB)
                $parentId = $odpNode['parent_node_id'] !== null ? (int)$odpNode['parent_node_id'] : null;
                $cable = $parentId !== null ? ($cableByNodePair["{$parentId}-{$odpId}"] ?? null) : null;
                $cableId = $cable ? (int)$cable['id'] : null;
                $cableCode = $cable ? $cable['cable_code'] : "Kabel-{$odpNode['node_code']}";

                $parentCode = ($parentId && isset($nodesById[$parentId])) ? $nodesById[$parentId]['node_code'] : 'Parent';

                $waypoints = $cable ? (is_string($cable['waypoints_json']) ? json_decode($cable['waypoints_json'], true) : $cable['waypoints_json']) : null;
                $checkCoord = !empty($waypoints) ? $waypoints[0] : [
                    $odpNode['latitude'],
                    $odpNode['longitude']
                ];

                if ($cableId) {
                    $updatedCableStatuses[$cableId] = 'cut_suspected';
                }

                $suspectedCuts[] = [
                    'cable_id' => $cableId,
                    'cable_code' => $cableCode,
                    'fault_type' => 'ODP_DISTRIBUTION_CUT',
                    'from_node' => $parentCode,
                    'to_node' => $odpNode['node_code'],
                    'affected_customers_count' => $losCount,
                    'check_coordinates' => [
                        'latitude' => (float)$checkCoord[0],
                        'longitude' => (float)$checkCoord[1]
                    ],
                    'recommendation' => "Gangguan ODP massal: {$losCount}/{$totalCust} pelanggan di {$odpNode['node_code']} berstatus LOS. Periksa core distribusi di titik {$parentCode} atau jalur kabel menuju {$odpNode['node_code']}."
                ];
            } elseif ($losCount > 0) {
                // Kasus 1: Individual Drop Core Cut (< 80% pelanggan putus)
                $healthyOdpIds[] = $odpId;

                foreach ($losCustIds as $cid) {
                    $cNode = $nodesById[$cid] ?? null;
                    if (!$cNode) continue;

                    $cable = $cableByNodePair["{$odpId}-{$cid}"] ?? null;
                    if ($cable) {
                        $updatedCableStatuses[(int)$cable['id']] = 'cut_suspected';
                    }

                    $suspectedCuts[] = [
                        'cable_id' => $cable ? (int)$cable['id'] : null,
                        'cable_code' => $cable ? $cable['cable_code'] : "DROP-{$cNode['node_code']}",
                        'fault_type' => 'INDIVIDUAL_DROP_CUT',
                        'from_node' => $odpNode['node_code'],
                        'to_node' => $cNode['node_code'],
                        'affected_customers_count' => 1,
                        'check_coordinates' => [
                            'latitude' => (float)$cNode['latitude'],
                            'longitude' => (float)$cNode['longitude']
                        ],
                        'recommendation' => "Gangguan individual: Hanya pelanggan {$cNode['node_name']} ({$cNode['node_code']}) yang mengalami LOS. Periksa kabel drop core dan adapter roset/konektor fast connector pelanggan."
                    ];
                }
            } else {
                $healthyOdpIds[] = $odpId;
            }
        }

        // ---------------------------------------------------------------------
        // ALGORITMA 3: Gangguan Backbone / Feeder / JB (Upward Tree Traversal)
        // ---------------------------------------------------------------------
        // Cek Joint Box (JB) yang membawahi ODP
        $jbs = array_filter($nodesById, fn($n) => $n['node_type'] === 'JB');

        foreach ($jbs as $jb) {
            $jbId = (int)$jb['id'];
            $descendants = self::getAllDescendantOdpIds($jbId, $childrenByParentId, $nodesById);

            if (empty($descendants)) continue;

            // Hitung berapa ODP turunan yang mati vs hidup
            $deadDescendants = array_intersect($descendants, $deadOdpIds);
            $healthyDescendants = array_intersect($descendants, $healthyOdpIds);

            // Jika seluruh ODP turunan di bawah JB ini mati (100% loss)
            if (count($deadDescendants) === count($descendants) && count($descendants) >= 2) {
                // Lakukan Upward Traversal mencari titik sehat terakhir di atas JB
                $parentJbId = $jb['parent_node_id'] !== null ? (int)$jb['parent_node_id'] : null;
                $healthyAncestor = null;

                $currentParentId = $parentJbId;
                while ($currentParentId !== null) {
                    $ancestorNode = $nodesById[$currentParentId] ?? null;
                    if (!$ancestorNode) break;

                    // Periksa apakah ancestor ini masih memiliki turunan cabang lain yang sehat
                    $siblingDescendants = self::getAllDescendantOdpIds($currentParentId, $childrenByParentId, $nodesById);
                    $hasHealthyBranch = false;
                    foreach ($siblingDescendants as $sId) {
                        if (!in_array($sId, $deadOdpIds, true)) {
                            $hasHealthyBranch = true;
                            break;
                        }
                    }

                    if ($hasHealthyBranch || $ancestorNode['node_type'] === 'POP') {
                        $healthyAncestor = $ancestorNode;
                        break;
                    }

                    $currentParentId = $ancestorNode['parent_node_id'] !== null ? (int)$ancestorNode['parent_node_id'] : null;
                }

                $fromNodeCode = ($parentJbId && isset($nodesById[$parentJbId])) 
                    ? $nodesById[$parentJbId]['node_code'] 
                    : ($healthyAncestor ? $healthyAncestor['node_code'] : 'Core');
                $cable = $parentJbId !== null ? ($cableByNodePair["{$parentJbId}-{$jbId}"] ?? null) : null;
                $cableId = $cable ? (int)$cable['id'] : null;
                $cableCode = $cable ? $cable['cable_code'] : "FEEDER-{$jb['node_code']}";

                if ($cableId) {
                    $updatedCableStatuses[$cableId] = 'cut_suspected';
                }

                // Total affected customers under this entire JB branch
                $totalAffected = 0;
                foreach ($descendants as $odpId) {
                    $totalAffected += count($customersByOdp[$odpId] ?? []);
                }

                // Tambahkan sebagai prioritas utama (backbone cut)
                array_unshift($suspectedCuts, [
                    'cable_id' => $cableId,
                    'cable_code' => $cableCode,
                    'fault_type' => 'BACKBONE_FEEDER_CUT',
                    'from_node' => $fromNodeCode,
                    'to_node' => $jb['node_code'],
                    'affected_customers_count' => $totalAffected,
                    'check_coordinates' => [
                        'latitude' => (float)$jb['latitude'],
                        'longitude' => (float)$jb['longitude']
                    ],
                    'recommendation' => "CRITICAL: Seluruh turunan di bawah {$jb['node_code']} putus total ({$totalAffected} pelanggan terdampak). Estimasi titik putus berada pada segmen kabel antara {$fromNodeCode} menuju {$jb['node_code']}."
                ]);
            }
        }

        // 3. Update database current_visual_status for cables if changed
        if (!empty($updatedCableStatuses)) {
            $updateCableStmt = $pdo->prepare("UPDATE gis_cables SET current_visual_status = :status WHERE id = :id");
            foreach ($updatedCableStatuses as $cId => $status) {
                $updateCableStmt->execute([':status' => $status, ':id' => $cId]);
            }
        }

        return [
            'suspected_fiber_cuts' => $suspectedCuts,
            'affected_cables_count' => count($updatedCableStatuses),
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Recursively find all descendant ODP node IDs under a parent
     */
    private static function getAllDescendantOdpIds(int $parentId, array $childrenMap, array $nodesById): array
    {
        $odpIds = [];
        $children = $childrenMap[$parentId] ?? [];

        foreach ($children as $childId) {
            $childNode = $nodesById[$childId] ?? null;
            if (!$childNode) continue;

            if ($childNode['node_type'] === 'ODP') {
                $odpIds[] = $childId;
            }

            // Recurse deeper for nested JBs or ODCs
            if ($childNode['node_type'] === 'JB' || $childNode['node_type'] === 'ODC') {
                $nested = self::getAllDescendantOdpIds($childId, $childrenMap, $nodesById);
                $odpIds = array_merge($odpIds, $nested);
            }
        }

        return array_unique($odpIds);
    }
}
