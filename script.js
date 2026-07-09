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
    
    // UI Recording & Output
    const recordingIndicator = document.getElementById('recording-indicator');
    const previewBtsVideo = document.getElementById('preview-bts-video');
    const btnDownloadVideo = document.getElementById('btn-download-video');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const photoboothCountdown = document.getElementById('photobooth-countdown');
    const cameraFlash = document.getElementById('camera-flash');
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
    
    // --- State untuk Photobooth ---
    let isPhotoboothActive = false;
    let photoboothState = 'IDLE'; // IDLE, BLUR_WAIT, COUNTING, SNAPPING
    let photoboothCount = 3;
    let photoboothLastTick = 0;
    let photoboothTotalPhotos = 4; // Default
    let photoboothCurrentPhotoIndex = 0;
    let photoboothImages = [];
    let photoboothBlurStartTime = 0;
    let photoboothProcessing = false; // Kunci agar tidak mulai sesi baru saat masih proses
    
    // UI Layout Sidebar
    const layoutBtns = document.querySelectorAll('.layout-btn');
    const liveStripPreview = document.getElementById('live-strip-preview');

    layoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            layoutBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            photoboothTotalPhotos = parseInt(btn.getAttribute('data-layout'), 10) || 4;
        });
    });
    
    // UI Frame Sidebar
    const frameBtns = document.querySelectorAll('.frame-btn');
    let currentFrameBg = 'white';
    let currentFrameText = '#222';

    frameBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            frameBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFrameBg = btn.getAttribute('data-frame') || 'white';
            currentFrameText = btn.getAttribute('data-text') || '#222';
        });
    });
    
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

            // Deteksi mobile: iOS Safari sering hang jika dipaksa pakai GPU delegate MediaPipe
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const chosenDelegate = isMobile ? "CPU" : "GPU";
            
            console.log(`Perangkat Mobile: ${isMobile} | Menggunakan Delegate: ${chosenDelegate}`);

            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: chosenDelegate
                },
                runningMode: runningMode,
                numHands: 1 // 1 tangan saja agar lebih ringan di HP
            });

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

    function isPeaceSign(landmarks) {
        // Hitung berapa jari yang terangkat (berdasarkan perbandingan ujung jari vs ruas tengah)
        let fingersUp = 0;
        
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        const isRingUp = landmarks[16].y < landmarks[14].y;
        const isPinkyUp = landmarks[20].y < landmarks[18].y;

        if (isIndexUp) fingersUp++;
        if (isMiddleUp) fingersUp++;
        if (isRingUp) fingersUp++;
        if (isPinkyUp) fingersUp++;

        // Syarat Peace Sign (V): 
        // 1. Tepat HANYA 2 jari yang naik
        // 2. Kedua jari itu adalah Telunjuk dan Tengah
        return (fingersUp === 2) && isIndexUp && isMiddleUp;
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

    // --- Logic Perekaman Video BTS (MediaRecorder) ---
    let mediaRecorder;
    let recordedChunks = [];
    let currentBtsVideoUrl = null;

    function startRecording() {
        recordedChunks = [];
        const canvasStream = canvasElement.captureStream(30);
        
        try {
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
            if (currentBtsVideoUrl) URL.revokeObjectURL(currentBtsVideoUrl);
            currentBtsVideoUrl = URL.createObjectURL(blob);
            if(previewBtsVideo) previewBtsVideo.src = currentBtsVideoUrl;
        };

        mediaRecorder.start();
        if (recordingIndicator) recordingIndicator.classList.remove('hidden');
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (recordingIndicator) recordingIndicator.classList.add('hidden');
    }

    if (btnDownloadVideo) {
        btnDownloadVideo.addEventListener('click', () => {
            if (!currentBtsVideoUrl) return;
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style = 'display: none';
            a.href = currentBtsVideoUrl;
            a.download = `FotoKitaBlur_BTS_${new Date().getTime()}.webm`;
            a.click();
            document.body.removeChild(a);
        });
    }

    // === LOGIKA PHOTOBOOTH CANVAS STITCHING ===

    const mainContainer = document.querySelector('.container'); // The main app container
    const resultPage = document.getElementById('result-page');
    const resultStep1 = document.getElementById('result-step-1');
    const resultStep2 = document.getElementById('result-step-2');
    
    const previewImage = document.getElementById('preview-image');
    const btnDownloadPhoto = document.getElementById('btn-download-photo');
    const btnNextVideo = document.getElementById('btn-next-video');
    const btnClosePreview = document.getElementById('btn-close-preview');
    let currentPhotoDataUrl = null;

    const filterBtns = document.querySelectorAll('.filter-btn');
    let currentResultFilter = 'none';

    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentResultFilter = btn.getAttribute('data-filter') || 'none';
                previewImage.style.filter = currentResultFilter;
            });
        });
    }

    function showPreviewModal(dataUrl) {
        currentPhotoDataUrl = dataUrl;
        previewImage.src = dataUrl;
        
        // Sembunyikan halaman utama, tampilkan halaman hasil
        if(mainContainer) mainContainer.classList.add('hidden');
        if(resultPage) resultPage.classList.remove('hidden');
        
        // Reset filter
        currentResultFilter = 'none';
        previewImage.style.filter = 'none';
        if (filterBtns.length > 0) {
            filterBtns.forEach(b => b.classList.remove('active'));
            filterBtns[0].classList.add('active');
        }
        
        // Mulai dari Step 1 (Foto)
        if(resultStep1) resultStep1.classList.remove('hidden');
        if(resultStep2) resultStep2.classList.add('hidden');
        
        // Scroll ke atas halaman hasil
        window.scrollTo(0, 0);
    }

    if(btnDownloadPhoto) {
        btnDownloadPhoto.addEventListener('click', () => {
            if (!currentPhotoDataUrl) return;
            
            if (currentResultFilter === 'none') {
                const a = document.createElement('a');
                a.href = currentPhotoDataUrl;
                a.download = `FotoKitaBlur_Strip_${new Date().getTime()}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                goToVideoStep();
            } else {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.filter = currentResultFilter;
                    ctx.drawImage(img, 0, 0);
                    
                    const a = document.createElement('a');
                    a.href = canvas.toDataURL('image/jpeg', 0.9);
                    a.download = `FotoKitaBlur_Strip_${new Date().getTime()}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    goToVideoStep();
                };
                img.src = currentPhotoDataUrl;
            }
        });
    }

    if(btnNextVideo) {
        btnNextVideo.addEventListener('click', goToVideoStep);
    }

    function goToVideoStep() {
        if(resultStep1) resultStep1.classList.add('hidden');
        if(resultStep2) resultStep2.classList.remove('hidden');
    }

    if(btnClosePreview) {
        btnClosePreview.addEventListener('click', () => {
            // Kembali ke main page
            if(resultPage) resultPage.classList.add('hidden');
            if(mainContainer) mainContainer.classList.remove('hidden');
            
            if (previewBtsVideo) previewBtsVideo.pause();
            
            // Bersihkan hasil sebelumnya
            previewImage.src = "";
            if (previewBtsVideo) previewBtsVideo.src = "";
            currentPhotoDataUrl = null;
            
            if (liveStripPreview) liveStripPreview.classList.add('hidden');
            
            // Buka kunci agar bisa mulai sesi baru
            photoboothProcessing = false;
        });
    }

    function processPhotoboothGrid() {
        if (photoboothImages.length === 0) return;

        const imgWidth = 600;
        const imgHeight = 750; // 4:5 ratio
        const margin = 40; 
        const spacing = 20; 
        
        const rows = photoboothImages.length;
        const cols = 1;

        const canvas = document.createElement('canvas');
        canvas.width = (imgWidth * cols) + (margin * 2);
        canvas.height = (imgHeight * rows) + (margin * 2) + (spacing * (rows - 1)) + 120;
        
        const context = canvas.getContext('2d');
        
        // Base background (Apply Frame Theme)
        if (currentFrameBg === 'retro') {
            const grad = context.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#f3ec78');
            grad.addColorStop(1, '#af4261');
            context.fillStyle = grad;
        } else {
            context.fillStyle = currentFrameBg;
        }
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        let loadedImages = 0;
        const images = [];

        photoboothImages.forEach((src, idx) => {
            const img = new Image();
            img.onload = () => {
                images[idx] = img;
                loadedImages++;
                if (loadedImages === photoboothImages.length) {
                    drawFinalGrid(context, canvas, images, imgWidth, imgHeight, margin, spacing);
                }
            };
            img.src = src;
        });
    }

    function drawFinalGrid(ctx, canvas, images, imgWidth, imgHeight, margin, spacing) {
        images.forEach((img, idx) => {
            const y = margin + (idx * (imgHeight + spacing));
            ctx.drawImage(img, margin, y, imgWidth, imgHeight);
            
            // stroke border
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 2;
            ctx.strokeRect(margin, y, imgWidth, imgHeight);
        });

        // Branding text at the bottom
        ctx.font = "bold 45px 'Plus Jakarta Sans', Arial, sans-serif";
        ctx.fillStyle = currentFrameText;
        ctx.textAlign = "center";
        ctx.fillText("FOTO KITA BLUR", canvas.width / 2, canvas.height - 70);

        ctx.globalAlpha = 0.8;
        ctx.font = "24px 'Plus Jakarta Sans', Arial, sans-serif";
        ctx.fillStyle = currentFrameText;
        ctx.fillText("📷 IG & 🎵 TikTok: @alwnfarhn", canvas.width / 2, canvas.height - 30);
        ctx.globalAlpha = 1.0;

        const finalDataURL = canvas.toDataURL('image/jpeg', 0.9);
        showPreviewModal(finalDataURL);
    }

    function applyAestheticEffects(ctx, width, height) {
        // 1. Vignette (Bayangan gelap melingkar di tepi)
        const gradient = ctx.createRadialGradient(
            width / 2, height / 2, width * 0.4,
            width / 2, height / 2, width * 0.9
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // 2. Film Grain Tipis (Noise statis)
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 35;
            data[i] += noise;
            data[i+1] += noise;
            data[i+2] += noise;
        }
        ctx.putImageData(imageData, 0, 0);
        
        // 3. Warna hangat (Retro feel)
        ctx.fillStyle = 'rgba(255, 140, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);
    }

    function takeSnapshotForGrid() {
        // Efek Flash
        cameraFlash.classList.remove('hidden');
        cameraFlash.classList.add('flash-animation');
        
        setTimeout(() => {
            cameraFlash.classList.remove('flash-animation');
            cameraFlash.classList.add('hidden');
        }, 800);

        // Ambil frame asli dari videoElement agar tidak kena efek blur
        const srcW = videoElement.videoWidth;
        const srcH = videoElement.videoHeight;
        let cropW = srcW;
        let cropH = srcH;
        let cropX = 0;
        let cropY = 0;

        const targetRatio = 4/5;
        const currentRatio = srcW / srcH;

        if (currentRatio > targetRatio) {
            // Lebar terlalu besar, crop kiri kanan
            cropW = srcH * targetRatio;
            cropX = (srcW - cropW) / 2;
        } else {
            // Tinggi terlalu besar, crop atas bawah
            cropH = srcW / targetRatio;
            cropY = (srcH - cropH) / 2;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        const tctx = tempCanvas.getContext('2d');
        
        // Hasil foto dipastikan selalu jernih (tanpa blur) sesuai permintaan
        tctx.filter = 'none';

        // Terapkan mirror (cermin) jika mode mirror aktif
        if (isMirrored) {
            tctx.translate(cropW, 0);
            tctx.scale(-1, 1);
        }

        // Gambar dari videoElement asli
        tctx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        tctx.filter = 'none'; // reset filter
        
        // Terapkan efek estetis (Vignette & Film Grain) pada canvas snapshot
        applyAestheticEffects(tctx, cropW, cropH);

        const dataURL = tempCanvas.toDataURL('image/jpeg', 1.0); // Kualitas maksimal 1.0
        photoboothImages.push(dataURL);
        
        // Tampilkan di Live Strip Preview
        const imgEl = document.createElement('img');
        imgEl.src = dataURL;
        liveStripPreview.appendChild(imgEl);
        
        photoboothCurrentPhotoIndex++;
        
        // Pindah ke state delay agar ada jeda antar foto
        photoboothState = 'POST_SNAP_WAIT';
        photoboothLastTick = performance.now();
    }

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
            const userTriggering = peaceSignDetected || isManualTriggerActive;

            // --- LOGIKA PHOTOBOOTH COUNTDOWN ---
            if (userTriggering && photoboothState === 'IDLE' && !photoboothProcessing) {
                isPhotoboothActive = true;
                photoboothState = 'BLUR_WAIT';
                photoboothBlurStartTime = now;
                photoboothCurrentPhotoIndex = 0;
                photoboothImages = [];
                
                // Mulai perekaman video BTS
                startRecording();
                
                // Clear dan tampilkan live preview
                liveStripPreview.innerHTML = '';
                liveStripPreview.classList.remove('hidden');
            }

            if (isPhotoboothActive) {
                if (!userTriggering) {
                     // Abort jika jari diturunkan sebelum selesai
                     isPhotoboothActive = false;
                     photoboothState = 'IDLE';
                     photoboothCountdown.classList.add('hidden');
                     liveStripPreview.classList.add('hidden');
                     liveStripPreview.innerHTML = ''; // Bersihkan thumbnail foto partial
                     photoboothImages = [];           // Reset array foto agar tidak bocor ke sesi berikutnya
                     photoboothCurrentPhotoIndex = 0;
                     stopRecording(); // Berhenti rekam
                } else {
                    if (photoboothState === 'BLUR_WAIT') {
                        if (now - photoboothBlurStartTime >= 1000) {
                            photoboothState = 'COUNTING';
                            photoboothCount = 3;
                            photoboothLastTick = now;
                            photoboothCountdown.textContent = photoboothCount;
                            photoboothCountdown.classList.remove('hidden');
                        }
                    } else if (photoboothState === 'COUNTING') {
                        if (now - photoboothLastTick >= 1000) {
                            photoboothCount--;
                            photoboothLastTick = now;
                            
                            if (photoboothCount > 0) {
                                photoboothCountdown.textContent = photoboothCount;
                                photoboothCountdown.style.animation = 'none';
                                photoboothCountdown.offsetHeight; 
                                photoboothCountdown.style.animation = 'pulseScale 1s ease-in-out infinite';
                            } else {
                                photoboothCountdown.classList.add('hidden');
                                takeSnapshotForGrid();
                            }
                        }
                    } else if (photoboothState === 'POST_SNAP_WAIT') {
                        // Jeda 1 detik (1000ms) setelah jepretan sebelum mulai menghitung foto berikutnya
                        if (now - photoboothLastTick >= 1000) {
                            if (photoboothCurrentPhotoIndex < photoboothTotalPhotos) {
                                // Masih ada foto yang harus diambil, mulai ngitung lagi
                                photoboothState = 'COUNTING';
                                photoboothCount = 3;
                                photoboothLastTick = now;
                                photoboothCountdown.textContent = photoboothCount;
                                photoboothCountdown.classList.remove('hidden');
                            } else {
                                // Semua foto selesai
                                isPhotoboothActive = false;
                                photoboothState = 'IDLE';
                                photoboothProcessing = true; // Kunci agar tidak mulai sesi baru
                                stopRecording(); // Berhenti rekam
                                processPhotoboothGrid();
                            }
                        }
                    }
                }
            }

            // Blur hanya aktif saat sedang countdown (3,2,1) jika dalam sesi photobooth
            const shouldBlur = isPhotoboothActive ? (photoboothState === 'COUNTING') : userTriggering;

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
