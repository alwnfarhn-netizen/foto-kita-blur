# PROMPTS.md — Requirements-Driven Prompting

> Dokumen ini adalah lanjutan dari `SPEC.md`.
> **Requirements-Driven Prompting (RDP)** artinya setiap prompt ke AI coding assistant (Claude Code, atau lainnya) ditulis berdasarkan requirement spesifik dari spec, bukan instruksi umum. Setiap prompt punya: requirement ID yang dirujuk, konteks, kriteria sukses, dan batasan eksplisit. Tujuannya supaya output AI bisa langsung dicek kesesuaiannya dengan spec, bukan dievaluasi secara subjektif.

---

## 1. Struktur Setiap Prompt

Setiap prompt dalam dokumen ini mengikuti pola yang sama:

```
KONTEKS     : requirement mana dari SPEC.md yang sedang dikerjakan
TUGAS       : instruksi spesifik, bukan vague
BATASAN     : hal yang TIDAK boleh dilakukan AI (mencegah scope creep)
OUTPUT YANG DIHARAPKAN : kriteria sukses yang bisa dicek manual
```

Pola ini sengaja dibuat ketat, supaya kalau output AI meleset, kamu bisa langsung tahu requirement mana yang gagal dipenuhi.

---

## 2. Prompt 1 — Setup Project & Akses Webcam

```
KONTEKS
Mengacu pada SPEC.md bagian FR-1 dan FR-2: sistem harus meminta izin
akses webcam dan menampilkan live preview sebelum recording dimulai.

TUGAS
Buatkan struktur project website vanilla HTML/CSS/JS (tanpa framework
dan tanpa build tool) dengan:
- index.html berisi elemen <video> untuk preview webcam
- script.js yang meminta akses kamera lewat getUserMedia dan
  menampilkan stream-nya di elemen <video>
- Tampilkan pesan error yang jelas di halaman (bukan di console saja)
  kalau user menolak izin kamera atau browser tidak mendukung
  getUserMedia

BATASAN
- Jangan tambahkan fitur lain di luar akses webcam dan preview dulu
- Jangan pakai library eksternal apa pun di tahap ini
- Jangan asumsikan browser tertentu, harus ada fallback message

OUTPUT YANG DIHARAPKAN
Halaman terbuka, browser minta izin kamera, dan begitu diizinkan,
preview webcam langsung tampil real-time di halaman.
```

---

## 3. Prompt 2 — Render ke Canvas

```
KONTEKS
Mengacu pada SPEC.md bagian 7 (Technical Notes): video stream harus
digambar ke <canvas> lewat requestAnimationFrame, bukan ditampilkan
langsung dari elemen <video>, supaya bisa dimanipulasi per frame.

TUGAS
Modifikasi script.js supaya:
- Elemen <video> dari Prompt 1 disembunyikan (atau dijadikan source saja)
- Setiap frame dari video stream digambar ke elemen <canvas> yang
  terlihat oleh user
- Gunakan requestAnimationFrame untuk loop render, bukan setInterval

BATASAN
- Jangan terapkan efek visual apa pun dulu di tahap ini, fokus hanya
  memastikan canvas menampilkan video secara real-time dan smooth
- Pastikan ukuran canvas menyesuaikan ukuran video asli, jangan
  hardcode angka yang menyebabkan gambar gepeng/terpotong

OUTPUT YANG DIHARAPKAN
Tampilan webcam di canvas terlihat identik dengan tampilan video asli,
tidak ada lag yang terlihat kasat mata, frame rate terasa mulus.
```

---

## 4. Prompt 3 — Integrasi Hand-Tracking

