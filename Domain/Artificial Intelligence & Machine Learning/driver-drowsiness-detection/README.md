# Cockpit — Driver Drowsiness Detection System

*Folder id: `driver-drowsiness-detection` · Upstream: `Gagandeep-2003/Driver-Drowsiness-Detection-System` · Entry point: `main.py`*

**Cockpit** is the instrument-style front end for this driver-fatigue project, and the
project behind it is a set of real, working computer-vision programs: a dlib-based **blink
and drowsiness detector** (`blinkDetect.py`), a Haar-cascade **face detector**
(`face-try.py`), a **lane detector** (`lanedetection.py`) and a **MediaPipe/Streamlit web
app** (`streamlit_app/streamlit_app.py`) that runs the same Eye Aspect Ratio logic in the
browser through `streamlit-webrtc`.

The static page at the project root (`index.html` + `css/style.css` + `js/app.js`) is a
**HUD-style instrument view** — a gauge, a scrolling EAR strip chart, session metrics, an
alarm panel and an "Engine" rail that documents the real thresholds used by the Python
code. It renders a **simulated** EAR signal in the browser and says so on screen, in the
chart watermark, in the footer and in the snapshot filename. It does **not** open your
camera, and neither of the two real backends exposes a JSON API.

> The *Cockpit* interface and this documentation were added after the upstream project.
> The upstream license, authorship and Python code are preserved unchanged.

---

## Features

### Implemented and verified in the repository

| Feature | Where | Notes |
|---|---|---|
| Eye Aspect Ratio from 68 facial landmarks | `blinkDetect.py:119-125` `eye_aspect_ratio()` | `EAR = (A + B) / (2·C)` with `scipy.spatial.distance.euclidean` |
| Eye-closed decision | `blinkDetect.py:23,153-157` | `thresh = 0.27`; `ear < thresh` ⇒ eyes closed |
| Blink counting and drowsiness state machine | `blinkDetect.py:159-190` `checkBlinkStatus()` | `blinkTime = 0.15` s (false blink), `drowsyTime = 1.5` s (drowsy) |
| Frame-rate calibration | `blinkDetect.py:262-300` | 100 valid frames, measures SPF, then `drowsyLimit = drowsyTime/spf`, `falseBlinkLimit = blinkTime/spf` |
| Drowsiness alarm (audio + on-screen banner) | `blinkDetect.py:340-352` | `alarm.wav` in a daemon thread via `playsound`; "! ! ! DROWSINESS ALERT ! ! !" overlay |
| Reset / quit keys | `blinkDetect.py:358-366` | `r` resets the state, `q` quits, `Esc` leaves the calibration loop |
| Session tracking (duration, mean EAR, alerts, blinks) | `blinkDetect.py:54-89` `TempSessionTracker` | Prints a session summary when the loop ends |
| Session data getters | `blinkDetect.py:212-247` | `get_current_ear()`, `get_current_blink_count()`, `get_session_data()`, `get_session_ear_values()`, `start_new_session()`, `end_current_session()` |
| Face detection with Haar cascade | `face-try.py:20-52` | `models/haarcascade_frontalface_default.xml` **is present**; blue rectangles |
| Lane detection | `lanedetection.py` | `region_of_interest()`, `drow_the_lines()` — edge/line-based, Hough transform |
| Tkinter launcher (Face Detection / Blink Detection / dark mode) | `main.py` | `run_face_detection()`, `run_blink_detection()`, `toggle_theme()`, `on_quit()` |
| Older Tkinter launcher (adds Lane Detection) | `ui.py` | `run_script()` via `sys.executable` |
| Browser-based drowsiness detection | `streamlit_app/streamlit_app.py` | MediaPipe FaceMesh, `EAR_THRESHOLD = 0.25`, `CONSEC_FRAMES = 20` |
| PWA variant (installable, offline-capable) | `streamlit_app/streamlit_app_pwa.py` | Inline base64 manifest, service worker, install prompt |
| Cockpit HUD interface (simulated signal) | `index.html`, `js/app.js` | Gauge with redline at 0.27, strip chart with 0.27/0.25 threshold lines, blink/alert/average-EAR metrics, alarm arm/mute/volume/test, 24h/12h clock, PNG snapshot |

### Not available / requires external setup

- **`models/shape_predictor_68_face_landmarks.dat` is NOT in this repository.** `blinkDetect.py`
  loads it at import time (`blinkDetect.py:28,32`) and the file's own comment says to
  download it from `https://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2` and
  place it in `models/`. Without it the script fails immediately.
