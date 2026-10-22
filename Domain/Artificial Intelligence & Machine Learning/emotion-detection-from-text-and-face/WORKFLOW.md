# MoodTunes (emotion-detection-from-text-and-face) — Setup & Test Workflow

**Folder id:** `emotion-detection-from-text-and-face`
**UI name:** MoodTunes
**Stack:** FastAPI 0.104.1 · uvicorn[standard] 0.24.0 · TensorFlow-CPU ≥ 2.15 + `tf-keras` · DeepFace ≥ 0.0.93 · transformers + PyTorch · OpenCV · redis · ddgs · Next.js 16 / React 19 / Tailwind 4 (frontend) · vanilla HTML/CSS/JS (webui)
**Entry point:** `backend/app.py` (FastAPI, `backend.app:app`)

**What it actually is:** a hybrid emotion-to-music API with two front ends.
- **Face mode** (`POST /predict`): uploads an image → DeepFace extracts/aligns the face →
  a custom CNN (Keras `.h5`) classifies the emotion → DuckDuckGo video search returns
  matching YouTube tracks.
- **Text mode** (`POST /predict-text`): a DistilBERT text-classification pipeline
  (`bhadresh-savani/distilbert-base-uncased-emotion`) labels the text → the same music
  lookup runs.
- Results are cached in **Redis** for 24 h when a Redis server is available; the app works
  without Redis (it logs a warning and disables caching).

**Runtime surfaces:**

| Surface | Kind | Port | Notes |
|---|---|---|---|
| `backend/app.py` | FastAPI (uvicorn) | 8000 | The real backend |
| `webui/` | Static page | 8080 | Vanilla JS; talks to `http://127.0.0.1:8000` |
| `frontend/` | Next.js 16 (React 19) | 3000 | `npm run dev`; needs Node 18+ |
| Redis | Optional cache | 6379 | `docker run -d --name moodtunes-redis -p 6379:6379 redis:alpine` |
| `docker compose up --build` | All three | 8000 / 3000 / 6379 | |

---

### 1. Prerequisites

- **Windows 10/11** with PowerShell (commands below are Windows-first).
- **Python 3.10+** — `HOW_TO_RUN.md` states 3.10+ and the backend `Dockerfile` uses
  `python:3.10-slim`.
- **Node.js 18+ and npm** — *only* for the `frontend/` Next.js app. The `webui/` page needs
  no Node at all.
- **~3 GB of free disk** for TensorFlow, PyTorch, the CNN weights and the DistilBERT model.
- **Internet access on first run** — two separate downloads happen lazily:
  - `models/emotion_model.h5` (~200 MB) is fetched from HuggingFace by
    `backend/model_loader.py:11` (`MODEL_URL`) on the first image prediction.
  - `bhadresh-savani/distilbert-base-uncased-emotion` is fetched by HuggingFace
    `transformers` on the first text prediction.
- **Optional:** a webcam for the `webui/` face-capture mode (the browser blocks camera
  access on non-HTTPS/non-localhost origins — `webui/js/app.js:450` says so explicitly).
- **Optional:** Docker Desktop for the compose path and for Redis.
- **No API key** is needed for anything — the music lookup scrapes DuckDuckGo video
  results, not the YouTube Data API.

**Environment variables actually read by the backend:**

| Variable | Default | Read at | Effect |
|---|---|---|---|
| `REDIS_URL` | *(unset)* | `backend/app.py:60` | Full Redis connection URL, including the database index |
| `REDIS_HOST` | `localhost` | `backend/app.py:60` | Used to build `redis://<host>:6379/0` when `REDIS_URL` is unset |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | `frontend/app/text-music/page.tsx:21`, `frontend/app/system/page.tsx:20` | API base baked into the Next.js bundle at build time |

The `webui/` page's API base is browser-side: `localStorage["mt.apiBase"]`, default
`http://127.0.0.1:8000` (`webui/js/app.js:4,6,40-43`), and it is also editable in the page
itself via the `#apiBase` text input (`webui/index.html:28`).

---

### 2. Installation and Setup

#### 2a. Backend (Python)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

