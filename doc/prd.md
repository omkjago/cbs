# Product Requirements Document (PRD) & Spesifikasi Teknis

**Nama Proyek:** Sistem Monitoring Jaringan Multi-Vendor & Pemetaan GIS Fiber Optik (NMS-GIS ISP)

**Arsitektur:** Web-Based Full REST API (PHP Native Tanpa Framework) & Leaflet.js

**Versi Dokumen:** 1.0

**Status:** Draft Siap Eksekusi (Ready for Development)

---

## 1. Latar Belakang & Tujuan Produk

### 1.1 Pernyataan Masalah (Problem Statement)

1. **Monitoring Reaktif:** Klien (ISP) tidak mengetahui adanya gangguan koneksi pelanggan secara langsung dan baru bertindak setelah pelanggan melapor.
2. **Ketiadaan Dokumentasi GIS:** Lokasi infrastruktur pasif di lapangan seperti *Optical Distribution Cabinet* (ODC), *Joint Box* (JB), *Optical Distribution Point* (ODP/ODM), serta jalur kabel Fiber Optik (FO) belum terpetakan secara digital.
3. **Pelacakan Gangguan Manual:** Saat jalur FO putus, teknisi harus melakukan pengecekan *Optical Power Meter* (OPM) secara manual dari titik ke titik karena tidak adanya data redaman terpusat maupun korelasi topologi jaringan.
4. **Infrastruktur Multi-Vendor:** Perangkat aktif terdiri dari berbagai merek (MikroTik, CCR, OLT ZTE, dan merek lainnya) yang membutuhkan satu *dashboard* terintegrasi.

### 1.2 Tujuan Produk (Product Goals)

* Mendeteksi gangguan pelanggan dan perubahan nilai redaman optik (*Rx Power*) secara otomatis maksimal dalam waktu **1–3 menit** sejak insiden terjadi.
* Menyediakan fitur *progressive web tagging* berbasis **Leaflet.js** dengan **Custom Icon Marker** untuk memetakan aset lapangan dari nol melalui 3 metode input lokasi.
* Menentukan estimasi segmen kabel FO atau titik JB/ODP yang mengalami putus jalur secara otomatis berdasarkan korelasi *alarm* OLT dan hierarki topologi.
* Menjaga performa *database* tetap ringan dan cepat melalui sistem **Temporary Log** dengan fitur penghapusan otomatis (*auto-delete*) sesuai rentang hari yang ditentukan klien.

### 1.3 Target Pengguna (User Personas)

| Role Pengguna | Deskripsi & Tanggung Jawab | Hak Akses Utama (RBAC) |
| --- | --- | --- |
| **Super Admin / Manajemen** | Pemilik sistem / Kepala IT ISP | Akses penuh: manajemen *user*, kredensial perangkat (MikroTik/OLT), pengaturan retensi *temporary log*, seluruh peta & laporan. |
| **NOC (Network Operations Center)** | Tim pemantau jaringan di kantor pusat | Memantau *dashboard* peta *real-time*, mengelola topologi GIS, melihat *virtual OPM*, dan menerbitkan tiket/titik koordinat gangguan ke teknisi. |
| **Teknisi Lapangan (Field Engineer)** | Tim instalasi & perbaikan FO di lapangan | Mengakses web via HP untuk *tagging* lokasi JB/ODP/Pelanggan (via GPS/Marker), melihat peta jalur FO, dan mengecek status redaman modem. |

---

## 2. Arsitektur Sistem & Spesifikasi Teknis

Sistem dirancang menggunakan pendekatan **Decoupled REST API Architecture** agar antarmuka web tidak mengalami *timeout* saat mengambil data dari banyak perangkat jaringan.

