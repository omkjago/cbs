<?php
declare(strict_types=1);

require_once __DIR__ . '/DeviceAdapterInterface.php';

/**
 * MikroTik RouterOS API Adapter (Pure Native Socket Implementation)
 * Enforces Zero-Shell Execution Policy: 100% PHP Streams without binary invocation.
 */
class MikrotikRosAdapter implements DeviceAdapterInterface
{
    /** @var resource|null */
    protected $socket = null;
    protected array $config = [];
    protected bool $connected = false;

    public function connect(array $config): bool
    {
        $this->config = $config;
        $host = (string)($config['ip_address'] ?? '127.0.0.1');
        $port = (int)($config['api_port'] ?? 8728);
        $timeout = (float)($config['timeout'] ?? 3.0);

        $errno = 0;
        $errstr = '';
        $this->socket = @stream_socket_client(
            "tcp://{$host}:{$port}",
            $errno,
            $errstr,
            $timeout,
            STREAM_CLIENT_CONNECT
        );

        if (!$this->socket) {
            $this->connected = false;
            return false;
        }

        stream_set_timeout($this->socket, (int)$timeout);

        // Perform login handshake
        $username = (string)($config['username'] ?? 'admin');
        $password = (string)($config['password'] ?? '');

        if (!$this->login($username, $password)) {
            $this->disconnect();
            return false;
        }

        $this->connected = true;
        return true;
    }

    public function testConnection(): array
    {
        if (!$this->connected && !$this->connect($this->config)) {
            return [
                'success' => false,
                'message' => 'Gagal terhubung ke MikroTik API pada port ' . ($this->config['api_port'] ?? 8728) . '. Periksa IP, Port, dan Kredensial.'
            ];
        }

        // Test running /system/resource/print
        $res = $this->writeSentence(['/system/resource/print']);
        $resource = $this->readSentence();

        return [
            'success' => true,
            'message' => 'Berhasil terhubung ke Router MikroTik.',
            'details' => [
                'board_name' => $resource[0]['board-name'] ?? ($resource[0]['platform'] ?? 'RouterOS Device'),
                'version' => $resource[0]['version'] ?? 'Unknown',
                'uptime' => $resource[0]['uptime'] ?? 'N/A',
                'cpu_load' => ($resource[0]['cpu-load'] ?? 0) . '%'
            ]
        ];
    }

    public function disconnect(): void
    {
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
        $this->socket = null;
        $this->connected = false;
    }

    public function getActiveClients(): array
    {
        if (!$this->connected) {
            return [];
        }

        $this->writeSentence(['/ppp/active/print']);
        $rawRows = $this->readSentence();

        $clients = [];
        foreach ($rawRows as $row) {
            if (isset($row['name'])) {
                $clients[] = [
                    'username' => $row['name'],
                    'ip_address' => $row['address'] ?? null,
                    'service' => $row['service'] ?? 'pppoe',
                    'uptime' => $row['uptime'] ?? null,
                    'caller_id' => $row['caller-id'] ?? null // MAC Address
                ];
            }
        }

        return $clients;
    }

    public function getOnuStatusList(): array
    {
        // Router MikroTik provides PPPoE sessions; OLT provides ONU status.
        return [];
    }

    public function getOpticalPower(string $onuIdentifier): ?array
    {
        return null;
    }

    // =========================================================================
    // MikroTik RouterOS API Binary Protocol Encoders & Decoders
    // =========================================================================

    protected function login(string $username, string $password): bool
    {
        // RouterOS v6.43+ login handshake
        $this->writeSentence(['/login', '=name=' . $username, '=password=' . $password]);
        $response = $this->readSentence();

        if (isset($response[0]['!done'])) {
            return true;
        }

        // Legacy challenge-response fallback for older RouterOS versions
        if (isset($response[0]['=ret'])) {
            $challenge = hex2bin($response[0]['=ret']);
            $hash = md5(chr(0) . $password . $challenge);
            $this->writeSentence(['/login', '=name=' . $username, '=response=00' . $hash]);
            $response2 = $this->readSentence();
            return isset($response2[0]['!done']);
        }

        return false;
    }

