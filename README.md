# Monitoring Kontrak

**SCM Warehouse & Distribution** · Desain & sistem login sama dengan website [Material Warehouse](https://stackgeefer.github.io/Warehouse-SCM/)

Website untuk memantau seluruh kontrak / OA: **masa berlaku & jatuh tempo**, **serapan nilai (realisasi)**, **amandemen**, **jaminan pelaksanaan**, **dokumen kontrak**, dan **rencana tindak lanjut** (amandemen / pengadaan ulang) sebelum kontrak habis.

🌐 Website: **https://stackgeefer.github.io/Monitoring-Kontrak/**

---

## Setup awal (sekali saja, oleh Owner)

1. Repo → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → Save.
2. Buat token GitHub: https://github.com/settings/personal-access-tokens/new
   - **Repository access** → *Only select repositories* → `Monitoring-Kontrak`
   - **Permissions → Contents** → *Read and write* → **Generate token**
3. Buka website → muncul halaman **Setup awal** → isi username Owner, password, dan token → **Buat akun Owner**.

Setelah itu halaman Setup tidak muncul lagi; website langsung memakai halaman **Login**.

## Peran pengguna

| Peran | Bisa apa |
|---|---|
| **Owner Utama** | Semua fitur + kelola pengguna, koneksi GitHub, pengingat, hapus kontrak |
| **Writer** (kontributor) | Tambah/edit kontrak, catat realisasi & amandemen, upload dokumen, ubah tindak lanjut, import ME3N/Excel |
| **Viewer** | Lihat dashboard, daftar, detail & dokumen, export Excel |

**Menambah Writer:** Pengaturan → Pengguna → isi username + pilih *Writer* + password awal → **Tambah pengguna**. Berikan username & password itu ke orangnya. Writer **tidak perlu akun GitHub** — penyimpanan memakai token Owner yang tersimpan terenkripsi (Writer tidak pernah melihat token). Writer bisa mengganti password sendiri di Pengaturan.

> 🔒 Semua data kontrak & dokumen di repo ini **terenkripsi (AES-256-GCM)**; kuncinya hanya terbuka setelah login yang benar. Repo boleh publik — tanpa login, isi `data/` tidak bisa dibaca. File Excel mentah tidak pernah di-commit (`.gitignore`).

## Fitur

- **Dashboard** — kontrak berjalan, segera berakhir (≤ 90 hari), kritis (≤ 30 hari), lewat masa berlaku, serapan nilai total; daftar **Perlu tindakan**; grafik kontrak berakhir 12 bulan ke depan; ringkasan per jenis; aktivitas terbaru.
- **Daftar Kontrak** — cari (nomor, pekerjaan, vendor, PIC), filter status/jenis/fungsi, urutkan, progress waktu vs serapan nilai, **Export Excel** (sheet Kontrak, Realisasi, Amandemen).
- **Detail Kontrak** — informasi, nilai & tanggal efektif setelah amandemen, realisasi (Call-off / RO / BAPP / invoice), amandemen, jaminan pelaksanaan, dokumen (PDF/JPG/PNG, preview juga di HP), riwayat perubahan.
- **Jatuh Tempo** — kontrak berakhir per bulan (3/6/12/24 bulan ke depan) + kontrak yang sudah lewat tapi belum ditutup, dengan pilihan tindak lanjut langsung di tabel.
- **Peringatan otomatis** — belum ada rencana tindak lanjut, nilai terserap ≥ 90%, serapan rendah dibanding waktu berjalan, jaminan berakhir sebelum kontrak / sudah berakhir.
- **Import** — dari data ME3N website Material Warehouse, file ME3N SAP, atau template Excel. Nomor baru → kontrak baru; nomor yang sudah ada → data SAP diperbarui (judul, PIC, realisasi manual, amandemen & dokumen tidak ditimpa).
- **History hapus** — setiap penghapusan (kontrak, realisasi, amandemen, dokumen, pengguna) tercatat: siapa, kapan, data apa.

## Terhubung dengan Material Warehouse

| Dari Monitoring Kontrak | Ke Material Warehouse |
|---|---|
| Menu sidebar **Material Warehouse ↗** | Membuka website Warehouse |
| Tombol **Material di Warehouse ↗** di detail OA | Halaman *Kontrak (OA/RO)* nomor OA tersebut (daftar material yang bisa ditarik) |
| **Import → Ambil data ME3N Warehouse** | Membaca data ME3N terenkripsi yang sudah di-upload di Warehouse — tanpa upload ulang. Otomatis bila sedang login Warehouse di browser yang sama; bila tidak, diminta login akun Warehouse sekali. |

URL Warehouse bisa diubah Owner di **Pengaturan → Integrasi Material Warehouse**.

## Cara kerja penyimpanan

Website statis (GitHub Pages, tanpa server/database). Setiap simpan = satu commit ke repo ini lewat GitHub API. Data selalu dibaca ulang dari versi terbaru sebelum diubah, jadi beberapa Writer bisa menyimpan bersamaan tanpa saling menimpa. Pengguna lain melihat perubahan ±1 menit kemudian.

## Struktur folder

```
index.html            Halaman utama
css/style.css         Tampilan (sama dengan Material Warehouse)
css/kontrak.css       Komponen khusus Monitoring Kontrak
js/app.js             Halaman, login, simpan
js/model.js           Status, sisa waktu, serapan nilai, peringatan, agregasi ME3N
js/vault.js           Enkripsi & pengguna
js/gh.js              Commit ke GitHub (atomic, aman untuk banyak Writer)
js/parser.js          Membaca Excel SAP ME3N (sama dengan Material Warehouse)
data/users.js         Pengguna (hash + kunci terenkripsi, tanpa password)
data/admin.js         Token GitHub Owner (terenkripsi)
data/kontrak.js       Semua data kontrak (terenkripsi)
data/files/*.js       Dokumen kontrak (terenkripsi)
vendor/               SheetJS, PDF.js
```
