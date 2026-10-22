"use client";

import { useState, useEffect } from "react";
import { OrbitalLoader } from "@/components/ui/orbital-loader";
import { AnimatePresence, motion } from "motion/react";

export function HydrationLoader() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Artificial small delay for premium feel and to ensure hydration is truly finished
    const timer = setTimeout(() => setMounted(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {!mounted && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black"
        >
          <OrbitalLoader message="Initialising MoodTunes..." />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
