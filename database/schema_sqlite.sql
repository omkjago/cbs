-- ========================================================================
-- NMS-GIS ISP - SQLite Compatible Schema (For Local Dev / Testing)
-- ========================================================================

PRAGMA foreign_keys = ON;

-- 1. Users & RBAC
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'technician' CHECK(role IN ('super_admin', 'noc', 'technician')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Network Devices
CREATE TABLE IF NOT EXISTS network_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK(device_type IN ('mikrotik_router', 'olt')),
    vendor_driver TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    api_port INTEGER DEFAULT 8728,
    ssh_telnet_port INTEGER DEFAULT 23,
    snmp_port INTEGER DEFAULT 161,
    username_enc TEXT NULL,
    password_enc TEXT NULL,
    snmp_community_enc TEXT NULL,
    is_online INTEGER NOT NULL DEFAULT 1,
    last_polled_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. GIS Nodes
CREATE TABLE IF NOT EXISTS gis_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_node_id INTEGER NULL REFERENCES gis_nodes(id) ON DELETE SET NULL,
    device_id INTEGER NULL,
    node_code TEXT NOT NULL UNIQUE,
    node_name TEXT NOT NULL,
    node_type TEXT NOT NULL CHECK(node_type IN ('POP', 'ODC', 'JB', 'ODP', 'CUSTOMER')),
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    input_method TEXT NOT NULL DEFAULT 'map_marker' CHECK(input_method IN ('gps', 'map_marker', 'manual_latlong')),
    port_capacity INTEGER DEFAULT 0,
    address_note TEXT NULL,
    metadata_json TEXT NULL,
    created_by INTEGER NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_node_type ON gis_nodes (node_type);
CREATE INDEX IF NOT EXISTS idx_parent_node ON gis_nodes (parent_node_id);
CREATE INDEX IF NOT EXISTS idx_coordinates ON gis_nodes (latitude, longitude);

-- 4. GIS FO Cables (Polylines)
CREATE TABLE IF NOT EXISTS gis_cables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cable_code TEXT NOT NULL UNIQUE,
    cable_type TEXT NOT NULL CHECK(cable_type IN ('feeder', 'distribution', 'drop_core')),
    core_count INTEGER NOT NULL DEFAULT 12,
    start_node_id INTEGER NOT NULL REFERENCES gis_nodes(id) ON DELETE CASCADE,
    end_node_id INTEGER NOT NULL REFERENCES gis_nodes(id) ON DELETE CASCADE,
    waypoints_json TEXT NOT NULL,
    length_meters REAL DEFAULT 0,
    current_visual_status TEXT NOT NULL DEFAULT 'normal' CHECK(current_visual_status IN ('normal', 'warning', 'cut_suspected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_start_end ON gis_cables (start_node_id, end_node_id);

-- 5. Current Device & Customer Status
CREATE TABLE IF NOT EXISTS device_current_status (
    node_id INTEGER PRIMARY KEY REFERENCES gis_nodes(id) ON DELETE CASCADE,
    olt_device_id INTEGER NULL,
    mikrotik_device_id INTEGER NULL,
    onu_interface TEXT NULL,
    onu_sn TEXT NULL,
    pppoe_username TEXT NULL,
    pppoe_ip TEXT NULL,
    connection_status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(connection_status IN ('ONLINE', 'LOS', 'DYING_GASP', 'OFFLINE', 'WARNING_DBM')),
    rx_power_dbm REAL NULL,
    tx_power_dbm REAL NULL,
    last_state_change_at DATETIME NULL,
    last_checked_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_status ON device_current_status (connection_status);

-- 6. Temporary Monitoring Logs
CREATE TABLE IF NOT EXISTS monitoring_temp_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL,
    previous_status TEXT NULL,
    new_status TEXT NOT NULL,
    rx_power_dbm REAL NULL,
    fault_Note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_created_at ON monitoring_temp_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_node_log ON monitoring_temp_logs (node_id, created_at);

-- 7. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO system_settings (setting_key, setting_value) VALUES
('temp_log_retention_days', '7'),
('temp_log_auto_delete_enabled', '1'),
('rx_power_warning_threshold', '-25.00'),
('rx_power_critical_threshold', '-28.00'),
('polling_interval_seconds', '120');
