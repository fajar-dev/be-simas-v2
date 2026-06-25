# Integrasi Juniper Mist BLE — Asset Location Tracking

## Gambaran Besar

Setiap aset (laptop, printer, dll) ditempel **tag BLE kecil** yang terus-menerus memancarkan sinyal Bluetooth. Access Point (AP) Juniper Mist yang sudah terpasang di setiap ruangan akan menangkap sinyal ini dan tahu "aset ini ada di ruangan ini".

## Alur Kerja

```
1. 🏷️ Tag BLE di aset terus broadcast sinyal
                    ↓
2. 📡 AP Mist di "Ruang Server" mendeteksi sinyal → kirim ke Mist Cloud
                    ↓
3. ☁️ Mist Cloud menentukan: "Tag ini masuk ke zona Ruang Server"
                    ↓
4. 📨 Mist Cloud kirim webhook ke SIMAS:
   {
     mac: "AA:BB:CC:DD:EE:FF",   ← identitas tag
     zone_id: "zone-uuid-1234",   ← zona yang dimasuki
     type: "enter"                 ← masuk zona
   }
                    ↓
5. 🖥️ SIMAS Backend menerima & proses:
   - Cari asset yang punya ble_tag_mac = "AA:BB:CC:DD:EE:FF" → Laptop A
   - Cari location yang punya mist_zone_id = "zone-uuid-1234" → Ruang Server
   - Cek: apakah Laptop A sudah di Ruang Server?
     - Belum → INSERT asset_location baru (otomatis!)
     - Sudah → skip (tidak duplikat)
```

## Mapping Data

Yang dilakukan adalah **menjembatani 2 sistem** dengan mapping sederhana:

| Di Mist | Di SIMAS | Cara mapping |
|---------|----------|--------------|
| BLE Tag (MAC address) | Asset | Field `ble_tag_mac` di tabel `assets` |
| Zone (zone_id) | Location | Field `mist_zone_id` di tabel `locations` |

## Setup yang Diperlukan

### 1. Di setiap aset — tempel tag BLE, isi MAC address di form SIMAS

```
Asset: Laptop A
BLE Tag MAC: AA:BB:CC:DD:EE:FF
```

### 2. Di setiap lokasi — mapping zone ID dari Mist ke lokasi SIMAS

```
Location: Ruang Server (Branch: Kantor Pusat)
Mist Zone ID: zone-uuid-1234
```

### 3. Di Mist Cloud — konfigurasi webhook

```
URL: https://api-simas.domain.com/api/webhook/mist?secret=xxx
Topic: zone
```

### 4. Environment Variable

Tambahkan di file `.env`:

```env
MIST_WEBHOOK_SECRET=your-secret-key-here
```

## Webhook Endpoint

### `POST /api/webhook/mist`

**Autentikasi**: Via header `X-Mist-Secret` atau query parameter `?secret=xxx`

**Request Body** (dari Mist Cloud):

```json
{
  "topic": "zone",
  "events": [
    {
      "site_id": "site-uuid",
      "zone_id": "zone-uuid-1234",
      "mac": "AA:BB:CC:DD:EE:FF",
      "type": "enter",
      "timestamp": 1622548800.123,
      "name": "Ruang Server"
    }
  ]
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "processed": 1,
    "results": [
      {
        "mac": "AA:BB:CC:DD:EE:FF",
        "status": "relocated",
        "assetId": 42,
        "locationId": 7
      }
    ]
  }
}
```

**Possible statuses**:

| Status | Keterangan |
|--------|------------|
| `relocated` | Berhasil — asset location baru dibuat |
| `skipped` | Event bukan "enter" (misal "exit"), diabaikan |
| `asset_not_found` | MAC address tidak cocok dengan aset manapun |
| `zone_not_mapped` | Zone ID tidak terdaftar di location manapun |
| `already_at_location` | Aset sudah di lokasi tersebut, tidak duplikat |
| `location_disabled` | Fitur location tracking dinonaktifkan di aset ini |

## Database Schema Changes

### Tabel `assets`

| Column | Type | Keterangan |
|--------|------|------------|
| `ble_tag_mac` | varchar, nullable, unique | MAC address BLE tag yang ditempel di aset |

### Tabel `locations`

| Column | Type | Keterangan |
|--------|------|------------|
| `mist_zone_id` | varchar, nullable, unique | UUID zona dari Mist yang di-mapping ke lokasi |

### Tabel `asset_locations`

| Column | Type | Keterangan |
|--------|------|------------|
| `source` | varchar, default "manual" | Sumber data: `manual` (input user) atau `ble` (otomatis dari Mist) |

## Setelah Setup

Semuanya **otomatis**:

- Laptop A dipindah dari Ruang Server ke Ruang Meeting → Mist kirim webhook → SIMAS otomatis catat perpindahan
- Buka detail aset Laptop A → history lokasi terisi otomatis dengan badge **BLE** (bukan Manual)
- Tidak perlu karyawan input manual perpindahan lagi

## Keamanan

- Webhook dilindungi **secret key** — hanya Mist Cloud yang tahu
- Request tanpa secret yang benar akan ditolak (401 Unauthorized)
- Secret dikonfigurasi via environment variable `MIST_WEBHOOK_SECRET`

## Yang TIDAK berubah

- Input lokasi **manual** tetap bisa dilakukan seperti biasa
- History menampilkan **sumber**: `BLE` (otomatis) atau `Manual` (input user)
- Aset tanpa tag BLE tetap berfungsi normal — field `ble_tag_mac` opsional

## Prerequisites di Mist

| Requirement | Keterangan |
|-------------|------------|
| **Subscription** | Asset Visibility license aktif |
| **AP Placement** | AP sudah ditempatkan di floorplan dengan posisi + tinggi akurat |
| **BLE Tags** | Tag BLE ditempel di aset, advertising interval > 100ms, 0 dBm |
| **Named Assets** | BLE tag didaftarkan sebagai Named Asset di Mist portal |
| **Zones** | Zona (ruangan/area) sudah didefinisikan di floorplan |
| **Webhook** | Webhook dikonfigurasi ke URL SIMAS backend dengan topic `zone` |

## Referensi

- [Juniper Mist API — Getting Started](https://www.juniper.net/documentation/us/en/software/mist/api/http/getting-started/how-to-get-started)
- [Mist Webhook Configuration](https://www.mist.com/documentation/mist-webhooks/)
