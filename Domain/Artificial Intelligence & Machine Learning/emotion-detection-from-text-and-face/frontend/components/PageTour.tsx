"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect } from "react";

export const PageTour = () => {
  useEffect(() => {
    const tourTrigger = document.getElementById("tour-trigger");
    
    const driverObj = driver({
      showProgress: true,
      animate: true,
      steps: [
        { 
          element: "#tour-logo", 
          popover: { 
            title: "Welcome to MoodTunes", 
            description: "Your AI-powered ecosystem for emotion-based music discovery.",
            side: "bottom", 
            align: "start" 
          } 
        },
        { 
          element: "#tour-hero", 
          popover: { 
            title: "Tuned to Your Soul", 
            description: "Detect emotions from your webcam or your written text. We support regional languages too!",
            side: "bottom", 
            align: "center" 
          } 
        },
        { 
          element: "#tour-visual", 
          popover: { 
            title: "Live Visual AI", 
            description: "Our custom CNN analyzes 7 distinct facial emotional states with biometric precision.",
            side: "top", 
            align: "center" 
          } 
        },
        { 
          element: "#tour-text", 
          popover: { 
            title: "Sentiment Intelligence", 
            description: "Transformers process your text to find the hidden mood in your writing.",
            side: "top", 
            align: "center" 
          } 
        },
        { 
          element: "#tour-tech", 
          popover: { 
            title: "Premium Tech Stack", 
            description: "Built with Next.js, FastAPI, TensorFlow, Redis, and Docker for industrial-grade performance.",
            side: "top", 
            align: "center" 
          } 
        },
      ],
    });

    const startTour = () => {
      driverObj.drive();
    };

    if (tourTrigger) {
        tourTrigger.addEventListener("click", startTour);
    }

    // Auto-start for first-time visitors
    const hasSeenTour = localStorage.getItem("moodtunes-tour-seen");
    if (!hasSeenTour) {
        setTimeout(() => {
            driverObj.drive();
            localStorage.setItem("moodtunes-tour-seen", "true");
        }, 2000);
    }

    return () => {
      if (tourTrigger) {
        tourTrigger.removeEventListener("click", startTour);
      }
    };
  }, []);

  return null;
};
