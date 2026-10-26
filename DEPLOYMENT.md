# 🚀 Panduan Otomatisasi CI/CD & Deployment Hosting (NMS-GIS ISP)

Dokumen ini menjelaskan konfigurasi alur kerja **CI/CD (Continuous Integration & Continuous Deployment)** menggunakan **GitHub Actions** untuk men-deploy aplikasi secara otomatis ke server hosting Anda setiap kali ada *push* ke branch `dev` atau `main`.

Panduan terlengkap dengan diagram arsitektur dan troubleshooting tersedia di [**`doc/deployment-guide.md`**](file:///c:/Users/user/Documents/aldo/cbs/doc/deployment-guide.md).

---

## 1. Konfigurasi GitHub Repository Secrets

Agar GitHub Actions dapat mengakses dan mengirimkan file ke server hosting Anda secara aman, tambahkan *Secrets* pada repositori GitHub Anda:

Buka GitHub: **Repository $\rightarrow$ Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions $\rightarrow$ New repository secret**

### Pilihan A: Server VPS / Dedicated Server (Sangat Disarankan via SSH)

| Nama Secret | Keterangan / Contoh Nilai |
| --- | --- |
| `SSH_HOST` | Alamat IP atau hostname server (contoh: `103.150.xxx.xxx` atau `nms.domainklien.com`) |
| `SSH_USER` | Username SSH (contoh: `root` atau `deployer`) |
| `SSH_PRIVATE_KEY` | Isi private key SSH (OpenSSH private key `id_rsa` / `id_ed25519`) |
| `SSH_PORT` | Port SSH server (default: `22`) |
| `DEPLOY_TARGET_DIR` | Direktori tujuan di server (contoh: `/var/www/nms-gis`) |

> **Cara membuat SSH Key untuk deployer di VPS:**
> ```bash
> ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""
> cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
> chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
> cat ~/.ssh/github_deploy # Salin isi private key ke GitHub Secret SSH_PRIVATE_KEY
> ```

---

### Pilihan B: Shared Hosting / cPanel (via FTP / FTPS)

Jika hosting Anda adalah shared hosting / cPanel tanpa akses SSH terminal:

| Nama Secret | Keterangan / Contoh Nilai |
| --- | --- |
| `FTP_SERVER` | Hostname FTP (contoh: `ftp.domainklien.com` atau IP server) |
| `FTP_USERNAME` | Akun user FTP cPanel |
| `FTP_PASSWORD` | Kata sandi akun FTP cPanel |
| `FTP_REMOTE_DIR` | Folder web root (contoh: `/public_html/nms/` atau `/public_html/`) |

---

## 2. Konfigurasi Web Server di Hosting

### A. Konfigurasi Nginx (Rekomendasi untuk Performa & Mitigasi PHP2Shell)

Arahkan `root` web server ke folder `/public` (bukan root proyek):

```nginx
server {
    listen 80;
    server_name nms.domainklien.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nms.domainklien.com;

    # SSL Certificate (Wajib HTTPS untuk HTML5 GPS HP)
    ssl_certificate /etc/letsencrypt/live/nms.domainklien.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nms.domainklien.com/privkey.pem;

    # Pointing DocumentRoot ke folder /public
    root /var/www/nms-gis/public;
    index index.php index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(self)" always;

    # Mitigasi Celah PHP-CGI Argument Injection (CVE-2024-4577 / PHP2Shell)
    if ($query_string ~* "(-d|-s|-u|-w|%ad)") {
        return 403;
    }

    # Route seluruh request ke Front Controller / SPA
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM Handler
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock; # Sesuaikan versi PHP
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
        fastcgi_param HTTP_PROXY ""; # Mitigasi HTTPoxy
    }
}
```

---

### B. Konfigurasi Apache (`.htaccess` di folder `/public`)

Jika menggunakan web server Apache (misal di cPanel), set Document Root subdomain mengarah ke `public_html/nms/public`. File `.htaccess` protektif telah otomatis aktif di folder `public/`.

---

## 3. Konfigurasi File Environment Server (`.env`)

Di server hosting Anda, siapkan file `.env` di root direktori proyek (`/var/www/nms-gis/.env`):

```env
APP_NAME="NMS-GIS Fiber Optic Monitoring"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://nms.domainklien.com

# Database MySQL Produksi
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nms_gis_db
DB_USERNAME=nms_user
DB_PASSWORD=PasswordDbKuat123!
DB_CHARSET=utf8mb4

# Master Key Enkripsi AES-256-GCM (Wajib 64 Karakter Hex)
# Buat dengan: openssl rand -hex 32
APP_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# JWT Secret Token Key
# Buat dengan: openssl rand -base64 48
JWT_SECRET=super_secret_jwt_key_produksi_isp_2026
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# CORS
CORS_ALLOWED_ORIGINS=https://nms.domainklien.com
```

---

## 4. Penjadwalan Background Worker (Cron Jobs)

Jalankan 2 cron job berikut di server hosting:

```cron
# 1. Poller Engine (Polling OLT & MikroTik setiap 2 Menit)
*/2 * * * * /usr/bin/php /var/www/nms-gis/workers/poller_worker.php >> /var/log/nms-poller.log 2>&1

# 2. Cleanup Temp Logs (Pembersihan log otomatis harian pukul 03:00 WIB)
0 3 * * * /usr/bin/php /var/www/nms-gis/workers/cleanup_temp_logs.php >> /var/log/nms-cleanup.log 2>&1
```

---

## 5. Alur Kerja Otomatisasi (Workflow Pipeline)

1. Developer melakukan `git push origin dev` (atau cherry-pick ke `main`).
2. **Job CI** otomatis berjalan di GitHub Actions:
   * Melakukan *syntax check* seluruh file PHP (`php -l`).
   * Menjalankan 70 asersi unit & integration tests (`test_phase1.php` s/d `test_phase4.php`).
   * Mengompilasi frontend React SPA (`npm run build`).
3. Jika seluruh pengujian lolos, **Job CD** otomatis aktif:
   * Men-deploy file termutakhir ke server hosting via SSH/Rsync atau FTPS.
   * Menjalankan migrasi database otomatis (`php database/migrate.php`).
   * Menetapkan hak akses direktori (*chmod 755*).
