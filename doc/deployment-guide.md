# 🚀 PANDUAN LENGKAP DEPLOYMENT & SETTING GITHUB ACTIONS (CI/CD)
# SISTEM MONITORING JARINGAN MULTI-VENDOR & GIS FIBER OPTIK (NMS-GIS ISP)

Dokumen ini merupakan panduan resmi dan komprehensif bagi Tim Engineer, Sysadmin, dan DevOps untuk melakukan konfigurasi repositori GitHub, penyiapan server hosting (VPS / Cloud maupun Shared Hosting / cPanel), dan otomatisasi alur kerja deployment (*Continuous Integration & Continuous Deployment*) untuk sistem **NMS-GIS ISP**.

---

## 1. IKHTISAR ALUR OTOMATISASI CI/CD

Pipeline CI/CD dirancang untuk memastikan bahwa setiap kode yang dikirim ke repositori GitHub diverifikasi secara ketat sebelum dideploy secara otomatis ke server hosting tanpa *downtime*.

```mermaid
flowchart TD
    subgraph Local ["1. Lingkungan Kerja Developer"]
        DevCode["Commit Kode di branch dev"] --> GitPush["git push origin dev (atau cherry-pick ke main)"]
    end

    subgraph GitHubActions ["2. GitHub Actions CI/CD Runner"]
        GitPush --> CIJob["Job 1: CI (Lint, Test & Build)"]
        CIJob --> PHPCheck["PHP Lint (php -l) & Setup PHP 8.3/8.5"]
        PHPCheck --> AutoTests["Eksekusi 70 Asersi Master Tests (Phase 1 s/d Phase 4)"]
        AutoTests --> ViteBuild["Build React 18 SPA (npm run build -> public/dist/)"]
        ViteBuild --> UploadArtifact["Upload Production Artifacts"]
        UploadArtifact --> CDJob["Job 2: CD (Deploy to Hosting)"]
    end

    subgraph HostingServer ["3. Server Hosting Produksi / Staging"]
        CDJob --> CheckMethod{"Metode Deploy"}
        CheckMethod -- "Pilihan A: SSH_HOST ada" --> SSHRsync["Rsync via SSH (easingthemes/ssh-deploy)"]
        CheckMethod -- "Pilihan B: FTP_SERVER ada" --> FTPSDeploy["FTPS Deploy (SamKirkland/FTP-Deploy-Action)"]
        SSHRsync --> RemoteTasks["Jalankan php database/migrate.php & Chmod"]
        FTPSDeploy --> ServerReady["Aplikasi Live & Terpasang"]
        RemoteTasks --> ServerReady
    end
```

---

## 2. PANDUAN SETTING GITHUB REPOSITORY (LANGKAH DEMI LANGKAH)

### A. Menambahkan Repository Secrets di GitHub

GitHub Secrets digunakan untuk menyimpan kredensial sensitif server secara aman dan terenkripsi.

1. Buka browser dan buka repositori GitHub proyek: `https://github.com/omkjago/cbs`.
2. Klik tab **Settings** di navigasi atas repositori.
3. Di panel menu kiri, buka seksi **Security** $\rightarrow$ klik **Secrets and variables** $\rightarrow$ pilih **Actions**.
4. Klik tombol hijau **New repository secret**.
5. Masukkan *Name* dan *Secret* sesuai tabel di bawah ini:

#### 📌 Pilihan A: Server VPS / Dedicated Server (Sangat Disarankan via SSH)

Gunakan metode ini jika hosting Anda adalah VPS (Ubuntu, Debian, CentOS, AlmaLinux) atau Dedicated Server dengan akses SSH:

