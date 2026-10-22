# Cockpit HUD (driver-drowsiness-detection) — Setup & Test Workflow

**Folder id:** `driver-drowsiness-detection`
**UI name:** Cockpit HUD
**Stack:** OpenCV (`opencv-python>=4.5.0,<5.0.0`) · dlib (`>=19.22.0,<20.0.0`) · NumPy `<2.0.0` · SciPy `<2.0.0` · MediaPipe · Streamlit · streamlit-webrtc · playsound · Pillow · aiofiles · Tkinter (stdlib)
**Entry points:** `main.py` (Tkinter launcher), `ui.py` (older Tkinter launcher), `blinkDetect.py`, `face-try.py`, `lanedetection.py`, `streamlit_app/streamlit_app.py`

**What it actually is:** a set of classical computer-vision programs (no trained model) that
measure **Eye Aspect Ratio (EAR)** from facial landmarks to detect eye closure and raise a
drowsiness alarm. The `index.html` + `css/style.css` + `js/app.js` page at the project root
is a **HUD-style instrument view that renders a simulated EAR signal** — it does not open the
camera and there is no backend for it to call.

**Runtime surfaces:**

| Surface | Kind | Port | Notes |
|---|---|---|---|
| `python main.py` | Tkinter launcher | n/a | Spawns `face-try.py` / `blinkDetect.py` as child processes |
| `python blinkDetect.py` | dlib EAR detector | n/a | Needs `models/shape_predictor_68_face_landmarks.dat` (**missing**) |
| `python face-try.py` | Haar face detector | n/a | Runs out of the box — cascade is present |
| `python lanedetection.py` | Lane detector | n/a | |
| `streamlit run streamlit_app/streamlit_app.py` | Streamlit + streamlit-webrtc | 8501 | MediaPipe FaceMesh, **no dlib needed** |
| `python -m http.server 8080` | Static server for the Cockpit HUD | 8080 | Simulated signal only |

---

### 1. Prerequisites

- **Windows 10/11** with PowerShell (commands below are Windows-first).
- **Python 3.10–3.12.** The pins `numpy<2.0.0` / `scipy<2.0.0` are incompatible with
  Python 3.13. `requirements.txt` was *tested* on Python 3.7–3.10; the MediaPipe/Streamlit
  path is the practical route on 3.11/3.12.
- **A webcam** — every detection path reads `cv2.VideoCapture(0)`.
- **A C++ build toolchain** if you intend to use `dlib` on Windows: *Visual Studio Build
  Tools* (Desktop development with C++) and CMake (`pip install cmake`). `dlib` has no
  prebuilt wheel for Windows.
- **A WebRTC-capable browser** (recent Chrome/Edge/Firefox) for the Streamlit app, and the
  browser must be allowed to use the camera.
- **Disk space:** roughly 1.5–3 GB for the full dependency set (MediaPipe, Streamlit, OpenCV, dlib source build).
- **No Node.js, no database, no API key.**

**Two mutually exclusive install paths — pick one:**

| Path | Needs dlib? | Needs VS Build Tools? | Gives you |
|---|---|---|---|
| **A — Desktop detector** | Yes | Yes | `blinkDetect.py` (dlib 68-point landmarks) |
| **B — Browser detector** | **No** | **No** | `streamlit_app/streamlit_app.py` (MediaPipe FaceMesh) + the Haar face detector + the Cockpit HUD |

**Constants the code uses (no env vars, no config file for the Python code):**

| Constant | File | Value | Meaning |
|---|---|---|---|
| `thresh` | `blinkDetect.py:23` | `0.27` | EAR below this ⇒ eyes closed |
| `blinkTime` | `blinkDetect.py:40` | `0.15` s | Closure shorter than this is a false blink |
| `drowsyTime` | `blinkDetect.py:41` | `1.5` s | Sustained closure that raises the alarm |
| `FACE_DOWNSAMPLE_RATIO` | `blinkDetect.py:20` | `1.5` | Face detection runs on a downscaled copy |
| `RESIZE_HEIGHT` | `blinkDetect.py:21` | `460` | Frames are resized to this height |
| `EAR_THRESHOLD` | `streamlit_app/streamlit_app.py:12` | `0.25` | Web-app EAR threshold |
| `CONSEC_FRAMES` | `streamlit_app/streamlit_app.py:13` | `20` | Consecutive closed frames before DROWSY |
| `MAX_EAR` / `THRESH` / `THRESH_ALERT` | `js/app.js:42-44` | `0.45` / `0.27` / `0.25` | Cockpit gauge scale and threshold lines |

