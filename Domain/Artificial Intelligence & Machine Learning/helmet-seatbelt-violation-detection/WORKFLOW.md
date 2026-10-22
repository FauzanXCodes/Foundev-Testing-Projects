# Signal Control Room (helmet-seatbelt-violation-detection) — Setup & Test Workflow

**Folder id:** `helmet-seatbelt-violation-detection`
**UI name:** Signal Control Room
**Stack:** OpenCV · NumPy · Pillow · PyTorch + torchvision · Ultralytics YOLO (YOLOv8x) · SQLite3 · Tkinter (stdlib) · vanilla HTML/CSS/JS (browser companion)
**Entry point:** `source/main_app.py` (Tkinter desktop application)

**What it actually is:** a **desktop** traffic-violation monitoring application. Operators sign
in with a username, password and role, watch up to four camera feeds, and the app detects
riders **without a helmet**, logs each violation into SQLite, and produces reports, statistics
and JSON/CSV exports.

> **Scope honesty — only the helmet detector is implemented.** The seatbelt and roundabout
> detectors are referenced in the UI but their modules are not in this repository: the
> imports are commented out at `source/main_app.py:21-22`, so `self.seatbelt_detector` and
> `self.roundabout_detector` are never assigned. Toggling either switch in the GUI raises
> `AttributeError` inside the camera thread; the generic handler in `update_camera_feed()`
> prints `Camera N error: ...` and ends that camera's thread. **Use the Helmet toggle only.**

The browser page at the project root (`index.html` + `css/style.css` + `js/app.js`) mirrors
the operator console visually, but it is a local, demo-data preview — it never loads a model
and never talks to a server. Its only external write is `localStorage`.

**Runtime surfaces:**

| Surface | Kind | Port | Notes |
|---|---|---|---|
| `source/main_app.py` | Tkinter desktop app | n/a | The real application — **no HTTP server** |
| `source/database_manager.py` (as `__main__`) | Self-test script | n/a | Writes `test_violations.db` |
| `source/user_authentication_v1.py` (as `__main__`) | Self-test script | n/a | Writes `traffic_system.db` |
| `source/helmet_detection_yolo8_max_accuracy.py` (as `__main__`) | Detector smoke test | n/a | Loads the model and warms it up |
| `python -m http.server 8000` | Static server for the browser page | 8000 | Demo data only |

---

### 1. Prerequisites

- **Windows 10/11** with PowerShell (commands below are Windows-first).
- **Python 3.9+** — the code uses `typing` generics and dataclasses; 3.10+ is recommended.
  Python 3.12.1 is fine.
- **A camera** — camera indices `0`–`3` via `cv2.VideoCapture(idx)`. Without one, the app
  still launches, logs in, and lets you record violations manually.
- **Disk space and time for PyTorch** — `torch` + `torchvision` + `ultralytics` are large
  downloads (the CUDA build is ~2–3 GB; the CPU build is smaller).
- **Network access on the first run** — Ultralytics fetches `yolov8x.pt` (~130 MB) from its
  release assets when the file is not already present.
- **Optional:** a custom helmet checkpoint (`.pt`) to replace the COCO model.
- **Node.js is not required** — the browser page is plain static files.
- **No API key** is required for anything.

> **The bundled `quasar/` folder is a Linux virtualenv snapshot** (`bin/`, `lib/`,
> `lib64`, `pyvenv.cfg` pointing at `/home/maqbool/anaconda3/bin`, Python 3.10.16). It
> **cannot be activated on Windows** — the `.exe` shims inside `quasar/lib/python3.10/site-packages/setuptools/`
> are Linux ELF binaries. **Ignore `quasar/` entirely and create your own environment.**

**Hard-coded settings in the source (no `.env`, no config file):**