```
[Perangkat Jaringan: MikroTik / CCR / OLT ZTE / Lainnya]
                       ▲
                       │ (VPN Private Tunnel: RouterOS API, SNMP, SSH/Telnet)
                       ▼
         [PHP CLI Background Poller Engine]  ◄─── (Cronjob / Linux Supervisor)
                       │
                       ▼ (Update Current Status & Insert State-Change Temp Log)
              [Database MySQL / MariaDB]     ◄─── [Cron Auto-Purge Temp Log]
                       ▲
                       │ (PDO Prepared Statements)
                       ▼
       [PHP Native Full REST API + Middleware]
                       ▲
                       │ (HTTPS JSON / GeoJSON + JWT Bearer Token)
                       ▼
    [Frontend Web App: HTML5 + JS + Leaflet.js]

```

### 2.1 Spesifikasi Teknologi (Tech Stack)

* **Backend API:** PHP Versi Terbaru (PHP 8.3+ / 8.4+ / 8.5+ dengan patch keamanan aktif untuk mitigasi celah RCE/PHP2Shell) Native (Tanpa Framework), berorientasi objek (OOP), struktur modular (Controller, Service, Repository, Adapter).
* **Database:** MySQL 8.0 / MariaDB 10.6+ (menggunakan *Engine InnoDB* untuk transaksi dan indeks koordinat).
* **Ekstensi PHP Wajib:** `php-pdo`, `php-snmp`, `php-ssh2`, `php-sockets`, `php-openssl`, `php-curl`, `php-mbstring`.
* **Frontend & Peta:** React SPA (Vite + React), Leaflet.js / React-Leaflet, TailwindCSS, REST API Client dengan integrasi JWT Bearer token & Live GIS Map.
* **CI/CD & Deployment:** GitHub Actions Pipeline untuk Automated Testing (PHP syntax & Unit Tests, Frontend build) dan Automated Continuous Deployment (CD) ke server hosting via SSH / rsync / FTP.
* **Server & Jaringan:** Web Server Nginx/Apache dengan PHP-FPM aman (bukan mode PHP-CGI legacy), **SSL/HTTPS wajib** (syarat mutlak agar fitur akses GPS HTML5 Geolocation berfungsi di *browser* HP), serta koneksi VPN (*WireGuard/OpenVPN/L2TP*) dari server aplikasi ke jaringan manajemen ISP.

---

## 3. Kebutuhan Fungsional (Functional Requirements)

### Modul 1: Manajemen Perangkat Multi-Vendor (Active Device Management)

* **FR-1.1:** Sistem dapat menyimpan data perangkat aktif (Router MikroTik/CCR dan OLT berbagai merek) beserta parameter koneksinya (IP Address, Port API/SSH/Telnet, SNMP Community, SNMP Version, Username, Password).
* **FR-1.2:** Sistem menggunakan pola **Driver/Adapter Pattern** di PHP Native sehingga penambahan merek OLT baru cukup dengan menambahkan satu *class* parser tanpa mengubah kode utama:
* `MikrotikAdapter`: Menarik data *PPPoE Active*, *PPPoE Secret*, status *interface*, dan IP pelanggan via RouterOS API.
* `ZteOltAdapter` / `GenericSnmpOltAdapter`: Menarik status *ONU Phase State* (*Online*, *LOS*, *Dying Gasp*, *Offline*) dan nilai optik *Rx/Tx Power* (dBm) via SNMP OID atau CLI Telnet/SSH.


* **FR-1.3:** Tersedia tombol **"Test Connection"** di web untuk menguji apakah server berhasil terhubung ke MikroTik/OLT sebelum data disimpan.

### Modul 2: GIS OSP Inventory & Leaflet Location Picker

