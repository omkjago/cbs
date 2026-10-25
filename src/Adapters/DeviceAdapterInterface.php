<?php
declare(strict_types=1);

/**
 * Standard Contract for Multi-Vendor Hardware Adapters
 * Compliant with PRD FR-1.2 and Zero-Shell Policy
 */
interface DeviceAdapterInterface
{
    /**
     * Connect to the physical network device (via Socket/API/SNMP)
     */
    public function connect(array $config): bool;

    /**
     * Test if credentials and port connectivity are valid
     */
    public function testConnection(): array;

    /**
     * Disconnect/Close connection stream
     */
    public function disconnect(): void;

    /**
     * Fetch active client sessions (PPPoE / IPoE for Routers)
     */
    public function getActiveClients(): array;

    /**
     * Fetch ONU/ONT Phase States (ONLINE, LOS, DYING_GASP, OFFLINE)
     */
    public function getOnuStatusList(): array;

    /**
     * Read optical Rx/Tx power (dBm) for a specific ONU/ONT port or SN
     */
    public function getOpticalPower(string $onuIdentifier): ?array;
}
