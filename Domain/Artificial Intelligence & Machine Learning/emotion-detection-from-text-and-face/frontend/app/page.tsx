"use client";

import Link from "next/link";
import { useState } from "react";
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
} from "../components/ui/resizable-navbar";
import { ThemeToggle } from "../components/theme-toggle";
import { Footer } from "../components/Footer";
import { PageTour } from "../components/PageTour";

export default function LandingPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { name: "Features", link: "#features" },
    { name: "Workflow", link: "#workflow" },
    { name: "Technical", link: "#technical" },
    { name: "Docs", link: "/docs" },
    { name: "GitHub", link: "https://github.com" },
  ];

  return (
    <>
      <div className="bg-scene" />
      <PageTour />
      
      <div className="landing-shell">
        <Navbar>
          {/* Desktop Nav */}
          <NavBody>
            <NavbarLogo id="tour-logo" className="relative">
              <img src="/logo.png" alt="" className="h-8 w-auto object-contain mr-2" />
              <span className="font-extrabold text-xl tracking-tight">MoodTunes</span>
            </NavbarLogo>
            <NavItems items={navItems} />
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button id="tour-trigger" className="text-sm font-semibold hover:text-white transition-colors cursor-pointer">
                Take a Tour
              </button>
              <NavbarButton href="/system" variant="primary">
                Launch App
              </NavbarButton>
            </div>
          </NavBody>

          {/* Mobile Nav */}
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
                <a key={item.name} href={item.link} className="text-lg font-medium py-2 text-neutral-900 dark:text-white" onClick={() => setIsMobileOpen(false)}>
                  {item.name}
                </a>
              ))}
              <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800 my-2" />
              <button 
                onClick={() => {
                  setIsMobileOpen(false);
                  document.getElementById("tour-trigger")?.click();
                }}
                className="w-full text-left text-lg font-medium py-2 text-neutral-900 dark:text-white flex items-center justify-between"
              >
                Take a Tour
                <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">New</span>
              </button>
              <NavbarButton href="/system" variant="primary" className="w-full mt-4">
                Launch App
              </NavbarButton>
            </MobileNavMenu>
          </MobileNav>
        </Navbar>

        <header className="hero-lp relative" id="tour-hero">
          <h1>Music tuned to your soul.</h1>
          <p>
            Experience the next generation of music recommendation. 
            Powered by advanced Emotion AI to map your <strong>facial expressions</strong> or <strong>written thoughts</strong> to the perfect soundtrack. Now with full support for <strong>regional languages</strong> like Hindi, Bengali, and more.
          </p>
          <div className="cta-group">
            <Link href="/system" className="btn btn-primary">
              Visual Detection
            </Link>
            <Link href="/text-music" className="btn btn-secondary">
              Text Analysis
            </Link>
          </div>
        </header>

        <section id="features" className="section-lp">
          <div className="section-header text-center">
            <h2>Built for the Modern Listener.</h2>
            <p>A sophisticated blend of Computer Vision and Content Discovery.</p>
          </div>
          
          <div className="feature-grid">
            <div className="feature-card relative" id="tour-visual">
              <div className="feature-icon-wrap">
                <img src="https://unpkg.com/lucide-static@latest/icons/camera.svg" alt="Camera" className="icon-white" />
              </div>
              <h3>Visual Emotion AI</h3>
              <p>Custom-trained CNN to detect 7 distinct facial emotional states with biometric precision.</p>
            </div>
            <div className="feature-card relative" id="tour-text">
              <div className="feature-icon-wrap">
                <img src="https://unpkg.com/lucide-static@latest/icons/message-square.svg" alt="Text" className="icon-white" />
              </div>
              <h3>Text Sentiment Analysis</h3>
              <p>State-of-the-art Transformer models analyze your words to find the hidden mood in your text.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <img src="https://unpkg.com/lucide-static@latest/icons/languages.svg" alt="Region" className="icon-white" />
              </div>
              <h3>Global Regional Support</h3>
              <p>Personalized discovery across languages including Hindi, Bengali, Spanish, and English.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <img src="https://unpkg.com/lucide-static@latest/icons/smartphone.svg" alt="PWA" className="icon-white" />
              </div>
              <h3>Next-Gen PWA Experience</h3>
              <p>Install MoodTunes on your device for a lightning-fast, app-like experience with offline support.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <img src="https://unpkg.com/lucide-static@latest/icons/zap.svg" alt="Performance" className="icon-white" />
              </div>
              <h3>Ultrafast Music Delivery</h3>
              <p>Powered by Redis caching layers to ensure sub-second recommendation speeds site-wide.</p>
            </div>
          </div>
        </section>

        <section className="section-lp">
          <div className="section-header">
            <h2>The Technical Blueprint.</h2>
            <p>How we turn pixels into emotional intelligence.</p>
          </div>

          <div className="flow-container">
            <div className="flow-step">
              <div className="step-num">01</div>
              <div className="step-content">
                <h4>Multi-Modal Signal Acquisition</h4>
                <p>Capturing high-resolution facial data via webcam or analyzing linguistic sentiment through raw text input.</p>
              </div>
            </div>
            <div className="flow-step">
              <div className="step-num">02</div>
              <div className="step-content">
                <h4>Neural Engine Selection</h4>
                <p>Routing data to specialized AI architectures: CNNs for visual biometric data or Transformers for NLP sentiment.</p>
              </div>
            </div>
            <div className="flow-step">
              <div className="step-num">03</div>
              <div className="step-content">
                <h4>Deep Inference Logic</h4>
                <p>Executing proprietary H5/Keras models or BERT-based pipelines to calculate confidence scores across emotion layers.</p>
              </div>
            </div>
            <div className="flow-step">
              <div className="step-num">04</div>
              <div className="step-content">
                <h4>Intelligent Music Mapping</h4>
                <p>Scraping the global music database with sub-second delivery powered by a distributed Redis caching layer.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-lp relative" id="tour-tech">
          <div className="section-header text-center">
            <h2>Powered by Industry Standards.</h2>
            <p>Leveraging a world-class technology stack for production-grade performance.</p>
          </div>

          <div className="tech-box">
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/nextdotjs/white" width="16" /> Next.js</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/fastapi/white" width="16" /> FastAPI</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/tensorflow/white" width="16" /> TensorFlow</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/docker/white" width="16" /> Docker</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/redis/white" width="16" /> Redis</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/huggingface/white" width="16" /> Transformers</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/opencv/white" width="16" /> OpenCV</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/python/white" width="16" /> Python</div>
             <div className="tech-pill"><img src="https://cdn.simpleicons.org/tailwindcss/white" width="16" /> Tailwind CSS</div>
          </div>
        </section>

        <section className="section-lp text-center" style={{ borderBottom: "1px dashed var(--border)" }}>
           <h2 style={{ fontSize: "3rem", marginBottom: "2rem" }}>Ready to explore?</h2>
           <Link href="/system" className="btn btn-primary" style={{ padding: "1rem 3rem", fontSize: "1.1rem" }}>
              Launch MoodTunes System
           </Link>
        </section>

        <Footer />
      </div>
    </>
  );
}
