# 🏛️ SIANTRI - Sistem Antrean Terpadu (Full Stack Development)

Aplikasi manajemen sistem antrean terintegrasi modern berbasis web real-time yang dirancang untuk pelayanan publik (PTSP, Dukcapil, Bank, Rumah Sakit, dll.) dengan antarmuka futuristik, audio chime Web Audio API, sintesis suara panggilan berbahasa Indonesia, pendaftaran tiket mandiri, layar monitor TV, panel petugas, analitik grafik, dan pelacak antrean pribadi pelanggan.

---

## 🌟 Fitur Utama Sesuai Spesifikasi

1. **Pendaftaran Antrean (Customer Kiosk)**
   - Pelanggan memilih jenis layanan dengan estimasi durasi dan jumlah antrean menunggu.
   - Mendapatkan nomor tiket otomatis berurutan sesuai prefix layanan (misal: `A-001`, `B-001`, dll.).
   - Menampilkan posisi antrean dan estimasi waktu tunggu secara dinamis.
   - Dialog cetak struk thermal ticket receipt dilengkapi simulasi QR Code pelacakan smartphone.

2. **Layanan & Loket (Master Data)**
   - **Kelola Layanan**: CRUD jenis layanan, kode prefix (A, B, C, dst.), nama layanan, deskripsi, estimasi waktu standar, dan pemilihan warna badge.
   - **Kelola Loket (Counter)**: CRUD nomor loket, pemetaan multi-layanan yang ditangani loket, status loket, dan penugasan petugas.

3. **Login Petugas/Admin (Autentikasi Multi-Role)**
   - **Administrator (Superadmin)**: Akses menyeluruh ke semua modul, Master Data Layanan, Master Data Loket, Manajemen Akun Petugas, Laporan & Analitik, dan Pengaturan Sistem.
   - **Petugas Loket (Staff)**: Terbatas pada pemanggilan nomor antrean sesuai layanan yang ditugaskan pada loketnya.
   - Dilengkapi **Akses Cepat Demo 1-Klik** untuk mempermudah demonstrasi dan pengujian dosen/penguji.

4. **Panggilan Antrean (Calling Console)**
   - **📢 Panggil Berikutnya**: Memanggil antrean terdepan yang berstatus *waiting* dan memicu suara panggilan di monitor.
   - **🔁 Panggil Ulang**: Mengulang panggilan audio dan visual di layar monitor.
   - **⏭️ Lewati**: Menandai antrean sebagai *skipped* jika pemohon tidak hadir.
   - **✅ Selesai**: Menyelesaikan proses pelayanan, mencatat durasi pelayanan aktual, dan menghentikan serving timer.

5. **Layar Monitor (Display Board TV)**
   - Tampilan Fullscreen resolusi tinggi dengan desain dark mode glassmorphism dan kontras tinggi.
   - **Highlight Nomor yang Sedang Dipanggil**: Kotak highlight hijau menyala (*emerald pulsing glow*), nomor tiket raksasa, dan nama loket tujuan.
   - **Riwayat Panggilan Terakhir**: Menampilkan 4-6 nomor terakhir yang dipanggil.
   - **Grid Status Seluruh Loket**: Menampilkan nomor yang sedang dilayani setiap loket secara real-time.
   - **Audio Chime & Speech Synthesizer**: Suara nada bel bandara (Web Audio API 4-tone chime) dilanjutkan suara Text-to-Speech bahasa Indonesia (*"Nomor antrean A, nol, nol, satu, silakan menuju loket satu"*).
   - Jam digital dan tanggal real-time, serta teks pengumuman berjalan (*running text marquee*).

6. **Manajemen Harian (Daily Lifecycle)**
   - Reset nomor antrean otomatis setiap hari saat waktu reset harian tiba (default: `00:00`).
   - Riwayat transaksi masa lalu tetap tersimpan utuh di database per tanggal (*date-based logging*).
   - Tombol manual *Reset Antrean Hari Ini* di menu admin.

7. **Laporan & Statistik (Analytics & Reporting)**
   - Ringkasan KPI: Total antrean, total selesai dilayani, total dilewati, rata-rata waktu tunggu, dan rata-rata waktu pelayanan.
   - **Grafik Volume Antrean per Jam**: Visualisasi traffic antrean interaktif (08:00 - 16:00).
   - **Kinerja per Loket**: Perbandingan jumlah pemohon yang dilayani dan kecepatan per loket.
   - **Distribusi Kategori Layanan**: Breakdown persentase volume tiap jenis layanan.
   - **Export CSV**: Download data transaksi lengkap siap dibuka di Microsoft Excel dengan format UTF-8 BOM.

8. **Pengaturan Sistem**
   - Nama instansi / kantor dan alamat kantor.
   - Teks pengumuman berjalan (*running text* monitor).
   - Waktu reset harian otomatis (format HH:mm).
   - Pengaturan kecepatan bicara (*voice speed*) dan nada suara (*pitch*) lengkap dengan tombol uji coba suara.
   - Tombol Reset Pabrik (*Factory Demo Seed*).

