# 📖 API Documentation & Standar REST API — NMS-GIS ISP

Dokumen ini memuat standar pemeliharaan dokumentasi, spesifikasi kontrak JSON, dan katalog lengkap seluruh endpoint REST API pada **Sistem Monitoring Jaringan Multi-Vendor & GIS Fiber Optik (NMS-GIS ISP)**.

---

## 1. Aturan Wajib Pemeliharaan Dokumentasi API

Setiap kali melakukan penambahan, perubahan, atau penghapusan endpoint, parameter, struktur respons, middleware, atau hak akses role, developer **WAJIB** memperbarui file ini (`doc/api-documentation.md`).

### Kapan Harus Memperbarui:
* **Menambah endpoint baru**: Catat rute pada modul yang sesuai beserta detail lengkap (HTTP method, path, controller, middleware, role akses, request body, dan format respons).
* **Mengubah validasi / struktur response**: Perbarui tabel parameter atau contoh payload JSON.
* **Mengubah hak akses RBAC**: Perbarui bagian endpoint terkait dan perbarui matriks pada bagian *Akses Per Role*.
* **Menambah migrasi database**: Dokumentasikan atribut/field baru yang berpengaruh pada REST API.

### Standar Dokumentasi:
1. Format URL selalu diawali dengan prefix `/api/v1/`.
2. Header respons selalu menyertakan `Content-Type: application/json; charset=UTF-8`.
3. Gunakan Bahasa Indonesia untuk deskripsi dan header agar seragam dengan standar proyek.
4. Jangan menambahkan data *placeholder* atau *TODO* — setiap endpoint terdokumentasi harus akurat dan siap diuji.

---

## 2. Matriks Akses Per Role (RBAC Summary)

Sistem menggunakan kontrol akses berbasis peran (*Role-Based Access Control*):

| Modul & Endpoint | Method | Path | Super Admin | NOC | Teknisi Lapangan | Publik |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| **Auth: Login** | `POST` | `/api/v1/auth/login` | ✅ | ✅ | ✅ | ✅ |
| **Auth: Refresh Token** | `POST` | `/api/v1/auth/refresh` | ✅ | ✅ | ✅ | ❌ |
| **Auth: Profile Me** | `GET` | `/api/v1/auth/me` | ✅ | ✅ | ✅ | ❌ |
| **GIS: Data Peta Lengkap** | `GET` | `/api/v1/gis/map-data` | ✅ | ✅ | ✅ | ❌ |
| **GIS: Tambah Node** | `POST` | `/api/v1/gis/nodes` | ✅ | ✅ | ✅ | ❌ |
| **GIS: Ubah Koordinat/Node** | `PUT` | `/api/v1/gis/nodes/{id}` | ✅ | ✅ | ✅ | ❌ |
| **GIS: Hapus Node** | `DELETE` | `/api/v1/gis/nodes/{id}` | ✅ | ✅ | ❌ | ❌ |
| **GIS: Tambah Kabel FO** | `POST` | `/api/v1/gis/cables` | ✅ | ✅ | ❌ | ❌ |
| **GIS: Hapus Kabel FO** | `DELETE` | `/api/v1/gis/cables/{id}` | ✅ | ✅ | ❌ | ❌ |
| **Device: Daftar Perangkat** | `GET` | `/api/v1/devices` | ✅ | ✅ | ❌ | ❌ |
| **Device: Tambah/Edit Device** | `POST` | `/api/v1/devices` | ✅ | ❌ | ❌ | ❌ |
| **Device: Test Koneksi** | `POST` | `/api/v1/devices/{id}/test` | ✅ | ✅ | ❌ | ❌ |
| **Monitoring: Live OPM** | `GET` | `/api/v1/monitoring/nodes/{id}/live-opm` | ✅ | ✅ | ✅ | ❌ |
| **Monitoring: Alarm Aktif** | `GET` | `/api/v1/monitoring/active-faults` | ✅ | ✅ | ✅ | ❌ |
| **Logs: Lihat Ukuran & Log** | `GET` | `/api/v1/logs/temp` | ✅ | ✅ | ❌ | ❌ |
| **Logs: Atur Retensi Hari** | `PUT` | `/api/v1/settings/log-retention` | ✅ | ❌ | ❌ | ❌ |
| **Logs: Purge Bersihkan Log** | `DELETE` | `/api/v1/logs/temp/purge` | ✅ | ❌ | ❌ | ❌ |