| Setting | Value | Line |
|---|---|---|
| Violation database | `traffic_violations.db` (CWD-relative) | `source/database_manager.py:15` |
| User database | `traffic_system.db` (CWD-relative) | `source/user_authentication_v1.py:13` |
| Password hashing | SHA-256 hex digest | `source/user_authentication_v1.py:38-40` |
| Model path | the literal string `"yolov8x.pt"` | `source/helmet_detection_yolo8_max_accuracy.py:65`, `:116` |
| Confidence threshold | `0.6` | `source/main_app.py:38` (`create_helmet_detector(confidence_threshold=0.6)`) |
| IoU threshold | `0.45` | `source/helmet_detection_yolo8_max_accuracy.py:45` |
| Device | `auto` → cuda / mps / cpu | `source/helmet_detection_yolo8_max_accuracy.py:121-127` |
| Frame display size | 300 × 200 | `source/main_app.py:346` |
| Roles | `Administrator`, `Traffic Officer`, `Public` | `source/main_app.py:83` |

**Default accounts (created automatically on first run):**

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Administrator |
| `officer1` | `officer123` | Traffic Officer |
| `public` | `public123` | Public |
| `test` | `test` | Traffic Officer |

> These are **development defaults seeded into `traffic_system.db`** and are printed in the
> source (`source/user_authentication_v1.py:317-321`). The stored passwords are SHA-256
> digests, not plaintext — but unsalted SHA-256 is not a production password hash, and the
> default accounts must be changed before any real use.

---

### 2. Installation and Setup

#### 2a. Create the environment

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

> **Do not activate `quasar\`.** It is a Linux venv snapshot and is unusable on Windows.

#### 2b. Install PyTorch (CPU build recommended, then the rest)

`requirements.txt` lists `torch` and `torchvision` **unpinned**, so `pip install -r
requirements.txt` pulls the default CUDA build (several GB). For a CPU-only machine,
install the CPU wheels first:

```powershell
# CPU-only PyTorch (much smaller download)
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# The remaining dependencies
python -m pip install opencv-python numpy pillow ultralytics
```

Or install the whole file, accepting the large CUDA download:

```powershell
python -m pip install -r requirements.txt
```

> **Note on the `tk` entry.** `requirements.txt` lists a package literally named `tk`. This is
> **not** the Tkinter module — Tkinter ships with the Python standard library on Windows
> (`python.org` installer, *tcl/tk and IDLE* component). The PyPI `tk` package is an
> unrelated meta-package that tries to install a Tcl/Tk distribution and commonly fails on
> Windows. **Install everything except `tk`** as shown above; you do not need it.

#### 2c. Verify the environment

```powershell
python --version
python -c "import cv2, numpy, PIL, torch, torchvision, ultralytics, tkinter, sqlite3; print('torch', torch.__version__); print('cv2', cv2.__version__); print('cuda', torch.cuda.is_available())"
```

#### 2d. Model weights — `yolov8x.pt`

`yolov8x.pt` is **not shipped** (`.gitignore` excludes `*.pt` and `*.weights`). Ultralytics
downloads it automatically from its release assets on first use, so the first launch needs
network access. To fetch it ahead of time:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection"
python -c "from ultralytics import YOLO; m = YOLO('yolov8x.pt'); print('yolov8x.pt ready')"
```

The file lands in your **current working directory** — see Section 3 for why that matters.

**Custom weights are not shipped either.** The detector accepts one via
`create_helmet_detector(custom_model_path=...)`, and the custom-model branch
(`process_custom_helmet_detections()`) understands the classes `person`, `helmet`,
`no_helmet`, `motorcycle`, `bicycle`. There is **no training dataset** in the repository and
no training script — you would have to train one yourself.

#### 2e. Assets: present vs. unused

