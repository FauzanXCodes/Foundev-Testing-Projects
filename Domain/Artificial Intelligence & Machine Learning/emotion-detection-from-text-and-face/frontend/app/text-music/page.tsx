"use client";

import { useState, useCallback } from "react";
import type { Song, PredictResponse, PlayerMode } from "../types";
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
import { OrbitalLoader } from "../../components/ui/orbital-loader";
import { motion, AnimatePresence } from "framer-motion";

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

export default function TextMusicPage() {
  const [inputText, setInputText] = useState("");
  const [language, setLanguage]   = useState("Any");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<PredictResponse | null>(null);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("video");
  const [toast, setToast]         = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { name: "Home", link: "/" },
    { name: "Visual Analysis", link: "/system" },
    { name: "Text-to-Music", link: "/text-music" },
    { name: "Docs", link: "/docs" },
  ];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const predictText = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true); setResult(null); setActiveSong(null);
    try {
      const res = await fetch(`${API_BASE}/predict-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, language: language }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Server error" }));
        throw new Error(err.detail || "Text analysis failed");
      }
      const data: PredictResponse = await res.json();
      setResult(data);
      if (data.songs.length > 0) setActiveSong(data.songs[0]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      showToast(msg);
    } finally {
      setLoading(false);
    }
  }, [inputText, language]);

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
              <NavbarButton href="/" variant="secondary">Home</NavbarButton>
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
                <a key={item.name} href={item.link} className="text-lg font-medium py-2 dark:text-white">
                  {item.name}
                </a>
              ))}
            </MobileNavMenu>
          </MobileNav>
        </Navbar>

        <main className="main-container pt-32">
          <header className="hero text-center mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500"
            >
              Express Your Soul.
            </motion.h1>
            <p className="hero-sub opacity-70 mt-4 max-w-2xl mx-auto">
              Our advanced Transformer model analyzes the emotional depth of your words and 
              curates a personalized soundtrack for your current state of mind.
            </p>
          </header>

          <div className="max-w-4xl mx-auto px-4">
            <div className="card bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
              <textarea 
                className="w-full h-48 bg-white/40 dark:bg-black/40 border border-neutral-300 dark:border-neutral-800 rounded-2xl p-6 text-neutral-900 dark:text-white text-lg focus:border-neutral-500 dark:focus:border-white/50 transition-all outline-none resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                placeholder="Type how you're feeling... (e.g., 'The sunset today was breathtakingly beautiful, I feel so at peace.')"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              
              <div className="mt-6 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/40 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <span className="text-neutral-400 text-sm font-medium whitespace-nowrap">Music Region:</span>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-neutral-200 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm rounded-xl px-4 py-3 min-w-[150px] focus:ring-2 focus:ring-neutral-400 dark:focus:ring-white/50 outline-none appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
                
                <button 
                  onClick={predictText}
                  disabled={loading || !inputText.trim()}
                  className="btn btn-primary px-8 py-3 rounded-xl text-md font-semibold bg-neutral-900 text-white dark:bg-white dark:text-black hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap w-full md:w-auto"
                >
                  {loading ? "Analyzing Emotions..." : "Discover Your Music"}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-20"
                >
                  <OrbitalLoader message="Reading between the lines..." />
                </motion.div>
              )}

              {result && !loading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8"
                >
                  {/* Result Summary */}
                  <div className="card bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-3xl">
                    <h2 className="text-xl font-semibold mb-6 text-neutral-400">Analysis Result</h2>
                    <div className="flex items-center gap-4 mb-8">
                      <span className="text-6xl">{EMOTION_META[result.emotion]?.emoji}</span>
                      <div>
                        <div className="text-3xl font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                          {EMOTION_META[result.emotion]?.label || result.emotion}
                        </div>
                        <div className="text-neutral-500">
                          Detected with {(result.confidence * 100).toFixed(1)}% confidence
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-neutral-500 uppercase">Input Context</div>
                      <div className="p-4 bg-white/40 dark:bg-black/40 rounded-xl border border-neutral-200 dark:border-neutral-800 italic text-neutral-700 dark:text-neutral-300">
                        "{result.text_analyzed}"
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="card bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-3xl">
                    <h2 className="text-xl font-semibold mb-6 text-neutral-400">Curated Tracks</h2>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                      {result.songs.map((song) => (
                        <div 
                          key={song.video_id}
                          onClick={() => setActiveSong(song)}
                          className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${
                            activeSong?.video_id === song.video_id 
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg" 
                              : "hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-white"
                          }`}
                        >
                          <img src={song.thumbnail} alt={song.title} className="w-16 h-12 object-cover rounded-lg" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate text-sm">{song.title}</div>
                            <div className={`text-xs ${activeSong?.video_id === song.video_id ? "text-neutral-700" : "text-neutral-500"}`}>
                              {song.channel}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Player Embed */}
                  {activeSong && (
                    <motion.div 
                      layoutId="player"
                      className="lg:col-span-2 card bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden aspect-video shadow-2xl"
                    >
                      <iframe
                        src={`https://www.youtube.com/embed/${activeSong.video_id}?autoplay=1`}
                        className="w-full h-full border-none"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <Footer />
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