* **FR-2.1 (Tiga Metode Input Lokasi Tersinkronisasi):** Pada form tambah/edit titik infrastruktur (POP, ODC, JB, ODP, Pelanggan), pengguna dapat menentukan koordinat melalui 3 cara yang saling terhubung secara *real-time*:
1. **Interaksi Icon Marker di Leaflet:** Klik pada peta atau geser (*drag-and-drop*) *icon marker* untuk mengisi kolom *Latitude* dan *Longitude* secara otomatis.
2. **Deteksi Lokasi Saat Ini (Auto-GPS):** Tombol *"Gunakan Lokasi Saya"* menggunakan `navigator.geolocation.getCurrentPosition()` untuk memindahkan *marker* ke titik berdiri teknisi saat itu juga.
3. **Input Manual (Ketik/Paste Lat-Long & Pencarian Nama Lokasi):** Mengetik alamat (via Geocoding API) atau menempelkan koordinat `-6.9932, 110.4203` yang otomatis memindahkan kamera peta Leaflet (`map.flyTo`) ke lokasi tersebut.


* **FR-2.2 (Custom Icon Marker Berdasarkan Jenis Node):** Peta Leaflet wajib menampilkan ikon yang berbeda untuk tiap jenis aset:
* **POP / Server / OLT:** Ikon Tower/Server.
* **ODC:** Ikon Kabinet Besar.
* **JB (Joint Box / Closure):** Ikon Titik Sambung (Diamond/Bulat).
* **ODP / ODM:** Ikon Kotak Distribusi.
* **Pelanggan (ONT/ONU):** Ikon Rumah.


* **FR-2.3 (Pemetaan Hierarki & Jalur Kabel FO):**
* Setiap node memiliki relasi `parent_id` (Contoh: `Pelanggan → ODP-01 → JB-02 → JB-01 → ODC-A → OLT Port PON 1`).
* Pengguna dapat menggambar jalur kabel FO (*Polyline*) di peta Leaflet yang menghubungkan antar titik (beserta *waypoint* tiang belokan kabel) dan mencatat kapasitas *core* (misal: Kabel 12 Core / 24 Core).


* **FR-2.4 (Filter Layer Peta):** Pengguna dapat menyalakan/mematikan tampilan *layer* tertentu di peta Leaflet (misal: sembunyikan ikon rumah pelanggan normal, tampilkan hanya JB, ODP, dan pelanggan yang sedang gangguan).

### Modul 3: Proactive Monitoring & Virtual OPM

* **FR-3.1:** *Background Worker* PHP menarik status perangkat dan pelanggan setiap interval waktu tertentu (default: setiap 2 menit).
* **FR-3.2 (Klasifikasi Status & Warna Marker/Jalur di Leaflet):**
* **Hijau (Online - Normal):** Pelanggan aktif dan redaman *Rx Power* berada di rentang normal (misal: `-14.00 dBm` s/d `-24.99 dBm`).
* **Kuning/Oranye (Online - High Attenuation Warning):** Pelanggan masih terkoneksi tetapi nilai *Rx Power* melewati ambang batas aman (misal: `-25.00 dBm` s/d `-28.00 dBm`).
* **Abu-abu (Offline - Dying Gasp / Power Off):** Modem pelanggan mati karena listrik rumah padam atau adaptor tercabut.
* **Merah Berkedip (Offline - LOS / Loss of Signal):** Sinyal optik terputus.


* **FR-3.3 (On-Demand Live OPM Check):** Saat teknisi atau NOC mengklik *marker* pelanggan atau ODP di peta Leaflet, tersedia tombol **"Cek Redaman Sekarang (Realtime OPM)"** yang langsung memanggil API OLT untuk mengambil nilai *Rx Power* detik itu juga tanpa menunggu jadwal *cronjob*.

### Modul 4: Smart Fault Localization (Deteksi Estimasi Titik Putus FO)