| Path | Status | Used by the code? |
|---|---|---|
| `models/haarcascade_car.xml` | Present | **No** — unreferenced |
| `models/haarcascade_eye.xml` | Present | **No** — unreferenced |
| `models/haarcascade_frontalface_default.xml` | Present | **No** — unreferenced |
| `models/haarcascade_fullbody.xml` | Present | **No** — unreferenced |
| `models/helmet.names` | Present | **No** — the class names come from the loaded model |
| `models/yolov4.cfg` | Present | **No** — Darknet config with no matching weights file |
| `helmet.names` (project root) | Present | **No** — duplicate of `models/helmet.names` |
| `yolov8x.pt` | **Missing** → auto-downloaded | **Yes** — `helmet_detection_yolo8_max_accuracy.py:116` |
| `source/*.py` | Present | **Yes** — the whole application |
| `index.html`, `css/style.css`, `js/app.js` | Present | The browser companion only |

#### 2f. Databases

Both SQLite files are created **automatically on first run** in the current working
directory. Nothing to set up:

- `traffic_violations.db` — tables `violations`, `users`, `system_logs`, `cameras`,
  `violation_images` (+ four indexes), and four default camera rows
  (`source/database_manager.py:32-137`).
- `traffic_system.db` — the `users` table for authentication
  (`source/user_authentication_v1.py:23-36`).

**There is no environment variable, no `.env`, and no config file.**

---

### 3. Launch the Complete Project

#### 3a. The desktop application (the real thing)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection\source"
..\.venv\Scripts\Activate.ps1
python main_app.py
```

**Run it from inside `source/`.** Two reasons:

1. `source/main_app.py:16`, `:24` and `:25` use **flat imports**
   (`from helmet_detection_yolo8_max_accuracy import create_helmet_detector`,
   `from database_manager import DatabaseManager`, `from user_authentication_v1 import UserAuth`).
   These resolve because Python puts the *script's own directory* on `sys.path[0]` — which
   means `python source/main_app.py` from the project root also works for the imports
   (verified: `sys.path[0]` = `...\source`).
2. Running from inside `source/` keeps the SQLite databases and the downloaded
   `yolov8x.pt` **inside `source/`** rather than scattering them at the project root.

If you prefer the project root, `python source/main_app.py` works identically for imports;
be aware the two `.db` files and `yolov8x.pt` will then be created in the project root.

**Expected startup output (console):**

```
Database initialized successfully
Attempting authentication for: <user>, role: <role>
Found user: <user>, stored role: <role>
Authentication successful!
```

followed by the Ultralytics model load:

```
Loading YOLOv8x model (most accurate)...
YOLOv8x model loaded successfully on device: cpu
Model type: YOLOv8x Pretrained
Model warmed up successfully
```

The model load and warm-up happen **at startup**, because `TrafficViolationSystem.__init__`
calls `create_helmet_detector(confidence_threshold=0.6)` (`source/main_app.py:38`) before
the login screen is drawn. On CPU this takes a while the first time.

- Window title: *"Traffic Violation Detection System"*, 1400×900.
- The **login screen** appears first: Username, Password, and a Role dropdown
  (`Administrator` / `Traffic Officer` / `Public`).
- **Stop:** close the window (it stops any running cameras and destroys the root).

#### 3b. The standalone self-test scripts

Each module has a `__main__` block that exercises it without the GUI:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection\source"
..\.venv\Scripts\Activate.ps1

# 1. Authentication self-test — prints PASS/FAIL for 7 cases
python user_authentication_v1.py

# 2. Database self-test — creates test_violations.db, saves one violation, prints stats
python database_manager.py

# 3. Detector smoke test — loads the model and warms it up
python helmet_detection_yolo8_max_accuracy.py
```

Expected output from `user_authentication_v1.py`:

```
Testing authentication system...
Default users created:
- admin/admin123 (Administrator)
- officer1/officer123 (Traffic Officer)
- public/public123 (Public)
- test/test (Traffic Officer)
Auth test: admin/admin123/Administrator -> SUCCESS
Auth test: officer1/officer123/Traffic Officer -> SUCCESS
Auth test: public/public123/Public -> SUCCESS
Auth test: test/test/Traffic Officer -> SUCCESS
Auth test: admin/wrong/Administrator -> FAILED
Auth test: nonexistent/password/Public -> FAILED
Auth test: admin/admin123/Traffic Officer -> FAILED
```

