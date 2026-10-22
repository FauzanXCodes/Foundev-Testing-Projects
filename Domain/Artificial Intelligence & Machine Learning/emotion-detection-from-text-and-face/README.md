# MoodTunes — AI Emotion Detection & Music Recommender

*Folder id: `emotion-detection-from-text-and-face` · Upstream: `SekhSujonHaque2005/MoodTunes-AI-Emotion-Detection-and-Music-Recommendation-System` · Backend entry: `backend/app.py`*

**MoodTunes** reads your mood from a **photo of your face** or from **a line of text**, and
then finds music that matches it. The backend is a FastAPI service with three real
endpoints — `GET /health`, `POST /predict` (image) and `POST /predict-text` (text) — and
the front end in `webui/` is a dependency-free HTML/CSS/JS page that talks to it over
`fetch`.

Two different models do the reading:

- **Face** — DeepFace locates and aligns the face, a custom Keras CNN (224×224, 7 emotion
  classes) classifies it. The model file is **not in this repository**; it is downloaded
  automatically from Hugging Face the first time it is needed.
- **Text** — a DistilBERT sentiment pipeline (`bhadresh-savani/distilbert-base-uncased-emotion`)
  labels the text, and the raw label is mapped onto the same seven emotions.

The recommended tracks come from a DuckDuckGo video search restricted to
`site:youtube.com`, cached in Redis for 24 hours when a Redis server is available.