> **Important — `requirements.txt` line 16 is not valid pip syntax.**
> It reads `torch --index-url https://download.pytorch.org/whl/cpu`, which pip cannot parse
> (a requirements file takes only `name [extras] version` per line). `pip install -r
> requirements.txt` will fail on that line. Install PyTorch **separately** and then install
> the rest from a filtered copy of the file.

```powershell
# 1. PyTorch (CPU build) — install on its own
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu

# 2. The remaining dependencies, with the broken torch line removed
$req = Get-Content .\requirements.txt | Where-Object { $_ -notmatch '^\s*torch\s+--index-url' }
$req | Set-Content -Path "$env:TEMP\requirements-moodtunes.txt" -Encoding utf8
python -m pip install -r "$env:TEMP\requirements-moodtunes.txt"
```

Confirm the heavy stack imported correctly:

```powershell
python -c "import fastapi, uvicorn, tensorflow, cv2, deepface, transformers, redis, ddgs; print('backend stack ok')"
```

> **Version caveat:** `requirements.txt` pins `numpy>=2.0.0` alongside
> `tensorflow-cpu>=2.15.0`. TensorFlow 2.15–2.19 wheels are built against NumPy 1.x and can
> raise "A module that was compiled using NumPy 1.x cannot be run in NumPy 2.x" at import
> time. If that happens, pin `numpy<2` (e.g. `python -m pip install "numpy<2"`) — the
> backend code does not require NumPy 2.

#### 2b. Frontend A — Next.js (optional)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face\frontend"
npm install
```

Node v22.15.0 / npm 11.6.3 are present in this environment. `package.json` pins
`next@^16.2.1`, `react@19.2.3`, `react-dom@19.2.3`, Tailwind 4 and `@tailwindcss/postcss`.

#### 2c. Frontend B — static `webui/` (no build step)

Nothing to install. Serve it from the project root:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
python -m http.server 8080 --directory webui
```

#### 2d. Optional — Redis cache

```powershell
docker run -d --name moodtunes-redis -p 6379:6379 redis:alpine
docker ps --filter name=moodtunes-redis
```

Without Redis the API still works — it prints
`WARNING: Redis not connected. Caching disabled. Error: ...` and serves every request from
DuckDuckGo.

#### 2e. Models

| File | Status | Behaviour |
|---|---|---|
| `models/emotion_model.h5` | **Missing** | Auto-downloaded from HuggingFace on the first image prediction (`backend/model_loader.py:14-27`). Needs internet. |
| `models/emotion_labels.json` | **Present** | `{"angry":0,"disgust":1,"fear":2,"happy":3,"neutral":4,"sad":5,"surprise":6}` — index → label map used by `classify_emotion()` |
| DistilBERT text model | **Not a file** | Downloaded into the HuggingFace cache on the first `/predict-text` call |

`backend/model_loader.py` also **permanently patches** the downloaded `.h5` in place to make
it Keras 3 compatible (`patch_h5_file_permanently()`, lines 30-63) — it rewrites
`"batch_shape"` to `"shape"` in the HDF5 `model_config` attribute. This is automatic; no
manual step is needed.

#### 2f. Docker (optional, all-in-one)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
docker compose up --build
```

`docker-compose.yml` starts three services: `redis` (:6379), `backend` (:8000, built from
`backend/Dockerfile`, `REDIS_HOST=redis`) and `frontend` (:3000,
`NEXT_PUBLIC_API_URL=http://localhost:8000`).

> **Note:** `backend/Dockerfile` does `RUN pip install --no-cache-dir -r requirements.txt`
> on the *root* `requirements.txt`, which still contains the invalid `torch --index-url`
> line. The image build will fail at that step until that line is corrected.

**There is no `.env` file.** Configuration is via the three environment variables above.

---

### 3. Launch the Complete Project

#### 3a. Backend — run from the project root

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

- **Port 8000.**
- **Run from the project root.** `backend/app.py` imports `from backend.model_loader import ...`
  with a fallback to `from model_loader import ...`, and `backend/model_loader.py` resolves
  `models/` relative to its own parent directory — so the module path `backend.app:app` must
  be resolvable from the root.
- **Start-up log, in order:**

```
Redis caching connected successfully.      <- only if Redis is running
WARNING: Redis not connected. Caching disabled. Error: ...   <- if not
INFO:     Uvicorn running on http://0.0.0.0:8000
```