> The first three `-> FAILED` lines are **expected** — they are negative test cases
> (wrong password, non-existent user, wrong role).

#### 3c. Browser companion UI

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection"
python -m http.server 8000
```

- **Port 8000.** Open <http://localhost:8000/>.
- The page is a **simulated** console: role cards that gate the UI, four camera cards with
  detection chips, a demo incident feed (labelled *"Demo incidents — sample data, not model
  output"*), manual entry, a filterable incident log, per-type and per-camera statistics,
  and JSON/CSV export, copy and clear.
- It makes **no** `fetch`, `XMLHttpRequest`, `WebSocket` or `getUserMedia` calls — verified by
  inspection of `js/app.js`. State lives in `localStorage`.
- **Stop with `Ctrl+C`.**

---

### 4. Test the Project

#### 4a. Automated tests — there are none

- `requirements.txt` lists `pytest`, but **there is no test file anywhere in the repository**
  and no `pytest.ini` / `conftest.py` / `tests/` directory.
- `pytest` therefore collects nothing and exits with "no tests ran". Do not treat that as a
  failure of the project — there is simply nothing to collect.

#### 4b. Script-level self-tests (the closest thing to automated tests)

These are the modules' own `__main__` blocks. They are runnable and deterministic.

| # | Command | Expected output |
|---|---|---|
| 1 | `python user_authentication_v1.py` | 4 `-> SUCCESS` lines for the valid credentials and 3 `-> FAILED` lines for the negative cases (wrong password, unknown user, wrong role). The `users` table is created in `traffic_system.db` on first run |
| 2 | `python database_manager.py` | `Database initialized successfully`, then `Violation saved: True`, then `Retrieved 1 violations`, then a `Statistics:` dict. Creates `test_violations.db` with one row |
| 3 | `python helmet_detection_yolo8_max_accuracy.py` | `YOLOv8x Helmet Detection Module`, a `Model Information:` block (`model_name: YOLOv8x`, `ready: True`, `device: cpu|cuda`), then `Module ready for integration with main.py`. **Requires `yolov8x.pt`** — it downloads on first use |

#### 4c. Desktop application — entry points and expected behaviour

| # | Entry point / action | How to exercise it | Expected output |
|---|---|---|---|
| 1 | `python main_app.py` | Launch from `source/` | The *"Traffic Violation Detection System"* login screen (1400×900) appears; the console shows `Database initialized successfully` and the YOLO model load |
| 2 | Login | `admin` / `admin123` / role **Administrator** | `Authentication successful!` in the console; the main interface opens with the header *"Traffic Violation Detection System - Administrator"*, *"User: admin"*, a **Logout** button, the 2×2 camera grid, the **Administrator Controls** panel and the **System Status & Violations** panel |
| 3 | Login | `officer1` / `officer123` / role **Traffic Officer** | The **Traffic Officer Controls** panel appears instead (Record Violation, View Daily Reports, Generate Ticket, Toggle Helmet/Seatbelt/Roundabout) |
| 4 | Login | `public` / `public123` / role **Public** | The **Public Interface** panel appears — read-only, with a **View Statistics** button |
| 5 | Login | A wrong password, an unknown user, or a role that does not match the account | The dialog *"Login Failed — Invalid credentials or role!"* appears; the console prints `Password mismatch` / `User 'x' not found in database` / `Role mismatch: expected ..., got ...` |
| 6 | Login | Select role *Traffic Officer* but sign in as `admin` | Login is rejected — the role must match the stored role exactly |
| 7 | **Start Cam 1** | Click it on any camera card | The camera tile shows live frames; the console logs `[<timestamp>] Camera 1 started`; if the index is unavailable a dialog *"Cannot access Camera 1"* appears |
| 8 | **Stop** | Click it on a camera card | The tile resets to *"Camera 1 / No Signal"*; the console logs `Camera 1 stopped` |
| 9 | **Helmet Detection** toggle | Toggle it on (Administrator or Officer panel) | The button turns green, the console logs `Helmet detection: ON`; with the camera running, detected helmets/persons are boxed (person = blue, motorcycle = yellow, bicycle = cyan) and violations get a thick **red** box labelled *"HELMET VIOLATION"* plus the violation ID |
| 10 | Violation triggered | Point the camera at a rider without a helmet | The status panel counter increments (`Helmet Violations: N`), the violation is written to `traffic_violations.db`, and the console logs `Violation saved: <id> - helmet` |
| 11 | **Seatbelt Detection** / **Roundabout Detection** toggle | Toggle either one | ⚠ **Broken by design in this repo.** The console prints `Camera N error: 'TrafficViolationSystem' object has no attribute 'seatbelt_detector'` and that camera's thread ends. **Use the Helmet toggle only** |
| 12 | **Record Violation** | Officer panel → fill in type / camera / details → **Save Violation** | The dialog *"Violation recorded successfully!"* appears and the counter increments |
| 13 | **View All Reports** | Administrator panel | An 800×600 window with a treeview of Type / Camera / Time / Officer for every row in `violations` |
| 14 | **View Daily Reports** | Officer panel | The same treeview filtered to today |
| 15 | **View Statistics** | Public panel | A window listing total violations, by type, by camera, by officer, daily for the last 7 days and an hourly distribution |
| 16 | **Export Data** | Administrator panel → pick a `.json` or `.csv` path | A dialog *"Export Complete"* appears and the file is written |
| 17 | **Generate Ticket**, **System Settings**, **User Management** | Click any of them | An informational dialog only — these three are placeholders (*"To be implemented"*) |
| 18 | **Logout** | Click it | Running cameras are stopped and the login screen returns |
| 19 | Closing the window | Click the X | Cameras are stopped and the app exits |

#### 4d. Browser companion UI — entry point and expected behaviour

```powershell
python -m http.server 8000
```

| # | Action | Expected output |
|---|---|---|
| 1 | Open <http://localhost:8000/> | The Signal Control Room page renders — role cards, four camera cards with detection chips, the incident log and the statistics panels |
| 2 | Choose a role card | The UI gates itself to that role's capabilities |
| 3 | Toggle a detection chip | The chip changes state; the incident feed is a **simulated** stream labelled *"Demo incidents — sample data, not model output"* |
| 4 | Add a manual incident | It appears in the filterable incident log |
| 5 | Filter, export JSON / CSV, copy, clear | All operate on the browser-side `localStorage` state |
| 6 | Observe the page's network tab | **No** network requests are made — the page never talks to the desktop app or to any server |

#### 4e. What is *not* tested here

- There is **no automated test** of detection accuracy, the SQLite schema, the export
  functions or the GUI.
- Detection behaviour can only be observed with a **real camera** pointed at **real riders**;
  a synthetic test cannot exercise the COCO → rider → head-region CV heuristic.
- The violation record's `details` column is populated from the `HelmetViolation` dataclass;
  the `confidence` column always stores `0.0` for camera-detected violations, because
  `handle_violation()` (`source/main_app.py:374-380`) never passes a confidence value.
- `handle_violation()` calls `self.helmet_detector.detect(processed_frame)` without a
  `camera_id`, so the detector's internal per-camera counters always use camera `0`; the
  correct camera number is only recorded in the outer `violation_data["camera_id"]`.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pip install -r requirements.txt` fails on the `tk` package | `tk` on PyPI is not Tkinter and is unrelated to this project | Install the dependencies individually (`opencv-python numpy pillow ultralytics`) plus `torch torchvision`; Tkinter ships with the Python installer |
