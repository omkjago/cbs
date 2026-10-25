<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../Services/CryptoService.php';
require_once __DIR__ . '/../Middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../Adapters/MikrotikRosAdapter.php';
require_once __DIR__ . '/../Adapters/ZteOltAdapter.php';
require_once __DIR__ . '/../Adapters/GenericSnmpAdapter.php';

final class DeviceController
{
    /**
     * Factory helper to instantiate driver adapter
     */
    public static function createAdapter(string $vendorDriver): DeviceAdapterInterface
    {
        return match ($vendorDriver) {
            'mikrotik_ros' => new MikrotikRosAdapter(),
            'zte_c300', 'zte_c320' => new ZteOltAdapter(),
            default => new GenericSnmpAdapter()
        };
    }

    /**
     * GET /api/v1/devices
     */
    public static function getDevices(): void
    {
        AuthMiddleware::authenticate(['super_admin', 'noc']);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT id, device_name, device_type, vendor_driver, ip_address, 
                       api_port, ssh_telnet_port, snmp_port, is_online, last_polled_at, created_at
                FROM network_devices
                ORDER BY id ASC
            ");
            $devices = $stmt->fetchAll();

            if (!headers_sent()) {
                http_response_code(200);
            }
            echo json_encode([
                'status' => 'success',
                'data' => $devices
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/v1/devices
     * Create network device with AES-256-GCM encrypted credentials
     */
    public static function createDevice(): void
    {
        AuthMiddleware::authenticate(['super_admin']);
        $input = json_decode((string)file_get_contents('php://input'), true);

        $name = trim((string)($input['device_name'] ?? ''));
        $type = (string)($input['device_type'] ?? 'mikrotik_router');
        $vendor = (string)($input['vendor_driver'] ?? 'mikrotik_ros');
        $ip = trim((string)($input['ip_address'] ?? ''));
        $apiPort = isset($input['api_port']) ? (int)$input['api_port'] : 8728;
        $sshPort = isset($input['ssh_telnet_port']) ? (int)$input['ssh_telnet_port'] : 23;
        $snmpPort = isset($input['snmp_port']) ? (int)$input['snmp_port'] : 161;

        $username = (string)($input['username'] ?? '');
        $password = (string)($input['password'] ?? '');
        $community = (string)($input['snmp_community'] ?? '');

        if ($name === '' || $ip === '') {
            if (!headers_sent()) http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Nama perangkat dan IP address wajib diisi.']);
            return;
        }

        try {
            $usernameEnc = $username !== '' ? CryptoService::encrypt($username) : null;
            $passwordEnc = $password !== '' ? CryptoService::encrypt($password) : null;
            $communityEnc = $community !== '' ? CryptoService::encrypt($community) : null;

            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO network_devices (
                    device_name, device_type, vendor_driver, ip_address, 
                    api_port, ssh_telnet_port, snmp_port,
                    username_enc, password_enc, snmp_community_enc, is_online
                ) VALUES (
                    :name, :type, :vendor, :ip, 
                    :api_port, :ssh_port, :snmp_port,
                    :user_enc, :pass_enc, :comm_enc, 1
                )
            ");

            $stmt->execute([
                ':name' => $name,
                ':type' => $type,
                ':vendor' => $vendor,
                ':ip' => $ip,
                ':api_port' => $apiPort,
                ':ssh_port' => $sshPort,
                ':snmp_port' => $snmpPort,
                ':user_enc' => $usernameEnc,
                ':pass_enc' => $passwordEnc,
                ':comm_enc' => $communityEnc
            ]);

            $id = (int)$pdo->lastInsertId();

            if (!headers_sent()) http_response_code(201);
            echo json_encode([
                'status' => 'success',
                'message' => "Perangkat '{$name}' berhasil ditambahkan dengan enkripsi kredensial AES-256-GCM.",
                'data' => ['id' => $id, 'device_name' => $name]
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/v1/devices/{id}/test
     * Test connection to device using its adapter
     */
    public static function testDevice(int $id): void
    {
        AuthMiddleware::authenticate(['super_admin', 'noc']);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT * FROM network_devices WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $id]);
            $device = $stmt->fetch();

            if (!$device) {
                if (!headers_sent()) http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Perangkat tidak ditemukan.']);
                return;
            }

            // Decrypt credentials
            $username = $device['username_enc'] ? CryptoService::decrypt($device['username_enc']) : '';
            $password = $device['password_enc'] ? CryptoService::decrypt($device['password_enc']) : '';
            $community = $device['snmp_community_enc'] ? CryptoService::decrypt($device['snmp_community_enc']) : '';

            $adapter = self::createAdapter($device['vendor_driver']);
            $adapter->connect([
                'ip_address' => $device['ip_address'],
                'api_port' => $device['api_port'],
                'snmp_port' => $device['snmp_port'],
                'username' => $username,
                'password' => $password,
                'snmp_community' => $community,
                'simulation_mode' => true
            ]);

            $result = $adapter->testConnection();
            $adapter->disconnect();

            if (!headers_sent()) http_response_code(200);
            echo json_encode([
                'status' => $result['success'] ? 'success' : 'error',
                'message' => $result['message'],
                'details' => $result['details'] ?? null
            ]);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/v1/devices/{id}
     */
    public static function deleteDevice(int $id): void
    {
        AuthMiddleware::authenticate(['super_admin']);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM network_devices WHERE id = :id");
            $stmt->execute([':id' => $id]);

            if ($stmt->rowCount() === 0) {
                if (!headers_sent()) http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Perangkat tidak ditemukan.']);
                return;
            }

            if (!headers_sent()) http_response_code(200);
            echo json_encode(['status' => 'success', 'message' => 'Perangkat berhasil dihapus.']);

        } catch (Throwable $e) {
            if (!headers_sent()) http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }
}