- The CNN and the DistilBERT pipeline are **lazy-loaded** — `Initializing Visual Emotion
  Engine (Lazy Load)...` appears on the first `/predict`, and `Initializing heavy text
  transformer model (Lazy Load)...` on the first `/predict-text`. Each first call is slow
  (model download + load).
- **Stop with `Ctrl+C`.**

**Alternative starts** (both from the project root, for the same reason):

```powershell
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000   # from inside .\backend
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000     # without --reload
```

#### 3b. Frontend B — the static `webui/` page

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
python -m http.server 8080 --directory webui
```

- **Port 8080.** Open <http://127.0.0.1:8080/>.
- The page's API base defaults to `http://127.0.0.1:8000`; it can be changed live in the
  `#apiBase` text box and is persisted to `localStorage["mt.apiBase"]`.
- Use **Recheck** in the page to verify connectivity to the backend.
- **Stop with `Ctrl+C`.**

#### 3c. Frontend A — the Next.js app

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face\frontend"
npm run dev
```

- **Port 3000.** Open <http://localhost:3000/>.
- API base: `process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"` — the default
  already matches a local backend on port 8000, so no `.env` is needed for local use. To
  point elsewhere, create `frontend/.env.local` with
  `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` **before** `npm run dev` (the variable is
  inlined at build time).
- Pages: `/` (landing), `/text-music`, `/system`, `/docs`.
- **Stop with `Ctrl+C`.**

#### 3d. Everything at once (Docker)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face"
docker compose up --build
```

Backend :8000 · Frontend :3000 · Redis :6379.

---

### 4. Test the Project

#### 4a. Automated tests — there are none

This project ships **no test files** and no test runner configuration. Every check below is
manual. (`requirements.txt` contains no `pytest`.)

#### 4b. Backend HTTP endpoints

Start the backend (Section 3a), then in a **second** PowerShell window:

| # | Method | Path | Example input | Expected output |
|---|---|---|---|---|
| 1 | `GET` | `/` | *(none)* | `200` · `{"message":"Emotion Detection API is running (Hybrid v3 — DeepFace + Custom CNN)"}` |
| 2 | `GET` | `/health` | *(none)* | `200` · `{"status":"ok","engine":"hybrid","model":"custom_emotion_model.h5"}` |
| 3 | `POST` | `/predict` | `multipart/form-data` with `file` = a JPEG/PNG face photo and `language=Any` | `200` · `{"emotion":"happy","confidence":0.87,"face_detected":true,"all_emotions":{"angry":0.01,...},"songs":[{"title":"...","video_id":"...","thumbnail":"https://img.youtube.com/vi/<id>/hqdefault.jpg","channel":"...","duration":"..."}]}` |
| 4 | `POST` | `/predict` | `file` = a **non-image** file (e.g. a `.txt`) | `400` · `{"detail":"Invalid image file"}` |
| 5 | `POST` | `/predict` | `file` = a photo with no detectable face | `200` with `"face_detected": false` — the full image is used as the fallback crop, and `classify_emotion()` still runs |
| 6 | `POST` | `/predict` | `file` = a valid face photo, `language=Indonesian` | `200` with `"songs"` — the query becomes `site:youtube.com Indonesian happy songs` (simple keyword per region) instead of the default English phrase |
| 7 | `POST` | `/predict-text` | JSON `{"text":"I am so happy and excited today!","language":"Any"}` | `200` · `{"emotion":"happy","raw_label":"joy","confidence":0.99,"text_analyzed":"I am so happy and excited today!","songs":[...]}` |
| 8 | `POST` | `/predict-text` | JSON `{"text":"   ","language":"Any"}` | ⚠ **`500`**, not `400`. `HTTPException(400, "Text cannot be empty")` is raised *inside* the `try` block and is then caught by the blanket `except Exception` (`backend/app.py:336`), which re-raises it as `500` with `{"detail":"400: Text cannot be empty"}`. The status code is a code defect, not a setup problem |
| 9 | `POST` | `/predict-text` | JSON `{"text":"I am terrified","language":"Any"}` | `200` with `"emotion":"fear"` and `"raw_label":"fear"` — the label map (`joy→happy`, `sadness→sad`, `anger→angry`, `love→happy`, else `neutral`) is applied at `backend/app.py:314-323` |
| 10 | `GET` | `/docs` | *(none)* | `200` — the auto-generated FastAPI OpenAPI UI (Swagger) |

Concrete PowerShell invocations:

```powershell
# 1 & 2 — liveness
Invoke-RestMethod http://127.0.0.1:8000/
Invoke-RestMethod http://127.0.0.1:8000/health

