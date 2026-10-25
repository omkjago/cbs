# 🔄 STANDAR WORKFLOW TERPUSAT AUDIT, REMEDIASI & VALIDASI NMS-GIS ISP
# EDISI: LEAN TOKEN & UNIFIED SINGLE-AUDIT PROTOCOL

> [!IMPORTANT]
> **ATURAN PROTOKOL RESMI KOORDINASI AUDIT & REMEDIASI (NMS-GIS ISP WORKFLOW)**
> Alur kerja ini mengatur siklus pengembangan, pengujian, audit, dan remediasi secara terpusat, terstruktur, dan efisien.
> Seluruh proses wajib mematuhi **ATURAN EFISIENSI TOKEN TINGGI & UNIFIED SINGLE-AUDIT PROTOCOL**.
> Dilarang mengirimkan pesan liar atau melompati hierarki kerja yang telah ditetapkan.

---

## 1. STRUKTUR PERAN & TANGGUNG JAWAB

| Peran | Pihak Pelaksana | Tanggung Jawab Utama |
| :--- | :--- | :--- |
| **Stakeholder / Owner** | **User** | Memberikan inisiasi kebutuhan, prioritas fitur, dan persetujuan akhir (*sign-off*). |
| **Lead AI Coordinator / PM** | **Antigravity (Lead Agent)** | **Hub & SPOC (Single Point of Contact)**: Menganalisis request user, mengarahkan fokus audit (FE/BE), memantau build/testing, memvalidasi hasil remediasi, dan menyajikan laporan visual terpadu kepada User. |
| **Auditor Frontend** | **Frontend Specialist** | Audit visual & fungsional antarmuka React SPA + Leaflet.js, verifikasi 3 metode input lokasi (GPS, marker drag, manual lat-long), responsivitas mobile teknisi lapangan, dan kepatuhan UI. |
| **Auditor Backend & Security** | **Backend Specialist** | Audit REST API, kepatuhan [`doc/api-documentation.md`](file:///C:/Users/user/.gemini/antigravity/worktrees/cbs/create_dev_branch/doc/api-documentation.md), integritas 100% PDO Prepared Statements, enkripsi kredensial AES-256-GCM, verifikasi **Zero-Shell Execution Policy** (mitigasi PHP2Shell/RCE), dan audit poller engine. |
| **Pelaksana Remediasi** | **Remediation Specialist** | Eksekusi perbaikan kode (FE & BE) pada branch `dev`, verifikasi build & sintaks (`cd frontend && npm run build`, `php -l`, `php tests/test_phase1.php`), cherry-pick kode ke `main`, dan push origin. |

---

## 2. ATURAN LARANGAN MUTLAK & BATASAN WEWENANG

1. **Auditor Dilarang Memodifikasi Kode Sumber Secara Liar**:
   * Auditor bertugas mengidentifikasi masalah, menentukan *root cause*, dan menyusun spesifikasi tiket perbaikan yang padat. Perbaikan kode dieksekusi secara terfokus pada fase remediasi.
2. **Larangan Keras Merge ke Main**:
   * Wajib mematuhi penuh [`doc/git-workflow.md`](file:///C:/Users/user/.gemini/antigravity/worktrees/cbs/create_dev_branch/doc/git-workflow.md). Seluruh pekerjaan dilakukan di branch `dev`. Sinkronisasi ke `main` **HANYA** melalui `git cherry-pick` dengan **Zero berkas dokumentasi internal/audit di branch `main`**.
3. **Integritas Database & Keamanan Sistem**:
   * Dilarang keras melakukan drop tabel manual pada database server hosting.
   * Dilarang keras menggunakan fungsi pemanggilan shell (`exec`, `shell_exec`, `system`, `passthru`, `proc_open`) demi mencegah celah RCE / PHP2Shell. Seluruh komunikasi perangkat jaringan (MikroTik ROS API, ZTE OLT SNMP/Telnet) wajib 100% socket / extension native PHP.

---

## 3. UNIFIED SINGLE-AUDIT PROTOCOL & EFISIENSI TOKEN

### A. Larangan Berkas Markdown Berceceran (Zero Fragmentation)
* **DILARANG** membuat banyak berkas markdown terpisah per siklus audit (misal: membuat `_audit.md`, lalu `_resolved.md`, lalu `_signoff.md`).
* **WAJIB**: Setiap siklus audit hanya menggunakan **SATU Laporan Audit Terpadu (Unified Single-Audit)** yang menggabungkan:
  1. *Baseline Temuan Masalah & Root Cause*
  2. *Spesifikasi Patch Kode (Target File & Diff)*
  3. *Bukti Empiris Hasil Pengujian (Test Run / Screenshot)*
  4. *Keputusan Sign-Off 100% Lulus*
* Laporan terpadu ini disajikan dalam **1 Dokumen Artefak Resmi** di chat.

### B. Aturan Efisiensi Kuota Token (Token Economy Rules)
1. **Single Final Response Rule**:
   * Hindari mengirim pesan perantara kecil yang tidak perlu ke User (seperti *"sedang membaca file"*, *"sedang compile"*). Setiap turn pesan me-refeed riwayat konteks panjang.
   * Proses alur kerja diselesaikan secara tuntas dan disajikan dalam **satu respons komprehensif** kepada User saat hasil pekerjaan siap.
2. **Laser-Targeted Tool Execution**:
   * Dilarang membaca berkas kode secara utuh jika hanya membutuhkan seksi tertentu (gunakan `StartLine` dan `EndLine` dengan rentang sempit < 60 baris).
   * Gunakan pencarian terarah (`git grep`, `Select-String`) alih-alih dumping log panjang.
3. **Compact Technical Prompts & Logs**:
   * Seluruh catatan teknis disusun padat, berbasis poin dan diff, tanpa kalimat basa-basi.
4. **Targeted Visual Screenshots**:
   * Pengujian visual cukup mengambil **1–2 screenshot fokus** pada elemen/peta yang diperbaiki.

### C. Protokol Pelaporan Bukti Visual Screenshot
1. Setiap tangkapan layar pengujian UI Leaflet / SPA yang dihasilkan di `scratch/` **wajib langsung disalin** ke direktori brain artefak (`<appDataDir>\brain\<conversation-id>`).
2. Tautkan gambar secara langsung di dalam artefak markdown resmi menggunakan format `![caption](/absolute/path)`.

---

## 4. DIAGRAM ALUR KERJA TERPUSAT (LEAN WORKFLOW)

```mermaid
flowchart TD
    User([👤 User / Stakeholder]) <-->|1. Input Request & Final Report| Lead([👑 Lead AI Coordinator / PM])
    
    Lead -->|2a. Scope Frontend Audit| FA([🎨 Frontend Specialist])
    Lead -->|2b. Scope Backend Audit| BA([⚙️ Backend & Security Specialist])
    
    FA -->|3a. Tiket Teknis Padat: Single Unified Log| REM([🛠️ Eksekusi Remediasi])
    BA -->|3b. Tiket Teknis Padat: Single Unified Log| REM
    
    REM -->|4. Eksekusi di dev, Build Test, Cherry-pick main, Push Origin| Deploy([🚀 Deployment via GitHub Actions CI/CD])
    Deploy -->|5a. Selesai Push & Deploy| FA
    Deploy -->|5b. Selesai Push & Deploy| BA
    
    FA -->|6a. Re-Validasi UI/Peta Leaflet| CheckFA{Valid 100%?}
    CheckFA -- Belum Sempurna -->|Memicu Ulang Perbaikan| REM
    CheckFA -- Lulus 100% -->|7a. Sign-off Padat| Lead
    
    BA -->|6b. Re-Validasi API/Zero-Shell| CheckBA{Valid 100%?}
    CheckBA -- Belum Sempurna -->|Memicu Ulang Perbaikan| REM
    CheckBA -- Lulus 100% -->|7b. Sign-off Padat| Lead
    
    Lead -->|8. Artefak Visual Terpadu & Laporan Final| User
```

---

## 5. TAHAPAN SIKLUS EKSEKUSI DETAIL

### Fase 0: Inisiasi & Analisis Terarah
1. **User** memberikan request/kebutuhan kepada **Lead**.
2. **Lead** menganalisis spesifikasi kebutuhan secara *laser-targeted*.
3. **Lead** menentukan cakupan audit (*Frontend UI/UX Leaflet* atau *Backend API/Security*).

### Fase 1: Audit & Penerbitan Tiket Terpadu
1. Auditor memverifikasi kondisi aktual kode dan fungsionalitas.
2. Auditor menyusun tiket teknis dalam format **Unified Single-Audit** (akar masalah, berkas target, kriteria lolos).

### Fase 2: Eksekusi Remediasi & Git Protocol
1. Dilakukan perbaikan kode secara atomik pada branch **`dev`**.
2. **Verifikasi Wajib**:
   - Frontend: `cd frontend && npm run build` (wajib exit code 0).
   - Backend: `php -l` pada file PHP terkait.
   - Test Suite: `php tests/test_phase1.php` (100% PASS).
3. Melakukan cherry-pick kode aplikasi bersih ke branch **`main`**, lalu push ke `origin main` dan `origin dev`.
4. Branch `main` wajib **100% steril** dari berkas audit/markdown internal.

### Fase 3: Deployment & Re-Validasi Otomatis
1. GitHub Actions memproses build dan deployment otomatis ke hosting.
2. Auditor melakukan re-validasi terhadap endpoint dan antarmuka live.
3. Jika lulus 100%, tiket ditutup dengan status *Sign-off*.

### Fase 4: Pelaporan Final Terpadu
1. Lead menyusun 1 dokumen **Artefak Laporan Terpadu**.
2. Memberikan laporan ringkas dan terstruktur kepada User.

---

## 6. STANDAR FORMAT TIKET TEKNIS TERPADU (COMPACT FORMAT)

```markdown
### 📋 TIKET AUDIT / REMEDIASI: [ID-MODUL]
- **Modul**: [GIS / Devices / Auth / Monitoring / Logs]
- **Target File**: `path/to/file.php` (atau `.jsx`)
- **Status**: [BARU / REMEDIASI / VALIDASI / SIGN-OFF 100%]
- **Deskripsi Masalah**: [Penjelasan ringkas & akar masalah]
- **Target Perbaikan**:
  - File: `path/to/file`
  - Perubahan: [Snippet diff / logic fix]
- **Kriteria Lolos (Acceptance Criteria)**:
  - [ ] Sintaks PHP lulus `php -l`
  - [ ] Build React lulus `npm run build`
  - [ ] Zero shell execution (`exec`/`system` = 0)
  - [ ] Respons API sesuai format JSON kontrak
```