| Nama Secret (*Name*) | Deskripsi / Contoh Nilai |
| :--- | :--- |
| `SSH_HOST` | Alamat IP publik server atau hostname domain (contoh: `103.150.123.45` atau `nms.perusahaan.com`) |
| `SSH_USER` | Username login SSH server (contoh: `root` atau user deployer `deployer`) |
| `SSH_PORT` | Port SSH server (default: `22`, atau port custom seperti `2222`) |
| `SSH_PRIVATE_KEY` | **Isi lengkap OpenSSH Private Key** (termasuk baris `-----BEGIN OPENSSH PRIVATE KEY-----` sampai `-----END OPENSSH PRIVATE KEY-----`) |
| `DEPLOY_TARGET_DIR` | Path absolut folder direktori instalasi di server (contoh: `/var/www/nms-gis`) |

> [!TIP]
> **Cara Membuat SSH Key Khusus Deployer di Server VPS:**
> Jalankan perintah berikut di terminal VPS Anda:
> ```bash
> # Buat pasangan kunci SSH ed25519 tanpa passphrase
> ssh-keygen -t ed25519 -C "github-actions-cbs-deploy" -f ~/.ssh/github_deploy -N ""
> 
> # Tambahkan public key ke daftar authorized_keys
> cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
> 
> # Pastikan hak akses folder SSH aman
> chmod 700 ~/.ssh
> chmod 600 ~/.ssh/authorized_keys
> 
> # Tampilkan private key untuk disalin ke GitHub Secret SSH_PRIVATE_KEY
> cat ~/.ssh/github_deploy
> ```

---

#### 📌 Pilihan B: Shared Hosting / cPanel (via FTP / FTPS)

Gunakan metode ini jika hosting Anda adalah Shared Hosting / cPanel tanpa akses terminal SSH:

| Nama Secret (*Name*) | Deskripsi / Contoh Nilai |
| :--- | :--- |
| `FTP_SERVER` | Host FTP hosting Anda (contoh: `ftp.perusahaan.com` atau alamat IP server) |
| `FTP_USERNAME` | Akun user FTP cPanel Anda (contoh: `deploy@perusahaan.com` atau `cpaneluser`) |
| `FTP_PASSWORD` | Kata sandi akun FTP cPanel |
| `FTP_REMOTE_DIR` | Path folder web root di cPanel (contoh: `/public_html/nms/` atau `/public_html/`) |

---

### B. Konfigurasi Workflow Permissions di GitHub

Untuk memastikan GitHub Actions memiliki izin yang cukup untuk membuat rilis dan mengunggah artefak:

1. Di menu repositori: **Settings** $\rightarrow$ **Actions** $\rightarrow$ **General**.
2. Gulir ke bawah ke bagian **Workflow permissions**.
3. Pilih opsi **Read and write permissions**.
4. Centang kotak **Allow GitHub Actions to create and approve pull requests**.
5. Klik **Save**.

---

### C. Konfigurasi Aturan Proteksi Branch (Branch Protection)

