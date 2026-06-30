import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('webcam-video');
    const canvasElement = document.getElementById('output-canvas');
    const ctx = canvasElement.getContext('2d');
    const errorMessageElement = document.getElementById('error-message');
    const loadingMessageElement = document.getElementById('loading-message');
    const manualTriggerBtn = document.getElementById('manual-trigger-btn');
    
    // UI Recording
    const previewVideoElement = document.getElementById('preview-video');
    const startRecordBtn = document.getElementById('start-record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const downloadBtn = document.getElementById('download-btn');
    const rerecordBtn = document.getElementById('rerecord-btn');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const presetSelect = document.getElementById('blur-preset');
    const mirrorToggle = document.getElementById('mirror-toggle');

    // Alasan memilih library: Menggunakan @mediapipe/tasks-vision (versi terbaru MediaPipe Web)
    // karena memproses langsung di GPU secara lokal (sangat cepat & privat) dan akurasinya tinggi.
    let handLandmarker = undefined;
    let runningMode = "VIDEO";
    let lastVideoTime = -1;
    let handResults = undefined;

    // --- State untuk Efek Blur ---
    let currentBlur = 0;
    let lastRenderTime = performance.now();
    let isManualTriggerActive = false; // Status tombol manual/spasi
    
    // Konstanta/Variabel Blur
    const FADE_DURATION_MS = 300; // Waktu yang dibutuhkan untuk full blur atau kembali tajam
    let MAX_BLUR_RADIUS = 15; // Intensitas blur maksimal (bisa diubah via preset)
    let FADE_RATE = MAX_BLUR_RADIUS / FADE_DURATION_MS; // Kecepatan perubahan blur per ms

    // Mirror Kamera
    let isMirrored = true;
    mirrorToggle.addEventListener('change', (e) => {
        isMirrored = e.target.checked;
    });

    // Listener untuk Preset Blur
    presetSelect.addEventListener('change', (e) => {
        MAX_BLUR_RADIUS = parseInt(e.target.value, 10);
        FADE_RATE = MAX_BLUR_RADIUS / FADE_DURATION_MS;
    });

    async function initializeHandTracking() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );

            // Coba GPU dulu, jika gagal fallback ke CPU (penting untuk HP!)
            const delegates = ["GPU", "CPU"];
            for (const delegate of delegates) {
                try {
                    console.log(`Mencoba delegate: ${delegate}...`);
                    handLandmarker = await HandLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                            delegate: delegate
                        },
                        runningMode: runningMode,
                        numHands: 1 // 1 tangan saja agar lebih ringan di HP
                    });
                    console.log(`Berhasil menggunakan delegate: ${delegate}`);
                    break; // Berhasil, keluar dari loop
                } catch (delegateError) {
                    console.warn(`Delegate ${delegate} gagal:`, delegateError);
                    if (delegate === "CPU") throw delegateError; // Jika CPU juga gagal, lempar error
                }
            }
            loadingMessageElement.classList.add('hidden');
        } catch (error) {
            console.error("Gagal memuat model hand tracking:", error);
            showError("Gagal memuat model AI pendeteksi tangan. Coba refresh halaman.");
        }
    }
    initializeHandTracking();

    function showError(message) {
        errorMessageElement.textContent = message;
        errorMessageElement.classList.remove('hidden');
        videoElement.parentElement.classList.add('hidden'); // Hide video container if error
    }

    // Fungsi untuk mendeteksi Peace Sign berdasarkan landmark tangan
    function isPeaceSign(landmarks) {
        // Koordinat Y: 0 adalah atas gambar, 1 adalah bawah gambar.
        // Jadi jari terangkat artinya nilai Y lebih kecil.
        
        // Jari Telunjuk (Index Finger)
        // 8: Ujung jari, 6: Ruas tengah (PIP)
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        
        // Jari Tengah (Middle Finger)
        // 12: Ujung jari, 10: Ruas tengah (PIP)
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        
        // Jari Manis (Ring Finger)
        // 16: Ujung jari, 14: Ruas tengah (PIP)
        // Terlipat = ujung jari berada di bawah ruas tengah
        const isRingDown = landmarks[16].y > landmarks[14].y;
        
        // Jari Kelingking (Pinky Finger)
        // 20: Ujung jari, 18: Ruas tengah (PIP)
        const isPinkyDown = landmarks[20].y > landmarks[18].y;

        // Tambahan ketepatan: pastikan jari telunjuk dan tengah benar-benar lurus ke atas
        // dibanding ruas paling bawahnya (MCP) untuk menghindari false-positive saat tangan miring
        const isIndexStraight = landmarks[8].y < (landmarks[5].y - 0.03);
        const isMiddleStraight = landmarks[12].y < (landmarks[9].y - 0.03);

        return isIndexUp && isMiddleUp && isRingDown && isPinkyDown && isIndexStraight && isMiddleStraight;
    }

    // --- Setup Event Listener untuk Trigger Manual ---
    
    // Support untuk Mouse
    manualTriggerBtn.addEventListener('mousedown', () => isManualTriggerActive = true);
    manualTriggerBtn.addEventListener('mouseup', () => isManualTriggerActive = false);
    manualTriggerBtn.addEventListener('mouseleave', () => isManualTriggerActive = false);
    
    // Support untuk Layar Sentuh (Mobile)
    manualTriggerBtn.addEventListener('touchstart', (e) => { 
        e.preventDefault(); // Mencegah emulasi klik bawaan browser
        isManualTriggerActive = true; 
    });
    manualTriggerBtn.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        isManualTriggerActive = false; 
    });
    manualTriggerBtn.addEventListener('touchcancel', (e) => { 
        e.preventDefault(); 
        isManualTriggerActive = false; 
    });

    // Support untuk Keyboard (Tombol Spasi)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault(); // Mencegah scroll halaman ke bawah
            isManualTriggerActive = true;
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            isManualTriggerActive = false;
        }
    });

    // --- Logic Perekaman Video (MediaRecorder) ---
    let mediaRecorder;
    let recordedChunks = [];

    function setupRecordingUI() {
        startRecordBtn.addEventListener('click', startCountdown);
        stopRecordBtn.addEventListener('click', stopRecording);
        downloadBtn.addEventListener('click', downloadVideo);
        rerecordBtn.addEventListener('click', resetToLive);
    }

    function startCountdown() {
        startRecordBtn.classList.add('hidden');
        countdownOverlay.classList.remove('hidden');
        presetSelect.disabled = true; // Kunci preset saat mulai rekam
        
        let count = 3;
        countdownOverlay.textContent = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownOverlay.textContent = count;
            } else {
                clearInterval(interval);
                countdownOverlay.classList.add('hidden');
                startRecording();
            }
        }, 1000);
    }

    function startRecording() {
        recordedChunks = [];
        
        // Ambil frame rate 30 FPS dari canvas
        const canvasStream = canvasElement.captureStream(30);
        
        try {
            // Gunakan format webm (native didukung di Chrome/Firefox)
            mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
        } catch (e) {
            console.warn("Format spesifik tidak didukung, menggunakan format bawaan", e);
            mediaRecorder = new MediaRecorder(canvasStream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const videoURL = URL.createObjectURL(blob);
            previewVideoElement.src = videoURL;
            
            // Pindah UI dari Live Canvas ke Preview Video
            canvasElement.classList.add('hidden');
            previewVideoElement.classList.remove('hidden');
            document.querySelector('.controls-container').classList.add('hidden'); // Sembunyikan tombol spasi
            
            stopRecordBtn.classList.add('hidden');
            downloadBtn.classList.remove('hidden');
            rerecordBtn.classList.remove('hidden');
        };

        mediaRecorder.start();
        stopRecordBtn.classList.remove('hidden');
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    function downloadVideo() {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = 'foto-kita-blur.webm';
        a.click();
        window.URL.revokeObjectURL(url);
    }

    function resetToLive() {
        // Hapus memori video sebelumnya
        URL.revokeObjectURL(previewVideoElement.src);
        previewVideoElement.src = "";
        
        // Kembali ke mode live
        previewVideoElement.classList.add('hidden');
        canvasElement.classList.remove('hidden');
        document.querySelector('.controls-container').classList.remove('hidden');
        
        downloadBtn.classList.add('hidden');
        rerecordBtn.classList.add('hidden');
        startRecordBtn.classList.remove('hidden');
        presetSelect.disabled = false; // Buka kunci preset
    }

    // Panggil setup
    setupRecordingUI();

    async function startWebcam() {
        // Check if the browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Browser Anda tidak mendukung akses kamera (getUserMedia API). Silakan gunakan browser modern seperti Chrome atau Firefox versi terbaru.');
            return;
        }

        try {
            // Deteksi mobile untuk menurunkan resolusi (performa lebih baik)
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    facingMode: 'user',
                    width: { ideal: isMobile ? 640 : 1280 },
                    height: { ideal: isMobile ? 480 : 720 }
                }, 
                audio: false 
            });
            
            // Assign stream to video element
            videoElement.srcObject = stream;

            // Wait for video metadata to load to set proper canvas dimensions
            videoElement.onloadedmetadata = () => {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                videoElement.play();
                
                // Mulai loop render ke canvas
                requestAnimationFrame(renderToCanvas);
            };

        } catch (error) {
            console.error('Error accessing webcam:', error);
            
            // Handle specific errors for better UX
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                showError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda untuk menggunakan aplikasi ini.');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                showError('Kamera tidak ditemukan di perangkat Anda. Pastikan kamera terpasang dan berfungsi.');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                showError('Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut dan coba lagi.');
            } else {
                showError(`Terjadi kesalahan saat mengakses kamera: ${error.message || error.name}`);
            }
        }
    }

    function renderToCanvas() {
        // Pastikan video sudah ready sebelum digambar
        if (videoElement.readyState >= 2) {
            const now = performance.now();
            const deltaTime = now - lastRenderTime;
            lastRenderTime = now;

            let peaceSignDetected = false;

            // 1. Jalankan deteksi tangan terlebih dahulu
            if (handLandmarker) {
                // Deteksi hanya dilakukan saat timestamp video maju (menghemat resource)
                if (lastVideoTime !== videoElement.currentTime) {
                    lastVideoTime = videoElement.currentTime;
                    handResults = handLandmarker.detectForVideo(videoElement, now);
                }

                // Cek apakah ada tangan yang berpose Peace
                if (handResults && handResults.landmarks) {
                    for (const landmarks of handResults.landmarks) {
                        if (isPeaceSign(landmarks)) {
                            peaceSignDetected = true;
                        }
                    }
                }
            }

            // Gabungkan logika dari AI (Gesture) dan Tombol Manual
            const shouldBlur = peaceSignDetected || isManualTriggerActive;

            // 2. Hitung intensitas blur (Transisi halus berdasarkan deltaTime)
            if (shouldBlur) {
                currentBlur = Math.min(MAX_BLUR_RADIUS, currentBlur + (FADE_RATE * deltaTime));
            } else {
                currentBlur = Math.max(0, currentBlur - (FADE_RATE * deltaTime));
            }

            // 3. Simpan state context dasar
            ctx.save();

            // Terapkan efek cermin (Mirroring) jika opsi dicentang
            if (isMirrored) {
                ctx.translate(canvasElement.width, 0);
                ctx.scale(-1, 1);
            }

            // Terapkan filter blur pada context
            if (currentBlur > 0) {
                ctx.filter = `blur(${currentBlur}px)`;
            } else {
                ctx.filter = 'none';
            }

            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            // 4. Wajib reset filter agar elemen lain tidak ikut ter-blur
            ctx.filter = 'none';

            // Kembalikan (restore) context seperti semula sebelum loop frame berikutnya
            ctx.restore();

            // 5. Gambar Watermark (setelah restore agar tidak ter-mirror)
            const watermarkText = "📷 IG & 🎵 TikTok: @alwnfarhn";
            ctx.font = "bold 20px 'Plus Jakarta Sans', Arial, sans-serif";
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.textAlign = "right";
            
            // Tambahkan shadow agar teks terbaca di atas background video apapun
            ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.fillText(watermarkText, canvasElement.width - 20, canvasElement.height - 20);
            
            // Reset shadow untuk frame berikutnya
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        // Panggil kembali frame berikutnya secara terus menerus
        requestAnimationFrame(renderToCanvas);
    }

    // --- Logic Popup ---
    const popup1 = document.getElementById('popup-1');
    const popup2 = document.getElementById('popup-2');
    const btnNextPopup = document.getElementById('btn-next-popup');
    const btnClosePopup = document.getElementById('btn-close-popup');

    function showPopup(popup) {
        if (!popup) return;
        popup.classList.remove('hidden');
        // Sedikit delay agar transisi CSS bekerja
        setTimeout(() => popup.classList.add('show'), 10);
    }

    function hidePopup(popup, onHidden) {
        if (!popup) return;
        popup.classList.remove('show');
        setTimeout(() => {
            popup.classList.add('hidden');
            if (onHidden) onHidden();
        }, 400); // Sesuaikan dengan durasi transisi CSS
    }

    // Tampilkan Popup 1 saat pertama kali dimuat
    // Untuk saat ini (masa pengujian), dimunculkan setiap kali refresh
    setTimeout(() => {
        showPopup(popup1);
    }, 500);

    if (btnNextPopup) {
        btnNextPopup.addEventListener('click', () => {
            hidePopup(popup1, () => {
                showPopup(popup2);
            });
        });
    }

    if (btnClosePopup) {
        btnClosePopup.addEventListener('click', () => {
            hidePopup(popup2);
            // localStorage.setItem('hasSeenPopups', 'true'); // Dinonaktifkan sementara untuk testing
        });
    }

    // --- Logic Full Screen (Hybrid: API + CSS fallback untuk HP) ---
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const videoContainer = document.querySelector('.video-container');
    let isCustomFullscreen = false;

    function enterFullscreen() {
        // Coba Fullscreen API dulu (berfungsi di desktop)
        const fsElement = videoContainer;
        const fsRequest = fsElement.requestFullscreen || fsElement.webkitRequestFullscreen || fsElement.msRequestFullscreen;
        
        if (fsRequest) {
            fsRequest.call(fsElement).catch(() => {
                // Jika API gagal (HP), gunakan CSS fullscreen
                activateCSSFullscreen();
            });
        } else {
            // Tidak ada API sama sekali, gunakan CSS fullscreen
            activateCSSFullscreen();
        }
    }

    function activateCSSFullscreen() {
        videoContainer.classList.add('css-fullscreen');
        fullscreenBtn.textContent = '❌ Close Full Screen';
        isCustomFullscreen = true;
    }

    function exitCSSFullscreen() {
        videoContainer.classList.remove('css-fullscreen');
        fullscreenBtn.textContent = '🔲 Full Screen';
        isCustomFullscreen = false;
    }

    function exitFullscreen() {
        if (document.fullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
        } else if (isCustomFullscreen) {
            exitCSSFullscreen();
        }
    }

    if (fullscreenBtn && videoContainer) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement && !isCustomFullscreen) {
                enterFullscreen();
            } else {
                exitFullscreen();
            }
        });

        // Update tombol saat status fullscreen API berubah (desktop)
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                fullscreenBtn.textContent = '❌ Close Full Screen';
            } else {
                fullscreenBtn.textContent = '🔲 Full Screen';
            }
        });
    }

    startWebcam();
});
