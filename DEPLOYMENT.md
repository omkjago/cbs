# Panduan Deployment Hosting Hostinger (Git Deployment)

Dokumen ini menjelaskan alur kerja deployment aplikasi **NMS-GIS ISP** langsung menggunakan fitur bawaan **Hostinger Git Deployment (Clone langsung dari GitHub)**. Karena repositori GitHub bersifat publik, proses deployment berjalan instan, otomatis, dan tanpa memerlukan konfigurasi GitHub Actions maupun SSH secrets.

Panduan arsitektur dan konfigurasi lengkap tersedia di [**`doc/deployment-guide.md`**](file:///c:/Users/user/Documents/aldo/cbs/doc/deployment-guide.md).

---

## 1. Menghubungkan Repositori GitHub ke Hostinger hPanel

1. Masuk ke **Hostinger hPanel** $\rightarrow$ buka menu **Websites** $\rightarrow$ pilih domain/subdomain `cbs.bawananusantara.com`.
2. Di sidebar menu kiri, buka seksi **Advanced** $\rightarrow$ klik **Git**.
3. Di bagian **Create a Repository (Buat Repositori)**:
   * **Repository**: `https://github.com/omkjago/cbs.git`
   * **Branch**: `main` (atau `dev` untuk staging/development)
   * **Install Path**: Biarkan default atau sesuaikan dengan folder subdomain Anda (misal: `public_html/cbs`).
4. Klik tombol **Create / Buat**.
5. Hostinger akan melakukan `git clone` secara otomatis. Semua berkas aplikasi, frontend React (`public/dist/`), dan backend PHP akan langsung terpasang.

---

## 2. Otomatisasi Auto-Deploy via GitHub Webhook

Agar setiap ada pembaruan komit di GitHub langsung terdeploy secara otomatis ke Hostinger tanpa perlu klik tombol deploy manual:

1. Di menu **Git** Hostinger hPanel, cari repositori yang baru saja dibuat.
2. Di kolom **Auto-Deployment**, salin URL **Webhook** yang disediakan oleh Hostinger (contoh: `https://hpanel.hostinger.com/api/git/deploy/...`).
3. Buka repositori Anda di GitHub:
   * Buka **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ klik **Add webhook**.
   * **Payload URL**: Tempelkan URL Webhook dari Hostinger tadi.
   * **Content type**: `application/json`.
   * **Which events would you like to trigger this webhook?**: Pilih `Just the push event`.
   * Klik **Add webhook**.
4. Selesai! Sekarang setiap kali Anda menjalankan `git push origin main` (atau `dev`), Hostinger akan langsung menarik (*pull*) perubahan terbaru secara otomatis.

---

## 3. Konfigurasi File Environment Server (`.env`)

Di server Hostinger, siapkan file `.env` di dalam root direktori instalasi aplikasi (misal via **File Manager** hPanel):

1. Masuk ke **hPanel** $\rightarrow$ **File Manager** $\rightarrow$ buka folder instalasi aplikasi (misal `public_html/cbs/`).
2. Buat file baru bernama `.env` (atau salin dari `.env.example`).
3. Isi konfigurasi produksi:

```env
# ==============================================================================
# NMS-GIS ISP - Production Environment Configuration
# ==============================================================================

APP_NAME="NMS-GIS Fiber Optic Monitoring"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://cbs.bawananusantara.com

# Database MySQL Produksi (Hostinger MySQL Database)
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=u123456789_nms
DB_USERNAME=u123456789_nmsuser
DB_PASSWORD=PasswordDatabaseSangatKuat_2026!
DB_CHARSET=utf8mb4

# Master Key Enkripsi AES-256-GCM (Wajib 64 Karakter Hex)
APP_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Stateless JWT Authentication Secret Token
JWT_SECRET=c2VjdXJlX2p3dF9zZWNyZXRfdG9rZW5faXNwXzIwMjZfbXNnaXNfcHJvZHVjdGlvbg==
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# CORS
CORS_ALLOWED_ORIGINS=https://cbs.bawananusantara.com

# Ambang Batas Optical Power Meter (OPM dBm)
RX_POWER_WARNING_THRESHOLD=-25.00
RX_POWER_CRITICAL_THRESHOLD=-28.00
```

---

## 4. Eksekusi Migrasi Database Awal

Setelah database MySQL dibuat dan kredensial di `.env` telah diisi:
* Jalankan migrasi via SSH terminal (atau via fitur Web Terminal hPanel):
  ```bash
  cd domains/bawananusantara.com/public_html/cbs
  php database/migrate.php --clean-dummy
  ```
* Skrip akan otomatis membuat tabel, mengisi indeks koordinat GIS, hashing Argon2id user Super Admin default (`admin@nms.isp` / `Admin123!@#`), dan menjamin basis data bersih tanpa data dummy.

---

## 5. Penjadwalan Background Worker (Cron Jobs di Hostinger)

Di Hostinger hPanel, buka menu **Advanced** $\rightarrow$ **Cron Jobs**:

1. **Poller Worker (Polling OLT & MikroTik setiap 2 Menit)**:
   * **Common Settings**: `*/2 * * * *` (Every 2 minutes)
   * **Command**: `/usr/bin/php /home/uXXXX/domains/bawananusantara.com/public_html/cbs/workers/poller_worker.php >/dev/null 2>&1`
2. **Auto-Purge Worker (Pembersihan Log Harian Pukul 03:00 WIB)**:
   * **Common Settings**: `0 3 * * *` (Once a day at 03:00)
   * **Command**: `/usr/bin/php /home/uXXXX/domains/bawananusantara.com/public_html/cbs/workers/cleanup_temp_logs.php >/dev/null 2>&1`
