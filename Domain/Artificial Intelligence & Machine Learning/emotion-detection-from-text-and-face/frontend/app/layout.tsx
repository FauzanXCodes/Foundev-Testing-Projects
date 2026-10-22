import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "MoodTunes — AI Emotion Detection & Music Recommendation",
  description: "Upload a photo or use your webcam — our AI detects your emotion and plays matching music instantly.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MoodTunes",
  },
};

import { ThemeProvider } from "../components/theme-provider";
import { HydrationLoader } from "../components/HydrationLoader";
import { Geist } from "next/font/google";
import { cn } from "../lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="app-layout">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <HydrationLoader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