---

## 3. Standar Format Respons JSON

### Respons Berhasil (200 OK / 201 Created):
```json
{
  "status": "success",
  "message": "Deskripsi singkat keberhasilan operasi.",
  "data": { ... }
}
```

### Respons Gagal (400 / 401 / 403 / 422 / 429 / 500):
```json
{
  "status": "error",
  "message": "Pesan deskripsi kesalahan yang mudah dipahami.",
  "errors": [ ... ]
}
```

---

## 4. Katalog Endpoint REST API

### 4.1 Modul Autentikasi (`/api/v1/auth`)

#### `POST /api/v1/auth/login`
* **Controller:** `AuthController@login`
* **Middleware:** `CorsMiddleware`, `RateLimitMiddleware` (Maksimal 5 percobaan gagal / 5 menit per IP)
* **Akses:** Publik
* **Request Body:**
  ```json
  {
    "email": "admin@nms.isp",
    "password": "AdminPassword123!"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "status": "success",
    "message": "Login berhasil.",
    "data": {
      "user": {
        "id": 1,
        "name": "Super Administrator",
        "email": "admin@nms.isp",
        "role": "super_admin"
      },
      "token": {
        "access_token": "eyJ0eXAi...",
        "refresh_token": "eyJ0eXAi...",
        "token_type": "Bearer",
        "expires_in": 3600
      }
    }
  }
  ```

#### `POST /api/v1/auth/refresh`
* **Controller:** `AuthController@refresh`
* **Request Body:** `{"refresh_token": "eyJ0eXAi..."}`
* **Response (200 OK):** Menghasilkan `access_token` baru.

#### `GET /api/v1/auth/me`
* **Controller:** `AuthController@me`
* **Middleware:** `AuthMiddleware`
* **Response (200 OK):** Mengembalikan data profil pengguna yang sedang login.

---

### 4.2 Modul GIS Inventory & Topology (`/api/v1/gis`)

