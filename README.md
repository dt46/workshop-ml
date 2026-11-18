# Workshop Machine Learning — Chat Assistant & Face Recognition

Aplikasi web interaktif untuk workshop pengenalan Machine Learning. Terdiri dari dua fitur utama:

- **Chat AI** — Chatbot streaming berbasis Claude AI (via 9router proxy)
- **Face Recognition** — Pengenalan wajah real-time menggunakan DeepFace + Facenet

---

## Prasyarat

| Software | Versi   | Download                     |
| -------- | ------- | ---------------------------- |
| Python   | 3.10+   | https://python.org/downloads |
| Node.js  | 18+     | https://nodejs.org           |
| Git      | Terbaru | https://git-scm.com          |

> **Penting:** Saat install Python, centang **"Add Python to PATH"**.

---

## Quick Start (Windows)

### Cara 1 — Pakai file .bat (Paling Mudah)

1. **Clone repo**

   ```bash
   git clone https://github.com/dt46/workshop-ml.git
   cd workshop-ml
   ```

2. **Double-click `start-backend.bat`** — otomatis install dependencies + jalankan backend

3. **Double-click `start-frontend.bat`** — otomatis install dependencies + jalankan frontend

4. **Buka browser** → http://localhost:3000

### Cara 2 — Manual via Terminal

#### Terminal 1 — Backend