9. **Status Antrean Pribadi (Pelanggan Mobile)**
   - Cek posisi antrean sendiri cukup dengan memasukkan kode tiket (misal: `A-004`).
   - Menampilkan jumlah orang di depan dan estimasi waktu giliran tiba.
   - **Notifikasi Giliran Dekat**: Peringatan visual kuning dan suara bip saat giliran tersisa <= 2 orang.
   - **Notifikasi Giliran Tiba**: Peringatan hijau berkedip saat nomor dipanggil ke loket.
   - **Fitur Batalkan Antrean**: Tombol untuk membatalkan tiket jika pemohon batal hadir.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Prasyarat
- Node.js (v18.0.0 atau lebih baru)
- npm

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan Server
```bash
npm run dev
# atau
npm start
```

Server akan aktif di: **`http://localhost:3000`**

---

## ⚡ Integrasi Database Supabase (PostgreSQL Cloud)

Aplikasi telah dilengkapi adapter resmi `@supabase/supabase-js` dengan sinkronisasi dua arah (*bi-directional sync*) dan fallback offline.

### Langkah Menghubungkan ke Supabase:
1. Buat project baru di [supabase.com](https://supabase.com).
2. Masuk ke **SQL Editor** di dashboard Supabase Anda, lalu salin dan jalankan seluruh isi file:
   [`database/supabase_schema.sql`](file:///c:/Users/user/Downloads/tugas%20apk%20%28siantri%29/tugas-fsd/database/supabase_schema.sql)
3. Buka **Project Settings -> API** di Supabase untuk mendapatkan:
   - **Project URL** (contoh: `https://xyzcompany.supabase.co`)
   - **Project API Key** (`anon` public atau `service_role`)
4. Masukkan kredensial tersebut ke file [`.env`](file:///c:/Users/user/Downloads/tugas%20apk%20%28siantri%29/tugas-fsd/.env):
   ```env
   PORT=3000
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-supabase-api-key
   ```
   *Atau Anda juga dapat mengisi langsung dari **Dashboard Admin -> Pengaturan Sistem -> Database Supabase** melalui browser, lalu klik "Simpan & Sinkronkan" tanpa perlu membuka file!*
5. Klik **"Uji Koneksi"** di dashboard admin untuk memastikan status terhubung `✅ Terhubung ke Supabase`.

---

## 🌐 Daftar Halaman & URL

| Halaman | URL | Keterangan |
| :--- | :--- | :--- |
| **📱 SIANTRI Mobile (PWA App)** | `http://localhost:3000/mobile.html` | Aplikasi smartphone lengkap: ambil tiket, digital pass, notifikasi getar & suara, riwayat |
| **Portal Terpadu (SPA All-in-One)** | `http://localhost:3000` | Halaman utama dengan navigasi tab antar view & demo role switcher |
| **Layar Monitor TV (Fullscreen)** | `http://localhost:3000/monitor.html` | Tampilan ruang tunggu TV untuk audio & nomor panggilan |
| **Kiosk Tiket Mandiri** | `http://localhost:3000/kiosk.html` | Layar sentuh touchscreen untuk ambil tiket |
| **Pelacak HP Pelanggan** | `http://localhost:3000/tracking.html` | Tampilan mobile untuk scan QR atau cek tiket |

> 📱 **Cara Buka di HP Nyata:** Sambungkan HP Anda ke Wi-Fi yang sama dengan laptop/PC ini, lalu buka alamat IP lokal Anda: `http://10.60.240.83:3000/mobile.html` atau klik tombol **"📱 Buka di HP"** di navigasi atas aplikasi untuk menampilkan QR Code!

---

## 🔑 Akun Demo Siap Pakai

| Role | Username | Password | Deskripsi Tugas |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `admin` | `admin123` | Akses penuh dashboard, master data, laporan, settings |
| **Petugas Loket 1** | `petugas1` | `petugas123` | Loket 1 - Layanan Kependudukan & KTP |
| **Petugas Loket 2** | `petugas2` | `petugas123` | Loket 2 - Layanan Kependudukan & CS |
| **Petugas Loket 3** | `petugas3` | `petugas123` | Loket 3 - Layanan Pajak & Retribusi |
| **Petugas Loket 4** | `petugas4` | `petugas123` | Loket 4 - Layanan Perizinan OSS |

*(Tersedia tombol login 1-klik di modal login untuk memudahkan pengujian).*

---

## 🧪 Pengujian Otomatis (E2E Test)
Untuk memvalidasi seluruh 9 fitur spesifikasi di atas:
```bash
node test_e2e.js
```
*Hasil: 15/15 Pengujian Berhasil (100% SUKSES).*