Streamlit's own settings live in `streamlit_app/.streamlit/config.toml`:
`enableStaticServing = true`, `enableCORS = false`, theme `primaryColor = "#ff6b6b"`.

---

### 2. Installation and Setup

#### Path A — full desktop detector (needs dlib)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install cmake
python -m pip install -r requirements.txt
```

If `pip install dlib` fails on Windows, install *Visual Studio Build Tools* (with the
"C++ desktop development" workload), then retry. The `requirements.txt` header documents
the same fallback.

#### Path B — the browser detector (no dlib, recommended on Windows)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install streamlit streamlit-webrtc mediapipe av opencv-python numpy scipy playsound
```

> `av` (PyAV) is required by `streamlit-webrtc` and is imported directly at
> `streamlit_app/streamlit_app.py:6`. The upstream README installs it separately for the
> same reason.

#### The dlib landmark model (required for `blinkDetect.py`)

`models/shape_predictor_68_face_landmarks.dat` is **not shipped** (~100 MB, git-ignored).
`blinkDetect.py` loads it at import time (`blinkDetect.py:28`, `blinkDetect.py:32`), so the
script fails immediately without it.

1. Download <https://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2>.
2. Decompress it:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
python -c "import bz2,shutil; shutil.copyfileobj(bz2.open('shape_predictor_68_face_landmarks.dat.bz2'), open('models/shape_predictor_68_face_landmarks.dat','wb'))"
```

3. Confirm it landed next to the Haar cascade:

```powershell
Get-ChildItem .\models
```

Expected: `haarcascade_frontalface_default.xml` **and** `shape_predictor_68_face_landmarks.dat`.

#### Verify the environment

```powershell
python --version
python -c "import cv2, numpy, scipy; print('cv2', cv2.__version__); print('numpy', numpy.__version__)"
python -c "import streamlit, mediapipe, av, streamlit_webrtc; print('web stack ok')"
```

#### Files that must be present

| Path | Status | Used by |
|---|---|---|
| `models/haarcascade_frontalface_default.xml` | **Present** | `face-try.py:17` (resolved via `os.path.join(BASE_DIR, 'models', ...)`) |
| `models/shape_predictor_68_face_landmarks.dat` | **Missing** → download it | `blinkDetect.py:28` |
| `models/ML_Models/ResNET+CNN (Tranfer Learning)/` | **Empty** | — no CNN is shipped |
| `models/ML_Models/Using Transformers/` | **Empty** | — no transformer is shipped |
| `alarm.wav` | **Present** (project root) | `sound_path` at `blinkDetect.py:29` |
| `streamlit_app/alarm.mp3` | **Present** | `playsound('alarm.mp3')` at `streamlit_app/streamlit_app.py:19` |
| `streamlit_app/.streamlit/config.toml` | **Present** | Streamlit theme + `enableStaticServing` |
| `streamlit_app/manifest.json`, `sw.js`, `offline.html`, `icons/` | **Present** | PWA assets |

**There is no `.env` file and no environment variables are read by this project.**

---

### 3. Launch the Complete Project

#### 3a. The Cockpit HUD (static page)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
.\.venv\Scripts\Activate.ps1
python -m http.server 8080
```

- **Port 8080** in this example; any free port works. Open <http://127.0.0.1:8080/>.
- **How the front end reaches the backend: it doesn't.** The page renders a *simulated* EAR
  signal in the browser and labels it as such on screen, in the chart watermark, in the
  footer and in the snapshot filename. There is no `fetch`, `XMLHttpRequest`, `WebSocket` or
  `getUserMedia` call anywhere in `js/app.js` — verified by inspection.
- Opening `index.html` directly from the file system also works, but a local server is
  recommended.
- **Stop with `Ctrl+C`.**

