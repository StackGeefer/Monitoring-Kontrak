# Monitoring Kontrak

**SCM Warehouse & Distribution** · Desain & sistem login sama dengan website [Material Warehouse](https://stackgeefer.github.io/Warehouse-SCM/)

Website untuk memantau seluruh kontrak / OA: **masa berlaku & jatuh tempo**, **serapan nilai (realisasi)**, **amandemen**, **jaminan pelaksanaan**, **dokumen kontrak**, dan **rencana tindak lanjut** (amandemen / pengadaan ulang) sebelum kontrak habis.

🌐 Website: **https://stackgeefer.github.io/Monitoring-Kontrak/**

---

## Setup awal (sekali saja, oleh Owner)

Akun Owner Utama **Gerald.samosir** sudah dibuat (password sama dengan website Material Warehouse).

1. Repo → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → Save.
2. Login di website sebagai Gerald.samosir.
3. Buat token GitHub: https://github.com/settings/personal-access-tokens/new
   - **Expiration** → *Custom* → ±1 tahun
   - **Repository access** → *Only select repositories* → `Monitoring-Kontrak`
   - **Permissions → Contents** → *Read and write* → **Generate token**
4. Di website: **Pengaturan → Koneksi GitHub** → tempel token → **Simpan & Tes**. Selama token belum diisi, website hanya bisa dilihat (belum bisa menyimpan).

Token yang kedaluwarsa cukup diganti di tempat yang sama; Writer otomatis ikut memakai token baru.

## Monitoring SAP (Client 100 Pertamina EP & Client 180 PHE)

Menu **Upload Data** → pilih beberapa file sekaligus. Jenis file & client dideteksi otomatis (nama file berisi `_100_` / `_180_`, tanggal data dari nama file, mis. `110826` = 8 Nov 2026):

| File | Dipakai untuk |
|---|---|
| **ME3N** client 100 / 180 | Menu **Kontrak OA (ME3N)**: masa berlaku, nilai target vs released (serapan), item kontrak, RO yang sudah ditarik, tindak lanjut OA |
| **ME2N** client 100 / 180 | Menu **PO / RO (ME2N)**: outstanding (sisa kirim), terlambat (lewat delivery date), belum ditagih, outstanding per plant, item per PO/RO. Item dengan Deletion Indicator `L` diabaikan |
| **Progres PR/RO** (sheet *Pengadaan* & *Expediting*) | Menu **Progres PR & PO**: status PR (On Progress / On Planning / pipeline), tahapan, lead time hari kerja (dihitung otomatis s/d hari ini, tanpa Sabtu-Minggu & libur nasional), expediting PO/RO dicocokkan otomatis dengan ME2N (status penerimaan SAP) |

- **Dashboard** menampilkan ringkasan ketiganya + OA segera berakhir & PO/RO terlambat; **Jatuh Tempo** menggabungkan OA (ME3N) dan kontrak manual.
- Filter **Semua client / 100 / 180** di setiap halaman. Total campuran IDR + USD memakai kurs di **Pengaturan → Monitoring SAP** (default 16.000).
- Upload ulang file sejenis = data jenis itu diganti yang terbaru. Data tersimpan terenkripsi di `data/sap.js`.

## Kontrak OA & Permintaan RO

- **Kontrak OA** menampilkan kontrak **Zona 1 (PG X07)** dan **Regional 1 (PG X02)**; PG lain (X03, X10) lewat pilihan "Other". Kartu per OA: masa berlaku, item pernah dipakai / stok habis di field, sisa nilai, saran RO.
- **Detail OA → Pilih item yang perlu di-RO**: stok field (Rantau/Lirik/Jambi/Pangkalan Susu), stok Zona 1 lain, pemakaian 12 bulan, **saran qty** = pemakaian/bulan × (cover + lead time) − stok (sama dengan Material Warehouse; cover & lead time di Pengaturan). Centang item → **Ajukan Permintaan RO**.
- **Alur Progres PR & PO**: Pengadaan Kontrak (tender) → Kontrak OA → **Permintaan RO** (diajukan dari detail OA) → **Approval MIM** → **PR** (need approval → terbit) → **RO terbit** → delivery (Expediting) → **Diterima**. RO & delivery date terhubung otomatis bila No. PR ditemukan di ME2N; RO yang terbit ikut tampil di tab Expediting.
- **Peran MIM**: approve / tolak permintaan RO dan memproses PR & RO (Owner Utama juga bisa). Pengaju bisa menghapus permintaannya selama belum di-approve; MIM / Owner Utama bisa menghapus kapan saja (tercatat di History hapus).
- **Expediting** dilengkapi otomatis dari ME2N bila kolom di file progres kosong (vendor, No. PR, delivery date, nilai) — ditandai label **SAP**.
- Stok & pemakaian diambil dari website Material Warehouse (**Data SAP → Perbarui dari Warehouse**, perlu akun Warehouse) dan disimpan terenkripsi di `data/stok.js` hanya untuk material yang ada di kontrak OA.

## Kontrak Warehouse & GS (per Field)

Menu **Kontrak Warehouse** (Crane & Tronton, Picker/TMC & Trailer, Vacuum Truck, Issuing & Receiving) dan **Kontrak GS** (KRP, sepeda motor, VTS, cleaning service, pembabatan, listrik, AC, dll.). Data awal Field Rantau diimport dari file *TKDN / Anggaran Kontrak SCM*.

- Kartu per kontrak: nilai (setelah amandemen), realisasi, sisa, % terserap vs % waktu, tagihan terakhir.
- **Input tagihan** tiap awal bulan untuk bulan sebelumnya: periode, nilai tanpa PPN, PR, RO, SA, no. & tanggal invoice (boleh dilengkapi belakangan lewat tombol edit).
- Bulan yang belum ditagih ditandai merah di kartu, di **matriks tagihan 12 bulan**, dan di Dashboard.
- Filter per **Field**; kontrak field lain ditambah lewat **Tambah Kontrak** (pilih Kategori & Field).

## Update status PO/RO oleh MIM

Di menu **PO / RO (ME2N)** klik dokumen → bagian **Update status dari MIM**: status terkini (proses di vendor, siap kirim, dalam pengiriman, tiba di gudang, ditunda, kendala), perkiraan tiba (ETA) dan catatan. Riwayat update tersimpan; update tidak hilang saat data ME2N baru di-upload. Filter **Terlambat · belum ada update MIM** menunjukkan PO/RO yang perlu di-follow-up.

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