```
KONTEKS
Mengacu pada SPEC.md bagian 2 (Tech Stack) dan FR-4: sistem harus
menjalankan hand-tracking real-time menggunakan library yang jalan
di browser (MediaPipe Hands JS atau TensorFlow.js hand-pose-detection).

TUGAS
Integrasikan library hand-tracking pilihanmu ke project ini.
Untuk tahap ini, cukup:
- Load model hand-tracking
- Jalankan deteksi pada tiap frame canvas
- Gambar titik-titik landmark tangan (21 titik) di atas canvas sebagai
  visualisasi, supaya kita bisa cek apakah deteksinya akurat

BATASAN
- Jangan implementasikan logika gesture spesifik dulu di tahap ini,
  fokus hanya memastikan landmark terdeteksi dengan benar
- Sebutkan di komentar kode, library mana yang dipakai dan alasannya
  (ringan/akurasi/kemudahan integrasi), supaya keputusan teknis bisa
  ditinjau ulang kalau perlu ganti library

OUTPUT YANG DIHARAPKAN
Saat tangan masuk frame kamera, titik-titik landmark muncul mengikuti
pergerakan jari secara real-time dengan delay minimal.
```

---

## 5. Prompt 4 — Logika Deteksi Gesture (Peace Sign)

```
KONTEKS
Mengacu pada SPEC.md bagian 7, poin 3: gesture peace sign dideteksi
dengan mengecek apakah ujung jari telunjuk dan jari tengah berada di
atas ruas tengahnya (terangkat/lurus), sementara jari manis dan
kelingking terlipat (ujung jari di bawah ruas tengahnya).

TUGAS
Tulis fungsi isPeaceSign(landmarks) yang menerima data landmark dari
Prompt 3 dan mengembalikan true/false berdasarkan logika di atas.
Tambahkan threshold toleransi yang wajar supaya tidak terlalu strict
(gesture manusia tidak pernah benar-benar presisi).

BATASAN
- Jangan gunakan machine learning tambahan untuk klasifikasi gesture,
  cukup logika geometris berbasis koordinat landmark
- Jangan integrasikan ke sistem blur dulu di tahap ini, fungsi ini
  harus bisa diuji terpisah dulu (misal ditampilkan sebagai teks
  "GESTURE TERDETEKSI" di pojok layar saat true)

OUTPUT YANG DIHARAPKAN
Saat user menunjukkan peace sign ke kamera, indikator teks/visual
muncul secara konsisten, dan hilang saat gesture dilepas.
```

---

## 6. Prompt 5 — Blur State dengan Fade In/Out

```
KONTEKS
Mengacu pada SPEC.md bagian FR-5 dan FR-6: begitu gesture terdeteksi,
efek blur harus muncul dengan fade in, bertahan sebentar, lalu fade
out kembali normal, dengan cooldown supaya tidak retrigger terus saat
gesture ditahan.

TUGAS
Buat sistem "blur state" dengan:
- Variabel yang melacak apakah blur sedang aktif dan kapan terakhir
  trigger terjadi
- Filter blur pada canvas yang nilainya berubah mengikuti kurva
  fade in (±250ms) → hold (±500ms) → fade out (±500ms)
- Cooldown ±1.5 detik setelah satu siklus selesai sebelum gesture yang
  sama bisa trigger ulang

BATASAN
- Jangan buat transisi blur yang tiba-tiba/patah, harus terlihat halus
- Jangan biarkan blur retrigger berkali-kali hanya karena gesture
  ditahan terus oleh user, cooldown harus benar-benar mencegah ini

OUTPUT YANG DIHARAPKAN
Saat gesture terdeteksi sekali, blur muncul halus lalu hilang halus,
dan tidak retrigger lagi sampai cooldown selesai meskipun gesture
masih ditunjukkan.
```

---

## 7. Prompt 6 — Trigger Manual sebagai Cadangan

```
KONTEKS
Mengacu pada SPEC.md bagian FR-7: tombol manual harus memicu blur
state yang sama persis dengan jalur gesture, sebagai cadangan kalau
deteksi gesture gagal.

TUGAS
Tambahkan tombol di layar dan event listener keyboard (tombol Spasi)
yang memanggil fungsi blur state yang sama dari Prompt 5.

BATASAN
- Jangan duplikasi logika fade in/out, harus memanggil fungsi yang
  sama dengan jalur gesture supaya perilakunya konsisten
- Pastikan tombol di layar cukup besar untuk diakses dari HP

OUTPUT YANG DIHARAPKAN
Menekan tombol atau Spasi menghasilkan efek blur yang identik dengan
yang dipicu oleh gesture.
```