# 3 — image prediction (supply any real face photo)
$img = "C:\path\to\face.jpg"
Invoke-RestMethod -Uri http://127.0.0.1:8000/predict -Method POST `
  -Form @{ file = Get-Item $img; language = "Any" }

# 4 — invalid image (expect a 400 with "Invalid image file")
Set-Content -Path "$env:TEMP\notanimage.txt" -Value "hello"
try {
  Invoke-RestMethod -Uri http://127.0.0.1:8000/predict -Method POST `
    -Form @{ file = Get-Item "$env:TEMP\notanimage.txt"; language = "Any" }
} catch { $_.ErrorDetails.Message }

# 7 & 8 — text prediction (empty text should 400)
Invoke-RestMethod -Uri http://127.0.0.1:8000/predict-text -Method POST `
  -ContentType "application/json" -Body '{"text":"I am so happy and excited today!","language":"Any"}'
try {
  Invoke-RestMethod -Uri http://127.0.0.1:8000/predict-text -Method POST `
    -ContentType "application/json" -Body '{"text":"   ","language":"Any"}'
} catch { $_.ErrorDetails.Message }
```

> `Invoke-RestMethod -Form` requires **PowerShell 6+** (Windows PowerShell 5.1 does not have
> `-Form`). On Windows PowerShell 5.1 use `curl.exe` instead:
>
> ```powershell
> curl.exe -X POST -F "file=@C:\path\to\face.jpg" -F "language=Any" http://127.0.0.1:8000/predict
> curl.exe -X POST -H "Content-Type: application/json" -d "{\"text\":\"I am so happy today!\"}" http://127.0.0.1:8000/predict-text
> ```

#### 4c. Redis cache behaviour

| # | Step | Expected output |
|---|---|---|
| 1 | Start Redis, then start the backend | `Redis caching connected successfully.` in the startup log |
| 2 | Run the same `/predict-text` request twice with the same emotion and language | First call logs `[CACHE MISS] Fetching fresh data via DuckDuckGo Semantic Search for query: '...'`; second logs `[CACHE HIT] Returning results from Redis for key: yt_cache:<emotion>:<language>` and returns the identical `songs` array faster |
| 3 | Stop Redis and restart the backend | `WARNING: Redis not connected. Caching disabled.` — and every endpoint still works |

Cache key format: `yt_cache:{emotion}:{language}` with a 24 h (86 400 s) TTL
(`backend/app.py:164`, `backend/app.py:208`).

#### 4d. Frontend checks

**`webui/` (static, port 8080):**

| # | Action | Expected output |
|---|---|---|
| 1 | Open <http://127.0.0.1:8080/> | The MoodTunes page renders with an API-base field pre-filled with `http://127.0.0.1:8000` |
| 2 | Click **Recheck** with the backend running | The status line reports the backend is reachable and `/health` returns `{"status":"ok"}` |
| 3 | Click **Recheck** with the backend stopped | The status line reports the failure; the page itself still loads |
| 4 | Type a sentence, submit in text mode | The predicted emotion, its confidence and a list of song cards appear |
| 5 | Upload a face photo or use the camera, submit in face mode | The predicted emotion, a bar for each of the seven `all_emotions` scores, and the song cards appear |
| 6 | Use the camera on a non-localhost origin | The page shows *"Camera API unavailable here — serve this page over localhost/https, or drop a photo file instead."* |

**`frontend/` (Next.js, port 3000):**

| # | Action | Expected output |
|---|---|---|
| 1 | Open <http://localhost:3000/> | The Next.js landing page renders |
| 2 | Open <http://localhost:3000/text-music> | The text-analysis UI; submitting calls `POST {API_BASE}/predict-text` |
| 3 | Open <http://localhost:3000/system> | The image-analysis UI; submitting calls `POST {API_BASE}/predict` as multipart form data |
| 4 | Stop the backend and submit | A visible error from the fetch — the API base is the one compiled in (`http://127.0.0.1:8000` by default) |
| 5 | `npm run build` | The production build succeeds (use this to type-check the TypeScript pages) |