```bash
cd backend

# Salin konfigurasi
copy .env.example .env

# Install dependencies (pertama kali ±5 menit)
pip install -r requirements.txt

# Jalankan server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

> **Catatan:** Jangan pakai `--reload` jika mengalami masalah hang. TensorFlow + uvicorn reload bisa konflik di Windows.

#### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

| Service     | URL                   |
| ----------- | --------------------- |
| Backend API | http://localhost:8000 |
| Frontend UI | http://localhost:3000 |

---

## Konfigurasi

### File `backend/.env`

```env
AI_BASE_URL=http://localhost:20128/v1   # 9router AI proxy
AI_KEY=9router                          # API key untuk 9router
AI_MODEL=cc/claude-haiku-4-5            # Model AI yang digunakan
```

### Mengubah Model AI

Edit `AI_MODEL` di `.env`. Contoh model yang tersedia via 9router:

- `cc/claude-haiku-4-5` — Cepat, ringan (default)
- `cc/claude-sonnet-4-5` — Lebih pintar, sedikit lebih lambat

---

## Panduan Penggunaan

### Chat AI

1. Klik tab **Chat AI** di navbar
2. Ketik pertanyaan (contoh: "Apa itu Machine Learning?")
3. Tekan **Enter** atau klik tombol kirim
4. Respons muncul real-time secara streaming
5. Klik **Hapus** untuk mulai percakapan baru

**Contoh pertanyaan:**

- "Jelaskan perbedaan supervised dan unsupervised learning"
- "Apa itu neural network?"
- "Bagaimana cara kerja face recognition?"

### Face Recognition

#### Daftarkan Wajah Baru

> **PENTING:** Saat mendaftar, **lepas kacamata dan masker**! Pastikan pencahayaan cukup.

1. Klik tab **Face Recognition**
2. Pilih mode **➕ Daftarkan Wajah**
3. Ketik nama di kolom input
4. Klik **Ambil 3 Foto & Daftarkan**
5. Sistem otomatis mengambil 3 foto dengan jeda — ikuti petunjuk angle:
   - Foto 1: **Hadap lurus ke kamera**
   - Foto 2: **Putar sedikit ke kiri**
   - Foto 3: **Putar sedikit ke kanan**
6. Nama muncul di panel **Wajah Terdaftar** jika berhasil

**Kenapa 3 foto?** Supaya sistem mengenali wajah dari berbagai sudut, meningkatkan akurasi identifikasi.

**Kenapa tidak boleh pakai kacamata/masker saat daftar?** Foto referensi harus bersih agar embedding wajah akurat. Tapi saat identifikasi, sistem tetap bisa mengenali walau pakai kacamata/masker.

#### Identifikasi Wajah (Live)

1. Pilih mode **🔍 Identifikasi Wajah**
2. Sistem otomatis men-scan wajah setiap 1.5 detik (**LIVE**)
3. Jika wajah dikenali → **kotak hijau** + nama + persentase akurasi
4. Jika tidak dikenali → **kotak merah** + "Unknown"
5. Hasil juga tampil di panel bawah kamera

> Tidak perlu tekan tombol — identifikasi berjalan otomatis secara live stream.

#### Hapus Wajah

- Klik ikon 🗑️ di sebelah nama pada panel **Wajah Terdaftar**
- Konfirmasi penghapusan

---

## Struktur Project

```
workshop-ml/
├── backend/
│   ├── main.py              ← Semua endpoint API (FastAPI)
│   ├── requirements.txt     ← Dependencies Python
│   ├── .env.example         ← Template konfigurasi
│   └── data/
│       └── faces/           ← Database wajah
│           ├── Nama_Orang/
│           │   ├── 1.jpg    ← Foto sudut lurus
│           │   ├── 2.jpg    ← Foto sudut kiri
│           │   └── 3.jpg    ← Foto sudut kanan
│           └── ...
├── frontend/
│   ├── src/
│   │   ├── App.tsx              ← Layout + navigasi
│   │   └── pages/
│   │       ├── ChatPage.tsx     ← UI chat AI
│   │       └── FacePage.tsx     ← UI face recognition
│   ├── vite.config.ts           ← Dev server + proxy config
│   └── package.json
├── start-backend.bat        ← Shortcut jalankan backend (Windows)
├── start-frontend.bat       ← Shortcut jalankan frontend (Windows)
└── README.md
```

---

## API Endpoints

| Method   | Endpoint             | Fungsi                 | Parameter             |
| -------- | -------------------- | ---------------------- | --------------------- |
| `GET`    | `/`                  | Health check           | -                     |
| `POST`   | `/api/chat`          | Chat streaming AI      | `{"messages": [...]}` |
| `POST`   | `/api/face/register` | Daftarkan wajah        | Form: `name`, `file`  |
| `POST`   | `/api/face/identify` | Identifikasi wajah     | Form: `file`          |
| `GET`    | `/api/faces`         | Daftar wajah terdaftar | -                     |
| `DELETE` | `/api/faces/{name}`  | Hapus wajah            | -                     |

---

## Teknologi yang Digunakan

| Komponen         | Teknologi              | Keterangan                             |
| ---------------- | ---------------------- | -------------------------------------- |
| Backend          | FastAPI + Uvicorn      | Web framework Python, ringan & cepat   |
| AI Chat          | OpenAI SDK → 9router   | Proxy ke Claude AI                     |
| Face Detection   | OpenCV (via DeepFace)  | Deteksi posisi wajah dalam gambar      |
| Face Recognition | Facenet (via DeepFace) | Embedding wajah → pencocokan identitas |
| Frontend         | React + TypeScript     | UI interaktif                          |
| Styling          | Tailwind CSS           | Utility-first CSS                      |
| Build Tool       | Vite                   | Dev server + bundler                   |
| Webcam           | react-webcam           | Akses kamera browser                   |

---

## Troubleshooting

| Masalah                             | Penyebab                                | Solusi                                                                             |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `pip install` sangat lambat         | TensorFlow ~500MB                       | Gunakan WiFi cepat, tunggu ±5 menit                                                |
| Backend hang / tidak merespons      | Konflik TensorFlow + uvicorn reload     | Jalankan tanpa `--reload`: `python -m uvicorn main:app --host 0.0.0.0 --port 8000` |
| "Tidak ada wajah terdeteksi"        | Pencahayaan kurang / wajah terlalu jauh | Dekatkan wajah ke kamera, tambah cahaya                                            |
| "Kualitas wajah kurang" saat daftar | Pakai kacamata/masker                   | Lepas kacamata & masker saat mendaftar                                             |
| Wajah terdaftar tapi tidak dikenali | Foto referensi kurang                   | Hapus lalu daftarkan ulang dengan 3 foto baru                                      |
| Chat tidak merespons                | 9router tidak jalan                     | Pastikan 9router berjalan di port 20128                                            |
| Port 8000 sudah dipakai             | Proses lain                             | `python -m uvicorn main:app --port 8001`                                           |
| Frontend error proxy                | Backend mati                            | Pastikan backend jalan dulu sebelum frontend                                       |
| `proxies` error saat startup        | httpx terlalu baru                      | Sudah di-pin di requirements.txt (`httpx==0.27.2`)                                 |
| `ModuleNotFoundError: uvicorn`      | uvicorn tidak di PATH                   | Gunakan `python -m uvicorn` bukan `uvicorn` langsung                               |

---

## Catatan untuk Peserta Workshop

1. **Koneksi internet diperlukan** — untuk download model AI (~90MB pertama kali) dan chat via 9router
2. **Webcam diperlukan** — untuk fitur Face Recognition
3. **Izinkan akses kamera** di browser saat diminta
4. **Jangan tutup terminal** backend & frontend selama menggunakan aplikasi
5. **Daftarkan wajah tanpa kacamata/masker** — identifikasi tetap bisa walau pakai aksesoris
6. **3 foto dari sudut berbeda** membuat pengenalan lebih akurat
7. **Pertama kali agak lambat** — TensorFlow perlu load model. Selanjutnya lebih cepat.