#### 3b. The Streamlit browser detector (recommended on Windows — avoids dlib)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
.\.venv\Scripts\Activate.ps1
streamlit run streamlit_app/streamlit_app.py
```

- **Port 8501** (Streamlit's default). Open <http://localhost:8501> and grant the camera
  permission when prompted.
- **Stop with `Ctrl+C`.**
- **Working-directory caveat:** `streamlit_app/streamlit_app.py:194` opens `alarm.wav` with
  a **relative** path, so the app must be launched from the **project root** (where
  `alarm.wav` lives). Conversely, `play_alarm()` at line 19 calls `playsound('alarm.mp3')`,
  which resolves against the CWD and therefore **fails** from the project root — it is
  caught and surfaces as the Streamlit warning *"Audio alert failed to play."* The file
  `streamlit_app/alarm.mp3` is the one the Streamlit apps actually intend to play. Run from
  inside `streamlit_app/` to make the alarm work, or copy `alarm.mp3` next to `alarm.wav`.

#### 3c. The PWA variant

The PWA app lives at **`streamlit_app/streamlit_app_pwa.py`** (inside the `streamlit_app`
folder — there is no copy at the project root). Run it from inside that folder so its
`alarm.mp3` resolves:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection\streamlit_app"
..\.venv\Scripts\python.exe -m streamlit run streamlit_app_pwa.py
```

(`PWA_README.md` and `DEPLOYMENT.md` show `cd streamlit_app` followed by
`streamlit run streamlit_app_pwa.py` — that form is correct. `DEPLOYMENT.md:26` likewise
points at `streamlit_app/streamlit_app_pwa.py` for Streamlit Cloud. The only real trap is
the CWD-relative `alarm.mp3`.)

Optional — regenerate the PWA icon set with Pillow:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection\streamlit_app"
..\.venv\Scripts\python.exe generate_icons.py
```

#### 3d. The desktop detectors

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
.\.venv\Scripts\Activate.ps1

python main.py            # Tkinter launcher (500x500): Face Detection / Blink Detection / dark mode / Quit
python ui.py              # older Tkinter launcher — adds Lane Detection; uses sys.executable
python face-try.py        # Haar face detector — works with no extra assets
python blinkDetect.py     # dlib EAR detector — needs models/shape_predictor_68_face_landmarks.dat
python lanedetection.py   # lane marking detector (Hough transform)
```

> **`main.py` launches children with the literal string `"python"`**
> (`subprocess.Popen(["python", script])`, `main.py:19` and `main.py:47`), so the venv's
> `python` must be on `PATH`. **Activate the venv in the same terminal** before clicking the
> buttons, or use `ui.py`, which uses `sys.executable` instead. Run from the project root —
> the scripts are launched by relative name.

**In-window controls for `blinkDetect.py`:** `r` resets the state machine, `q` quits, `Esc`
leaves the calibration loop. On exit it prints a session summary (duration, EAR readings,
average EAR, alerts, blinks) and writes `output-low-light-2.avi` (overwritten each run).

---

### 4. Test the Project

#### 4a. Automated tests — there are none

- `requirements.txt` does **not** include `pytest`, and there is **no `tests/` directory and
  no test file** in this project.
- `streamlit_app/test_pwa_setup.py` is **not** a pytest module. It is a standalone
  verification script that prints a checklist of PWA assets. Run it directly:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection\streamlit_app"
