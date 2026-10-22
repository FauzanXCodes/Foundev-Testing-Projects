# 🏗️ System Architecture

This document describes the high-level architecture of the Emotion Detection and Music Recommendation System.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                          User Interface                           │
│                      (Next.js App Router)                         │
│           Webcam Feed │ Text Input │ Language Preferences         │
└───────────────────────┬───────────────────────────────────────────┘
                        │ REST API (JSON / FormData)
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                            │
│                         backend/app.py                            │
│                                                                   │
│   ┌────────────────────┐   ┌─────────────────┐   ┌────────────┐   │
│   │ Visual AI Pipeline │   │ Text AI Pipeline│   │ Music API  │   │
│   │ (DeepFace + CNN)   │   │ (DistilBERT)    │   │ (YouTube)  │   │
│   └─────────┬──────────┘   └────────┬────────┘   └────────────┘   │
└─────────────┼───────────────────────┼───────────────────────────────┘
              │                       │
              ▼                       ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   Trained CNN Model     │  │   Transformer Model     │
│   emotion_model.h5      │  │   HuggingFace NLP       │
│   (FER2013 Dataset)     │  │   (Lazy Loaded)         │
└─────────────────────────┘  └─────────────────────────┘
```

---

## Component Breakdown

### 1. Robust Frontend (Next.js v14+)
- **Visual Module**: Captures raw video from the user's webcam or file upload, and posts binary image data to the backend.
- **Texting Module**: Highly responsive text-field interface for natural language sentiment input.
- **Interactivity**: Implements region-specific queries (Language dropdown) and modern UI loaders (`OrbitalLoader`) using `framer-motion` to keep a smooth user experience during inference wait times.

### 2. High-Performance API (FastAPI)
*Upgraded from Flask to FastAPI for out-of-the-box asynchronous concurrency and automatic OpenAPI serialization.*
- Receives HTTP payload via two main endpoints: `/predict` and `/predict-text`.
- **Optimization Strategy**: Employs "Lazy Loading" on massive NLP models so the server boots up near-instantly, only provisioning Transformer pipelines on first use.

### 3. Visual Emotion Detection (Hybrid CNN Pipeline)
- **Face Extraction Engine (DeepFace / OpenCV)**: Ensures the bounding box of the face is cleanly separated from busy backgrounds before mathematical inference occurs.
- **Custom Classifier (TensorFlow / Keras)**: A custom Convolutional Neural Network natively trained on the FER2013 dataset. It receives the 48x48 cropped face and predicts a probability distribution spanning 7 distinct emotional domains.

### 4. Text Emotion Detection (HuggingFace Transformer)
- **Architecture**: DistilBERT (`bhadresh-savani/distilbert-base-uncased-emotion`).
- **Advantage**: A robust, context-aware NLP model capable of parsing highly nuanced syntax. Capable of extrapolating underlying sadness or joy out of ambiguous sentences far better than heuristic polarity scoring like TextBlob.

### 5. Dynamic Music Recommendation Engine
- Maps extracted emotional vectors into carefully selected musical genres (e.g., "Sad" → "Acoustic / Emotional").
- Concatenates the user's explicit Regional Language preference (e.g., "Hindi") directly against the emotion keyword.
- Executes real-time web scraping against YouTube to pull live embedded video/audio, ensuring continuous access to billions of tracks without relying on stringent OAuth integrations.

---

## Technology Stack Summary

| Component          | Technology                           |
|--------------------|--------------------------------------|
| **Frontend UI**    | Next.js (React), Tailwind CSS, Framer|
| **Backend API**    | FastAPI (Python), Uvicorn            |
| **Visual Core**    | OpenCV, DeepFace                     |
| **Deep Learning**  | TensorFlow / Keras (CNN)             |
| **NLP Core**       | Transformers (PyTorch), DistilBERT   |
| **Music Domain**   | YouTube Data Request Crawler         |
| **Model Datasets** | FER2013                              |

---

*Architecture accurately reflects the modern Hybrid V3 update.*
