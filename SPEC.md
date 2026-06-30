# SPEC.md — Website "Foto Kita Blur" (Live Webcam Dance Recorder)

> Dokumen ini ditulis dengan pendekatan **Spec-Driven Development (SDD)**.
> Spec ditulis dan disepakati dulu, baru kode dibangun mengikuti spec ini.

---

## 1. Overview

**Nama project:** Foto Kita Blur — Live Webcam Dance Recorder
**Tipe:** Web application, single page, real-time webcam + recording
**Tujuan:** User membuka website, mengizinkan akses webcam, merekam video sambil menari/berpose (sambil memutar lagu dari aplikasi lain di device mereka sendiri), lalu sistem otomatis mendeteksi gesture tangan tertentu (misalnya peace sign/2 jari) secara real-time, dan begitu gesture terdeteksi, efek blur otomatis muncul lalu kembali normal, terinspirasi gaya tren "Foto Kita Blur" yang viral di TikTok. Hasil rekaman video bisa di-preview dan didownload.

**Catatan hak cipta:** Project ini **tidak** memutar, merekam, menyematkan, atau mendistribusikan audio lagu apa pun, dan tidak menampilkan lirik di dalam aplikasi. Lagu yang menjadi latar tren ini tetap diputar user dari aplikasi/perangkat mereka sendiri (misalnya Spotify atau YouTube secara terpisah), bukan dari website ini. Yang diadaptasi di sini murni konsep efek visualnya, bukan konten musiknya.

---

## 2. Tech Stack (asumsi)

| Layer | Teknologi |
|---|---|
| Akses kamera | `getUserMedia` (Web API browser, native) |
| Hand/gesture tracking | MediaPipe Hands (versi JavaScript, via `@mediapipe/hands` atau TensorFlow.js `handpose`/`hand-pose-detection`), jalan langsung di browser |
| Render frame real-time | HTML5 `<canvas>` (jembatan antara video stream, hasil deteksi gesture, dan efek visual) |
| Recording | `MediaRecorder` API (merekam output canvas jadi file video `.webm`) |
| Efek blur/aesthetic | CSS filter / Canvas pixel manipulation, diterapkan real-time per frame |
| Trigger blur | Gesture tangan tertentu (misal peace sign/2 jari) terdeteksi otomatis lewat hand-tracking, dengan tombol manual sebagai cadangan |
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Backend (opsional) | Python + Flask, hanya kalau mau simpan riwayat video di server |

Catatan: seluruh proses (deteksi gesture, rekam, render efek) bisa 100% dilakukan di browser (client-side), karena MediaPipe Hands versi JS dan TensorFlow.js memang didesain untuk jalan di sisi client tanpa kirim data ke server. Backend **tidak wajib** kecuali kamu mau fitur simpan/gallery di server.

---

## 3. User Stories

1. **Sebagai user**, saya ingin membuka website dan langsung melihat tampilan webcam saya, supaya saya bisa atur pose dan posisi dulu.
2. **Sebagai user**, saya ingin ada hitungan mundur (countdown) sebelum recording mulai, supaya saya sempat bersiap.
3. **Sebagai user**, saya ingin sistem otomatis mendeteksi gesture tangan saya (misal peace sign/2 jari) selama recording, supaya efek blur muncul tepat saat saya melakukan gesture itu, tanpa saya perlu pencet tombol apa pun.
4. **Sebagai user**, saya ingin efek blur muncul secara halus (fade in) lalu hilang secara halus juga (fade out) setelah beberapa saat sejak gesture terdeteksi, bukan muncul/hilang secara tiba-tiba dan kasar.
5. **Sebagai user**, saya ingin bisa melakukan gesture itu berkali-kali selama satu sesi recording, supaya efek blur bisa muncul di beberapa momen sekaligus.
6. **Sebagai user**, saya ingin tetap ada tombol manual sebagai cadangan, untuk jaga-jaga kalau gesture saya tidak terdeteksi dengan baik (misal pencahayaan kurang).
7. **Sebagai user**, saya ingin mengatur intensitas efek blur (ringan, sedang, brutal) sebelum mulai recording.
8. **Sebagai user**, saya ingin bisa rekam ulang dari awal kalau hasilnya kurang sreg, sebelum download.
9. **Sebagai user**, saya ingin mendownload hasil video ke device saya dalam format yang umum dipakai.
10. **Sebagai user**, saya ingin website ini menjelaskan dengan jelas kalau webcam dan rekaman saya tidak dikirim ke server mana pun (privasi).

