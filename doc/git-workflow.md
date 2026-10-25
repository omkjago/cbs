# 🛡️ PROTOKOL WAJIB: ALUR KERJA GIT (GIT WORKFLOW RULES)
# SISTEM MONITORING JARINGAN MULTI-VENDOR & GIS FIBER OPTIK (NMS-GIS ISP)

> [!CAUTION]
> **ATURAN PALING PENTING — TIDAK BOLEH DILANGGAR DALAM KONDISI APAPUN**

---

## 1. LARANGAN KERAS MERGE KE MAIN
- **DILARANG KERAS** menjalankan `git merge` ke branch `main`, atau melakukan merge dari `main` ke `dev`!
- Branch `main` **TIDAK PERNAH** boleh memiliki riwayat merge commit (`Merge branch '...' into ...`).
- Riwayat komit pada branch `main` **WAJIB 100% LINEAR**.

---

## 2. HANYA GUNAKAN CHERRY-PICK UNTUK SINKRONISASI KE MAIN
- Seluruh pekerjaan pengembangan, perbaikan bug, audit, dan pembuatan fitur dilakukan **eksklusif pada branch `dev`**.
- Setelah pekerjaan pada branch `dev` teruji, lulus build, dan di-commit:
  1. Catat hash komit yang ingin diproduksikan dari `dev` (misal: `<commit-hash>`).
  2. Pindah ke branch `main`:
     ```bash
     git checkout main
     ```
  3. Lakukan **cherry-pick** komit tersebut secara individual:
     ```bash
     git cherry-pick <commit-hash>
     ```
  4. Push branch `main` ke remote repository:
     ```bash
     git push origin main
     ```
  5. **Segera kembali ke branch `dev`** untuk melanjutkan pekerjaan harian:
     ```bash
     git checkout dev
     ```

---

## 3. ATURAN INTEGRITAS BRANCH MAIN (ZERO NON-PRODUCTION DOCS)
- Branch `main` **HANYA** diperuntukkan bagi kode eksekusi produksi:
  - Backend PHP Native (`src/`, `config/`, `public/index.php`, `workers/`).
  - Database migrations & schema (`database/schema_*.sql`, `database/migrate.php`).
  - Frontend React source & build distribution (`frontend/src/`, `public/dist/`).
  - CI/CD workflow & server configurations (`.github/workflows/deploy.yml`, `public/.htaccess`).
- Seluruh berkas dokumentasi internal (`doc/`), audit reports (`audit_*.md`, `laporan_*.md`), artefak perencanaan, dan README non-produksi **DILARANG KERAS** berada di branch `main`.
- Branch `dev` adalah **SATU-SATUNYA SUMBER KEBENARAN (SOURCE OF TRUTH)** untuk seluruh dokumentasi, PRD, audit report, dan aturan sistem.
- **Atomic Commits**: Saat melakukan commit di `dev`, selalu pisahkan commit kode aplikasi dari commit dokumentasi/rules. Hanya commit kode aplikasi murni yang di-cherry-pick ke `main`.

---

## 4. ATURAN INTEGRITAS KODE & DATABASE (NMS-GIS ISP)
- **Zero-Shell Execution Policy**: Dilarang keras menggunakan fungsi eksekusi shell sistem (`exec`, `shell_exec`, `system`, `passthru`, `proc_open`) untuk menjaga sistem kebal dari celah PHP2Shell / RCE. Seluruh interaksi jaringan MikroTik dan OLT wajib menggunakan socket / library PHP murni.
- **Integritas Database**:
  - Dilarang keras melakukan drop tabel atau reset database secara manual pada server hosting riil.
  - Pembaruan skema database wajib melalui skrip migrasi terstruktur [`database/migrate.php`](file:///C:/Users/user/.gemini/antigravity/worktrees/cbs/create_dev_branch/database/migrate.php) dengan proteksi 100% PDO Prepared Statements.
- **Verifikasi Wajib Sebelum Commit & Cherry-Pick**:
  1. Frontend React: `cd frontend && npm run build` (wajib lulus tanpa error / exit code 0).
  2. Backend PHP: Pemeriksaan sintaks `php -l` pada seluruh file PHP yang dimodifikasi.
  3. Unit & Integration Test: `php tests/test_phase1.php` (seluruh pengujian wajib lulus 100%).