* **FR-4.1 (Algoritma Korelasi Pohon Topologi):**
* **Gangguan Individu (Drop Core Cut):** Jika hanya 1 pelanggan pada sebuah ODP yang berstatus `LOS`, sistem menandai gangguan hanya pada garis kabel *drop core* pelanggan tersebut.
* **Gangguan ODP (Distribution Cut):** Jika $\ge 80\%$ pelanggan pada satu ODP berstatus `LOS` secara bersamaan, sistem menandai ODP tersebut dan segmen kabel menuju *parent* terdekatnya (JB/ODC) dengan warna **Merah Tebal**.
* **Gangguan Backbone / JB (Feeder/Sub-Feeder Cut):** Jika beberapa ODP yang berada di bawah satu jalur **Joint Box (JB)** yang sama mengalami `LOS` bersamaan, sistem menelusuri pohon topologi ke atas (*upward tree traversal*) hingga menemukan titik percabangan terakhir yang masih memiliki ODP berstatus *Online*. Segmen di antara titik sehat terakhir dan **JB pertama yang seluruh turunannya mati** ditetapkan sebagai **Lokasi Estimasi Putus FO**.


* **FR-4.2 (Panel & Alert Gangguan):** Menampilkan *banner* peringatan di *dashboard* berisi daftar insiden aktif lengkap dengan tautan *"Lihat di Peta"* dan tombol *"Buka di Google Maps"* (untuk navigasi teknisi menuju koordinat JB/ODP yang terdampak).

### Modul 5: Manajemen Temporary Log & Auto-Delete (Database Optimization)

* **FR-5.1 (Pemisahan Status Terkini & Log Sementara):**
* Data kondisi terakhir disimpan di tabel `device_current_status` menggunakan operasi `UPDATE` (jumlah baris selalu tetap mengikuti jumlah pelanggan/perangkat).
* Riwayat kejadian disimpan di tabel `monitoring_temp_logs` hanya ketika terjadi **perubahan status (State Change)** (misal: dari `ONLINE` ke `LOS`, atau ketika redaman melewati batas *warning*).


* **FR-5.2 (Pengaturan Retensi Otomatis oleh Klien):**
* Di halaman *Pengaturan Sistem*, klien dapat memilih atau menginput masa simpan *temporary log* dalam satuan hari (contoh: **1, 3, 7, 14, atau 30 hari**).
* Sistem menampilkan informasi jumlah baris *temporary log* saat ini dan estimasi ukuran penyimpanan (MB).


* **FR-5.3 (Eksekusi Auto-Delete & Manual Purge):**
* Skrip otomatis berjalan setiap hari untuk menghapus seluruh baris pada `monitoring_temp_logs` yang usianya melebihi batas hari pilihan klien.
* Tersedia tombol **"Bersihkan Log Sementara Sekarang"** di *dashboard* bagi Super Admin untuk mengosongkan log secara instan kapan saja.



---

## 4. User Stories & Acceptance Criteria (Gherkin Format)

### US-01: Tagging Lokasi Infrastruktur via Peta Leaflet & GPS

* **Sebagai** Teknisi Lapangan, **saya ingin** menambahkan titik lokasi JB dan ODP melalui *browser* HP dengan memilih titik di peta Leaflet atau tombol GPS **agar** posisi infrastruktur tercatat akurat tanpa harus mengetik koordinat secara manual.
* **Acceptance Criteria:**
* **Given** teknisi membuka halaman *Tambah Node GIS* di *browser* melalui koneksi HTTPS,
* **When** teknisi menekan tombol *"Gunakan Lokasi Saya"* atau menggeser *Icon Marker* di peta Leaflet,
* **Then** kolom input `Latitude` dan `Longitude` otomatis terisi dengan koordinat lokasi *marker* terbaru (6 digit desimal) dan siap disimpan melalui REST API.



### US-02: Deteksi Otomatis Estimasi Lokasi Kabel FO Putus

* **Sebagai** staf NOC, **saya ingin** melihat garis jalur FO berubah menjadi merah di antara JB/ODP yang mengalami putus massal **agar** teknisi tidak perlu melakukan pengecekan OPM manual dari OLT/ODC satu per satu.
* **Acceptance Criteria:**
* **Given** `JB-01` membawahi `JB-02`, dan `JB-02` membawahi `ODP-05` serta `ODP-06`,
* **When** seluruh pelanggan di `ODP-05` dan `ODP-06` terdeteksi mengalami status `LOS` dari OLT, sementara pelanggan di bawah `JB-01` lainnya masih `ONLINE`,
* **Then** sistem menandai segmen kabel antara `JB-01` menuju `JB-02` dengan warna merah berkedip di peta Leaflet dan menampilkan estimasi titik putus di sekitar koordinat `JB-02`.