---

## 8. Prompt 7 — Recording dengan MediaRecorder

```
KONTEKS
Mengacu pada SPEC.md bagian FR-9 dan FR-3: hasil canvas (yang sudah
termasuk efek blur) harus direkam jadi file video, dengan countdown
sebelum recording dimulai.

TUGAS
Implementasikan:
- Tombol "Mulai Rekam" dengan countdown 3 detik di layar sebelum
  recording aktif
- canvas.captureStream() dialirkan ke MediaRecorder
- Tombol "Stop" untuk mengakhiri recording
- Hasil rekaman ditampilkan sebagai preview video yang bisa diputar
  ulang sebelum didownload

BATASAN
- Jangan rekam dari elemen <video> asli, harus dari canvas supaya
  efek blur ikut terekam
- Jangan otomatis download, user harus klik tombol download secara
  eksplisit setelah preview

OUTPUT YANG DIHARAPKAN
File .webm hasil download bisa diputar di video player biasa dan
menampilkan efek blur yang sama seperti yang terlihat saat recording.
```

---

## 9. Prompt 8 — Preset Intensitas Blur

```
KONTEKS
Mengacu pada SPEC.md bagian FR-8 dan bagian 6: tersedia 3 preset
(Ringan, Sedang, Brutal) yang dipilih sebelum recording dimulai.

TUGAS
Tambahkan UI pemilihan preset sebelum tombol "Mulai Rekam", dan
hubungkan nilai preset ke parameter blur (radius blur maksimal) yang
dipakai di Prompt 5.

BATASAN
- Preset harus dipilih sebelum recording mulai, tidak bisa diubah
  di tengah sesi recording yang sedang berjalan
- Beri nilai default yang masuk akal kalau user tidak memilih apa pun

OUTPUT YANG DIHARAPKAN
Memilih preset berbeda menghasilkan intensitas blur yang terlihat
jelas perbedaannya saat gesture/trigger diaktifkan.
```

---

## 10. Prompt 9 — Notice Privasi & Polish UI

```
KONTEKS
Mengacu pada SPEC.md bagian FR-10/FR-12 dan NFR terkait privasi:
sistem harus menjelaskan bahwa video dan hand-tracking diproses lokal
di browser.

TUGAS
Tambahkan notice privasi yang jelas dan mudah dibaca di halaman
(sebelum atau sesudah akses kamera diberikan), dan rapikan tampilan
keseluruhan (spacing, kontras warna, responsif di mobile).

BATASAN
- Jangan menyembunyikan notice ini di tempat yang sulit ditemukan
- Jangan ubah logika fungsional apa pun di tahap ini, fokus hanya ke
  UI dan teks privasi

OUTPUT YANG DIHARAPKAN
User yang baru membuka halaman langsung paham bahwa videonya tidak
dikirim ke server mana pun, dan tampilan terlihat rapi di HP maupun
desktop.
```

---

## 11. Cara Pakai Dokumen Ini

1. Jalankan prompt secara berurutan (Prompt 1 sampai 9), satu per satu, jangan digabung sekaligus
2. Setelah tiap prompt selesai dijalankan AI, cek "OUTPUT YANG DIHARAPKAN" secara manual sebelum lanjut ke prompt berikutnya
3. Kalau output tidak sesuai, jangan lanjut ke prompt berikutnya, perbaiki dulu dengan merujuk balik ke requirement ID yang relevan di SPEC.md
4. Kalau ada requirement baru yang muncul di tengah jalan, update SPEC.md dulu, baru tulis prompt baru dengan pola yang sama