    protected function writeSentence(array $words): bool
    {
        if (!is_resource($this->socket)) {
            return false;
        }

        $packet = '';
        foreach ($words as $word) {
            $packet .= $this->encodeLength(strlen($word)) . $word;
        }
        $packet .= chr(0); // End of sentence

        return @fwrite($this->socket, $packet) !== false;
    }

    protected function readSentence(): array
    {
        if (!is_resource($this->socket)) {
            return [];
        }

        $rows = [];
        $current = [];

        while (true) {
            $word = $this->readWord();
            if ($word === null || $word === '') {
                if (!empty($current)) {
                    $rows[] = $current;
                    $current = [];
                }
                break;
            }

            if ($word === '!re') {
                if (!empty($current)) {
                    $rows[] = $current;
                    $current = [];
                }
            } elseif ($word === '!done') {
                $current['!done'] = true;
                $rows[] = $current;
                break;
            } elseif ($word === '!trap' || $word === '!fatal') {
                $current['!error'] = true;
            } elseif (str_starts_with($word, '=')) {
                $parts = explode('=', substr($word, 1), 2);
                $key = $parts[0] ?? '';
                $val = $parts[1] ?? '';
                $current[$key] = $val;
            }
        }

        return $rows;
    }

    protected function readWord(): ?string
    {
        if (!is_resource($this->socket) || feof($this->socket)) {
            return null;
        }

        $length = $this->decodeLength();
        if ($length === 0) {
            return '';
        }

        $buffer = '';
        while (strlen($buffer) < $length && !feof($this->socket)) {
            $chunk = fread($this->socket, $length - strlen($buffer));
            if ($chunk === false || $chunk === '') {
                break;
            }
            $buffer .= $chunk;
        }

        return $buffer;
    }

    protected function encodeLength(int $length): string
    {
        if ($length < 0x80) {
            return chr($length);
        } elseif ($length < 0x4000) {
            $length |= 0x8000;
            return chr(($length >> 8) & 0xFF) . chr($length & 0xFF);
        } elseif ($length < 0x200000) {
            $length |= 0xC00000;
            return chr(($length >> 16) & 0xFF) . chr(($length >> 8) & 0xFF) . chr($length & 0xFF);
        } elseif ($length < 0x10000000) {
            $length |= 0xE0000000;
            return chr(($length >> 24) & 0xFF) . chr(($length >> 16) & 0xFF) . chr(($length >> 8) & 0xFF) . chr($length & 0xFF);
        } else {
            return chr(0xF0) . chr(($length >> 24) & 0xFF) . chr(($length >> 16) & 0xFF) . chr(($length >> 8) & 0xFF) . chr($length & 0xFF);
        }
    }

    protected function decodeLength(): int
    {
        if (!is_resource($this->socket) || feof($this->socket)) {
            return 0;
        }

        $b = ord(fgetc($this->socket));
        if (($b & 0x80) === 0) {
            return $b;
        } elseif (($b & 0xC0) === 0x80) {
            return (($b & 0x3F) << 8) | ord(fgetc($this->socket));
        } elseif (($b & 0xE0) === 0xC0) {
            return (($b & 0x1F) << 16) | (ord(fgetc($this->socket)) << 8) | ord(fgetc($this->socket));
        } elseif (($b & 0xF0) === 0xE0) {
            return (($b & 0x0F) << 24) | (ord(fgetc($this->socket)) << 16) | (ord(fgetc($this->socket)) << 8) | ord(fgetc($this->socket));
        } elseif (($b & 0xF8) === 0xF0) {
            return (ord(fgetc($this->socket)) << 24) | (ord(fgetc($this->socket)) << 16) | (ord(fgetc($this->socket)) << 8) | ord(fgetc($this->socket));
        }

        return 0;
    }
}
