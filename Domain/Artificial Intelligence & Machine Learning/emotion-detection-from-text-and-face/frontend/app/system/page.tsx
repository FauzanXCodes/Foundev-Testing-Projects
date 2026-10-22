"use client";

import { useRef, useState, useCallback } from "react";
import type { Song, PredictResponse, InputMode, PlayerMode } from "../types";
import Link from "next/link";
import { 
  Navbar, 
  NavBody, 
  NavItems, 
  NavbarLogo, 
  NavbarButton,
  MobileNav,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu
} from "../../components/ui/resizable-navbar";
import { ThemeToggle } from "../../components/theme-toggle";
import { Footer } from "../../components/Footer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const EMOTION_META: Record<string, { emoji: string; label: string }> = {
  happy:    { emoji: "😊", label: "Happy" },
  sad:      { emoji: "😢", label: "Sad" },
  angry:    { emoji: "😠", label: "Angry" },
  neutral:  { emoji: "😐", label: "Neutral" },
  surprise: { emoji: "😲", label: "Surprise" },
  fear:     { emoji: "😨", label: "Fearful" },
  disgust:  { emoji: "🤢", label: "Disgusted" },
};

const LANGUAGES = ["Any", "English", "Hindi", "Bengali", "Spanish", "Punjabi", "Tamil", "Telugu", "K-Pop", "Anime/J-Pop"];