| `pip install torch` downloads several GB | `requirements.txt` pins nothing, so pip picks the CUDA build | `python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu` |
| `.\quasar\Scripts\Activate.ps1` fails | `quasar/` is a **Linux** venv snapshot (`pyvenv.cfg` points at `/home/maqbool/anaconda3/bin`, Python 3.10.16) | Ignore `quasar/` entirely and create your own `.venv` |
| `ModuleNotFoundError: No module named 'helmet_detection_yolo8_max_accuracy'` | The app was launched in a way that did not put `source/` on `sys.path` | `cd source` and run `python main_app.py` |
| `ModuleNotFoundError: No module named 'database_manager'` / `'user_authentication_v1'` | Same cause | `cd source` and run `python main_app.py` |
| `FileNotFoundError` / `URL ... yolov8x.pt not found` and the download fails | No internet on first run | Ensure network access, or place `yolov8x.pt` manually in the working directory (see Section 2d) |
| The app hangs at startup for a long time | `TrafficViolationSystem.__init__` loads and warms up YOLOv8x **before** the login screen appears | Expected on CPU; wait for `Model warmed up successfully` |
| `Camera N error: 'TrafficViolationSystem' object has no attribute 'seatbelt_detector'` (or `roundabout_detector`) | The seatbelt/roundabout modules are not in the repository — the imports are commented out | **Expected.** Toggle only the **Helmet** detection switch; the error ends that camera's thread |
| Every rider is flagged as a helmet violation | With the COCO model there are no `helmet`/`no_helmet` classes; the app falls back to `process_coco_detections()`, which judges the head region by **contour circularity** and **HSV uniformity** | Expect false positives. Supply a custom helmet checkpoint via `create_helmet_detector(custom_model_path=...)` for real helmet classes |
| `"Cannot access Camera N"` | No camera at that index, or it is held by another app | Close other camera apps; indices `0`–`3` are tried in order |
| Login always fails with *"Invalid credentials or role!"* | The **role must match** the stored role exactly, or the wrong password was given | Use the seeded pairs: `admin/admin123` (Administrator), `officer1/officer123` and `test/test` (Traffic Officer), `public/public123` (Public). Usernames are lowercased and stripped |
| `sqlite3.OperationalError: unable to open database file` | The working directory is not writable | Run from a writable directory (e.g. `source/`) |
| The `violations` table has no rows after a session | Violations are only written when the helmet detector produces one | Check the console for `Violation saved: ...` |
| `confidence` is always `0.0` in the database | `handle_violation()` never passes a confidence value | Known limitation of the current code, not a setup problem |
| The console prints `Traceback` on a camera thread | An exception inside `update_camera_feed()` | The generic handler catches it and prints `Camera N error: ...`; check whether the seatbelt/roundabout toggle was on |
| `pip install dlib` style native build errors | Not applicable — this project does not use dlib | n/a |
| Ultralytics writes weights to an unexpected folder | `YOLO("yolov8x.pt")` resolves relative to the **current working directory** | Run from `source/` so the file lands in `source/` |
| Port 8000 already in use | Another local server | `python -m http.server 8090` |
| `pytest` reports "no tests ran" | There are no test files | Expected — `pytest` is listed in `requirements.txt` but unused |