..\.venv\Scripts\python.exe test_pwa_setup.py
```

Expected: a per-file report for `manifest.json`, `sw.js`, `offline.html` and the icon set,
ending with a summary line. Because the file contains non-UTF-8 console glyphs, run it in a
UTF-8 terminal or redirect the output to a file to avoid mojibake:

```powershell
..\.venv\Scripts\python.exe test_pwa_setup.py | Out-File -Encoding utf8 pwa_check.txt
```

> If you want to run pytest here, install it yourself (`pip install pytest`) — but note
> that `pytest` collects `test_pwa_setup.py` by name and will also pick up its
> `test_pwa_features()` function, because that name matches the `test_*` pattern. The file
> is import-safe: the asset checks live in `main()` and are only called under the
> `if __name__ == "__main__"` guard, so importing the module runs nothing. The collected
> `test_pwa_features()` case merely probes for Pillow and Streamlit and asserts nothing.

#### 4b. Streamlit app — entry point and expected behaviour

| # | Entry point | How to exercise it | Expected output |
|---|---|---|---|
| 1 | `streamlit run streamlit_app/streamlit_app.py` | Open <http://localhost:8501> | Page titled *"🚗 Driver Drowsiness Detection"* with the subtitle *"Detects eye closure and triggers an audio alert if drowsiness is detected."* and an *"Install as Mobile App"* expander |
| 2 | Same | Click **Start** on the WebRTC video widget and allow camera access | The live feed appears and is processed by MediaPipe FaceMesh |
| 3 | Same | Keep your eyes open | The frame is annotated with `EAR: 0.xx` (white text, top-left) |
| 4 | Same | Close your eyes and hold them closed | After `CONSEC_FRAMES = 20` consecutive closed frames the frame is annotated `DROWSY!` in large red text, and the alarm thread starts (`playsound('alarm.mp3')`) |
| 5 | Same | Look away / leave the frame | No `EAR` overlay is drawn (no face mesh found) |
| 6 | `streamlit_app/streamlit_app_pwa.py` | Open <http://localhost:8501> | Same detection plus a PWA install prompt / service-worker registration |

#### 4c. Desktop detectors — entry points and expected behaviour

| # | Entry point | How to exercise it | Expected output |
|---|---|---|---|
| 1 | `python face-try.py` | Point the webcam at your face | A window titled *"Face Detection"* opens with a **blue rectangle** around each detected face. Press `q` to quit |
| 2 | `python face-try.py` with no webcam | Disconnect the camera first | Prints `[ERROR] Cannot access webcam.` and exits with code 1 |
| 3 | `python blinkDetect.py` **without** the landmark model | Run as-is | Fails immediately at import with a dlib shape-predictor error — this is the expected failure mode when `models/shape_predictor_68_face_landmarks.dat` is missing |
| 4 | `python blinkDetect.py` with the model present | Run and face the camera | Prints `Caliberation in Progress!` → `Caliberation Complete!` → `Current SPF (seconds per frame) is ... ms` → `drowsy limit: ..., false blink limit: ...`; then a *"Blink Detection"* window with **red dots** on the eye landmarks and `Blinks : N` in the corner |
| 5 | Same | Hold your eyes closed for ~1.5 s | The overlay `! ! ! DROWSINESS ALERT ! ! !` appears and `alarm.wav` plays |
| 6 | Same | Press `r` / `q` | `r` resets the counters; `q` quits, prints the session summary and releases the camera |
| 7 | `python main.py` | Click **Face Detection** | A child process opens the *"Face Detection"* OpenCV window; the launcher button is disabled until it exits |
| 8 | `python main.py` | Click **Blink Detection** | The `blinkDetect.py` child process runs in a daemon thread |
| 9 | `python main.py` | Click **Switch to Dark Mode** | The launcher window's background and button colours change |
| 10 | `python main.py` | Click **Quit** | Any running child process is terminated and the launcher window closes |
| 11 | `python lanedetection.py` | Run with a road video | A window opens with detected lane lines drawn in green |
| 12 | `python ui.py` | Click **Lane Detection** | The older launcher additionally offers lane detection |

#### 4d. Cockpit HUD — entry point and expected behaviour

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection"
python -m http.server 8080
```

| # | Action | Expected output |
|---|---|---|
| 1 | Open <http://127.0.0.1:8080/> | The HUD renders: a **STANDBY** LED, a session timer, a local clock, and an amber chip reading *"Simulated signal — live webcam EAR requires the backend"* |
| 2 | Click **Start session** (or press `Space`) | The needle sweeps, the strip chart fills at 20 samples/s, and the metrics start counting |
| 3 | Move **Baseline EAR** (0.200 → 0.450) and pick a profile (*Steady* / *Normal* / *Drowsy*) | The simulated signal changes shape; the profile selection re-randomises the timing |
| 4 | Read the state plate | States cycle `STANDBY → NORMAL → DROWSY WARNING → DROWSY → ALERT`; the gauge redline sits below **0.27** |
| 5 | Use the alarm deck (*Alarm armed*, *Vol*, *Mute*, *Alarm test*) | The siren toggles, the level changes, mute silences it while the visual ALERT still shows, and *Alarm test* plays three beeps |
| 6 | Click the snapshot button | Saves `cockpit-ear-sim.png` with the header *"SIMULATED SIGNAL (NOT WEBCAM EAR)"* |
| 7 | Read the **Engine** rail | It documents the real EAR formula, the real thresholds (0.27 / 0.15 s / 1.5 s / 0.25 / 20) and the commands to run the real backends |