### US-03: Pengaturan Auto-Delete Temporary Log

* **Sebagai** Super Admin ISP, **saya ingin** mengatur penghapusan otomatis *log monitoring* sementara setiap $X$ hari sekali **agar** kapasitas *database* server tidak penuh dan aplikasi tetap berjalan cepat.
* **Acceptance Criteria:**
* **Given** Super Admin mengubah pengaturan *Retensi Temporary Log* menjadi `3 Hari` dan menyimpannya,
* **When** proses *scheduled cleanup* berjalan atau tombol hapus otomatis dipicu,
* **Then** seluruh data pada tabel `monitoring_temp_logs` yang memiliki `created_at` lebih tua dari $3 \times 24\text{ jam}$ terhapus secara permanen tanpa menghapus data master pelanggan maupun status terkini di peta.



---

## 5. Kebutuhan Non-Fungsional & Keamanan (PHP Native Security Standard)

Karena sistem dibangun menggunakan **PHP Native tanpa framework**, tim pengembang wajib mengimplementasikan lapisan keamanan mandiri berikut:

1. **Pencegahan SQL Injection (100% PDO Prepared Statements):**
* Dilarang menggunakan ekstensi `mysqli_query` dengan penggabungan *string* variabel (`"SELECT * FROM ... WHERE id = " . $_GET['id']`).
* Wajib menggunakan `PDO::prepare()` dan `PDO::execute()` dengan `PDO::ATTR_EMULATE_PREPARES => false`.


2. **Enkripsi Kredensial Perangkat Jaringan (AES-256-GCM):**
* Password akun pengguna web di-hash menggunakan `password_hash($pass, PASSWORD_ARGON2ID)`.
* Password MikroTik API, Telnet/SSH OLT, dan SNMP Community **wajib dienkripsi dua arah** menggunakan `openssl_encrypt` dengan algoritma `aes-256-gcm`. *Master Key* enkripsi disimpan di file `.env` di luar direktori publik (`public_html`) dan tidak boleh masuk ke repositori Git.


3. **Autentikasi API Stateless (JWT + HTTP-Only Refresh Token):**
* Setiap *endpoint* REST API (kecuali `/api/v1/auth/login`) wajib divalidasi oleh `AuthMiddleware.php` yang memeriksa keabsahan tanda tangan HMAC-SHA256 pada `Authorization: Bearer <token>`.
* Token memiliki masa berlaku pendek (misal: 60 menit) dengan mekanisme *Refresh Token*.


4. **Input Validation, XSS Protection & CORS Middleware:**
* Seluruh input JSON dari `php://input` harus divalidasi tipe datanya (khususnya validasi rentang nilai `latitude` antara `-90` s/d `90` dan `longitude` antara `-180` s/d `180`).
* Seluruh *output* teks yang dirender ke *popup* peta Leaflet wajib melalui sanitasi `htmlspecialchars()` atau menggunakan `textContent` di sisi JavaScript untuk mencegah *Stored XSS*.
* `CorsMiddleware.php` membatasi akses API hanya dari *domain frontend* resmi milik klien.


5. **Rate Limiting Middleware:**
* Endpoint login dibatasi maksimal **5 percobaan gagal per 5 menit** per IP Address untuk mencegah serangan *Brute Force*.


