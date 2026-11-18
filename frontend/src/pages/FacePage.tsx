import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { UserPlus, Users, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2, Radio } from "lucide-react";

interface FaceResult {
  name: string;
  confidence: number;
  location: { top: number; right: number; bottom: number; left: number };
}

const REGISTER_PHOTOS = 3;
const ANGLE_HINTS = ["Hadap lurus ke kamera", "Putar sedikit ke kiri", "Putar sedikit ke kanan"];

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function FacePage() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isIdentifyingRef = useRef(false);

  const [mode, setMode] = useState<"identify" | "register">("identify");
  const [registerName, setRegisterName] = useState("");
  const [results, setResults] = useState<FaceResult[]>([]);
  const [registered, setRegistered] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [registerProgress, setRegisterProgress] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [liveStatus, setLiveStatus] = useState<"scanning" | "idle">("idle");
  const [liveInfo, setLiveInfo] = useState<string>("");

  const loadRegistered = useCallback(async () => {
    try {
      const { data } = await axios.get<{ registered: string[] }>("/api/faces");
      setRegistered(data.registered);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadRegistered(); }, [loadRegistered]);

  const capture = useCallback(() => webcamRef.current?.getScreenshot() ?? null, []);

  const drawBoxes = useCallback((faces: FaceResult[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const face of faces) {
      const { top, left, bottom, right } = face.location;
      const color = face.name === "Unknown" ? "#ef4444" : "#10b981";
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(left, top, right - left, bottom - top);

      ctx.font = "bold 14px sans-serif";
      const label = face.name + (face.confidence > 0 ? ` ${face.confidence}%` : "");
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(left, top - 26, tw + 12, 24);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, left + 6, top - 8);
    }
  }, []);

  // Live identify — auto every 1.5s in identify mode
  useEffect(() => {
    if (mode !== "identify") {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setResults([]);
      return;
    }

    const interval = setInterval(async () => {
      if (isIdentifyingRef.current) return;
      isIdentifyingRef.current = true;
      setLiveStatus("scanning");

      const img = capture();
      if (!img) { isIdentifyingRef.current = false; setLiveStatus("idle"); return; }

      try {
        const form = new FormData();
        form.append("file", dataURLtoBlob(img), "capture.jpg");
        const { data } = await axios.post<{ faces: FaceResult[]; total: number; message?: string }>(
          "/api/face/identify", form
        );
        setResults(data.faces);
        drawBoxes(data.faces);
        if (data.faces.length === 0) {
          setLiveInfo(data.message ?? "Tidak ada wajah terdeteksi");
        } else {
          setLiveInfo(`${data.faces.length} wajah — ${data.faces.map(f => f.name).join(", ")}`);
        }
      } catch (e) {
        setLiveInfo("Error: " + (e as Error).message);
      }
      finally {
        isIdentifyingRef.current = false;
        setLiveStatus("idle");
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [mode, capture, drawBoxes]);

  const handleRegister = async () => {
    if (!registerName.trim()) { setMessage({ type: "error", text: "Nama wajib diisi" }); return; }
    setLoading(true);
    setMessage(null);
    setRegisterProgress(0);

    try {
      for (let i = 0; i < REGISTER_PHOTOS; i++) {
        setRegisterProgress(i);
        // jeda antar foto supaya user sempat gerak
        if (i > 0) await new Promise(r => setTimeout(r, 1200));

        const img = capture();
        if (!img) throw new Error("Gagal mengambil gambar dari kamera");

        const form = new FormData();
        form.append("name", registerName.trim());
        form.append("file", dataURLtoBlob(img), `capture_${i + 1}.jpg`);
        await axios.post<{ message: string; total_photos: number }>("/api/face/register", form);

        setRegisterProgress(i + 1);
      }

      setMessage({ type: "success", text: `✓ ${REGISTER_PHOTOS} foto '${registerName.trim()}' berhasil didaftarkan` });
      setRegisterName("");
      await loadRegistered();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ??
        "Gagal mendaftarkan wajah";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
      setRegisterProgress(0);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Hapus wajah "${name}"?`)) return;
    await axios.delete(`/api/faces/${encodeURIComponent(name)}`);
    await loadRegistered();
    setMessage({ type: "success", text: `Wajah ${name} dihapus` });
  };

  return (
    <div className="flex gap-6 p-6 h-[calc(100vh-65px)] overflow-auto">
      {/* Left: Camera */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Camera + canvas overlay */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 relative aspect-[4/3]">
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover"
            videoConstraints={{ facingMode: "user", width: 1280, height: 960 }}
          />
          <canvas
            ref={canvasRef}
            width={1280}
            height={960}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Live indicator */}
          {mode === "identify" && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
              <Radio size={11} className={liveStatus === "scanning" ? "text-green-400 animate-pulse" : "text-gray-500"} />
              <span className="text-xs font-semibold text-white">LIVE</span>
            </div>
          )}

          {/* Angle hint during register */}
          {mode === "register" && loading && registerProgress < REGISTER_PHOTOS && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-full text-sm font-semibold text-white">
              📸 Foto {registerProgress + 1}/{REGISTER_PHOTOS} — {ANGLE_HINTS[registerProgress]}
            </div>
          )}
        </div>

        {/* Live status info */}
        {mode === "identify" && liveInfo && (
          <div className="text-xs text-gray-500 text-center -mt-2">{liveInfo}</div>
        )}

        {/* Mode tabs */}
        <div className="flex gap-2 bg-gray-900 p-1 rounded-xl border border-gray-800">
          {(["identify", "register"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setResults([]); setMessage(null); setLiveInfo(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {m === "identify" ? "🔍 Identifikasi Wajah" : "➕ Daftarkan Wajah"}
            </button>
          ))}
        </div>

        {/* Register form */}
        {mode === "register" && (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs text-amber-400">
              ⚠️ Saat mendaftar: lepas kacamata & masker, pastikan pencahayaan cukup
            </div>
            <input
              value={registerName}
              onChange={e => setRegisterName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && handleRegister()}
              placeholder="Masukkan nama…"
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={handleRegister}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {loading
                ? `Mengambil foto ${registerProgress + 1}/${REGISTER_PHOTOS} — ${ANGLE_HINTS[registerProgress] ?? "selesai"}…`
                : `Ambil ${REGISTER_PHOTOS} Foto & Daftarkan`}
              {loading && (
                <span className="flex gap-1 ml-1">
                  {Array.from({ length: REGISTER_PHOTOS }).map((_, i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${i < registerProgress ? "bg-white" : "bg-white/30"}`} />
                  ))}
                </span>
              )}
            </button>
          </>
        )}

        {/* Message */}
        {message && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {message.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {message.text}
          </div>
        )}

        {/* Results list (identify mode) */}
        {results.length > 0 && mode === "identify" && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Terdeteksi — {results.length} wajah
            </div>
            {results.map((face, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold ${
                    face.name === "Unknown" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                  }`}>
                    {face.name === "Unknown" ? "?" : face.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{face.name}</p>
                    {face.confidence > 0 && <p className="text-xs text-gray-400">Akurasi: {face.confidence}%</p>}
                  </div>
                </div>
                <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                  face.name === "Unknown" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {face.name === "Unknown" ? "Tidak Dikenal" : "Dikenal"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Registered faces */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-300">Wajah Terdaftar</span>
          </div>
          <button onClick={loadRegistered} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex-1">
          {registered.length === 0 ? (
            <div className="p-8 text-center">
              <Users size={28} className="text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Belum ada wajah terdaftar</p>
            </div>
          ) : (
            registered.map(name => (
              <div key={name} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">
                    {name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-300 truncate">{name}</span>
                </div>
                <button
                  onClick={() => handleDelete(name)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