- **`dlib` is not pip-installable on Windows without a C++ toolchain** (Visual Studio Build
  Tools + CMake). The MediaPipe/Streamlit path avoids dlib entirely and is the easier
  route on Windows.
- **No mouth-aspect-ratio (MAR) implementation exists anywhere in the code.** The folder
  metadata advertises "EAR/MAR eye-mouth ratio"; only EAR is implemented.
- **No trained model, no weights, no dataset** — this is classical computer vision, not
  machine learning.
- **No JSON/HTTP API.** `blinkDetect.py` and `face-try.py` are local scripts that draw into
  OpenCV windows; the Streamlit app serves its own HTML. There is no endpoint the Cockpit
  page could call, which is why the page simulates the signal.
- **No session history persistence.** `Sesssion_analysis.py` is a 17-line Tkinter stub
  (`ttk.Notebook` with two empty frames) — it stores nothing.
- **The alarm audio path is inconsistent**: `blinkDetect.py` plays `alarm.wav` (present at
  the project root), while the Streamlit apps call `playsound('alarm.mp3')` (present at
  `streamlit_app/alarm.mp3`). See [Troubleshooting](#troubleshooting).
- **`models/ML_Models/` is empty** — two sub-folders (`ResNET+CNN (Tranfer Learning)` and
  `Using Transformers`) exist with no files, so no CNN or transformer model is shipped.
- **The Cockpit page never touches the webcam**, and the upstream README's "PWA support /
  offline functionality" claim applies only to the Streamlit variant.

---

## Technology Stack

| Layer | Technology | Version / constraint |
|---|---|---|
| Language | Python | tested 3.7–3.10 per `requirements.txt`; the OpenCV/NumPy pins below target ≤ 3.11/3.12 |
| Computer vision | OpenCV | `opencv-python>=4.5.0,<5.0.0` |
| Landmark detection (desktop) | dlib | `dlib>=19.22.0,<20.0.0` — needs a C++ toolchain on Windows |
| Landmark detection (web) | MediaPipe | `mediapipe>=0.10.0,<1.0.0` (FaceMesh, 468 landmarks) |
| Numerics | NumPy, SciPy | `numpy>=1.19.0,<2.0.0`, `scipy>=1.7.0,<2.0.0` |
| Web UI backend | Streamlit | `streamlit>=1.25.0,<2.0.0` |
| WebRTC streaming | streamlit-webrtc (+ `av`) | `streamlit-webrtc>=0.45.0,<1.0.0` |
| Audio alert | playsound | `playsound>=1.2.2,<2.0.0` |
| Desktop GUI | Tkinter / ttk | Python standard library |
| PWA assets | Pillow | `Pillow>=8.0.0,<11.0.0` (icon generation) |
| Static UI | Vanilla HTML5 + CSS + ES5 JavaScript | no framework, no bundler |
| Fonts | Google Fonts — Rajdhani, Chakra Petch, Share Tech Mono | optional CDN |

---

## Prerequisites

- **Windows 10/11** with PowerShell (commands below are Windows-first).
- **Python 3.10 or 3.11 recommended.** The pins in `requirements.txt` (`numpy<2.0.0`) are
  not compatible with Python 3.13.
- **A webcam** — every detection path reads `cv2.VideoCapture(0)`.
- **A C++ build toolchain** if you intend to use `dlib` on Windows: *Visual Studio Build
  Tools* (Desktop development with C++) and CMake (`pip install cmake`).
- **A browser with WebRTC** (Chrome/Edge/Firefox, recent) for the Streamlit app — the
  browser must be allowed to use the camera.
- macOS/Linux alternatives are noted in [Installation](#installation).

---

## Project Structure

```
driver-drowsiness-detection/
├── main.py                    # Tkinter launcher — the metadata entry point
├── ui.py                      # Older Tkinter launcher (adds Lane Detection)
├── blinkDetect.py             # dlib EAR blink / drowsiness detector (desktop)
├── face-try.py                # Haar-cascade face detector (desktop)
├── lanedetection.py           # Lane-marking detector (OpenCV, Hough)
├── Sesssion_analysis.py       # Tkinter stub for session history (empty)
├── index.html                 # Cockpit HUD interface (added later)
├── css/style.css              # Cockpit styling
├── js/app.js                  # Cockpit simulation, gauge, chart, metrics
├── alarm.wav                  # Alarm sound used by blinkDetect.py
├── eye.PNG, eye_aspect_ratio.PNG, face.PNG, test_image.jpg   # Reference images
├── models/
│   ├── haarcascade_frontalface_default.xml   # PRESENT — used by face-try.py
│   ├── shape_predictor_68_face_landmarks.dat # MISSING — must be downloaded
│   └── ML_Models/                            # empty folders, no weights
├── streamlit_app/
│   ├── streamlit_app.py       # MediaPipe + streamlit-webrtc app
│   ├── streamlit_app_pwa.py   # PWA variant (inline manifest, service worker)
│   ├── alarm.mp3              # Alarm sound referenced by the Streamlit apps
│   ├── manifest.json, sw.js, offline.html, icons/  # PWA assets
│   ├── generate_icons.py      # Regenerates the icon set with Pillow
│   ├── test_pwa_setup.py      # PWA asset validation script
│   └── .streamlit/config.toml # enableStaticServing=true, enableCORS=false, theme
├── requirements.txt           # Pinned dependency ranges
├── DEPLOYMENT.md              # PWA deployment guide (Streamlit Cloud / Heroku / Docker)
├── PWA_IMPLEMENTATION.md, PWA_README.md, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md
├── License                    # MIT, Copyright (c) 2025 jai-76
├── project-metadata.json      # id, stack, goal, license, entry point
└── .github/workflows/         # issue/PR automation workflows
```

Paths the code actually uses:

| Purpose | Path used by the code |
|---|---|
| dlib landmark model | `modelPath = "models/shape_predictor_68_face_landmarks.dat"` — `blinkDetect.py:28` |
| Haar cascade | `os.path.join(BASE_DIR, 'models', 'haarcascade_frontalface_default.xml')` — `face-try.py:17` |
| Desktop alarm | `sound_path = "alarm.wav"` — `blinkDetect.py:29` |
| Recorded video | `cv2.VideoWriter('output-low-light-2.avi', …)` — `blinkDetect.py:306` |
| Streamlit alarm | `playsound('alarm.mp3')` — `streamlit_app/streamlit_app.py:19` |
| Streamlit audio embed | `open("alarm.wav", "rb")` — `streamlit_app/streamlit_app.py:194` |
| PWA manifest / service worker | `manifest.json`, `sw.js`, `icons/` in `streamlit_app/` |

---

## Installation

### Option A — full desktop detector (needs dlib)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install cmake
python -m pip install -r requirements.txt
```

If `pip install dlib` fails on Windows, install *Visual Studio Build Tools* (with the
"C++ desktop development" workload) and retry; the `requirements.txt` header documents the
same fallback.

### Option B — the browser detector (no dlib)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install streamlit streamlit-webrtc mediapipe av opencv-python numpy playsound
```

### Linux / macOS

```bash
cd driver-drowsiness-detection
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

macOS also needs the Xcode command line tools (`xcode-select --install`); Debian/Ubuntu
users may need `sudo apt-get install cmake libopenblas-dev liblapack-dev`.

### The dlib landmark model (required for `blinkDetect.py`)

`models/shape_predictor_68_face_landmarks.dat` is **not shipped** (it is ~100 MB and is
git-ignored). Download it from dlib.net and place it in `models/`:

1. Open <https://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2> and download it.
2. Decompress it (7-Zip, or `python -c "import bz2,shutil; shutil.copyfileobj(bz2.open('shape_predictor_68_face_landmarks.dat.bz2'), open('shape_predictor_68_face_landmarks.dat','wb'))"`).
3. Move `shape_predictor_68_face_landmarks.dat` into the `models/` folder next to
   `haarcascade_frontalface_default.xml`.

---

## Environment Configuration

The code reads **no environment variables** — there is no `.env` and no `.env.example`.
Everything is configured through module-level constants:

| Constant | File | Value | Meaning |
|---|---|---|---|
| `thresh` | `blinkDetect.py:23` | `0.27` | EAR below this ⇒ eyes closed |
| `blinkTime` | `blinkDetect.py:40` | `0.15` s | Closure shorter than this is a false blink |
| `drowsyTime` | `blinkDetect.py:41` | `1.5` s | Sustained closure that raises the alarm |
| `FACE_DOWNSAMPLE_RATIO` | `blinkDetect.py:20` | `1.5` | Face detection runs on a downscaled copy |
| `RESIZE_HEIGHT` | `blinkDetect.py:21` | `460` | Frames are resized to this height |
| `GAMMA` | `blinkDetect.py:43` | `1.5` | Gamma-correction LUT (currently commented out in favour of histogram equalisation) |
| `EAR_THRESHOLD` | `streamlit_app/streamlit_app.py:12` | `0.25` | Web-app EAR threshold |
| `CONSEC_FRAMES` | `streamlit_app/streamlit_app.py:13` | `20` | Consecutive closed frames before DROWSY |
| `MAX_EAR`, `THRESH`, `THRESH_ALERT` | `js/app.js:42-44` | `0.45`, `0.27`, `0.25` | Cockpit gauge scale and threshold lines |
| `BLINK_WINDOW`, `DROWSY_TIME`, `ALERT_TIME` | `js/app.js:45-47` | `0.15`, `1.5`, `1.0` s | Cockpit state timings |
| `SAMPLE_MS`, `MAX_SAMPLES` | `js/app.js:48-49` | `50`, `480` | Chart sampling rate and buffer length |

Streamlit's own settings live in `streamlit_app/.streamlit/config.toml`:
`enableStaticServing = true`, `enableCORS = false`, and the red/white theme
(`primaryColor = "#ff6b6b"`).

---

## How to Launch

### 1. The desktop detector (Tkinter launcher)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
.\.venv\Scripts\Activate.ps1
python main.py
```

A 500×500 window opens with three controls: **Face Detection**, **Blink Detection**, a
**Switch to Dark Mode** toggle and a **Quit** button. `main.py` launches each detector as a
child process with `subprocess.Popen(["python", script])` — the literal `"python"` must
resolve to your virtualenv interpreter, so **activate the venv first**. `ui.py` (the older
launcher) uses `sys.executable` instead and additionally offers **Lane Detection**.

### 2. The detectors directly

```powershell
python blinkDetect.py     # dlib EAR detector — needs models/shape_predictor_68_face_landmarks.dat
python face-try.py        # Haar face detector — needs nothing extra
python lanedetection.py   # lane marking detector
```

`blinkDetect.py` prints a calibration banner, calibrates on 100 valid frames, shows the
measured SPF and the derived limits, then runs the detection loop. Press `q` to quit and
`r` to reset the state.

### 3. The browser detector (Streamlit)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
.\.venv\Scripts\Activate.ps1
streamlit run streamlit_app/streamlit_app.py
```

- **Port 8501** (Streamlit's default) — open <http://localhost:8501>. Grant the browser
  permission to use the camera when prompted.
- The PWA variant: `cd streamlit_app; streamlit run streamlit_app_pwa.py` (see
  `DEPLOYMENT.md` for Streamlit Cloud / Heroku / Docker recipes; the Docker example
  exposes **8501** and binds `0.0.0.0`).
- **Stop with `Ctrl+C`.**

### 4. The Cockpit HUD (static page)

The Cockpit page is a static site — no build step, no backend. Serve it with any static
server:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
python -m http.server 8080
```

- **Port 8080** in this example; any free port works. Open <http://127.0.0.1:8080/>.
- Opening `index.html` directly from the file system also works, but a local server is
  recommended.
- **How the front end reaches the backend: it doesn't.** The page renders a *simulated*
  EAR signal in the browser and labels it as such on screen. It never calls a webcam API
  and never calls a backend endpoint, because no endpoint exists.
- **Stop the server with `Ctrl+C`.**

---

## Model and Dataset Setup

| Item | Status | Where the code expects it |
|---|---|---|
| `models/shape_predictor_68_face_landmarks.dat` | **MISSING — must be downloaded** from <https://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2> | `models/` next to the Haar cascade; loaded at `blinkDetect.py:32` |
| `models/haarcascade_frontalface_default.xml` | **PRESENT** (OpenCV's frontal-face cascade) | loaded at `face-try.py:20` |
| `models/ML_Models/ResNET+CNN (Tranfer Learning)/` | **EMPTY** — no weights | — |
| `models/ML_Models/Using Transformers/` | **EMPTY** — no weights | — |
| `alarm.wav` | **PRESENT** (project root) | `sound_path` in `blinkDetect.py:29` |
| `streamlit_app/alarm.mp3` | **PRESENT** | `playsound('alarm.mp3')` in the Streamlit apps |
| Training dataset | **Not applicable** — no model is trained | — |
| Landmark training set | Not needed — dlib's 68-point predictor is a pre-trained model shipped as the `.dat` file | — |

---

## Usage

### Cockpit HUD (the static page)

1. Open the served page. The top bar shows a **STANDBY** LED, a session timer and a local
   clock; the amber chip under the bar reads *"Simulated signal — live webcam EAR requires
   the backend"*.
2. **Start session** (or press `Space`). The needle sweeps, the strip chart fills at
   20 samples/s, and the metrics start counting.
3. **Signal controls.** Move *Baseline EAR* (0.200–0.450) and pick a profile:
   *Steady* (rare blinks), *Normal* (blinks + mild closures) or *Drowsy* (frequent deep
   closures). Changing the profile mid-session re-randomises the timing.
4. **Read the state plate.** The gauge has a redline below **0.27** (the `thresh` in
   `blinkDetect.py`); the states are `STANDBY → NORMAL → DROWSY WARNING → DROWSY → ALERT`.
5. **Alarm deck.** *Alarm armed* toggles the siren, *Vol* sets the level, *Mute* silences
   it (the visual ALERT still shows) and *Alarm test* plays three beeps.
6. **Snapshot PNG** saves the strip chart with a header that says
   *"SIMULATED SIGNAL (NOT WEBCAM EAR)"* — the file is `cockpit-ear-sim.png`.
7. The **Engine** rail documents the real formula, the real thresholds and copyable
   commands to run the actual backends.

### Desktop detector

1. `python main.py` → **Blink Detection**.
2. Allow the webcam; keep your face centred and lit. The calibration step needs 100 frames
   with a detected face — if it cannot find one it prints *"Unable to detect face, Please
   check proper lighting"*.
3. Watch the video window: eye landmarks are drawn as red dots, `Blinks : N` is shown while
   you are alert, and `! ! ! DROWSINESS ALERT ! ! !` appears with the alarm when the
   closure is sustained.
4. Press `r` to reset the counters, `q` to quit. A session summary (duration, EAR
   readings, average EAR, alerts, blinks) is printed on exit, and the frames are written to
   `output-low-light-2.avi`.

### Browser detector (Streamlit)

1. `streamlit run streamlit_app/streamlit_app.py` → <http://localhost:8501>.
2. Accept the camera prompt. The video stream is processed **in the browser** by
   `streamlit-webrtc`; frames are analysed by MediaPipe FaceMesh on the Python side.
3. When the EAR stays below `0.25` for 20 consecutive frames, `DROWSY!` is drawn on the
   frame and the alarm thread starts.

### Lane detection

`python lanedetection.py` opens a road-video window with the detected lane lines drawn in
green (`lanedetection.py` `region_of_interest()` + `drow_the_lines()`).

---

## API Documentation

**There is no HTTP API in this project.** The two real backends are desktop programs:

- `blinkDetect.py` and `face-try.py` open OpenCV windows (`cv2.imshow`) and read
  `cv2.VideoCapture(0)`. They expose no routes and no JSON.
- `streamlit_app/streamlit_app.py` is a Streamlit application: Streamlit serves its own
  HTML/WebSocket protocol on port 8501 and offers no application-defined JSON endpoint.
- The Cockpit page is static and makes **no** `fetch`/`XMLHttpRequest`/WebSocket calls.

The only programmatic surface is the Python API inside `blinkDetect.py`, which exists for
the future `session_history.py` module and is documented in
[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `dlib.shape_predictor` raises immediately | `models/shape_predictor_68_face_landmarks.dat` is missing | Download it from dlib.net and place it in `models/` (see [Installation](#installation)) |
| `pip install dlib` fails on Windows | No C++ toolchain | Install *Visual Studio Build Tools* + CMake (`pip install cmake`), then retry; or use the MediaPipe/Streamlit path instead |
| `ImportError: No module named 'dlib'` | Virtualenv not active, or Option B install | `.\.venv\Scripts\Activate.ps1` |
| `ModuleNotFoundError: No module named 'streamlit_webrtc'` | Web extras not installed | `pip install streamlit streamlit-webrtc mediapipe av` |
| `playsound` raises on Windows | No audio device / file locked | Install `playsound`; on Windows also `pip install playsound` (the `requirements.txt` lists it twice for Windows compatibility) |
| Streamlit shows *"Audio alert failed to play."* | `playsound('alarm.mp3')` is resolved against the **current working directory** | Run the app from inside `streamlit_app/` (where `alarm.mp3` lives), or copy `alarm.mp3` next to the script you launch |
| Streamlit crashes with `FileNotFoundError: alarm.wav` | `open("alarm.wav", "rb")` is also relative to the CWD | Run from the project root (where `alarm.wav` lives) — note the two audio paths want different working directories |
| *"Camera not found / Cannot access webcam"* | No camera, or another app holds it | Close other apps using the camera; check `cv2.VideoCapture(0)`; on the Streamlit app allow camera access in the browser |
| Browser never asks for the camera | Streamlit-webrtc blocked | Use `http://localhost:8501` (not `127.0.0.1` in some setups), check for camera permissions, and try Chrome/Edge |
| *"Caliberation in Progress!"* never finishes | No face detected in the 100 frames | Improve lighting, face the camera, or reduce `FACE_DOWNSAMPLE_RATIO` (the overlay suggests exactly this) |
| Tkinter button does nothing | `main.py` runs `["python", script]` — the venv's `python` is not on PATH | Activate the venv in the same terminal, or use `ui.py`, which uses `sys.executable` |
| `FileNotFoundError: face-try.py` | Launcher started from the wrong directory | Run `python main.py` from the project root — the scripts are launched by relative name |
| Port 8501 already in use | Another Streamlit app is running | `streamlit run streamlit_app/streamlit_app.py --server.port 8502` |
| Port 8080 already in use (static server) | Another local server | `python -m http.server 8090` |
| `numpy` / `scipy` install fails on Python 3.13 | `requirements.txt` pins `numpy<2.0.0` | Use Python 3.10–3.12 |
| MediaPipe import error on Python 3.12+ | Older mediapipe wheels | Upgrade mediapipe, or run the dlib desktop path on Python 3.10 |

---

## Limitations

- **The dlib model is not shipped** — a ~100 MB download is required for the desktop
  detector.
- **`dlib` is painful to install on Windows**; the Streamlit/MediaPipe path is the
  practical route there.
- **EAR-only.** No mouth aspect ratio, no head pose, no gaze tracking, no PERCLOS — so
  looking away from the road or talking is not detected.
- **Calibration is fixed at 100 frames** and assumes a steady face; glasses, strong
  backlight and low light degrade the landmark fit (the `output-low-light-2.avi` filename
  hints at the original low-light experiments).
- **The thresholds are hand-picked constants** (`0.27`, `0.15`, `1.5`, `0.25`, `20`); they
  are not tuned per driver, and the same `0.27` is reused for both a dlib 68-point and a
  MediaPipe 468-point landmark set, whose EAR scales are not identical.
- **The drowsiness rule is frame-count based** (`drowsyLimit = drowsyTime / spf`), so its
  real-time meaning changes with the machine's frame rate.
- **The alarm can only be muted by the operator** and the desktop alarm thread is
  fire-and-forget; `playsound` is a blocking call in a daemon thread.
- **No HTTP API, no telemetry, no trip report** — despite the metadata goal mentioning a
  "trip report", the only report is the console session summary.
- **`Sesssion_analysis.py` is a stub**; no session history is stored or displayed.
- **The PWA claims are only partly met**: the service worker caches a small asset list, and
  the MediaPipe stream itself needs a live connection.
- **The Cockpit page shows simulated data.** Any screenshot of it is a simulation, and the
  page says so in three places — but it is still not a measurement of a real driver.
- **Frame-rate and lighting dependence**, single-face assumption (`rects[0]`), and no
  handling of sunglasses, occlusions or multiple drivers.
- **`output-low-light-2.avi` is written on every run** and overwrites the previous file.

---

## License and Credits

- **Upstream project:** *Driver Drowsiness Detection System* —
  <https://github.com/Gagandeep-2003/Driver-Drowsiness-Detection-System> (metadata
  repository field; the original README's badges point at the same repository with a
  capitalised name).
- **License:** MIT — see the `License` file, *Copyright (c) 2025 jai-76*. The license and
  authorship are preserved unchanged.
- **Added later (not part of the upstream release):** the **Cockpit** interface —
  `index.html`, `css/style.css`, `js/app.js` — plus this `README.md` and
  `PROJECT_OVERVIEW.md`. The upstream Python code (`main.py`, `ui.py`, `blinkDetect.py`,
  `face-try.py`, `lanedetection.py`, `streamlit_app/`) is unmodified.
- **Third-party components:** OpenCV (Apache-2.0), dlib (Boost-1.0), MediaPipe (Apache-2.0),
  Streamlit (Apache-2.0), streamlit-webrtc (MIT), NumPy (BSD-3-Clause), SciPy (BSD-3-Clause),
  playsound (MIT), Pillow (MIT-CMU). The dlib landmark model is distributed by
  <https://dlib.net> under its own terms and is **not** included in this repository.