> The **MoodTunes Sessions** interface in `webui/` and this documentation were added
> later. The upstream license, authorship and Python code are preserved unchanged. The
> repository also contains an upstream Next.js front end in `frontend/` — see
> [Project Structure](#project-structure).

---

## Features

### Implemented and verified in the repository

| Feature | Where | Notes |
|---|---|---|
| Health endpoint | `backend/app.py:224-226` | `{"status": "ok", "engine": "hybrid", "model": "custom_emotion_model.h5"}` |
| Service banner | `backend/app.py:219-221` | `GET /` returns a one-line status message |
| Face emotion detection | `backend/app.py:229-297` `/predict` | DeepFace `extract_faces` (OpenCV detector, aligned) → custom CNN |
| Per-class emotion scores | `backend/app.py:128-131` | `all_emotions` = label → score, rounded to 4 decimals |
| Face-detected flag | `backend/app.py:250,268-274` | `face_detected: false` when the CNN had to classify the whole image |
| Text emotion detection | `backend/app.py:298-338` `/predict-text` | DistilBERT pipeline, labels mapped `joy→happy`, `sadness→sad`, `anger→angry`, `love→happy`, … |
| Automatic model download | `backend/model_loader.py:14-27` | Fetches `emotion_model.h5` from Hugging Face on first use |
| Keras 3 compatibility patch | `backend/model_loader.py:30-63` | Rewrites the `.h5` `model_config` (`batch_shape` → `shape`) in place with `h5py` |
| Emotion → music mapping | `backend/app.py:92-100` | `EMOTION_QUERIES` for the global case, `simplified_keywords` for a specific language |
| YouTube track search | `backend/app.py:178-203` | `ddgs` video search on `site:youtube.com …`, video id + thumbnail extraction |
| Redis caching (optional) | `backend/app.py:163-172`, `206-211` | Key `yt_cache:{emotion}:{language}`, TTL 86 400 s (24 h); degrades gracefully |
| CORS | `backend/app.py:69-75` | `allow_origins=["*"]` — the vanilla UI calls the API cross-origin |
| Lazy model loading | `backend/app.py:29-40`, `77-86` | Neither the CNN nor DistilBERT is loaded until the first request |
| Webcam capture in the browser | `webui/js/app.js:446-490` | `getUserMedia` (1280×720) → canvas → JPEG blob |
| Drag & drop / file picker | `webui/js/app.js:632-655` | Accepts `image/*`, rejects files over 20 MB |
| Live health polling | `webui/js/app.js:93-112`, `668` | `GET /health` every 15 s, 8 s timeout, plus a manual *Recheck* |
| Per-emotion theming | `webui/js/app.js:13-21`, `115-130` | Accent colours for happy/sad/angry/fear/surprise/neutral/disgust |
| Emotion score chart | `webui/js/app.js:221-248` | Sorted bars built from `all_emotions` (face mode only) |
| Now-playing band + track reel | `webui/js/app.js:255-329` | Prev/next, thumbnails, `Open on YouTube` link |
| Copy playlist | `webui/js/app.js:331-349` | Copies a formatted list of titles + URLs |
| Honest offline state | `webui/index.html:43-59` | An "Backend offline" panel with the exact start commands; **nothing is rendered before the API answers** |
| API base URL configurable | `webui/js/app.js:40-43` | Editable field, persisted in `localStorage["mt.apiBase"]` |
| Docker deployment | `docker-compose.yml`, `backend/Dockerfile` | backend :8000, frontend :3000, redis :6379 |

### Not available / requires external setup

- **`models/emotion_model.h5` is not in this repository.** `.gitignore` excludes
  `models/*.h5`; the file is downloaded on first use from
  `https://huggingface.co/sujon2005/Emotion_Detection_and_Music_Recommendation_System/resolve/main/emotion_model.h5`.
  Roughly 200 MB, per the project docs.
- **The training dataset is not in this repository.** `data/` contains only a README;
  `data/raw/*` and `data/processed/*` are git-ignored. The docs mention FER2013 for the
  CNN and the training notebook is present
  (`training/emotion-detection-and-music-recommendation-system.ipynb`), but no data and
  no trained-from-scratch weights ship with the code.
- **The DistilBERT weights are not bundled** — `transformers` downloads them from
  Hugging Face on the first text request (the UI warns that the first request can take a
  while).
- **No API keys are needed**, but an internet connection is: the model download and the
  DuckDuckGo track search both require it.
- **Redis is optional.** Without it the app logs `WARNING: Redis not connected. Caching
  disabled.` and still works, just slower.
- **No user accounts, no history, no database.** Sessions live in the browser tab only.
- **No audio playback.** The UI lists YouTube links and thumbnails; it does not embed a
  player or stream audio.
- **`webui/` and `frontend/` are two separate front ends.** The vanilla one is the
  documented path; the Next.js app in `frontend/` is the upstream one and needs Node 18+.
- **The upstream `HOW_TO_RUN.md` says CORS is restricted to `http://localhost:3000`** — it
  is not; the code allows every origin.

---

## Technology Stack

| Layer | Technology | Version / constraint |
|---|---|---|
| Web framework | FastAPI | `0.104.1` |
| ASGI server | uvicorn | `0.24.0` (with the `standard` extra) |
| Validation | pydantic | `TextRequest` model (FastAPI dependency) |
| Deep learning runtime | TensorFlow (CPU) | `tensorflow-cpu>=2.15.0` + `tf-keras` |
| Face detection | DeepFace | `deepface>=0.0.93`, OpenCV detector backend |
| Face classification | Custom Keras CNN | `models/emotion_model.h5` (downloaded, 7 classes, 224×224 input) |
| NLP | transformers + PyTorch | `bhadresh-savani/distilbert-base-uncased-emotion`, `framework="pt"` |
| Vision / numerics | OpenCV, NumPy | `opencv-python>=4.10.0.84`, `numpy>=2.0.0` |
| Search | `ddgs` (DuckDuckGo Search) | `ddgs` — `DDGS().videos(...)` |
| Cache | Redis | `redis` — optional, `REDIS_URL` / `REDIS_HOST` |
| HTTP client | requests | `>=2.31.0` (model download) |
| Model file I/O | h5py | via `model_loader.patch_h5_file_permanently()` |
| Data / plots | pandas, scikit-learn, matplotlib, seaborn | `>=2.1.3`, `>=1.3.2`, `>=3.8.2`, `>=0.13.0` |
| Front end (documented path) | Vanilla HTML5 + CSS + ES5 JavaScript | `webui/index.html`, `webui/css/style.css`, `webui/js/app.js` — no framework, no build step |
| Front end (upstream) | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui + framer-motion | `frontend/` — requires Node 18+ |
| Containerisation | Docker / docker compose | `python:3.10-slim` backend image, `next` frontend image, `redis:alpine` |

---

## Prerequisites

- **Windows 10/11** with PowerShell (commands below are Windows-first).
- **Python 3.10+** (`HOW_TO_RUN.md` states 3.10+; the Dockerfile uses `python:3.10-slim`).
- **Node.js 18+ and npm** — *only* if you want to run the upstream Next.js front end.
  The `webui/` page needs no Node at all.
- **~3 GB of free disk** for TensorFlow, PyTorch, the CNN weights and the DistilBERT
  weights.
- **An internet connection** on the first run (model downloads) and for every track search.
- **Optional:** a webcam for the face mode, and Redis for caching.

---

## Project Structure

```
emotion-detection-from-text-and-face/
├── backend/
│   ├── app.py                # FastAPI app: /, /health, /predict, /predict-text
│   ├── model_loader.py       # model download, Keras 3 patch, label loading
│   ├── __init__.py
│   └── Dockerfile            # python:3.10-slim, uvicorn backend.app:app --port 8000
├── webui/                    # ← the documented front end
│   ├── index.html            # MoodTunes Sessions
│   ├── css/style.css
│   └── js/app.js             # fetch(), webcam, theming, player, reel
├── frontend/                 # upstream Next.js app (alternative UI, needs Node)
│   ├── app/{page,layout,types,globals.css,text-music,system,docs}
│   ├── components/, lib/, public/, package.json, next.config.ts, Dockerfile
├── models/
│   └── emotion_labels.json   # PRESENT — label → index map (7 classes)
│   # emotion_model.h5 is MISSING: git-ignored, downloaded on first use
├── training/
│   └── emotion-detection-and-music-recommendation-system.ipynb
├── data/README.md            # dataset folder — raw/ and processed/ are git-ignored and empty
├── docs/architecture.md      # upstream architecture description
├── requirements.txt          # 18 pinned/ranged dependencies
├── HOW_TO_RUN.md             # upstream run guide
├── docker-compose.yml        # backend :8000 + frontend :3000 + redis :6379
├── LICENSE                   # MIT, Copyright (c) 2026 springboardmentor442n-coder
├── project-metadata.json     # id, stack, goal, license, entry point
└── .gitignore                # ignores models/*.h5, models/*.keras, data/raw/*, data/processed/*
```

Paths the code actually uses:

| Purpose | Path / value | Source |
|---|---|---|
| CNN weights | `models/emotion_model.h5` (project root) | `backend/model_loader.py:9` |
| Label map | `models/emotion_labels.json` | `backend/model_loader.py:10` |
| Model download URL | `https://huggingface.co/sujon2005/Emotion_Detection_and_Music_Recommendation_System/resolve/main/emotion_model.h5` | `backend/model_loader.py:11` |
| Text model id | `bhadresh-savani/distilbert-base-uncased-emotion` | `backend/app.py:37` |
| Redis connection | `REDIS_URL`, else `redis://$REDIS_HOST:6379/0`, else `redis://localhost:6379/0` | `backend/app.py:60` |
| Cache key | `yt_cache:{emotion}:{language.lower().replace(' ','_')}` (TTL 86 400 s) | `backend/app.py:164,208` |
| UI API base | `localStorage["mt.apiBase"]`, default `http://127.0.0.1:8000` | `webui/js/app.js:4,6,40-43` |
| UI language | `localStorage["mt.language"]` | `webui/js/app.js:5,571-576` |

---

## Installation

### 1. Create the environment

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

If PowerShell blocks the activation script:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 2. Install PyTorch (CPU build) separately

`requirements.txt` line 16 reads `torch --index-url https://download.pytorch.org/whl/cpu`,
which is **not valid pip requirement syntax** (an option cannot be attached to a
requirement name in that form). Install the CPU wheel first, then install the rest with
that line filtered out:

```powershell
pip install torch --index-url https://download.pytorch.org/whl/cpu
Get-Content requirements.txt | Where-Object { $_ -notmatch '--index-url' } | Set-Content "$env:TEMP\requirements-moodtunes.txt"
pip install -r "$env:TEMP\requirements-moodtunes.txt"
```

### 3. Linux / macOS

```bash
cd emotion-detection-from-text-and-face
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
grep -v -- '--index-url' requirements.txt > /tmp/requirements-moodtunes.txt
pip install -r /tmp/requirements-moodtunes.txt
```

### 4. Optional: the Next.js front end

```powershell
cd frontend
npm install
```

You do not need this for the `webui/` page.

### 5. Optional: Redis

```powershell
docker run -d --name moodtunes-redis -p 6379:6379 redis:alpine
```

Without Redis the API still works — it just logs `WARNING: Redis not connected. Caching
disabled.` and searches DuckDuckGo on every request.

---

## Environment Configuration

The backend reads exactly **two** environment variables. There is no `.env` file and no
`.env.example` in the repository (`.env` is git-ignored).

| Variable | Default | Read by | Effect |
|---|---|---|---|
| `REDIS_URL` | `redis://{REDIS_HOST or 'localhost'}:6379/0` | `backend/app.py:60` | Full Redis connection URL, including database index |
| `REDIS_HOST` | `localhost` | `backend/app.py:60` | Used to build the URL when `REDIS_URL` is not set |

The Docker Compose file sets `REDIS_HOST=redis` for the backend service so it reaches the
`redis` container, and `NEXT_PUBLIC_API_URL=http://localhost:8000` for the Next.js front
end. The vanilla `webui/` page does **not** use an environment variable — its backend URL
lives in the browser (`localStorage["mt.apiBase"]`, default `http://127.0.0.1:8000`).

---

## How to Launch

### 1. The backend (FastAPI)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
.\.venv\Scripts\Activate.ps1
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Run it **from the `backend/` directory** (the command above is what `HOW_TO_RUN.md` and
the UI's offline panel use — `uvicorn app:app`). Running from the project root with the
package path also works:

```powershell
python -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

- **Port 8000.** The app itself defines no port — uvicorn's default is 8000 and the
  Docker image pins `--port 8000`.
- **First run downloads the ~200 MB CNN** from Hugging Face into `models/emotion_model.h5`
  and patches it for Keras 3. The first `/predict` request can therefore take a long
  time; the first `/predict-text` request additionally downloads DistilBERT.
- **Stop with `Ctrl+C`.**

**Verify it is alive:**

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
# {"status":"ok","engine":"hybrid","model":"custom_emotion_model.h5"}
```

### 2. The MoodTunes web UI (static page)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
python -m http.server 8080 --directory webui
```

- **Port 8080** in this example — any free port works. Open <http://127.0.0.1:8080/>.
- **How the front end reaches the back end:** the page calls
  `http://127.0.0.1:8000/health`, `http://127.0.0.1:8000/predict` and
  `http://127.0.0.1:8000/predict-text` with `fetch`. The API base is editable in the
  header field and remembered in `localStorage`.
- **Stop the server with `Ctrl+C`.**

### 3. The upstream Next.js front end (optional alternative)

```powershell
cd frontend
npm install
npm run dev
```

- **Port 3000** (`next dev`), open <http://localhost:3000>.
- It talks to the same backend on port 8000.
- `npm run build` + `npm start` for a production build; `npm run lint` for ESLint.

### 4. Everything with Docker Compose

```powershell
docker compose up --build
```

- backend :8000, Next.js frontend :3000, Redis :6379.

### 5. Redis on its own (optional)

```powershell
docker run -d --name moodtunes-redis -p 6379:6379 redis:alpine
```

---

## Model and Dataset Setup

| Item | Status | Where the code expects it |
|---|---|---|
| `models/emotion_model.h5` (custom CNN, 7 classes, 224×224) | **MISSING** — git-ignored (`models/*.h5`), downloaded on first use from `https://huggingface.co/sujon2005/Emotion_Detection_and_Music_Recommendation_System/resolve/main/emotion_model.h5` | `backend/model_loader.py:9,11,16-25`; the file is written next to `models/emotion_labels.json` |
| `models/emotion_labels.json` | **PRESENT** — `{"angry":0,"disgust":1,"fear":2,"happy":3,"neutral":4,"sad":5,"surprise":6}` | `backend/model_loader.py:10,86-92`; loaded into `idx_to_label = {int(v): k}` |
| Keras 3 patch | Applied automatically to the downloaded `.h5` | `backend/model_loader.py:30-63` — rewrites `"batch_shape": [null, …]` to `"shape": […]` inside the `model_config` attribute using `h5py` |
| DistilBERT emotion model | **Not bundled** — `transformers` fetches `bhadresh-savani/distilbert-base-uncased-emotion` from Hugging Face on the first text request | `backend/app.py:35-39` |
| DeepFace | Installed as a package (`deepface>=0.0.93`); the code uses `detector_backend="opencv"`, so the face-detection path needs no extra model download | `backend/app.py:252-258` |
| Training dataset | **Not in the repository** — `data/` has only a README; `data/raw/*` and `data/processed/*` are git-ignored. The docs mention FER2013 for the CNN | `data/`, `training/emotion-detection-and-music-recommendation-system.ipynb` |
| Retraining | Not part of the runtime path — the notebook is the only training artefact and it needs the missing dataset | `training/` |

To place the CNN manually instead of downloading it, put the file at
`models/emotion_model.h5`; `download_model()` skips the fetch when the file already exists.

---

## Usage

### Text mood

1. Open the page. The header shows a health pill — it should read **connected** within a
   second or two. If it says *offline*, the offline panel shows the exact commands to
   start the backend.
2. Stay on the **Text mood** tab.
3. Type how you feel (minimum 3 characters, maximum 2000) — for example:
   *“The sunset today was breathtakingly beautiful, I feel so at peace.”*
4. Optionally pick a **Music region** (Any, English, Hindi, Bengali, Spanish, Punjabi,
   Tamil, Telugu, K-Pop, Anime/J-Pop). The choice is remembered for both tabs.
5. Press **Read my mood** (or `Ctrl`/`⌘` + `Enter`).
6. The stage shows the emotion title, a confidence bar, the raw transformer label chip
   (e.g. *transformer label: joy*) and the track list. The first request may take a
   while while DistilBERT is downloaded and loaded.

### Face mood

1. Switch to the **Face mood** tab.
2. Drag & drop a photo, click the drop zone to browse, or press **Use webcam** → **Capture
   frame**. The webcam path requests 1280×720 and converts the frame to a JPEG blob in the
   browser.
3. Images must be `image/*` and under 20 MB.
4. Press **Analyze face**.
5. The result shows the emotion, the confidence, a warning chip if no face was detected
   (*“no face detected — the CNN classified the full image”*), and the **Model output —
   all emotions** bar chart built from `all_emotions`.
6. Use the now-playing band (prev/next) and the **Session reel** to browse the returned
   tracks; **Copy playlist** copies a formatted list of titles and YouTube links.

### Reading the results

- `emotion` is one of `happy, sad, angry, fear, surprise, neutral, disgust` (text mode maps
  the transformer's labels onto the same seven).
- `confidence` is a 0–1 number, rendered as a percentage.
- `all_emotions` (face mode) contains the score of every class.
- `songs` is a list of `{title, video_id, thumbnail, channel, duration}`.

---

## API Documentation

Base URL: `http://127.0.0.1:8000`. Interactive docs are served by FastAPI at
`/docs` (Swagger UI) and `/redoc`.

### `GET /`

| | |
|---|---|
| **Request** | none |
| **Response 200** | `{"message": "Emotion Detection API is running (Hybrid v3 — DeepFace + Custom CNN)"}` |
| **Errors** | none |

### `GET /health`

| | |
|---|---|
| **Request** | none |
| **Response 200** | `{"status": "ok", "engine": "hybrid", "model": "custom_emotion_model.h5"}` |
| **Errors** | none |

> The `model` field reports the *logical* name of the engine. The file on disk is
> `models/emotion_model.h5` — the two names do not match.

### `POST /predict`

| | |
|---|---|
| **Request** | `multipart/form-data` — `file` (image, required) and `language` (form field, default `"Any"`) |
| **Response 200** | `{"emotion": "happy", "confidence": 0.8731, "face_detected": true, "all_emotions": {"angry": 0.01, …}, "songs": [{"title": "…", "video_id": "…", "thumbnail": "https://img.youtube.com/vi/<id>/hqdefault.jpg", "channel": "…", "duration": "…"}]}` |
| **Errors** | `400 {"detail": "Invalid image file"}` when the bytes cannot be decoded; `500 {"detail": "<exception message>"}` for anything else (including a model that failed to load — `"AI Model failed to initialize. Try again in a few seconds."`) |

Notes: the upload is written to a temporary `.jpg` for DeepFace and deleted in the
`finally` block. If DeepFace cannot find a face, the **whole image** is classified and
`face_detected` is `false`.

### `POST /predict-text`

| | |
|---|---|
| **Request** | `application/json` — `{"text": "…", "language": "Any"}` (`text` required, `language` optional) |
| **Response 200** | `{"emotion": "happy", "raw_label": "joy", "confidence": 0.9912, "text_analyzed": "…", "songs": [ … ]}` |
| **Errors** | `400 {"detail": "Text cannot be empty"}` for empty text; `500 {"detail": "<exception message>"}` otherwise |

> Known behaviour: the empty-text `HTTPException(400)` is raised inside the `try` block
> whose `except Exception` handler converts every exception into a `500`. An empty text
> therefore surfaces as **HTTP 500** with the detail string
> `400: Text cannot be empty`. The web UI blocks empty input client-side, so you only
> see this when calling the API directly.

### CORS

`backend/app.py:69-75` configures `CORSMiddleware(allow_origins=["*"],
allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`. The `webui/` page is
served from a different origin than the API, so this is what lets the page call it.
(Wildcard origin plus credentials is a combination browsers reject for *credentialed*
requests; the UI uses plain `fetch()` without credentials, so it works. The upstream
`HOW_TO_RUN.md` claim that CORS is limited to `http://localhost:3000` is inaccurate.)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pip install -r requirements.txt` fails on the `torch` line | `torch --index-url …` is not valid requirement syntax | Install torch separately, then install a filtered copy of the file (see [Installation](#installation)) |
| `ImportError: cannot import name 'X' from 'numpy'` | `numpy>=2.0.0` vs. an older TensorFlow | Upgrade to `tensorflow>=2.16` (NumPy 2 support) or pin `numpy<2` and adjust |
| `ModuleNotFoundError: No module named 'backend'` | uvicorn started from the wrong directory | Run `python -m uvicorn app:app …` from inside `backend/`, or `backend.app:app` from the project root |
| `500 AI Model failed to initialize. Try again in a few seconds.` | The CNN could not be downloaded or loaded | Check the console for `CRITICAL: Failed to load .h5 model: …`, verify the internet connection and that `models/` is writable, then re-check `models/emotion_model.h5` exists |
| First `/predict` hangs for minutes | The ~200 MB model is downloading and Keras is patching the file | Wait; the console prints `Downloading emotion model from HuggingFace to …` and `Model downloaded successfully.` |
| `Keras 3` / `batch_shape` load error | The `.h5` was saved by an older Keras | The loader patches it automatically; if `patch_h5_file_permanently()` warned, delete `models/emotion_model.h5` and let it be re-downloaded and re-patched |
| UI shows the orange "Backend offline" panel | `uvicorn` is not running, or the API base is wrong | Start the backend on port 8000, then press *Recheck*; check the **Backend URL** field in the header |
| UI: *Cannot reach …/predict-text* | Wrong base URL or the backend is on another host/port | Edit the **Backend URL** field (it is saved in `localStorage["mt.apiBase"]`) |
| UI: *Timed out after 30 s* | The first request is still loading a model | The UI says so explicitly — wait for the download to finish and retry |
| Empty text returns HTTP 500 instead of 400 | The `except Exception` handler swallows the 400 | Known bug; the UI prevents it by requiring ≥ 3 characters |
| `Camera unavailable — permission denied` | The browser blocked the webcam | Allow camera access for the page's origin (serve over `http://localhost` or HTTPS), then press **Use webcam** again |
| Webcam does not work from `http://127.0.0.1:8080` | Some browsers restrict `getUserMedia` to secure contexts | Use `http://localhost:8080`, or fall back to a photo file |
| Tracks never appear | DuckDuckGo returned no YouTube results, or the search failed | The backend prints the traceback and returns `[]`; the UI then says *"no tracks returned for this mood"*. Check the uvicorn console |
| `WARNING: Redis not connected. Caching disabled.` | No Redis server | Expected and harmless — start Redis on 6379 or set `REDIS_URL` |
| `Access-Control-Allow-Origin` error in the browser console | Stale cached page or a proxy rewriting headers | Hard-reload the page; the API must answer `/health` with the CORS headers |
| Docker build fails on `requirements.txt` | The `torch --index-url` line | Build a filtered requirements file first and adjust the Dockerfile accordingly |

---

## Limitations

- **The CNN weights and the training dataset are not in the repository** — the app
  depends on a Hugging Face download at first use, and the model cannot be retrained from
  the shipped code alone.
- **First-run cost is high** — several hundred megabytes of downloads, and a long first
  request per modality.
- **Emotion recognition from faces is a coarse, seven-class estimate**; the CNN was
  trained on FER2013-style data, so it is unreliable outside frontal, well-lit, aligned
  faces.
- **The text model is English-only** (`distilbert-base-uncased-emotion`). The `language`
  field only affects the *music* queries, not the text analysis.
- **The `language` selector changes the search terms, not the classifier** — a Hindi
  sentence is still classified by an English model.
- **Track search scrapes DuckDuckGo** and is not an official YouTube API; it can be
  rate-limited and it breaks if DuckDuckGo changes its markup.
- **No audio playback** — links and thumbnails only.
- **No persistence**: no accounts, no history, no database. Reloading the page loses the
  session.
- **CORS is wide open** (`allow_origins=["*"]`), which is fine for a local demo and
  wrong for a public deployment.
- **The `SECRET`/auth story does not exist** — there is no authentication on any
  endpoint, so anyone who can reach port 8000 can run inference.
- **Redis caching keys on emotion + language only**, so two different users get the same
  track list, and a change in the search backend is not noticed for up to 24 hours.
- **The empty-text 400 becomes a 500** (see above).
- **`/health` reports a model name that does not match the file on disk** — a small but
  real inconsistency in the API contract.
- **The Next.js front end and the vanilla `webui/` are not kept in sync** — two UIs, one
  API.
- **The `training/` notebook and `docs/architecture.md` are upstream artefacts** that
  describe an earlier design (they mention FER2013 and a Next.js-only front end).

---

## License and Credits

- **Upstream project:** *MoodTunes: AI-Powered Emotion Detection & Music Recommender* —
  <https://github.com/SekhSujonHaque2005/MoodTunes-AI-Emotion-Detection-and-Music-Recommendation-System>.
- **License:** MIT — see `LICENSE`, *Copyright (c) 2026 springboardmentor442n-coder*. The
  license and authorship are preserved unchanged.
- **Added later (not part of the upstream release):** the **MoodTunes Sessions** interface
  in `webui/` (`index.html`, `css/style.css`, `js/app.js`) and this `README.md` /
  `PROJECT_OVERVIEW.md`. The upstream Python code (`backend/app.py`,
  `backend/model_loader.py`) and the Next.js `frontend/` are unmodified.
- **Third-party components and models:** FastAPI (MIT), uvicorn (BSD-3-Clause),
  TensorFlow (Apache-2.0), tf-keras (Apache-2.0), DeepFace (MIT), transformers (Apache-2.0),
  PyTorch (BSD-3-Clause), OpenCV (Apache-2.0), DuckDuckGo Search `ddgs` (MIT), Redis (BSD-3-Clause),
  Next.js / React (MIT). The CNN weights are hosted on Hugging Face by
  `sujon2005`; the DistilBERT checkpoint is `bhadresh-savani/distilbert-base-uncased-emotion`.
  YouTube links returned by the search point at third-party content — the project does
  not host or license any media.