#### 4e. What is *not* tested here

- There is **no automated test** of the EAR maths, the state machine, the calibration, or
  any of the UI surfaces.
- The Streamlit and desktop paths need a physical webcam and a real face to produce
  meaningful numbers; without one they either fail to open the camera or report
  *"Unable to detect face, Please check proper lighting"*.
- There is **no JSON/HTTP API** to assert against — `blinkDetect.py` and `face-try.py` draw
  into OpenCV windows, and Streamlit serves its own HTML/WebSocket protocol with no
  application-defined endpoint.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `dlib.shape_predictor` raises immediately | `models/shape_predictor_68_face_landmarks.dat` is missing | Download it from dlib.net and place it in `models/` (see Section 2) |
| `pip install dlib` fails on Windows | No C++ toolchain | Install *Visual Studio Build Tools* (Desktop development with C++) + CMake (`pip install cmake`), then retry — **or use the MediaPipe/Streamlit path instead, which needs no compiler** |
| `ImportError: No module named 'dlib'` | Virtualenv not active, or you installed Path B | `.\.venv\Scripts\Activate.ps1` |
| `ModuleNotFoundError: No module named 'streamlit_webrtc'` | Web extras not installed | `pip install streamlit streamlit-webrtc mediapipe av` |
| `ModuleNotFoundError: No module named 'av'` | PyAV missing — it is imported directly at `streamlit_app/streamlit_app.py:6` | `pip install av` |
| Streamlit shows *"Audio alert failed to play."* | `playsound('alarm.mp3')` resolves against the **current working directory** | Run the app from inside `streamlit_app/` (where `alarm.mp3` lives), or copy `alarm.mp3` next to `alarm.wav` in the project root |
| Streamlit crashes with `FileNotFoundError: alarm.wav` | `open("alarm.wav", "rb")` is also relative to the CWD | Run from the project root, where `alarm.wav` lives — the two audio paths want different working directories |
| *"Camera not found"* / *"Cannot access webcam."* | No camera, or another app holds it | Close other camera apps; check `cv2.VideoCapture(0)`; on the Streamlit app allow camera access in the browser |
| The browser never asks for the camera | streamlit-webrtc blocked | Use `http://localhost:8501`, check camera permissions, and try Chrome/Edge |
| *"Caliberation in Progress!"* never finishes | No face detected across the 100 calibration frames | Improve lighting, face the camera, or reduce `FACE_DOWNSAMPLE_RATIO` (the on-screen overlay suggests exactly this) |
| A `main.py` button does nothing | `main.py` runs `["python", script]` — the venv's `python` is not on `PATH` | Activate the venv in the same terminal, or use `ui.py` (which uses `sys.executable`) |
| `FileNotFoundError: face-try.py` | The launcher was started from the wrong directory | Run `python main.py` from the project root — the scripts are launched by relative name |
| Port 8501 already in use | Another Streamlit app is running | `streamlit run streamlit_app/streamlit_app.py --server.port 8502` |
| Port 8080 already in use | Another local server | `python -m http.server 8090` |
| `numpy` / `scipy` install fails on Python 3.13 | `requirements.txt` pins `numpy<2.0.0` | Use Python 3.10–3.12 |
| MediaPipe import error on Python 3.12+ | Older mediapipe wheels | Upgrade mediapipe, or run the dlib desktop path on Python 3.10 |
| The Cockpit page shows a plausible-looking EAR trace | It is a **simulation**, clearly watermarked on screen | Treat it as a UI demo, not a measurement; run the Streamlit app for a real webcam EAR |
| `playsound` raises on Windows | No audio device, or the file is locked | Ensure `playsound` is installed (the `requirements.txt` lists it twice for Windows compatibility) |

---

### 6. Verification Checklist

**Prerequisites and environment**

