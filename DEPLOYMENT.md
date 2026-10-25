# Panduan Otomatisasi CI/CD & Deployment Hosting

Dokumen ini menjelaskan konfigurasi alur kerja **CI/CD (Continuous Integration & Continuous Deployment)** menggunakan **GitHub Actions** untuk men-deploy aplikasi secara otomatis ke server hosting Anda setiap kali ada *push* ke branch `dev` atau `main`.

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
| `DEPLOY_TARGET_DIR` | Direktori tujuan di server (contoh: `/var/www/nms-gis` atau `/home/user/public_html`) |

> **Cara membuat SSH Key untuk deployer di VPS:**
> ```bash
> ssh-keygen -t ed25519 -C "github-actions-deploy"
> # Masukkan public key ke: ~/.ssh/authorized_keys di server
> # Masukkan private key ke: GitHub Secret SSH_PRIVATE_KEY
> ```

---

### Pilihan B: Shared Hosting / cPanel (via FTP / FTPS)

Jika hosting Anda adalah shared hosting / cPanel tanpa akses SSH terminal:

| Nama Secret | Keterangan / Contoh Nilai |
| --- | --- |
| `FTP_SERVER` | Hostname FTP (contoh: `ftp.domainklien.com` atau IP server) |
| `FTP_USERNAME` | Akun user FTP |
| `FTP_PASSWORD` | Kata sandi akun FTP |
| `FTP_REMOTE_DIR` | Folder web root (contoh: `/public_html/` atau `/public_html/nms/`) |

---

## 2. Konfigurasi Web Server di Hosting

### A. Konfigurasi Nginx (Rekomendasi untuk Performa & Bebas PHP2Shell)

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

    root /var/www/nms-gis/public;
    index index.html index.php;

    # Security: Blokir akses ke file tersembunyi & .env
    location ~ /\. {
        deny all;
    }

    # Route seluruh request ke Front Controller / SPA
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM Handler (Mitigasi Celah PHP-CGI Argument Injection)
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock; # Sesuaikan versi PHP
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        
        # Hardening header
        fastcgi_hide_header X-Powered-By;
    }
}
```

---

### B. Konfigurasi Apache (`.htaccess` di folder `/public`)

Jika menggunakan web server Apache (misal di cPanel), buat file `.htaccess` di dalam direktori `public/`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ index.php [QSA,L]
</IfModule>

# Security Hardening
<IfModule mod_headers.c>
    Header unset X-Powered-By
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
</IfModule>
```

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

# Master Key Enkripsi AES-256-GCM (64 hex characters)
APP_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# JWT Secret Token Key
JWT_SECRET=super_secret_jwt_key_produksi_isp_2026
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# CORS
CORS_ALLOWED_ORIGINS=https://nms.domainklien.com
```

---

## 4. Alur Kerja Otomatisasi (Workflow Pipeline)

1. Developer melakukan `git push origin dev` atau merge ke `main`.
2. **Job CI** otomatis berjalan di GitHub Actions:
   * Melakukan *syntax check* seluruh file PHP (`php -l`).
   * Menjalankan unit & integration tests (`tests/test_phase1.php`).
   * Mengompilasi frontend React SPA (`npm run build`).
3. Jika seluruh pengujian lolos, **Job CD** otomatis aktif:
   * Men-deploy file termutakhir ke server hosting via SSH/Rsync atau FTPS.
   * Menjalankan migrasi database otomatis (`php database/migrate.php`).
   * Menetapkan hak akses direktori (*chmod 755*).