6. **Proteksi Celah Keamanan PHP-to-Shell (Mitigasi PHP2Shell & RCE CGI Argument Injection):**
* **Versi PHP Terbaru & Patch Keamanan Wajib:** Sistem wajib dijalankan pada PHP versi terbaru (PHP 8.3+ / 8.4+ / 8.5+ ter-patch) untuk menutup kerentanan *argument injection* pada modul CGI/FastCGI (misal CVE-2024-4577 atau varian PHP2Shell yang menyuntikkan argumen via *query string* untuk mengeksekusi *arbitrary code / shell*).
* **Zero Shell Execution Policy:** Seluruh interaksi jaringan dengan perangkat (MikroTik API, SNMP OLT, Telnet/SSH) wajib 100% menggunakan koneksi socket native atau library/ekstensi resmi PHP (`php-sockets`, `php-snmp`, `php-ssh2`). Dilarang keras menggunakan pemanggilan shell sistem (`exec()`, `shell_exec()`, `system()`, `passthru()`, `proc_open()`, `popen()`).
* **Hardening Konfigurasi Runtime (`php.ini`):**
  - Menonaktifkan fungsi berbahaya: `disable_functions = exec,passthru,shell_exec,system,proc_open,popen,show_source`
  - Mematikan inklusi remote: `allow_url_include = Off`
  - Menyembunyikan identitas server: `expose_php = Off`
  - Web server (Nginx/Apache) wajib menggunakan PHP-FPM aman dan dilarang mengarahkan *query string* ke *binary* PHP-CGI secara langsung.



---

## 6. Rancangan Skema Database (ERD & DDL SQL)

Berikut adalah skema tabel inti yang dioptimalkan untuk performa GIS dan manajemen *Temporary Log*:

```sql
-- 1. Tabel Pengguna & Role (RBAC)
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'noc', 'technician') NOT NULL DEFAULT 'technician',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Tabel Perangkat Aktif Multi-Vendor (MikroTik, CCR, OLT ZTE, dll)
CREATE TABLE network_devices (
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
) ENGINE=InnoDB;

-- 3. Tabel Titik Infrastruktur GIS (POP, ODC, JB, ODP, Customer)
CREATE TABLE gis_nodes (
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
) ENGINE=InnoDB;

-- 4. Tabel Jalur Kabel FO (Polyline untuk Leaflet Map)
CREATE TABLE gis_cables (
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
) ENGINE=InnoDB;

-- 5. Tabel Status Terkini Pelanggan & Modem (Ukuran Tabel Tetap & Cepat)
CREATE TABLE device_current_status (
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
) ENGINE=InnoDB;

-- 6. Tabel TEMPORARY LOG (Otomatis Dihapus Berkala Sesuai Pilihan Klien)
CREATE TABLE monitoring_temp_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    node_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    rx_power_dbm DECIMAL(5, 2) NULL,
    fault_Note VARCHAR(255) NULL COMMENT 'Catatan otomatis korelasi titik putus',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at) COMMENT 'Indeks utama untuk percepatan Auto-Delete',
    INDEX idx_node_log (node_id, created_at)
) ENGINE=InnoDB;

-- 7. Tabel Pengaturan Sistem (Termasuk Konfigurasi Auto-Delete Temp Log)
CREATE TABLE system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Data Awal Pengaturan
INSERT INTO system_settings (setting_key, setting_value) VALUES
('temp_log_retention_days', '7'),
('temp_log_auto_delete_enabled', '1'),
('rx_power_warning_threshold', '-25.00'),
('rx_power_critical_threshold', '-28.00'),
('polling_interval_seconds', '120');

```

---

## 7. Spesifikasi Endpoint REST API (JSON Contract)

Seluruh *endpoint* menggunakan awalan `/api/v1` dan mengembalikan header `Content-Type: application/json`.

### 7.1 Daftar Endpoint Utama