Sesuai aturan [`doc/git-workflow.md`](file:///c:/Users/user/Documents/aldo/cbs/doc/git-workflow.md), branch `main` wajib steril dan hanya diperbarui melalui `git cherry-pick`:

1. Di menu repositori: **Settings** $\rightarrow$ **Branches**.
2. Klik **Add branch protection rule**.
3. Pada **Branch name pattern**, ketik `main`.
4. Centang aturan berikut:
   * **Require status checks to pass before merging** (Pilih job `Lint, Test & Build`).
   * **Do not allow bypassing the above settings**.
5. Klik **Create / Save changes**.

---

## 3. PERSIAPAN & KONFIGURASI SERVER HOSTING

### A. Kebutuhan Sistem & Paket Dependensi

Pastikan server hosting telah terpasang:
- **PHP**: Versi **8.3** atau **8.5+** (Mencegah kerentanan PHP2Shell / CVE-2024-4577).
- **Ekstensi PHP Wajib**:
  ```bash
  sudo apt update
  sudo apt install -y php8.3-fpm php8.3-cli php8.3-mysql php8.3-sqlite3 \
                      php8.3-curl php8.3-mbstring php8.3-xml php8.3-snmp
  ```
- **Database**: MySQL 8.0+ / MariaDB 10.5+ (Engine InnoDB, Charset `utf8mb4`).
- **Web Server**: Nginx (Sangat direkomendasikan) atau Apache 2.4+ / LiteSpeed.

---

### B. Konfigurasi Web Server

#### 1. Konfigurasi Nginx (Rekomendasi untuk Kecepatan & Keamanan)

Buat file konfigurasi virtual host di `/etc/nginx/sites-available/nms-gis`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name nms.perusahaan.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nms.perusahaan.com;

    # SSL Certificate (Let's Encrypt / ZeroSSL)
    ssl_certificate /etc/letsencrypt/live/nms.perusahaan.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nms.perusahaan.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # PENTING: Arahkan root ke folder /public, BUKAN root direktori aplikasi!
    root /var/www/nms-gis/public;
    index index.php index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(self)" always;

    # Mitigasi Serangan CGI Argument Injection (PHP2Shell / CVE-2024-4577)
    if ($query_string ~* "(-d|-s|-u|-w|%ad)") {
        return 403;
    }

    # Cache Aset Frontend React SPA
    location /dist/ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        try_files $uri =404;
    }

    # Blokir akses ke file sensitif & file dot (.env, .git, .sql)
    location ~ /\.(?!well-known).* {
        deny all;
    }

    location ~* \.(sql|sqlite|log|md|yml|yaml|ini|sh|bat)$ {
        deny all;
    }

    # Front Controller Routing (Peta Leaflet & REST API)
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM Handler
    location ~ \.php$ {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock; # Sesuaikan versi PHP
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        fastcgi_param HTTP_PROXY ""; # Mitigasi HTTPoxy
        fastcgi_read_timeout 60s;
    }
}
```

Aktifkan konfigurasi Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/nms-gis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

#### 2. Konfigurasi Apache / cPanel (Shared Hosting)

Jika menggunakan cPanel / Apache:
1. Masuk ke cPanel $\rightarrow$ menu **Domains** atau **Subdomains**.
2. Buat subdomain (misal: `nms.perusahaan.com`).
3. Set **Document Root** mengarah langsung ke subfolder `public_html/nms/public` (BUKAN `public_html/nms`).
4. File `.htaccess` protektif telah otomatis tersedia di dalam direktori `public/.htaccess` untuk memblokir celah CVE-2024-4577 dan mengatur routing front controller.

---

### C. Pembuatan & Konfigurasi File `.env` di Server

Di server hosting, buat file `.env` di dalam root direktori aplikasi (`/var/www/nms-gis/.env`):

```bash
cd /var/www/nms-gis
cp .env.example .env
nano .env
```

Sesuaikan isian variabel konfigurasi produksi:

```env
# ==============================================================================
# NMS-GIS ISP - Production Environment Configuration
# ==============================================================================

APP_NAME="NMS-GIS Fiber Optic Monitoring"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://nms.perusahaan.com

# Database MySQL Produksi
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nms_gis_db
DB_USERNAME=nms_gis_user
DB_PASSWORD=PasswordDatabaseSangatKuat_2026!
DB_CHARSET=utf8mb4

# Master Key Enkripsi AES-256-GCM (Wajib 64 Karakter Hex)
# Buat dengan: openssl rand -hex 32
APP_KEY=e8a71c5392f418b762810a95c34e72d1f90b83e4a2c1d7654890ef123456789a

# Stateless JWT Authentication
# Buat dengan: openssl rand -base64 48
JWT_SECRET=c2VjdXJlX2p3dF9zZWNyZXRfdG9rZW5faXNwXzIwMjZfbXNnaXNfcHJvZHVjdGlvbg==
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# CORS Allowed Origin (Domain Web Anda)
CORS_ALLOWED_ORIGINS=https://nms.perusahaan.com

