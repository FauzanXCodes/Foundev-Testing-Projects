import Link from "next/link";

export function Footer() {
  return (
    <footer className="mood-footer">
      <div className="footer-content">
        {/* Left Column: Brand Statement */}
        <div className="footer-brand">
          <div className="brand-logo">MoodTunes</div>
          <p>MoodTunes — AI Emotion Detection.</p>
          <p>Revolutionizing music discovery with sentiment intelligence.</p>
        </div>

        {/* Right Columns: Links */}
        <div className="footer-links-grid">
          <div className="footer-col">
            <h4>Navigation</h4>
            <Link href="/">Home</Link>
            <Link href="/system">Visual AI</Link>
            <Link href="/text-music">Text AI</Link>
            <a href="#features">Features</a>
          </div>

          <div className="footer-col">
            <h4>Socials</h4>
            <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer">Twitter / X</a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer">YouTube</a>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <a href="mailto:hello@moodtunes.ai">Email Support</a>
            <Link href="/docs">Documentation</Link>
          </div>
        </div>
      </div>

      {/* Massive Bottom Branding */}
      <div className="footer-huge-label">
        MOODTUNES
      </div>

      <div className="footer-bottom-bar">
        <p>© 2026 MoodTunes. Built for Excellence.</p>
      </div>
    </footer>
  );
}