#### 4e. What is *not* tested here

- There is **no** automated test for any endpoint, the model loader, the label map or the
  cache.
- The `/predict` and `/predict-text` happy paths depend on the network (model download on
  first call, DuckDuckGo on every cache miss), so they cannot be asserted offline.
- The seven emotion labels are asserted only by the shape of the response; the *accuracy*
  of the CNN against a specific face is not reproducible without the reference model.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pip install -r requirements.txt` fails with `Invalid requirement: 'torch --index-url ...'` | `requirements.txt` line 16 is not valid pip syntax | Install `python -m pip install torch --index-url https://download.pytorch.org/whl/cpu` separately, then install a filtered copy of the file (see Section 2a) |
| `A module that was compiled using NumPy 1.x cannot be run in NumPy 2.x` | `numpy>=2.0.0` vs. a TensorFlow 2.15–2.19 wheel built against NumPy 1.x | `python -m pip install "numpy<2"` |
| `ModuleNotFoundError: No module named 'backend'` | The server was started from the wrong directory | Run `python -m uvicorn backend.app:app ...` from the **project root** |
| `ModuleNotFoundError: No module named 'app'` | Running `uvicorn app:app` from the project root | Either `cd .\backend` first, or use the `backend.app:app` module path from the root |
| `WARNING: Redis not connected. Caching disabled.` | No Redis server running | Start it (`docker run -d --name moodtunes-redis -p 6379:6379 redis:alpine`) or ignore — caching is optional |
| `redis.exceptions.ConnectionError` on startup | `REDIS_HOST` points somewhere unreachable | `Remove-Item Env:REDIS_HOST` / set `REDIS_URL` correctly, or unset both |
| `CRITICAL: Failed to load .h5 model: ...` | The HuggingFace download failed (no internet / blocked) or the file is corrupt | Check connectivity, delete `models/emotion_model.h5` and let it re-download, or download it manually from the `MODEL_URL` in `backend/model_loader.py:11` into `models/` |
| `ConnectionError` to HuggingFace on the first `/predict-text` | The DistilBERT model download failed | Ensure internet access; the model is cached in the HuggingFace cache after the first success |
| The first `/predict` call takes minutes | It downloads ~200 MB of CNN weights and loads TensorFlow | Expected on a cold start; subsequent calls are fast |
| `{"detail":"Invalid image file"}` | The upload was not a decodable image | Use a real JPEG/PNG |
| `face_detected` is `false` | DeepFace found no face (or raised) — the full image is used as the fallback crop | Use a clear, front-facing, well-lit photo |
| `songs` is an empty array | The DuckDuckGo search returned nothing, or was blocked | Check the backend console for the traceback; the lookup requires internet and a non-blocked DuckDuckGo response |
| `POST /predict-text` returns `500` with a transformer error | The pipeline failed to load | Check the backend log for the real exception; usually a failed model download or a torch/transformers version clash |
| CORS error in the browser console | The frontend origin is not in the allowed list | `backend/app.py:69-75` sets `allow_origins=["*"]`, so a CORS error usually means the request never reached the backend — check that it is running on port 8000 |
| `webui` page shows *"Camera API unavailable here"* | The page is not served from localhost/https | Serve it with `python -m http.server 8080 --directory webui` and open `http://127.0.0.1:8080/` |
| `webui` page cannot reach the backend | Wrong API base | Edit the `#apiBase` field in the page, or clear `localStorage["mt.apiBase"]` |
| Next.js page posts to the wrong host | `NEXT_PUBLIC_API_URL` is compiled in at build time | Set it in `frontend/.env.local` and restart `npm run dev` |
| `docker compose build` fails on the backend image | `backend/Dockerfile` installs the root `requirements.txt`, including the invalid torch line | Fix line 16 of `requirements.txt` (or pre-build an image with torch installed separately) |
| `docker compose up` frontend cannot reach the backend | The browser runs on the host, not in the compose network | `NEXT_PUBLIC_API_URL=http://localhost:8000` is already set for the frontend service; confirm the backend is published on host port 8000 |
| Port 8000 / 3000 / 8080 already in use | Another process holds the port | Stop it, or use `--port 8010` / `npm run dev -- -p 3010` / `python -m http.server 8090` |