# Ambang Batas Optical Power Meter (OPM dBm)
RX_POWER_WARNING_THRESHOLD=-25.00
RX_POWER_CRITICAL_THRESHOLD=-28.00
```

> [!IMPORTANT]
> **Jangan Pernah Mengabaikan `APP_KEY` dan `JWT_SECRET`!**
> `APP_KEY` digunakan oleh `CryptoService` untuk mengenkripsi password MikroTik dan SNMP community ZTE OLT menggunakan algoritma AES-256-GCM. Jika key ini berubah, kredensial perangkat yang tersimpan tidak akan bisa didekripsi.

---

### D. Hak Akses File & Direktori (*Permissions*)

Pastikan web server memiliki hak akses yang benar:

```bash
# Set kepemilikan ke user web server (www-data untuk Nginx/Apache di Ubuntu/Debian)
sudo chown -R www-data:www-data /var/www/nms-gis

# Izin baca/eksekusi standar direktori & file
sudo chmod -R 755 /var/www/nms-gis

# Pastikan file .env terlindungi dari akses publik
sudo chmod 600 /var/www/nms-gis/.env
```

---

## 4. OTOMATISASI BACKGROUND WORKER & CRON JOBS

Sistem NMS-GIS memiliki 2 background worker utama yang wajib dijadwalkan agar pemantauan berjalan otomatis:

1. **Poller Worker (`workers/poller_worker.php`)**: Melakukan pooling status OLT dan MikroTik setiap **2 menit**.
2. **Auto-Purge Worker (`workers/cleanup_temp_logs.php`)**: Membersihkan temporary log sesuai batas hari retensi setiap hari pukul **03:00 WIB**.

### A. Konfigurasi via Crontab (Linux / VPS)

Buka crontab user `www-data`:
```bash
sudo crontab -u www-data -e
```

Tambahkan 2 baris perintah cron berikut:

```cron
# 1. Poller Engine (Setiap 2 Menit)
*/2 * * * * /usr/bin/php /var/www/nms-gis/workers/poller_worker.php >> /var/log/nms-poller.log 2>&1

# 2. Cleanup Temp Logs Auto-Purge (Setiap Hari Pukul 03:00 WIB)
0 3 * * * /usr/bin/php /var/www/nms-gis/workers/cleanup_temp_logs.php >> /var/log/nms-cleanup.log 2>&1
```

---

### B. Konfigurasi via Systemd Timer (Alternatif Enterprise VPS)

Untuk keandalan enterprise pada VPS, Anda dapat menggunakan Systemd Service dan Timer:

Buat file `/etc/systemd/system/nms-poller.service`:
```ini
[Unit]
Description=NMS-GIS Multi-Vendor Poller Engine
After=network.target mysql.service

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/var/www/nms-gis
ExecStart=/usr/bin/php /var/www/nms-gis/workers/poller_worker.php

[Install]
WantedBy=multi-user.target
```

Buat file `/etc/systemd/system/nms-poller.timer`:
```ini
[Unit]
Description=Run NMS-GIS Poller Engine every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
Unit=nms-poller.service

[Install]
WantedBy=timers.target
```

Aktifkan service timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nms-poller.timer
```

---

### C. Konfigurasi Cron Jobs di cPanel (Shared Hosting)

1. Masuk ke cPanel hosting Anda.
2. Buka menu **Cron Jobs** di bawah seksi *Advanced*.
3. Pada **Add New Cron Job**:
   - Poller 2 Menit:
     - Common Settings: `*/2 * * * *` (Every 2 minutes).
     - Command: `/usr/local/bin/php /home/username/public_html/nms/workers/poller_worker.php >/dev/null 2>&1`
   - Auto-Purge Harian:
     - Common Settings: `0 3 * * *` (Once a day at 03:00).
     - Command: `/usr/local/bin/php /home/username/public_html/nms/workers/cleanup_temp_logs.php >/dev/null 2>&1`