---

### 6. Verification Checklist

**Prerequisites and environment**

- [ ] Windows 10/11 and PowerShell are available.
- [ ] Python 3.9+ is in use (`python --version`); 3.12.1 is fine.
- [ ] A camera is connected (indices `0`–`3` are tried).
- [ ] The working directory is `N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection` (or its `source\` subfolder).
- [ ] `quasar\` is **not** used — it is a Linux venv snapshot and cannot be activated on Windows.
- [ ] `.venv\Scripts\Activate.ps1` completes.
- [ ] `python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu` succeeded (or the CUDA build was installed deliberately).
- [ ] `opencv-python`, `numpy`, `pillow`, `ultralytics` are installed and `tkinter` imports from the standard library.
- [ ] `python -c "import cv2, numpy, PIL, torch, torchvision, ultralytics, tkinter, sqlite3"` succeeds.

**Assets**

- [ ] `source\main_app.py`, `source\helmet_detection_yolo8_max_accuracy.py`, `source\database_manager.py`, `source\user_authentication_v1.py` all exist.
- [ ] `yolov8x.pt` is present in the working directory (downloaded on first run).
- [ ] It is understood that no custom helmet checkpoint and no training dataset ship with the repository.
- [ ] It is understood that the Haar cascades in `models\` and `yolov4.cfg` are **unused** by the code.

**Script self-tests**

- [ ] `python user_authentication_v1.py` prints 4 `SUCCESS` and 3 `FAILED` lines.
- [ ] `python database_manager.py` prints `Violation saved: True` and `Retrieved 1 violations`, and creates `test_violations.db`.
- [ ] `python helmet_detection_yolo8_max_accuracy.py` prints the model-information block with `ready: True`.
- [ ] `pytest` collects nothing — this is expected, as no test files exist.

**Launch**

- [ ] `python main_app.py` (from `source\`) opens the 1400×900 login window.
- [ ] The console shows `Database initialized successfully` and `YOLOv8x model loaded successfully on device: <cpu|cuda>` followed by `Model warmed up successfully`.
- [ ] `traffic_violations.db` and `traffic_system.db` are created in the working directory.

**Authentication checks**

- [ ] `admin` / `admin123` / Administrator logs in and shows the Administrator panel.
- [ ] `officer1` / `officer123` / Traffic Officer logs in and shows the Officer panel.
- [ ] `public` / `public123` / Public logs in and shows the read-only Public panel.
- [ ] `test` / `test` / Traffic Officer logs in.
- [ ] A wrong password, an unknown user and a mismatched role each produce *"Invalid credentials or role!"*.
- [ ] The default accounts and the unsalted SHA-256 hashing are understood as development-only
      and are changed before any real use.

**Detection and reporting checks**

- [ ] **Start Cam 1** shows a live feed; **Stop** resets the tile to *"No Signal"*.
- [ ] The **Helmet Detection** toggle turns green and logs `Helmet detection: ON`.
- [ ] A detected violation draws a red *"HELMET VIOLATION"* box, increments the counter, and logs `Violation saved: ...`.
- [ ] The seatbelt/roundabout toggles are understood to raise `AttributeError` and are not used.
- [ ] **Record Violation** shows *"Violation recorded successfully!"*.
- [ ] **View All Reports** and **View Daily Reports** list the stored violations.
- [ ] **View Statistics** shows the totals by type, camera, officer, day and hour.
- [ ] **Export Data** writes a `.json` or `.csv` file to the chosen path.
- [ ] **Generate Ticket**, **System Settings** and **User Management** are understood to be informational placeholders only.
- [ ] **Logout** stops the cameras and returns to the login screen.

**Browser companion checks**

- [ ] `python -m http.server 8000` serves the page and <http://localhost:8000/> opens.
- [ ] The role cards gate the UI, the incident feed is labelled *"Demo incidents — sample data, not model output"*, and the export/copy/clear controls work.
- [ ] It is understood that the page performs **no** detection and makes **no** network requests.

**Limitations acknowledged**

- [ ] Only the **helmet** detector is implemented; seatbelt and roundabout are commented-out imports.
- [ ] No YOLO weights, no custom checkpoint and no training dataset ship with the repository.
- [ ] With the COCO model, helmet presence is inferred by contour circularity and HSV
      uniformity on the head region — false positives are expected.
- [ ] There is no HTTP API and no server; the desktop app is the only runtime that opens
      cameras or the model.
- [ ] The `confidence` column always stores `0.0` for camera-detected violations.
- [ ] The per-camera counters inside the detector always use camera `0`, because
      `detect()` is called without a `camera_id`.
- [ ] The default accounts are development placeholders with unsalted SHA-256 hashes.
