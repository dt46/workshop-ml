"""
Workshop ML Backend
- POST /api/chat              → streaming chat via 9router
- POST /api/face/register     → daftarkan wajah (simpan foto)
- POST /api/face/identify     → kenali wajah dari foto/webcam
- GET  /api/faces             → daftar wajah terdaftar
- DELETE /api/faces/{name}    → hapus wajah
"""

import io
import os
import json
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from PIL import Image
from deepface import DeepFace

app = FastAPI(title="Workshop ML API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Konfigurasi ───────────────────────────────────────────────────────────────

FACES_DIR   = Path("data/faces")
FACES_DIR.mkdir(parents=True, exist_ok=True)

AI_BASE_URL = os.getenv("AI_BASE_URL", "http://localhost:20128/v1")
AI_KEY      = os.getenv("AI_KEY",      "9router")
AI_MODEL    = os.getenv("AI_MODEL",    "cc/claude-haiku-4-5")

ai = OpenAI(base_url=AI_BASE_URL, api_key=AI_KEY)

SYSTEM_PROMPT = (
    "Kamu adalah asisten AI bernama Roxy untuk Workshop Machine Learning. "
    "Jawab dengan bahasa Indonesia yang ramah dan mudah dipahami oleh pemula. "
    "Gunakan contoh sederhana saat menjelaskan konsep teknis."
)

DB_MODEL    = "Facenet"
DB_DETECTOR = "opencv"
THRESHOLD   = 0.65


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    registered = [p.name for p in FACES_DIR.iterdir() if p.is_dir()]
    return {"status": "ok", "model": AI_MODEL, "registered_faces": len(registered)}


# ── Chat ──────────────────────────────────────────────────────────────────────

@app.post("/api/chat")
def chat(request: dict):
    messages = request.get("messages", [])
    if not messages:
        raise HTTPException(400, "messages required")

    def generate():
        stream = ai.chat.completions.create(
            model=AI_MODEL,
            stream=True,
            max_tokens=1024,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield f"data: {json.dumps({'text': delta})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Face: Register ────────────────────────────────────────────────────────────

@app.post("/api/face/register")
def register_face(name: str = Form(...), file: UploadFile = File(...)):
    contents = file.file.read()

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        faces = DeepFace.extract_faces(
            img_path=tmp_path,
            detector_backend=DB_DETECTOR,
            enforce_detection=True,
        )
    except ValueError:
        os.unlink(tmp_path)
        raise HTTPException(400, "Tidak ada wajah terdeteksi. Pastikan wajah menghadap kamera dan lepas masker.")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if len(faces) > 1:
        raise HTTPException(400, f"Terdeteksi {len(faces)} wajah. Gunakan foto dengan 1 wajah saja.")

    face_confidence = faces[0].get("face_confidence", 1.0)
    if face_confidence < 0.90:
        raise HTTPException(
            400,
            f"Kualitas wajah kurang ({face_confidence:.0%}). Lepas kacamata/masker dan pastikan pencahayaan cukup."
        )

    safe_name = name.strip().replace(" ", "_")
    person_dir = FACES_DIR / safe_name
    person_dir.mkdir(exist_ok=True)

    existing = list(person_dir.glob("*.jpg"))
    idx = len(existing) + 1
    dest = person_dir / f"{idx}.jpg"
    Image.open(io.BytesIO(contents)).convert("RGB").save(dest)

    _clear_deepface_cache()

    total = len(list(person_dir.glob("*.jpg")))
    return {"success": True, "name": safe_name, "total_photos": total,
            "message": f"Foto {total} untuk '{name}' berhasil disimpan"}


# ── Face: Identify ────────────────────────────────────────────────────────────

@app.post("/api/face/identify")
def identify_face(file: UploadFile = File(...)):
    registered = list(FACES_DIR.rglob("*.jpg"))
    if not registered:
        return {"faces": [], "message": "Belum ada wajah terdaftar. Daftarkan wajah dulu."}

    contents = file.file.read()
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        try:
            matches = DeepFace.find(
                img_path=tmp_path,
                db_path=str(FACES_DIR),
                model_name=DB_MODEL,
                detector_backend=DB_DETECTOR,
                enforce_detection=True,
                silent=True,
            )
        except ValueError:
            return {"faces": [], "message": "Tidak ada wajah terdeteksi"}

        results = []
        for df in matches:
            if df.empty:
                continue

            best = df.sort_values("distance").iloc[0]
            dist = float(best["distance"])

            region = {
                "x": int(best.get("source_x", 0)),
                "y": int(best.get("source_y", 0)),
                "w": int(best.get("source_w", 0)),
                "h": int(best.get("source_h", 0)),
            }

            if dist <= THRESHOLD:
                identity_path = Path(best["identity"])
                name = identity_path.parent.name.replace("_", " ")
                confidence = round((1 - dist / THRESHOLD) * 100, 1)
            else:
                name = "Unknown"
                confidence = 0.0

            results.append({
                "name": name,
                "confidence": confidence,
                "location": {
                    "top":    region["y"],
                    "left":   region["x"],
                    "bottom": region["y"] + region["h"],
                    "right":  region["x"] + region["w"],
                },
            })

        if not results:
            try:
                face_objs = DeepFace.extract_faces(
                    img_path=tmp_path,
                    detector_backend=DB_DETECTOR,
                    enforce_detection=False,
                )
                for face_obj in face_objs:
                    r = face_obj["facial_area"]
                    results.append({
                        "name": "Unknown",
                        "confidence": 0.0,
                        "location": {
                            "top": r["y"], "left": r["x"],
                            "bottom": r["y"] + r["h"], "right": r["x"] + r["w"],
                        },
                    })
            except Exception:
                pass

        return {"faces": results, "total": len(results)}

    finally:
        os.unlink(tmp_path)


# ── Face: List ────────────────────────────────────────────────────────────────

@app.get("/api/faces")
def list_faces():
    dirs = sorted(p.name.replace("_", " ") for p in FACES_DIR.iterdir() if p.is_dir())
    return {"registered": dirs, "total": len(dirs)}


# ── Face: Delete ──────────────────────────────────────────────────────────────

@app.delete("/api/faces/{name}")
def delete_face(name: str):
    safe_name = name.replace(" ", "_")
    path = FACES_DIR / safe_name
    if not path.exists():
        raise HTTPException(404, f"Wajah '{name}' tidak ditemukan")
    shutil.rmtree(path)
    _clear_deepface_cache()
    return {"success": True, "message": f"Wajah '{name}' dihapus"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clear_deepface_cache():
    for pkl in FACES_DIR.rglob("*.pkl"):
        pkl.unlink()
    for npz in FACES_DIR.rglob("*.npz"):
        npz.unlink()