---

### 6. Verification Checklist

**Prerequisites and environment**

- [ ] Windows 10/11 and PowerShell are available.
- [ ] Python 3.10+ is in use (`python --version`).
- [ ] Node.js 18+ and npm are installed (only needed for `frontend/`).
- [ ] Roughly 3 GB of free disk is available for TensorFlow, PyTorch and the models.
- [ ] The machine has internet access for the first-run model downloads.
- [ ] The working directory is `N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\emotion-detection-from-text-and-face`.

**Backend installation**

- [ ] `.venv\Scripts\Activate.ps1` completes.
- [ ] `python -m pip install torch --index-url https://download.pytorch.org/whl/cpu` succeeded.
- [ ] The invalid `torch --index-url` line was excluded from the requirements install (the install completed without `Invalid requirement`).
- [ ] `python -c "import fastapi, uvicorn, tensorflow, cv2, deepface, transformers, redis, ddgs"` succeeds.
- [ ] No NumPy-1.x/2.x binary incompatibility error appears on `import tensorflow`.
- [ ] `models\emotion_labels.json` is present and contains the seven labels (angry, disgust, fear, happy, neutral, sad, surprise).

**Optional Redis**

- [ ] `docker run -d --name moodtunes-redis -p 6379:6379 redis:alpine` was executed, or the absence of Redis is a deliberate choice.
- [ ] `docker ps --filter name=moodtunes-redis` shows the container running.

**Backend launch**

- [ ] `python -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000` starts from the project root.
- [ ] The startup log shows `Redis caching connected successfully.` **or** the `WARNING: Redis not connected` fallback.
- [ ] `INFO: Uvicorn running on http://0.0.0.0:8000` appears.
- [ ] `Ctrl+C` stops the server cleanly.

**Automated tests**

- [ ] It is understood that this project ships **no** automated test suite and `pytest` is not a dependency.

**Endpoint checks**

- [ ] `GET /` → `200` with the "Emotion Detection API is running" message.
- [ ] `GET /health` → `200` with `{"status":"ok","engine":"hybrid","model":"custom_emotion_model.h5"}`.
- [ ] `POST /predict` with a face photo → `200` with `emotion`, `confidence`, `face_detected`, `all_emotions` (7 keys) and `songs`.
- [ ] `POST /predict` with a non-image file → `400` with `{"detail":"Invalid image file"}`.
- [ ] `POST /predict` with `language=Indonesian` → `200` with region-specific song queries.
- [ ] `POST /predict-text` with a happy sentence → `200` with `raw_label: "joy"` and `emotion: "happy"`.
- [ ] `POST /predict-text` with whitespace-only text → `400` with `{"detail":"Text cannot be empty"}`.
- [ ] `GET /docs` → `200` (Swagger UI).

**Cache checks**

- [ ] Two identical `/predict-text` calls produce a `[CACHE MISS]` then a `[CACHE HIT]` in the backend log.
- [ ] With Redis stopped the backend still serves every endpoint.

**Front-end checks**

- [ ] `python -m http.server 8080 --directory webui` serves the page and <http://127.0.0.1:8080/> opens.
- [ ] **Recheck** in the `webui` page reports the backend as reachable.
- [ ] The `webui` page returns a prediction and renders song cards for both text and face modes.
- [ ] `npm install` completed in `frontend\` and `npm run dev` serves <http://localhost:3000/>.
- [ ] `/text-music` and `/system` both reach `http://127.0.0.1:8000` and render results.
- [ ] `npm run build` succeeds in `frontend\`.

**Limitations acknowledged**

- [ ] `models\emotion_model.h5` is not shipped — it is downloaded on first use and the first
      request is therefore slow and internet-dependent.
- [ ] The music lookup scrapes DuckDuckGo video results; there is no YouTube Data API key
      and no guarantee of stable results.
- [ ] Redis is optional; without it the app is slower but fully functional.
- [ ] The Docker backend image build fails on the unmodified `requirements.txt` torch line.
