# 📋 Catatan Pekerjaan - Foto Kita Blur
> Terakhir diperbarui: **9 Juli 2025 — Sesi Malam**

---

## ✅ Pekerjaan yang Sudah Selesai

### 1. Logo FOKUFOKU — Layout Landscape
- Logo SVG di halaman utama (`index.html`) diubah menjadi **landscape** (memanjang ke samping, satu baris: FOKU FOKU).
- Ukuran font dan spasi disesuaikan agar tetap rapi dan proporsional.
- Subtitle "by @alwnfarhn" diposisikan tepat di bawah logo.
- **File terkait:** `index.html` (baris 17-78)

### 2. Sidebar Grid Pemilih Layout Foto (1/2/3/4)
- Tombol pemilih grid foto (1, 2, 3, 4 foto) dirapikan dan disejajarkan.
- Tidak menggunakan grid CSS, melainkan flexbox vertical agar rapi.
- **File terkait:** `index.html` (baris 143-164), `style.css` (.layout-sidebar, .layout-btn)

### 3. Panel Tema Bingkai (Frame Filter)
- Ditambahkan panel pemilih tema bingkai di samping kanan: **Minimalist, Elegant, Coquette, Retro Film**.
- Masing-masing tema mengubah warna background dan teks pada hasil foto strip.
- Teks otomatis menyesuaikan (gelap/terang) berdasarkan warna bingkai yang dipilih.
- **File terkait:** `index.html` (baris 167-187), `script.js` (baris 58-70, 343-412), `style.css` (.frame-design-panel, .frame-btn)

### 4. Presisi Layout Tengah
- Logo FOKUFOKU, subtitle, dan layar kamera dikunci posisinya agar **100% center/presisi**.
- Menggunakan CSS Grid 3 kolom (`1fr auto 1fr`) sehingga sidebar kiri/kanan tidak menggeser posisi tengah.
- **File terkait:** `style.css` (.camera-stage, .camera-and-controls)

### 5. Tinggi Sidebar Disesuaikan
- Panel sidebar (grid + tema bingkai) diperbaiki agar tidak terlalu tinggi/memanjang ke bawah.
- Menggunakan `align-items: flex-start` agar tinggi sesuai konten.
- **File terkait:** `style.css` (.side-options-container)

### 6. Filter Foto di Halaman Hasil
- Ditambahkan **7 filter foto** di halaman hasil sesi:
  - **Normal** — Tanpa filter
  - **B&W** — Hitam putih (monochrome)
  - **Vintage** — Sepia klasik ala era 90/2000-an
  - **Pastel** — Lembut, cerah, Korean style
  - **Vivid** — Kontras tinggi, warna pekat
  - **Cool** — Nuansa kebiruan sejuk
  - **Warm** — Nuansa kekuningan hangat
- Filter bisa di-preview langsung di gambar.
- Saat download, filter di-render permanen ke canvas sebelum disimpan sebagai JPEG.
- **Di desktop:** filter tampil sebagai panel sidebar di samping kanan foto.
- **Di HP:** filter tampil di atas foto secara horizontal.
- **File terkait:** `index.html` (baris 233-245), `script.js` (baris 245-313), `style.css` (.result-filters, .filter-btn, @media min-width 600px)

### 7. File Logo SVG
- Dibuat salinan logo dalam format `.svg` untuk keperluan lain (desain, branding).
- **File:** `logo_fokufoku_lengkap.svg`

### 8. Hasil Foto Dibuat Selalu Jernih
- Permintaan: Blur hanya berlaku saat proses mengambil gambar (live preview/kamera), sedangkan hasil jepretan akhir harus jernih.
- Mengubah logika di `takeSnapshotForGrid()` dengan memastikan `ctx.filter = 'none'` selalu digunakan pada saat canvas menyimpan frame kamera.
- **Kualitas JPEG ditingkatkan** dari 0.9 menjadi 1.0 (kualitas maksimal/terbaik).
- **File terkait:** `script.js` (baris 484-501)

### 9. Audit & Perbaikan Bug
- **Bug: Halaman hasil tidak bisa di-scroll** → FIXED ✅
  - Penyebab: `max-height: 60vh` dan `overflow: hidden` pada `.result-media-box`
  - Solusi: Hapus batasan tinggi, buat class `.result-page-wrapper` dengan `overflow-y: auto`
- **Bug: Elemen `#error-message` & `#loading-message` tidak ada di HTML** → FIXED ✅
  - Penyebab: JavaScript mereferensikan elemen yang belum ada di DOM
  - Solusi: Tambahkan kedua elemen di bawah video container

---

## 📁 Daftar File Proyek

| File | Fungsi |
|------|--------|
| `index.html` | Halaman utama (kamera, popup, hasil) |
| `style.css` | Semua styling dan responsif |
| `script.js` | Logika AI, photobooth, filter, recording |
| `logo_fokufoku_lengkap.html` | Logo SVG versi asli (vertikal/stacked) |
| `logo_fokufoku_lengkap.svg` | Salinan logo dalam format SVG murni |
| `ikon_favicon_fokufoku.html` | Favicon/ikon kecil |
| `PROMPTS.md` | Kumpulan prompt pengembangan |
| `SPEC.md` | Spesifikasi proyek |

---

## 🔜 Tindak Lanjut / TODO

### Prioritas Tinggi
- [ ] **Test di HP** — Pastikan layout responsif dan filter berfungsi baik di mobile
- [ ] **Test semua grid foto (1, 2, 3, 4)** — Verifikasi setiap layout menghasilkan strip yang benar
- [ ] **Test semua tema bingkai** — Pastikan warna background dan teks sesuai di semua kombinasi
- [ ] **Test semua filter foto** — Pastikan setiap filter ter-render saat download

### Prioritas Sedang
- [ ] **Tambah tema bingkai baru** — Misalnya: gradient biru, neon, earth tone
- [ ] **Tambah filter foto baru** — Misalnya: dramatic, cinematic, film kodak
- [ ] **Aktifkan localStorage untuk popup** — Agar popup welcome hanya muncul sekali (saat ini dinonaktifkan untuk testing)
- [ ] **Cache busting otomatis** — Ganti `?v=8` dengan hash/timestamp otomatis di produksi

### Prioritas Rendah / Ide
- [ ] **Tambah custom text di bingkai** — User bisa menulis teks sendiri di strip foto
- [ ] **Tambah stiker/emoji overlay** — Dekorasi tambahan sebelum download
- [ ] **Tambah opsi format download** — PNG selain JPEG
- [ ] **Optimasi performa mobile** — Kurangi beban AI model di perangkat low-end

---

## ⚠️ Catatan Teknis Penting

1. **MediaPipe** diimpor dari CDN (`@mediapipe/tasks-vision@0.10.3`). Jika CDN down, AI tidak akan berfungsi.
2. **Semua proses berjalan lokal** — Tidak ada data yang dikirim ke server. Aman untuk privasi pengguna.
3. **Video BTS** direkam dalam format `.webm` menggunakan `MediaRecorder` API.
4. **Foto strip** di-generate sebagai canvas JPEG dengan kualitas 0.9.
5. **Fullscreen** memiliki 2 mode: Fullscreen API (desktop) dan CSS fallback (mobile).

---

*Catatan ini dibuat otomatis sebagai referensi pengembangan. Perbarui secara berkala saat ada pekerjaan baru.*
