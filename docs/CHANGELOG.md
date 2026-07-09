# 📝 Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-07-08

### Added
- **Module Asset Handover** (Form Serah Terima Aset/Barang): dokumen serah terima berisi header (tanggal, lokasi teks bebas, jenis transaksi, status aset, keperluan, estimasi kembali) + daftar item aset (asset, employee penerima, jumlah, kelengkapan, kondisi).
  - Status alur: `pending | approve | cancel`.
  - Satu handover dapat memiliki banyak employee (employee dipasang per item; satu employee bisa memegang banyak aset).
  - Hanya aset tanpa active holder & tidak sedang di handover `pending` lain yang boleh dipilih.
  - Saat `approve` → otomatis membuat asset holder tiap item (asset → employee). Saat `cancel` handover yang sudah `approve` → holder yang dibuat otomatis dikembalikan (return).
  - Endpoint: `GET/POST /asset-handover`, `GET/PUT/DELETE /asset-handover/:id`, `POST /asset-handover/:id/approve`, `POST /asset-handover/:id/cancel` (permission `asset-handover:*`).
- **E-sign integration untuk Asset Handover**:
  - Saat handover dibuat → otomatis men-generate PDF "FORM SERAH TERIMA ASET/BARANG" (tanggal, nama karyawan, checklist jenis transaksi, checklist status aset, keperluan, estimasi kembali, tabel item berisi nama/code/deskripsi, kolom tanda tangan penyerah & penerima), menyimpannya sebagai attachment handover, dan mengirimkannya ke provider e-sign (`esignHelper.documentSign`) dengan signer = penyerah + penerima.
  - Webhook `POST /webhook/esign` status `COMPLETED` → handover di-approve; `filename` attachment handover diganti ke `file_url` dokumen tertanda, dan dokumen tertanda tersebut juga di-attach ke setiap asset holder yang dibuat.
  - Helper baru: `src/core/helpers/handover-pdf.ts` (`generateHandoverPdf`) memakai `pdf-lib`.
  - `AttachmentService`: tambah `createExternal()` (attachment dari URL eksternal) & `updateFilename()`.
- Entity baru: `asset_handovers`, `asset_handover_items`.
- Permission baru: `asset-handover` × `read, create, update, delete, approve, cancel`.
- Test E2E: `test/asset-handover.test.ts` (16 test — termasuk generate attachment form saat create, approve/reject via webhook e-sign, & attachment tertanda ke holder).

### Changed
- Entity `AssetHolder`: tambah kolom nullable `handover_id` (diisi saat handover di-approve) + relasi ke `AssetHandover`.
- `AssetHolderService.create`: memblokir assign holder manual bila aset sedang menunggu approval handover (`pending`).

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
