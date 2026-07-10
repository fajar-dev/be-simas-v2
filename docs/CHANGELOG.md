# 📝 Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-07-10

### Added
- **Custom field handover (per transaction type)**: modul baru `handover-field` — field konfigurabel per tipe (`assign`/`return`) dengan tipe `text | number | select | radio | date | datetime`, opsi custom untuk select/radio, dan flag required. Endpoint `GET /handover-field?transactionType=` & `PUT /handover-field/:transactionType` (bulk-replace, permission `handover-field:read|manage`). Saat handover dibuat, nilai field di-**snapshot** ke kolom `handovers.custom_fields` (`simple-json`) → mengedit definisi field **tidak** memengaruhi handover yang sudah ada. Key & value tampil di PDF. Test E2E `test/handover-field.test.ts` + skenario snapshot/versioning di `test/handover.test.ts`.
- **Serah terima pengembalian (return handover)**: handover `return` — hanya aset yang active holder-nya = karyawan penyerah (`handedOverById`) yang boleh dipindai; lewat alur `pending → e-sign → approve` yang sama; saat approve, holder terkait ditandai returned. Mendukung **partial return** (assign 2, return 1) dan tautan best-effort ke handover assign asal (`parent_handover_id`). Holder dari serah terima hanya bisa dikembalikan lewat return handover (return manual diblokir).
- **Guard perubahan status aset**: menolak ubah status (single & bulk) bila aset masih **dipegang via handover** atau sedang dalam **pending handover** — menjaga konsistensi lifecycle handover. Bulk menolak seluruh batch bila ada satu yang terkunci.
- Test E2E return handover + guard status (`test/handover.test.ts`).

### Changed
- **Rename modul `AssetHandover` → `Handover`** (generik, untuk reuse modul stok — stok & serah terima berbagi satu dokumen): folder `src/modules/handover`, tabel `handovers` & `handover_items`, endpoint `/handover*`, permission `handover:*`, entity-type attachment `"Handover"`.
- **Cleanup serializer (repo-wide)**: hapus scalar FK bila objek lengkap sudah diserialisasi (mis. `assetId` bila ada `asset:{}`), pada holder/asset/user/user-list/note/location/maintenance. `UserService.create/update` kini reload relasi agar objek `role`/`employee` ada di response.
- Entity `AssetHolder`: relasi origin handover `handover`/`handover_id` → **`assignHandover`/`assign_handover_id`**; tambah relasi `returnHandover`/`return_handover_id` (diisi saat return handover di-approve).
- Copy PDF & dokumen: type transaksi Penetapan/Pengembalian.

### Added
- **Cancel Asset Handover**: handover berstatus `pending` dapat dibatalkan (status menjadi `cancel`); setelah `approve` handover terkunci dan tidak bisa dibatalkan. Endpoint `POST /asset-handover/:id/cancel` (permission `asset-handover:cancel`); aset ikut terbebas untuk di-assign ulang. Alur e-sign tetap aman: webhook `COMPLETED` menolak meng-approve handover yang sudah `cancel`.
- **Module Asset Handover** (Form Serah Terima Aset/Barang): dokumen serah terima berisi header (tanggal, lokasi teks bebas, type, catatan) + daftar item aset (asset, employee penerima, jumlah, kelengkapan, kondisi).
  - Type transaksi: `assign | return`. Status alur: `pending | approve | reject | cancel`.
  - Satu handover dapat memiliki banyak employee (employee dipasang per item; satu employee bisa memegang banyak aset).
  - Hanya aset tanpa active holder & tidak sedang di handover `pending` lain yang boleh dipilih.
  - Saat `approve` → otomatis membuat asset holder tiap item (asset → employee). Cancel hanya untuk handover `pending`; setelah `approve` handover terkunci.
  - Endpoint: `GET/POST /asset-handover`, `GET /asset-handover/:id`, `POST /asset-handover/:id/cancel` (permission `asset-handover:*`). Approve/reject dipicu via webhook e-sign.
- **E-sign integration untuk Asset Handover**:
  - Saat handover dibuat → otomatis men-generate PDF "FORM SERAH TERIMA ASET/BARANG" (tanggal, nama karyawan, checklist type: Penetapan/Pengembalian, catatan, tabel item berisi nama/code/deskripsi, kolom tanda tangan penyerah & penerima), menyimpannya sebagai attachment handover, dan mengirimkannya ke provider e-sign (`esignHelper.documentSign`) dengan signer = penyerah + penerima.
  - Webhook `POST /webhook/esign` status `COMPLETED` → handover di-approve; `filename` attachment handover diganti ke `file_url` dokumen tertanda, dan dokumen tertanda tersebut juga di-attach ke setiap asset holder yang dibuat.
  - Helper baru: `src/core/helpers/handover-pdf.ts` (`generateHandoverPdf`) memakai `pdf-lib`.
  - `AttachmentService`: tambah `createExternal()` (attachment dari URL eksternal) & `updateFilename()`.
- Entity baru: `asset_handovers`, `asset_handover_items`.
- Permission baru: `asset-handover` × `read, create, update, delete, approve, reject, cancel`.
- Test E2E: `test/asset-handover.test.ts` (23 test — termasuk generate attachment form saat create, approve/reject via webhook e-sign, attachment tertanda ke holder, & skenario cancel).

### Changed
- Entity `AssetHolder`: tambah kolom nullable `handover_id` (diisi saat handover di-approve) + relasi ke `AssetHandover`.
- `AssetHolderService.create`: memblokir assign holder manual bila aset sedang menunggu approval handover (`pending`).
- Handover: field `purpose` (Keperluan) diganti menjadi `note` (Catatan) — kolom DB `note`, ditampilkan di form, detail, dan PDF form serah terima.
- Handover: `transactionType` disederhanakan dari `serah_terima | peminjaman | pengembalian` menjadi `assign | return` (label form "Type"; label PDF Penetapan/Pengembalian).
- **Sentralisasi enum**: semua enum bernilai tetap dipindah ke `src/core/enums.ts` (`ASSET_STATUSES`, `HANDOVER_TRANSACTION_TYPES`, `HANDOVER_STATUSES`, `ASSET_LOCATION_SOURCES`) — validator (Zod) & entity (TypeORM) memakai sumber yang sama, jadi perubahan nilai cukup di satu tempat.

### Removed
- Handover: field `category` (Status Aset) & `estimatedReturnDate` (Estimasi Kembali) dihapus total — dari form, detail, list, validator, kolom DB, swagger, dan PDF (checklist "Status Asset" & baris "Estimasi Tanggal Kembali").

### Fixed
- Handover: catatan (`note`) sebelumnya tidak tersimpan karena frontend mengirim `note` sementara backend memvalidasi `purpose`; kini konsisten memakai `note` end-to-end.

---

## [0.1.0] — 2026-06-18

### Added
- Initial release

---

## Template Entri Baru

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- Fitur baru

### Changed
- Perubahan pada fitur yang sudah ada

### Deprecated
- Fitur yang akan dihapus di versi mendatang

### Removed
- Fitur yang dihapus

### Fixed
- Perbaikan bug

### Security
- Perbaikan keamanan
```

### Versioning Rules

- **MAJOR** (X.0.0): Breaking changes, perubahan arsitektur besar
- **MINOR** (0.X.0): Fitur baru, module baru, penambahan endpoint
- **PATCH** (0.0.X): Bug fix, perbaikan kecil, update dependencies