#### `GET /api/v1/gis/map-data`
* **Controller:** `GisController@getMapData`
* **Middleware:** `AuthMiddleware` (Semua Role)
* **Response (200 OK):**
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
        "check_coordinates": { "latitude": -6.9911200, "longitude": 110.4235000 },
        "recommendation": "Seluruh pelanggan di bawah ODP-SMG-005 mengalami LOS. Periksa fisik kabel di JB-SMG-002."
      }
    ],
    "nodes": [
      {
        "id": 25,
        "parent_node_id": 14,
        "node_code": "ODP-SMG-005",
        "node_name": "ODP Ruko Simpang Lima",
        "node_type": "ODP",
        "icon_type": "icon_odp_red_pulse",
        "latitude": -6.9915000,
        "longitude": 110.4241000,
        "input_method": "map_marker",
        "port_capacity": 16,
        "address_note": "Tiang depan ruko nomor 3",
        "status": "LOS",
        "rx_power_dbm": null
      }
    ],
    "cables": [
      {
        "id": 88,
        "cable_code": "CBL-DIST-JB02-ODP05",
        "cable_type": "distribution",
        "core_count": 12,
        "status_color": "#EF4444",
        "is_flashing": true,
        "length_meters": 62.10,
        "waypoints": [
          [-6.9911200, 110.4235000],
          [-6.9913100, 110.4238200],
          [-6.9915000, 110.4241000]
        ]
      }
    ]
  }
  ```

#### `POST /api/v1/gis/nodes`
* **Controller:** `GisController@createNode`
* **Middleware:** `AuthMiddleware` (Semua Role)
* **Request Body:**
  ```json
  {
    "parent_node_id": 14,
    "node_code": "JB-SMG-042",
    "node_name": "Joint Box Simpang Lima Tiang 4",
    "node_type": "JB",
    "latitude": -6.9902851,
    "longitude": 110.4229104,
    "input_method": "map_marker",
    "port_capacity": 24,
    "address_note": "Tiang depan minimarket, klem sabuk stainless",
    "onu_sn": null,
    "pppoe_username": null
  }
  ```
* **Response (201 Created):** Node berhasil disimpan.

#### `PUT /api/v1/gis/nodes/{id}`
* **Controller:** `GisController@updateNode`
* **Fungsi:** Mengubah koordinat (drag-and-drop marker pada Leaflet) atau data atribut node.
* **Request Body:**
  ```json
  {
    "latitude": -6.9903100,
    "longitude": 110.4229500,
    "input_method": "map_marker"
  }
  ```

#### `POST /api/v1/gis/cables`
* **Controller:** `GisController@createCable`
* **Middleware:** `AuthMiddleware` (`super_admin`, `noc`)
* **Request Body:**
  ```json
  {
    "cable_code": "CBL-DIST-JB01-ODP02",
    "cable_type": "distribution",
    "core_count": 12,
    "start_node_id": 3,
    "end_node_id": 5,
    "length_meters": 65.5,
    "waypoints": [
      [-6.9911200, 110.4235000],
      [-6.9914000, 110.4237000],
      [-6.9918000, 110.4238000]
    ]
  }
  ```

---

### 4.3 Modul Perangkat & Driver Multi-Vendor (`/api/v1/devices`)

#### `POST /api/v1/devices`
* **Controller:** `DeviceController@createDevice`
* **Middleware:** `AuthMiddleware` (`super_admin`)
* **Fungsi:** Menyimpan kredensial router MikroTik atau OLT (password & SNMP community dienkripsi otomatis menggunakan **AES-256-GCM** sebelum disimpan ke database).

#### `POST /api/v1/devices/{id}/test`
* **Controller:** `DeviceController@testConnection`
* **Middleware:** `AuthMiddleware` (`super_admin`, `noc`)
* **Fungsi:** Menguji konektivitas API RouterOS / SNMP / Telnet secara langsung menggunakan native socket tanpa eksekusi shell.

---

### 4.4 Modul Monitoring & Virtual OPM (`/api/v1/monitoring`)

#### `GET /api/v1/monitoring/nodes/{id}/live-opm`
* **Controller:** `MonitoringController@getLiveOpm`
* **Middleware:** `AuthMiddleware` (Semua Role)
* **Fungsi:** Memanggil API/SNMP OLT secara on-demand saat tombol *"Cek OPM Live"* ditekan di antarmuka peta Leaflet untuk membaca nilai *Rx Power* (dBm) modem detik itu juga.

#### `GET /api/v1/monitoring/active-faults`
* **Controller:** `MonitoringController@getActiveFaults`
* **Fungsi:** Mengembalikan daftar insiden putus jalur FO aktif berdasarkan hasil korelasi pohon topologi (*FaultAnalyzerService*).

---

### 4.5 Modul Temporary Log & Pengaturan (`/api/v1/logs`, `/api/v1/settings`)

#### `GET /api/v1/logs/temp`
* **Controller:** `MonitoringController@getTempLogs`
* **Middleware:** `AuthMiddleware` (`super_admin`, `noc`)
* **Response:** Daftar riwayat perubahan status serta total baris dan estimasi ukuran tabel (MB).

#### `PUT /api/v1/settings/log-retention`
* **Middleware:** `AuthMiddleware` (`super_admin`)
* **Request Body:** `{"retention_days": 7, "auto_delete_enabled": true}`

#### `DELETE /api/v1/logs/temp/purge`
* **Middleware:** `AuthMiddleware` (`super_admin`)
* **Fungsi:** Menghapus seluruh baris log sementara secara instan (*Truncate/Delete Safe*).
