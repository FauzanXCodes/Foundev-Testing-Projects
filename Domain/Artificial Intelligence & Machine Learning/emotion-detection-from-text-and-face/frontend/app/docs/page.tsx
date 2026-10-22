"use client";

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
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  IconBrain, 
  IconRocket, 
  IconCpu, 
  IconDatabase, 
  IconDevices, 
  IconCode, 
  IconLayout, 
  IconMusic, 
  IconShieldCheck,
  IconBolt,
  IconFingerprint,
  IconMessages,
  IconServer,
  IconBrandGithub,
  IconCommand,
  IconPlayerPlayFilled,
  IconCircleCheck,
  IconArrowRight,
  IconQuestionMark,
  IconChevronDown,
  IconVersions
} from "@tabler/icons-react";

const FAQ_ITEMS = [
  {
    question: "What happens if no face is detected in the image?",
    answer: "Our system implements a robust fail-safe. If the DeepFace extraction layer fails to isolate a specific face region, the engine automatically falls back to an full-frame holistic analysis. This ensures that the system always returns an result, even with wide-angle shots or atypical lighting."
  },
  {
    question: "How does the system handle different musical regions?",
    answer: "MoodTunes features a 'Regional Context Engine'. When a user selects a language like Hindi or Bengali, our backend dynamically rewrites the YouTube search parameters to prioritize regional NLP context over generic global pop genres. This ensures highly culturally-accurate recommendations."
  },
  {
    question: "Why is Redis used in the backend infrastructure?",
    answer: "Redis is critical for MNC-grade performance. It serves two purposes: 1) Performance: It caches YouTube search results for 24 hours, reducing latency from ~2s to <300ms. 2) API Quota Management: It ensures we don't redundantly scrape YouTube, maintaining system reliability and longevity."
  },
  {
    question: "Is the emotion detection data stored on the server?",
    answer: "No. Privacy is a core architectural pillar. Facial processing happens in real-time within the volatile memory of the FastAPI worker. No images are permanently stored, and no biometric signatures are persisted. The system is stateless by design."
  },
  {
    question: "Can I install MoodTunes as a standalone application?",
    answer: "Absolutely. MoodTunes is a 'Progressive Web App' (PWA). You can install it on Android (via Chrome), iOS (Add to Home Screen), or Desktop (Chrome/Edge App). It will then function with a standalone window, custom launcher icon, and app-like transitions."
  }
];