4. Klik **Add New Cron Job**.

---

## 5. PROSEDUR UJI COBA DEPLOYMENT (STEP-BY-STEP WALKTHROUGH)

Setelah seluruh setting GitHub dan hosting selesai, lakukan pengujian alur deployment:

1. **Kirim Perubahan Kode ke GitHub**:
   ```bash
   git checkout dev
   git add .
   git commit -m "docs: add deployment guide and github setup"
   git push origin dev
   ```

2. **Pantau Tab Actions di GitHub**:
   - Buka `https://github.com/omkjago/cbs/actions`.
   - Lihat workflow **CI/CD Pipeline - Test & Deploy to Hosting** yang sedang berjalan.
   - Pastikan tahapan berikut berstatus centang hijau:
     - ✅ `Check PHP Syntax (Lint)`
     - ✅ `Run Backend Tests` (70/70 asersi lolos)
     - ✅ `Install Frontend Dependencies & Build` (Vite SPA compiled)
     - ✅ `Deploy via SSH / Rsync to Server`
     - ✅ `Run Post-Deploy Script on Remote Server`

3. **Verifikasi Web Aplikasi di Browser**:
   - Akses URL: `https://nms.perusahaan.com`.
   - Pastikan halaman peta Leaflet tampil dengan mulus dan tile OpenStreetMap ter-load.
   - Klik tombol **Login** di pojok kanan atas:
     - Email: `admin@nms.isp`
     - Password: `Admin123!@#`
   - Setelah login, uji fitur penambahan titik GIS node (GPS, Drag Marker, Manual Lat-Long).
   - Klik tombol **Cek OPM Live** pada salah satu node pelanggan untuk menguji integrasi adapter OLT.

---

## 6. PANDUAN PENYELESAIAN MASALAH (TROUBLESHOOTING & FAQ)

### Q1: GitHub Actions gagal dengan error `Host key verification failed`?
* **Penyebab**: Server runner GitHub belum mengenali fingerprint host SSH server Anda.
* **Solusi**: Action `easingthemes/ssh-deploy` menangani ini secara otomatis. Pastikan port SSH dan IP server pada secret `SSH_HOST` dan `SSH_PORT` sudah benar tanpa spasi.

### Q2: GitHub Actions gagal dengan error `Permission denied (publickey)`?
* **Penyebab**: Public key SSH belum terdaftar di `~/.ssh/authorized_keys` milik `SSH_USER`.
* **Solusi**: Pastikan Anda telah menambahkan public key deployer ke `authorized_keys` dan memastikan izin file `chmod 600 ~/.ssh/authorized_keys`.

### Q3: Tampilan halaman peta kosong / blank putih (*White Screen of Death*)?
* **Penyebab**: Web server mengarahkan Document Root ke folder root repositori, bukan ke folder `/public`.
* **Solusi**: Ubah konfigurasi Nginx `root /var/www/nms-gis/public;` atau di cPanel set Document Root subdomain ke `public_html/nms/public`.

### Q4: Mendapatkan respons `403 Forbidden` saat mengakses API?
* **Penyebab**: Proteksi mitigasi CVE-2024-4577 (PHP2Shell) memblokir request yang mengandung karakter berbahaya pada query string (`%ad`, `-d`, `-s`).
* **Solusi**: Ini adalah fitur keamanan yang bekerja sebagaimana mestinya untuk mencegah eksploitasi RCE. Pastikan parameter URL API bersih dan sesuai kontrak [`doc/api-documentation.md`](file:///c:/Users/user/Documents/aldo/cbs/doc/api-documentation.md).

### Q5: Error `500 Internal Server Error` saat login atau migrasi database?
* **Penyebab**: File `.env` belum dibuat di server atau kredensial database MySQL salah.
* **Solusi**: Masuk ke server, buat file `.env` dari `.env.example`, masukkan kredensial MySQL yang valid, lalu jalankan `php database/migrate.php`.
