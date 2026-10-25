-- ========================================================================
-- NMS-GIS ISP - MySQL / MariaDB Database Schema (InnoDB)
-- ========================================================================

-- 1. Tabel Pengguna & Role (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'noc', 'technician') NOT NULL DEFAULT 'technician',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Perangkat Aktif Multi-Vendor (MikroTik, CCR, OLT ZTE, dll)
CREATE TABLE IF NOT EXISTS network_devices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    device_type ENUM('mikrotik_router', 'olt') NOT NULL,
    vendor_driver VARCHAR(50) NOT NULL COMMENT 'mikrotik_ros, zte_c300, zte_c320, huawei, hsgq, generic_snmp',
    ip_address VARCHAR(45) NOT NULL,
    api_port INT UNSIGNED DEFAULT 8728,
    ssh_telnet_port INT UNSIGNED DEFAULT 23,
    snmp_port INT UNSIGNED DEFAULT 161,
    username_enc TEXT NULL COMMENT 'Encrypted with AES-256-GCM',
    password_enc TEXT NULL COMMENT 'Encrypted with AES-256-GCM',
    snmp_community_enc TEXT NULL COMMENT 'Encrypted with AES-256-GCM',
    is_online TINYINT(1) NOT NULL DEFAULT 1,
    last_polled_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Titik Infrastruktur GIS (POP, ODC, JB, ODP, Customer)
CREATE TABLE IF NOT EXISTS gis_nodes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_node_id BIGINT UNSIGNED NULL COMMENT 'Relasi pohon hierarki ke node di atasnya',
    device_id INT UNSIGNED NULL COMMENT 'Relasi ke OLT/Router jika node adalah POP atau Pelanggan',
    node_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Contoh: JB-SMG-001, ODP-SMG-012',
    node_name VARCHAR(120) NOT NULL,
    node_type ENUM('POP', 'ODC', 'JB', 'ODP', 'CUSTOMER') NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    input_method ENUM('gps', 'map_marker', 'manual_latlong') NOT NULL DEFAULT 'map_marker',
    port_capacity INT UNSIGNED DEFAULT 0 COMMENT 'Kapasitas port untuk ODC/ODP',
    address_note VARCHAR(255) NULL COMMENT 'Patokan lokasi lapangan',
    metadata_json JSON NULL COMMENT 'Info tambahan: warna tube/core di JB, nomor port PON',
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_node_type (node_type),
    INDEX idx_parent_node (parent_node_id),
    INDEX idx_coordinates (latitude, longitude),
    CONSTRAINT fk_parent_node FOREIGN KEY (parent_node_id) REFERENCES gis_nodes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Jalur Kabel FO (Polyline untuk Leaflet Map)
CREATE TABLE IF NOT EXISTS gis_cables (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cable_code VARCHAR(50) NOT NULL UNIQUE,
    cable_type ENUM('feeder', 'distribution', 'drop_core') NOT NULL,
    core_count INT UNSIGNED NOT NULL DEFAULT 12,
    start_node_id BIGINT UNSIGNED NOT NULL,
    end_node_id BIGINT UNSIGNED NOT NULL,
    waypoints_json JSON NOT NULL COMMENT 'Array koordinat [[lat,lng], [lat,lng]] untuk garis Polyline Leaflet',
    length_meters DECIMAL(10, 2) DEFAULT 0,
    current_visual_status ENUM('normal', 'warning', 'cut_suspected') NOT NULL DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_start_end (start_node_id, end_node_id),
    CONSTRAINT fk_cable_start FOREIGN KEY (start_node_id) REFERENCES gis_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_cable_end FOREIGN KEY (end_node_id) REFERENCES gis_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Status Terkini Pelanggan & Modem (Ukuran Tabel Tetap & Cepat)
CREATE TABLE IF NOT EXISTS device_current_status (
    node_id BIGINT UNSIGNED PRIMARY KEY COMMENT '1-to-1 dengan gis_nodes (tipe CUSTOMER/ODP)',
    olt_device_id INT UNSIGNED NULL,
    mikrotik_device_id INT UNSIGNED NULL,
    onu_interface VARCHAR(60) NULL COMMENT 'Contoh: gpon-onu_1/2/1:5',
    onu_sn VARCHAR(50) NULL COMMENT 'Serial Number Modem ONT/ONU',
    pppoe_username VARCHAR(80) NULL,
    pppoe_ip VARCHAR(45) NULL,
    connection_status ENUM('ONLINE', 'LOS', 'DYING_GASP', 'OFFLINE', 'WARNING_DBM') NOT NULL DEFAULT 'ONLINE',
    rx_power_dbm DECIMAL(5, 2) NULL COMMENT 'Nilai OPM sisi modem pelanggan, misal -19.45',
    tx_power_dbm DECIMAL(5, 2) NULL,
    last_state_change_at DATETIME NULL,
    last_checked_at DATETIME NOT NULL,
    INDEX idx_status (connection_status),
    CONSTRAINT fk_status_node FOREIGN KEY (node_id) REFERENCES gis_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel TEMPORARY LOG (Otomatis Dihapus Berkala Sesuai Pilihan Klien)
CREATE TABLE IF NOT EXISTS monitoring_temp_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    node_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    rx_power_dbm DECIMAL(5, 2) NULL,
    fault_Note VARCHAR(255) NULL COMMENT 'Catatan otomatis korelasi titik putus',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at) COMMENT 'Indeks utama untuk percepatan Auto-Delete',
    INDEX idx_node_log (node_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel Pengaturan Sistem (Termasuk Konfigurasi Auto-Delete Temp Log)
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data Awal Pengaturan Sistem
INSERT INTO system_settings (setting_key, setting_value) VALUES
('temp_log_retention_days', '7'),
('temp_log_auto_delete_enabled', '1'),
('rx_power_warning_threshold', '-25.00'),
('rx_power_critical_threshold', '-28.00'),
('polling_interval_seconds', '120')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