export default function DocsPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const navItems = [
    { name: "Features", link: "/#features" },
    { name: "Workflow", link: "/#workflow" },
    { name: "Technical", link: "/#technical" },
    { name: "Docs", link: "/docs" },
    { name: "GitHub", link: "https://github.com" },
  ];

  const sidebarLinks = [
    { id: "mission", title: "Project Mission", icon: <IconRocket size={18} /> },
    { id: "engine-visual", title: "Visual AI Engine", icon: <IconFingerprint size={18} /> },
    { id: "engine-text", title: "Text AI Engine", icon: <IconMessages size={18} /> },
    { id: "stack", title: "Technical Stack", icon: <IconCode size={18} /> },
    { id: "performance", title: "Performance Benchmarks", icon: <IconBolt size={18} /> },
    { id: "pwa", title: "PWA & Deployment", icon: <IconDevices size={18} /> },
    { id: "faq", title: "Stakeholder FAQ", icon: <IconQuestionMark size={18} /> },
  ];

  return (
    <>
      <div className="bg-scene" />
      <div className="landing-shell">
        <Navbar>
          <NavBody>
            <NavbarLogo>
              <img src="/logo.png" alt="" className="h-8 w-auto object-contain mr-2" />
              <span className="font-extrabold text-xl tracking-tight">MoodTunes</span>
            </NavbarLogo>
            <NavItems items={navItems} />
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <NavbarButton href="/system" variant="primary">Launch App</NavbarButton>
            </div>
          </NavBody>
          <MobileNav>
            <MobileNavHeader>
              <NavbarLogo><img src="/logo.png" alt="" className="h-8 w-auto object-contain mr-2" /><span className="font-extrabold text-xl tracking-tight">MoodTunes</span></NavbarLogo>
              <div className="flex items-center gap-2"><ThemeToggle /><MobileNavToggle isOpen={isMobileOpen} onClick={() => setIsMobileOpen(!isMobileOpen)} /></div>
            </MobileNavHeader>
            <MobileNavMenu isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)}>
              {navItems.map((item) => <a key={item.name} href={item.link} className="text-lg font-medium py-2 dark:text-white" onClick={() => setIsMobileOpen(false)}>{item.name}</a>)}
            </MobileNavMenu>
          </MobileNav>
        </Navbar>

        <main className="main-container pt-32 pb-40">
          {/* Hero Section */}
          <header className="max-w-4xl mb-32">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] mb-6 font-sans"
            >
              <IconVersions size={14} /> Documentation v3.5.2 • Production Ready
            </motion.div>
            <h1 className="text-7xl font-black tracking-[-0.04em] mb-8 leading-[0.95] font-outfit">
              The Architecture of <span className="bg-gradient-to-r from-neutral-300 to-neutral-600 bg-clip-text text-transparent italic font-serif">MoodTunes.</span>
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl font-plus">
              Explore the multi-modal AI ecosystem, from sub-second Redis orchestration to the neural weights of our core CNN engines.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
            {/* Desktop Sidebar */}
            <aside className="lg:col-span-1 hidden lg:block sticky top-32 h-fit">
              <nav className="space-y-1">
                {sidebarLinks.map(link => (
                  <a 
                    key={link.id} 
                    href={`#${link.id}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group hover:bg-neutral-100 dark:hover:bg-neutral-800/50 text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white font-plus"
                  >
                    <span className="opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-transform">{link.icon}</span>
                    {link.title}
                  </a>
                ))}
              </nav>
            </aside>

            {/* Content Core */}
            <div className="lg:col-span-3 space-y-32">
              
              {/* Mission Section */}
              <section id="mission" className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center"><IconRocket size={24} /></div>
                  <h2 className="text-4xl font-black tracking-tight font-outfit">Project Mission & Value</h2>
                </div>
                <div className="space-y-6 text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed font-plus">
                  <p>
                    In an era of hyper-personalized content, MoodTunes represents a paradigm shift in <strong>Cognitive Experience Discovery</strong>. We bridge the gap between machine intelligence and human emotion, creating a seamless feedback loop that translates physiological state into high-fidelity musical experiences.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    {[
                      "End-to-end emotional biometric automation.",
                      "Zero-latency response for immersive UX.",
                      "Culture-aware music recommendation logic.",
                      "Privacy-first stateless neural inference."
                    ].map(feat => (
                      <div key={feat} className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-medium">
                        <IconCircleCheck className="text-green-500" size={18} /> {feat}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Engine Section: Visual */}
              <section id="engine-visual" className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center"><IconFingerprint size={24} /></div>
                  <h2 className="text-4xl font-black tracking-tight font-outfit">Visual Neural Engine <span className="text-neutral-400">(VNE)</span></h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-6">
                    <div className="p-8 rounded-[2rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                      <h4 className="font-black mb-6 flex items-center gap-2 text-sm uppercase tracking-widest font-outfit text-blue-500 underline underline-offset-8 decoration-blue-500/30">The Hybrid Strategy: Why this matters?</h4>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 font-plus leading-relaxed mb-6">
                        Most systems use a single-stage model that often fails in suboptimal lighting or cluttered backgrounds. MoodTunes uses a **Dual-Architecture Hybrid Pipeline**:
                      </p>
                      <ul className="space-y-4">
                        <li className="flex gap-4 items-start">
                          <IconCircleCheck className="text-green-500 shrink-0 mt-1" size={16} />
                          <div>
                            <p className="font-bold text-sm">Precision Extraction (DeepFace)</p>
                            <p className="text-xs opacity-70 italic leading-relaxed">We use DeepFace primarily for its elite <strong>Biometric Alignment</strong> capabilities. It locates the 68 facial landmarks and crops out the background, ensuring the classifier iterates purely on facial features, not your room's wallpaper.</p>
                          </div>
                        </li>
                        <li className="flex gap-4 items-start">
                          <IconCircleCheck className="text-green-500 shrink-0 mt-1" size={16} />
                          <div>
                            <p className="font-bold text-sm">Lightweight Inference (Custom CNN)</p>
                            <p className="text-xs opacity-70 italic leading-relaxed">DeepFace's internal classification models are research-heavy and slow. We replace the last mile with a <strong>Custom TensorFlow CNN</strong> optimized specifically for our 7-emotion music mapping, cutting inference time by 70% while maintaining 90%+ accuracy.</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-neutral-950 p-6 rounded-3xl text-white font-mono text-[10px] space-y-6 border border-neutral-800">
                    <div>
                      <span className="text-neutral-500 uppercase text-[8px] font-black tracking-widest">Model Spec</span><br/>
                      <span className="text-blue-400">Layer</span>: Conv2D (64 filters)<br/>
                      <span className="text-blue-400">Layer</span>: MaxPooling (2,2)<br/>
                      <span className="text-blue-400">Layer</span>: Dropout (0.25)<br/>
                      <span className="text-blue-400">Layer</span>: Dense (128, Relu)<br/>
                      <span className="text-blue-400">Layer</span>: Dense (7, Softmax)
                    </div>
                    <div className="pt-4 border-t border-neutral-800">
                       <span className="text-neutral-500 uppercase text-[8px] font-black tracking-widest">Inference Targets</span><br/>
                       <div className="flex flex-wrap gap-1 mt-2">
                         {["Happy", "Sad", "Angry", "Fear", "Neutral"].map(e => <span key={e} className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">{e}</span>)}
                       </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Engine Section: Text */}
              <section id="engine-text" className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center"><IconMessages size={24} /></div>
                  <h2 className="text-4xl font-bold tracking-tight">Text Sentiment Engine (TSE)</h2>
                </div>
                <div className="flex flex-col md:flex-row gap-12 items-center">
                  <div className="flex-1 space-y-6">
                    <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                      TSE allows for deep narrative sentiment mapping, identifying hidden emotional subtext from complex human expressions.
                    </p>
                    <div className="p-6 rounded-[2rem] bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
                      <h4 className="font-bold text-sm mb-2">Model: DistilBERT-base-uncased</h4>
                      <p className="text-xs opacity-70">
                        Running on a sophisticated <strong>HuggingFace Pipeline</strong>, this transformer model analyzes tokenized text at high precision. It handles nuanced states like <strong>'Love'</strong> and <strong>'Joy'</strong> that visual engines might overlook.
                      </p>
                    </div>
                  </div>
                  <div className="w-full md:w-64 aspect-square bg-neutral-100 dark:bg-neutral-900 rounded-3xl flex items-center justify-center group relative overflow-hidden border-2 border-dashed border-neutral-300 dark:border-neutral-800">
                    <IconBrain size={80} className="text-neutral-300 dark:text-neutral-700 group-hover:scale-110 group-hover:text-cyan-500/20 transition-all duration-500" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <span className="font-mono text-[10px] font-bold text-cyan-400 uppercase italic">Pipeline: PyTorch</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Technical Stack */}
              <section id="stack" className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><IconCode size={24} /></div>
                  <h2 className="text-4xl font-bold tracking-tight">The Ecosystem Stack</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800">
                        <th className="py-4 font-black uppercase tracking-widest text-[10px] opacity-40">Layer</th>
                        <th className="py-4 font-black uppercase tracking-widest text-[10px] opacity-40">Technology</th>
                        <th className="py-4 font-black uppercase tracking-widest text-[10px] opacity-40">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                      <tr>
                        <td className="py-6 font-bold">Frontend</td>
                        <td className="py-6"><span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-xs">Next.js 15 (Turbo)</span></td>
                        <td className="py-6 text-xs italic">Server-side rendering & responsive orchestration.</td>
                      </tr>
                      <tr>
                        <td className="py-6 font-bold">Backend</td>
                        <td className="py-6"><span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-xs">FastAPI (Python 3.10+)</span></td>
                        <td className="py-6 text-xs italic">Async request handling & neural pipe routing.</td>
                      </tr>
                      <tr>
                        <td className="py-6 font-bold">Inference</td>
                        <td className="py-6"><span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-xs">TensorFlow / PyTorch</span></td>
                        <td className="py-6 text-xs italic">Multi-modal deep learning model execution.</td>
                      </tr>
                      <tr>
                        <td className="py-6 font-bold">Cache</td>
                        <td className="py-6"><span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-xs">Redis Cluster</span></td>
                        <td className="py-6 text-xs italic">Performance-optimized key-value storage (24h TTL).</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Performance Section */}
              <section id="performance" className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center"><IconBolt size={24} /></div>
                  <h2 className="text-4xl font-bold tracking-tight">Performance Engineering</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <p className="text-neutral-600 dark:text-neutral-400">Our infrastructure is designed for extreme vertical efficiency and horizontal scaling.</p>
                    <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                       <h4 className="font-bold flex items-center gap-2 mb-4"><IconDatabase className="text-red-500" /> Redis Benchmarks</h4>
                       <div className="space-y-3">
                         <div className="flex justify-between text-xs"><span>Cold Search (Scraping)</span> <span className="opacity-60">~1.8s - 2.5s</span></div>
                         <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                           <div className="w-[100%] h-full bg-neutral-300 dark:bg-neutral-700" />
                         </div>
                         <div className="flex justify-between text-xs font-bold text-green-500"><span>Cached Delivery (Redis)</span> <span>~280ms - 350ms</span></div>
                         <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                           <div className="w-[15%] h-full bg-green-500" />
                         </div>
                       </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <p className="text-xs font-black uppercase text-neutral-400 tracking-widest mt-2">Core Performance Pillars</p>
                    <ul className="space-y-4">
                      <li className="flex gap-4">
                        <IconCircleCheck size={20} className="text-green-500 shrink-0" />
                        <span className="text-sm opacity-80">Asynchronous I/O handling via FastAPI Uvicorn workers.</span>
                      </li>
                      <li className="flex gap-4">
                        <IconCircleCheck size={20} className="text-green-500 shrink-0" />
                        <span className="text-sm opacity-80">GPU-optimized (if available) neural weights for immediate classification.</span>
                      </li>
                      <li className="flex gap-4">
                        <IconCircleCheck size={20} className="text-green-500 shrink-0" />
                        <span className="text-sm opacity-80">Smart YouTube regional query rewriting for localized discovery indexing.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* FAQ Section */}
              <section id="faq" className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-12">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center"><IconQuestionMark size={24} /></div>
                  <h2 className="text-4xl font-bold tracking-tight italic font-serif">Frequently Asked Questions</h2>
                </div>
                <div className="space-y-4 border-t border-neutral-100 dark:border-neutral-900 pt-8">
                  {FAQ_ITEMS.map((faq, idx) => (
                    <div key={idx} className="border-b border-neutral-100 dark:border-neutral-900 last:border-none pb-4">
                      <button 
                        onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                        className="w-full flex items-center justify-between py-4 text-left group hover:text-blue-500 transition-colors"
                      >
                        <span className="font-bold text-lg">{faq.question}</span>
                        <IconChevronDown size={20} className={`transition-transform duration-300 ${activeFaq === idx ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {activeFaq === idx && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <p className="pb-6 text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl">
                              {faq.answer}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </section>

            </div>
          </div>

          {/* Call to action */}
          <section className="mt-40 pt-40 border-t border-neutral-100 dark:border-neutral-900 text-center">
            <h2 className="text-5xl font-black mb-8">Ready to see it in action?</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/system" className="px-12 py-4 rounded-full bg-black text-white dark:bg-white dark:text-black font-black text-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-3">
                <IconRocket className="text-orange-500" /> Launch Engine
              </a>
              <a href="https://github.com" className="px-12 py-4 rounded-full border-2 border-neutral-900 dark:border-white font-black text-lg hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all flex items-center gap-3">
                <IconBrandGithub /> Source Code
              </a>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