| Kategori | Method | Endpoint URL | Deskripsi Fungsi | Role Akses |
| --- | --- | --- | --- | --- |
| **Auth** | `POST` | `/api/v1/auth/login` | Login pengguna & penerbitan token JWT | Publik |
| **Devices** | `GET` | `/api/v1/devices` | Mengambil daftar router MikroTik & OLT | Admin, NOC |
| **Devices** | `POST` | `/api/v1/devices` | Menambah perangkat baru (enkripsi kredensial) | Super Admin |
| **Devices** | `POST` | `/api/v1/devices/{id}/test` | Menguji koneksi SNMP / API MikroTik | Super Admin |
| **GIS Map** | `GET` | `/api/v1/gis/map-data` | Mengambil seluruh Marker Node, Status & Polyline (GeoJSON) | Semua Role |
| **GIS Node** | `POST` | `/api/v1/gis/nodes` | Menyimpan lokasi JB/ODP/Pelanggan baru (GPS/Marker/LatLong) | Semua Role |
| **GIS Node** | `PUT` | `/api/v1/gis/nodes/{id}` | Memperbarui titik koordinat saat Marker digeser di Leaflet | Semua Role |
| **GIS Cable** | `POST` | `/api/v1/gis/cables` | Menyimpan tarikan garis jalur kabel FO (*Polyline*) | Admin, NOC |
| **OPM Live** | `GET` | `/api/v1/monitoring/nodes/{id}/live-opm` | Mengambil nilai *Rx Power* langsung dari OLT detik itu juga | Semua Role |
| **Faults** | `GET` | `/api/v1/monitoring/active-faults` | Daftar alarm aktif & hasil estimasi JB/ODP yang putus | Semua Role |
| **Temp Log** | `GET` | `/api/v1/logs/temp` | Menampilkan daftar log sementara & ukuran tabel (MB) | Admin, NOC |
| **Temp Log** | `PUT` | `/api/v1/settings/log-retention` | Mengubah jumlah hari *auto-delete* temporary log | Super Admin |
| **Temp Log** | `DELETE` | `/api/v1/logs/temp/purge` | Menghapus seluruh *temporary log* secara instan | Super Admin |

### 7.2 Contoh Payload JSON: Menambah Lokasi Node GIS (`POST /api/v1/gis/nodes`)

**Request Body:**

```json
{
  "parent_node_id": 14,
  "node_code": "JB-SMG-042",
  "node_name": "Joint Box Simpang Lima Tiang 4",
  "node_type": "JB",
  "latitude": -6.9902851,
  "longitude": 110.4229104,
  "input_method": "map_marker",
  "address_note": "Tiang depan minimarket, klem sabuk stainless",
  "metadata_json": {
    "core_spliced": 12,
    "tube_color": "Biru, Oranye"
  }
}

```

### 7.3 Contoh Payload JSON: Data Peta Leaflet & Lokalisasi Putus FO (`GET /api/v1/gis/map-data`)

**Response Body (200 OK):**

```json
{
  "status": "success",
  "summary": {
    "total_customers": 450,
    "online": 432,
    "warning_dbm": 4,
    "dying_gasp": 2,
    "los_cut": 12
  },
  "suspected_fiber_cuts": [
    {
      "cable_id": 88,
      "cable_code": "CBL-DIST-JB02-ODP05",
      "from_node": "JB-SMG-002",
      "to_node": "ODP-SMG-005",
      "affected_customers_count": 12,
      "check_coordinates": {
        "latitude": -6.9911200,
        "longitude": 110.4235000
      },
      "recommendation": "Seluruh pelanggan di bawah ODP-SMG-005 mengalami LOS. Periksa fisik kabel dan core di titik JB-SMG-002."
    }
  ],
  "nodes": [
    {
      "id": 25,
      "node_code": "ODP-SMG-005",
      "node_type": "ODP",
      "icon_type": "icon_odp_red_pulse",
      "latitude": -6.9915000,
      "longitude": 110.4241000,
      "status": "LOS",
      "avg_rx_power_dbm": null
    }
  ],
  "cables": [
    {
      "id": 88,
      "cable_code": "CBL-DIST-JB02-ODP05",
      "status_color": "#FF0000",
      "is_flashing": true,
      "waypoints": [
        [-6.9911200, 110.4235000],
        [-6.9913100, 110.4238200],
        [-6.9915000, 110.4241000]
      ]
    }
  ]
}

```