---

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Sistem meminta izin akses webcam lewat browser (`getUserMedia`) |
| FR-2 | Sistem menampilkan live preview webcam di halaman sebelum recording dimulai |
| FR-3 | Tersedia tombol "Mulai Rekam" dengan countdown 3 detik sebelum recording dimulai |
| FR-4 | Selama recording berlangsung, sistem menjalankan hand-tracking secara real-time dan mendeteksi gesture target (misal peace sign/2 jari) di tiap frame |
| FR-5 | Begitu gesture target terdeteksi, efek blur muncul (fade in) dan otomatis hilang (fade out) setelah durasi tertentu (misal 1-2 detik), lalu kembali ke tampilan normal |
| FR-6 | Sistem menerapkan cooldown singkat (misal 1.5 detik) setelah satu gesture terdeteksi, supaya gesture yang sama tidak memicu efek berkali-kali secara beruntun tanpa sengaja |
| FR-7 | Tersedia tombol trigger manual (keyboard Spasi atau tombol layar) sebagai cadangan kalau gesture tidak terdeteksi |
| FR-8 | User bisa memilih preset intensitas efek sebelum mulai: Ringan / Sedang / Brutal |
| FR-9 | User bisa menekan tombol "Stop" untuk mengakhiri recording kapan saja |
| FR-10 | User bisa preview hasil video sebelum download, dan rekam ulang dari awal kalau kurang sreg |
| FR-11 | User bisa download hasil video dalam format `.webm` (format native `MediaRecorder`) |
| FR-12 | Sistem menampilkan notice privasi yang jelas (video dan data hand-tracking diproses sepenuhnya di browser, tidak diupload ke server kecuali user pilih simpan) |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Latency antara gesture terdeteksi dan efek blur muncul harus di bawah 200ms, supaya terasa responsif |
| NFR-2 | Proses hand-tracking tidak boleh membuat frame rate video turun drastis (target tetap di atas 20fps selama tracking aktif) |
| NFR-3 | Website harus tetap berjalan walau tanpa backend (full client-side capable) |
| NFR-4 | Tidak ada data webcam/video/hasil tracking yang dikirim ke server tanpa persetujuan eksplisit dari user |
| NFR-5 | Tampilan harus mobile-friendly, termasuk tombol trigger manual yang mudah di-tap saat sedang menari |
| NFR-6 | Browser yang tidak mendukung `getUserMedia`, `MediaRecorder`, atau library hand-tracking yang dipakai harus mendapat pesan fallback yang jelas, dengan opsi tetap pakai mode trigger manual saja |

---

## 6. Komponen Visual (Style Reference dari Tren)

Berdasarkan ciri khas tren "Foto Kita Blur" di TikTok, elemen visual yang relevan untuk ditiru gaya-nya (bukan kontennya):

- **Soft blur / motion blur ringan** di sebagian frame, bukan blur merata penuh, supaya tetap terlihat ada subjek
- **Film grain** halus untuk kesan nostalgic
- **Warna hangat sedikit pudar** (warm fade tone), bukan warna tajam dan saturated
- **Vignette ringan** di pinggir foto
- **Aspect ratio square (1:1) atau Polaroid-style** dengan border putih di bawah, biar mirip estetika "foto kenangan"

Preset yang bisa dibuat:
- **Ringan**: grain tipis + warm tone, fokus subjek masih jelas
- **Sedang**: blur halus + grain + vignette
- **Brutal**: blur kuat menyeluruh, kesan foto kenangan yang benar-benar buram (sesuai makna lagu)

---

## 7. Technical Notes — Implementasi Gesture Detection & Trigger Blur

Pendekatan teknis untuk fitur ini:

1. Video stream dari webcam digambar terus-menerus ke `<canvas>` lewat `requestAnimationFrame`, bukan langsung ditampilkan dari elemen `<video>`. Ini perlu supaya kita bisa memanipulasi pixel-nya frame demi frame.
2. Library hand-tracking (misal MediaPipe Hands versi JS, atau `hand-pose-detection` dari TensorFlow.js) memproses tiap frame video dan mengembalikan koordinat landmark tangan (21 titik per tangan).
3. Gesture target (misal "peace sign") dideteksi dengan logika sederhana berbasis posisi landmark, contohnya: cek apakah ujung jari telunjuk dan jari tengah berada di atas ruas tengahnya masing-masing (menandakan kedua jari itu terangkat/lurus), sementara ujung jari manis dan kelingking berada di bawah ruas tengahnya (menandakan terlipat). Logika ini mirip seperti fungsi `is_peace()` yang biasa dipakai di implementasi Python dengan MediaPipe, hanya saja di sini ditulis ulang dalam JavaScript.
4. Begitu gesture target terdeteksi, sistem menyimpan timestamp dan mengaktifkan "blur state", lalu menerapkan cooldown supaya tidak retrigger terus-menerus selama gesture masih ditahan.
5. Selama "blur state" aktif, setiap frame yang digambar ke canvas diberi filter blur dengan intensitas yang naik dulu (fade in selama kira-kira 200-300ms), bertahan sebentar di puncak, lalu turun lagi (fade out) sampai balik normal. Total durasi efek per trigger sekitar 1-2 detik, bisa disesuaikan.
6. Tombol manual (cadangan) memicu "blur state" yang sama persis dengan jalur gesture, jadi logika fade in/out-nya cukup ditulis sekali dan dipakai bersama oleh kedua jalur trigger.
7. Hasil canvas inilah (bukan video mentah dari webcam) yang dialirkan ke `MediaRecorder` lewat `canvas.captureStream()`, supaya video hasil rekaman sudah termasuk efek blur-nya, bukan perlu diproses lagi belakangan.

Contoh konsep filter blur dinamis:

```css
filter: blur(var(--blur-amount));
```

di mana `--blur-amount` diubah nilainya tiap frame mengikuti kurva fade in-out (misal pakai fungsi easing sederhana), bukan langsung loncat dari 0 ke max.

---

## 8. Acceptance Criteria

- [ ] Website berhasil minta izin & menampilkan live webcam
- [ ] Countdown muncul sebelum recording dimulai
- [ ] Hand-tracking aktif selama recording dan mendeteksi gesture target dengan akurasi yang wajar di pencahayaan normal
- [ ] Efek blur otomatis muncul saat gesture terdeteksi, dengan fade in/out yang halus, bukan tiba-tiba
- [ ] Cooldown bekerja, gesture yang ditahan lama tidak memicu efek berulang-ulang tanpa jeda
- [ ] Tombol trigger manual tetap berfungsi sebagai cadangan
- [ ] Gesture maupun tombol manual bisa dipakai berkali-kali dalam satu sesi recording
- [ ] Hasil video yang didownload sudah termasuk efek blur (bukan video polos)
- [ ] User bisa rekam ulang tanpa reload halaman
- [ ] Download video menghasilkan file yang valid dan bisa diputar normal
- [ ] Notice privasi tampil jelas di halaman, termasuk penjelasan bahwa hand-tracking diproses lokal di browser
- [ ] Tampilan dan tombol trigger manual tetap mudah dipakai saat dibuka dari HP

---

## 9. Out of Scope (versi pertama)

- Audio dari lagu apa pun ikut direkam atau disematkan ke dalam aplikasi (hak cipta); audio asli ruangan dari mikrofon boleh ikut terekam kalau user mengizinkan, tapi sistem tidak menyediakan lagu apa pun
- Deteksi otomatis lirik atau beat dari lagu tertentu
- Gesture custom yang bisa didefinisikan sendiri oleh user (versi pertama pakai gesture tetap, misal peace sign)
- Filter wajah / AR face tracking
- Sharing langsung ke media sosial dari dalam app
- Gallery publik / penyimpanan video user di server
- Trimming/edit video lanjutan di dalam app

---

## 10. Next Step

1. Bangun halaman dasar + akses webcam via `getUserMedia`
2. Render video stream ke `<canvas>` secara real-time via `requestAnimationFrame`
3. Integrasikan library hand-tracking (MediaPipe Hands JS / TensorFlow.js `hand-pose-detection`) dan tampilkan landmark tangan dulu sebagai uji coba
4. Tulis fungsi deteksi gesture target (misal peace sign) berdasarkan posisi landmark
5. Implementasi countdown sebelum recording mulai
6. Implementasi "blur state" + fade in/out, dipicu bersama oleh gesture terdeteksi maupun tombol manual cadangan
7. Tambahkan cooldown supaya gesture yang ditahan tidak retrigger berulang
8. Hubungkan `canvas.captureStream()` ke `MediaRecorder` untuk merekam hasil akhir
9. Buat 3 preset intensitas (Ringan/Sedang/Brutal)
10. Tambah tombol stop, preview hasil, rekam ulang, dan download
11. Tambah notice privasi (termasuk penjelasan hand-tracking lokal di browser)
12. Testing di mobile & beberapa browser (Chrome, Safari, Firefox), termasuk uji akurasi gesture dan frame rate