- [ ] Windows 10/11 and PowerShell are available.
- [ ] Python 3.10–3.12 is in use (`python --version`); not 3.13.
- [ ] A webcam is connected and not held open by another application.
- [ ] The working directory is `N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\driver-drowsiness-detection`.
- [ ] `.venv\Scripts\Activate.ps1` completes and `python -c "import cv2, numpy, scipy"` succeeds.
- [ ] If the Streamlit path is used: `python -c "import streamlit, mediapipe, av, streamlit_webrtc"` succeeds.
- [ ] If the dlib path is used: Visual Studio Build Tools (C++ workload) and CMake are installed, and `pip install dlib` succeeded.

**Assets**

- [ ] `models\haarcascade_frontalface_default.xml` exists.
- [ ] `models\shape_predictor_68_face_landmarks.dat` exists (downloaded) — required only for `blinkDetect.py`.
- [ ] `alarm.wav` exists at the project root.
- [ ] `streamlit_app\alarm.mp3` exists.
- [ ] `streamlit_app\.streamlit\config.toml` exists with `enableStaticServing = true`.
- [ ] `streamlit_app\manifest.json`, `sw.js`, `offline.html` and `icons\` exist.

**Launch**

- [ ] `python -m http.server 8080` serves the Cockpit HUD and <http://127.0.0.1:8080/> opens.
- [ ] `streamlit run streamlit_app/streamlit_app.py` starts and <http://localhost:8501> opens.
- [ ] The Streamlit page shows the title *"🚗 Driver Drowsiness Detection"*.
- [ ] `python main.py` opens the 500x500 Tkinter launcher window.
- [ ] `Ctrl+C` stops the static server and the Streamlit app cleanly.

**Automated / script checks**

- [ ] `streamlit_app\test_pwa_setup.py` runs directly and reports the PWA asset checklist (it is a script, not a pytest module).
- [ ] It is understood that this project ships **no** pytest suite and `pytest` is not in `requirements.txt`.

**Streamlit detection checks**

- [ ] Clicking Start on the WebRTC widget prompts for and obtains camera access.
- [ ] With eyes open, the frame shows `EAR: 0.xx`.
- [ ] With eyes held closed, `DROWSY!` appears after ~20 consecutive closed frames.
- [ ] The alarm either plays or the known CWD-relative `alarm.mp3` warning is understood.

**Desktop detection checks**

- [ ] `python face-try.py` opens the *"Face Detection"* window and draws a blue rectangle around a detected face.
- [ ] `q` quits the face-detection window.
- [ ] `python blinkDetect.py` prints the calibration banner and the SPF/drowsy-limit lines.
- [ ] Eye landmarks are drawn as red dots and `Blinks : N` is shown.
- [ ] Holding the eyes closed shows `! ! ! DROWSINESS ALERT ! ! !`.
- [ ] `r` resets and `q` quits; the session summary is printed on exit.

**Cockpit HUD checks**

- [ ] The page shows the *STANDBY* LED, session timer, clock, and the *"Simulated signal"* chip.
- [ ] **Start session** starts the needle sweep and the strip chart.
- [ ] Baseline EAR slider and the *Steady* / *Normal* / *Drowsy* profiles change the signal.
- [ ] The state plate cycles `STANDBY → NORMAL → DROWSY WARNING → DROWSY → ALERT`, with the redline at 0.27.
- [ ] Alarm armed / Vol / Mute / Alarm test all respond.
- [ ] The snapshot saves `cockpit-ear-sim.png` labelled *"SIMULATED SIGNAL (NOT WEBCAM EAR)"*.
- [ ] It is understood that the HUD performs **no** detection and calls **no** backend.

**Limitations acknowledged**

- [ ] The dlib landmark model is a ~100 MB manual download, not shipped.
- [ ] Only **EAR** is implemented — there is no mouth aspect ratio, no head pose, no gaze
      tracking and no PERCLOS.
- [ ] No trained model, weights or dataset ship with this project.
- [ ] There is no JSON/HTTP API and no session-history persistence (`Sesssion_analysis.py` is
      an empty Tkinter stub).
- [ ] The thresholds (`0.27`, `0.15`, `1.5`, `0.25`, `20`) are hand-picked constants, and
      the same `0.27` is reused for a 68-point dlib set and a 468-point MediaPipe set whose
      EAR scales are not identical.