---

## 8. Spesifikasi Struktur Direktori PHP Native & Worker

Agar kode PHP Native mudah dipelihara oleh tim *developer* dan aman (file konfigurasi tidak bisa diakses langsung dari *browser*), wajib menggunakan struktur folder berikut:

```text
/nms-gis-project
├── /config
│   ├── database.php          # Koneksi PDO Singleton
│   └── env.php               # Parser file .env (Master Key AES, DB Credentials)
├── /src
│   ├── /Middlewares
│   │   ├── AuthMiddleware.php      # Validasi JWT & Role RBAC
│   │   ├── CorsMiddleware.php      # Pengaturan Header CORS
│   │   └── RateLimitMiddleware.php # Pembatas request login
│   ├── /Adapters                   # Multi-Vendor Driver Layer
│   │   ├── DeviceAdapterInterface.php
│   │   ├── MikrotikRosAdapter.php  # RouterOS API Client
│   │   ├── ZteOltAdapter.php       # SNMP & Telnet Parser untuk ZTE
│   │   └── GenericSnmpAdapter.php  # SNMP Standar untuk merek OLT lain
│   ├── /Services
│   │   ├── CryptoService.php       # Enkripsi/Dekripsi AES-256-GCM
│   │   ├── FaultAnalyzerService.php# Algoritma penentu titik putus JB/ODP
│   │   └── LogPurgeService.php     # Logika penghapusan temporary log
│   └── /Controllers
│       ├── AuthController.php
│       ├── DeviceController.php
│       ├── GisController.php
│       └── MonitoringController.php
├── /workers                        # Dijalankan via PHP CLI (Bukan Web)
│   ├── poller_worker.php           # Menarik data OLT/MikroTik tiap 2 menit
│   └── cleanup_temp_logs.php       # Cronjob auto-delete temporary log
├── /public                         # Satu-satunya folder yang dibuka di Web Server (DocumentRoot)
│   ├── index.php                   # Front Controller / Router REST API
│   ├── /assets
│   │   ├── /js
│   │   │   ├── app.js
│   │   │   └── leaflet-map-manager.js # Logika Custom Marker, Drag Pin & GPS
│   │   └── /icons                  # File SVG/PNG Icon Marker (OLT, JB, ODP, Rumah)
│   └── app.html                    # Antarmuka SPA Dashboard & Peta
└── .env                            # Dilarang masuk Git

```

---

## 9. Tahapan Pengembangan (Milestone & Delivery Plan)

| Fase / Sprint | Estimasi Durasi | Fokus Pengembangan & Deliverable |
| --- | --- | --- |
| **Fase 1: Core API, Security & GIS Tagging** | Minggu 1–2 | Setup struktur PHP Native, JWT Auth, Enkripsi AES-256, Database, dan halaman Peta Leaflet dengan fitur *Location Picker* (GPS, Drag Icon Marker, Input Lat/Long) + penggambaran garis kabel FO. *(Pada tahap ini tim teknisi klien sudah bisa mulai mencicil input lokasi JB/ODP di lapangan).* |
| **Fase 2: Multi-Vendor Poller & Virtual OPM** | Minggu 3–4 | Pembuatan modul `MikrotikRosAdapter` dan `OltSnmpAdapter`, skrip *background worker* penarik data *Rx Power* (dBm) dan status *LOS vs Dying Gasp*, serta fitur tombol *Cek Live OPM*. |
| **Fase 3: Smart Fault Localization & Temp Log** | Minggu 5–6 | Implementasi algoritma korelasi pohon topologi untuk mendeteksi segmen JB/ODP yang putus di peta Leaflet, pembuatan fitur manajemen *Temporary Log* (retensi $X$ hari), serta *testing* beban (*stress test*) & serah terima (UAT). |