export default function SystemPage() {
  const [inputMode, setInputMode]     = useState<InputMode>("upload");
  const [playerMode, setPlayerMode]   = useState<PlayerMode>("video");
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [language, setLanguage]       = useState("Any");
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<PredictResponse | null>(null);
  const [activeSong, setActiveSong]   = useState<Song | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const [toast, setToast]             = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const predict = useCallback(async () => {
    if (!imageFile) return;
    setLoading(true); setError(null); setResult(null); setActiveSong(null);
    try {
      const form = new FormData();
      form.append("file", imageFile);
      form.append("language", language);
      const res = await fetch(`${API_BASE}/predict`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Server error" }));
        throw new Error(err.detail || "Prediction failed");
      }
      const data: PredictResponse = await res.json();
      setResult(data);
      if (data.songs.length > 0) setActiveSong(data.songs[0]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg); showToast(msg);
    } finally {
      setLoading(false);
    }
  }, [imageFile, language]);

  const navItems = [
    { name: "Home", link: "/" },
    { name: "Visual Analysis", link: "/system" },
    { name: "Text-to-Music", link: "/text-music" },
    { name: "Docs", link: "/docs" },
  ];

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Invalid image file"); return; }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null); setActiveSong(null); setError(null);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setWebcamActive(true);
    } catch { showToast("Camera access denied"); }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "webcam.jpg", { type: "image/jpeg" });
      setImageFile(file);
      setPreviewUrl(canvas.toDataURL("image/jpeg"));
      setResult(null); setActiveSong(null); setError(null);
      setInputMode("upload");
      stopWebcam();
      showToast("Frame captured");
    }, "image/jpeg");
  };


  return (
    <>
      <div className="bg-scene" />

      <div className="page-shell">
        <Navbar>
          <NavBody>
            <NavbarLogo>
              <img src="/logo.png" alt="" className="h-8 w-auto object-contain mr-2" />
              <span className="font-extrabold text-xl tracking-tight">MoodTunes</span>
            </NavbarLogo>
            <NavItems items={navItems} />
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="status-chip hidden xl:flex">
                <span className="live-dot" />
                API Operational
              </div>
              <NavbarButton href="/" variant="secondary">
                Home
              </NavbarButton>
            </div>
          </NavBody>

          <MobileNav>
            <MobileNavHeader>
              <NavbarLogo>
                <img src="/logo.png" alt="" className="h-8 w-auto object-contain mr-2" />
                <span className="font-extrabold text-xl tracking-tight">MoodTunes</span>
              </NavbarLogo>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <MobileNavToggle isOpen={isMobileOpen} onClick={() => setIsMobileOpen(!isMobileOpen)} />
              </div>
            </MobileNavHeader>
            <MobileNavMenu isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)}>
              {navItems.map((item) => (
                <a key={item.name} href={item.link} className="text-lg font-medium py-2 dark:text-white" onClick={() => setIsMobileOpen(false)}>
                  {item.name}
                </a>
              ))}
              <NavbarButton href="/" variant="primary" className="w-full mt-4">
                View Landing Page
              </NavbarButton>
            </MobileNavMenu>
          </MobileNav>
        </Navbar>

        <main className="main-container">
          <header className="hero">
            <h1>Mood Recognition.</h1>
            <p className="hero-sub" style={{ margin: "0 auto" }}>
              An industrial-grade solution for emotion-aware music recommendations. 
              Powered by a custom CNN and DeepFace.
            </p>
          </header>

          <div className="grid-two">
            {/* LEFT: INPUT */}
            <section className="input-section">
              <div className="card">
                <h2 className="card-title">Analysis Input</h2>
                
                <div className="tabs">
                  <button 
                    className={`tab ${inputMode === "upload" ? "active" : ""}`} 
                    onClick={() => { setInputMode("upload"); if (webcamActive) stopWebcam(); }}
                  >
                    Image Upload
                  </button>
                  <button 
                    className={`tab ${inputMode === "webcam" ? "active" : ""}`} 
                    onClick={() => { setInputMode("webcam"); if (previewUrl) { setPreviewUrl(null); setImageFile(null); } }}
                  >
                    Live Webcam
                  </button>
                </div>

                {inputMode === "upload" && (
                  <>
                    {!previewUrl && (
                      <div className="upload-zone" onClick={() => document.getElementById("fileInput")?.click()}>
                        <div className="upload-icon-wrap">
                          <img src="https://unpkg.com/lucide-static@latest/icons/upload-cloud.svg" alt="Upload" className="icon-white" width="40" height="40" />
                        </div>
                        <p>Drop image or <span>click to browse</span></p>
                        <input id="fileInput" type="file" accept="image/*" onChange={onFileInput} style={{ display: "none" }} />
                      </div>
                    )}
                    {previewUrl && (
                      <div className="preview-container">
                        <img src={previewUrl} alt="Preview" />
                      </div>
                    )}
                  </>
                )}

                {inputMode === "webcam" && (
                  <div className="webcam-container">
                    <video ref={videoRef} autoPlay playsInline muted style={{ display: webcamActive ? "block" : "none" }} />
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                    {!webcamActive && <p style={{ color: "var(--text-muted)" }}>Camera Offline</p>}
                  </div>
                )}

                <div style={{ marginTop: "1.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 500 }}>Music Region:</span>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "8px 12px", borderRadius: "8px", outline: "none", fontSize: "0.9rem", flex: 1, cursor: "pointer" }}
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                <div className="btn-group" style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                  {inputMode === "webcam" && (
                    <>
                      {!webcamActive ? (
                        <button className="btn btn-secondary" onClick={startWebcam}>Start Camera</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={captureFrame}>Capture</button>
                          <button className="btn btn-danger" onClick={stopWebcam}>Stop</button>
                        </>
                      )}
                    </>
                  )}
                  {inputMode === "upload" && imageFile && !loading && (
                    <button className="btn btn-primary" onClick={predict} style={{ flex: 1 }}>
                      Execute Analysis
                    </button>
                  )}
                  {loading && (
                    <button className="btn btn-primary" disabled style={{ flex: 1 }}>
                      <span className="spinner" /> Analyzing...
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* RIGHT: RESULTS */}
            <section className="results-section">
              <div className="card">
                <h2 className="card-title">Analysis Output</h2>
                
                {!result && !loading && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    Select an input to begin emotion-aware recommendation.
                  </div>
                )}

                {result && (
                  <div className="emotion-result-card">
                    <div className="emotion-badge">
                      {EMOTION_META[result.emotion]?.emoji} {result.emotion.toUpperCase()}
                    </div>
                    <div className="confidence-text">
                      Confidence: {(result.confidence * 100).toFixed(1)}%
                    </div>

                    <div className="confidence-bar-wrap">
                      <div className="confidence-bar">
                        <div className="confidence-fill" style={{ width: `${result.confidence * 100}%` }} />
                      </div>
                    </div>

                    <div className="breakdown-label">Distribution</div>
                    {result.all_emotions && Object.entries(result.all_emotions)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([em, score]) => (
                        <div key={em} className={`emotion-row ${em === result.emotion ? "active" : ""}`}>
                          <div className="emotion-name">{em}</div>
                          <div className="emotion-mini-bar">
                            <div className="emotion-mini-fill" style={{ width: `${score * 100}%` }} />
                          </div>
                          <div style={{ width: "40px", textAlign: "right", color: "var(--text-muted)" }}>
                            {(score * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {result && result.songs.length > 0 && (
                <div className="card" style={{ marginTop: "2rem" }}>
                  <h2 className="card-title">Recommended System Tracks</h2>
                  
                  <div className="player-mode-toggle">
                    <button className={`mode-btn ${playerMode === "video" ? "active" : ""}`} onClick={() => setPlayerMode("video")}>Video</button>
                    <button className={`mode-btn ${playerMode === "audio" ? "active" : ""}`} onClick={() => setPlayerMode("audio")}>Audio</button>
                  </div>

                  {activeSong && (
                    <div className="player-embed" style={{ overflow: "hidden", borderRadius: "12px" }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${activeSong.video_id}?autoplay=1`}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        style={
                          playerMode === "audio"
                            ? { width: "100%", height: "120px", aspectRatio: "auto", border: "1px solid var(--border)", transition: "all 0.3s ease" }
                            : { width: "100%", aspectRatio: "16/9", border: "1px dashed var(--border)", transition: "all 0.3s ease" }
                        }
                      />
                    </div>
                  )}

                  <div className="song-list">
                    {result.songs.map((song) => (
                      <div 
                        key={song.video_id} 
                        className={`song-item ${activeSong?.video_id === song.video_id ? "active" : ""}`}
                        onClick={() => setActiveSong(song)}
                      >
                        <img src={song.thumbnail} alt={song.title} className="song-thumb" />
                        <div className="song-info">
                          <div className="song-title">{song.title}</div>
                          <div className="song-channel">{song.channel}</div>
                        </div>
                        {song.duration && <div className="song-duration">{song.duration}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>

        <Footer />
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
