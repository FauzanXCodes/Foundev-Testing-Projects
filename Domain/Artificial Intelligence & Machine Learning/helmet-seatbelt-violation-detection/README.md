# Signal Control Room

Folder id: `helmet-seatbelt-violation-detection`. This repository is a **traffic-violation monitoring desktop application** built with Tkinter and OpenCV: operators sign in with a role, watch up to four camera feeds, and the app detects riders **without a helmet**, logs each violation into a SQLite database, and produces reports, statistics and JSON/CSV exports. A **companion browser page** (`index.html` + `css/style.css` + `js/app.js`) named *Signal Control Room* mirrors the operator console visually, but it is a local, demo-data preview — it never loads a model and never talks to a server.

| Surface | Role | Loads the model? |
|---|---|---|
| `source/main_app.py` (Tkinter) | Real application: login, camera feeds, detection toggles, violation log | Yes (Ultralytics YOLO) |
| `index.html` + `js/app.js` (browser) | Operator-console preview with a simulated incident feed | No |

> **Scope honesty.** Only the **helmet** detector is implemented. The seatbelt and roundabout detectors are referenced in the UI but their modules are not in this repository (the imports are commented out in `source/main_app.py`).

## Features

**Implemented and verified in the source**

- **Role-based login** — `setup_login_interface()` + `login()` accept a username, password and a role chosen from `Administrator`, `Traffic Officer`, `Public`; `UserAuth.authenticate()` verifies all three against the `users` table of `traffic_system.db`.
- **Password hashing** — `UserAuth.hash_password()` stores SHA-256 hex digests (`hashlib.sha256`), never plaintext.
- **Role-specific control panels** — `setup_admin_controls()` (reports, settings, export, user management), `setup_officer_controls()` (record violation, daily reports, ticket, detection toggles), `setup_public_controls()` (view-only statistics).
- **Four-camera grid** — `setup_camera_section()` builds a 2×2 grid; `start_camera()` opens `cv2.VideoCapture(camera_idx)` on a background daemon thread and `update_camera_feed()` renders frames resized to 300×200.
- **Helmet violation detection** — `YOLOv8xHelmetDetector.detect()` returns a processed frame plus a list of `HelmetViolation` dataclass instances; violations are boxed in red and labelled `HELMET VIOLATION`.
- **Two violation-inference strategies** — a custom helmet model path (`process_custom_helmet_detections`: direct `no_helmet` class, plus person-near-motorcycle-without-helmet) and a COCO path (`process_coco_detections`: find riders on a vehicle, then judge the head region by shape and colour).
- **Violation persistence** — `DatabaseManager.save_violation()` writes to `violations` in `traffic_violations.db`; `get_all_violations()`, `get_violations_by_date()`, `get_violations_by_type()`, `get_violations_by_camera()` and `get_violation_statistics()` feed the report windows.
- **Manual violation entry** — `create_manual_violation_window()` records type, camera, details and officer without any detection.
- **Data export** — `export_data()` writes JSON or CSV to a path chosen with a file dialog.
- **Browser companion UI** — role cards that gate the UI, four camera cards with detection chips, a simulated demo incident feed, manual entry, filterable incident log, per-type / per-camera statistics, and JSON / CSV export / copy / clear.

**Not available / requires external setup**

- **Seatbelt and roundabout detection are not implemented.** `source/main_app.py` imports them as commented-out lines (`#from seatbelt_detection_v2 import SeatbeltDetector`), so `self.seatbelt_detector` and `self.roundabout_detector` are never assigned. Toggling either switch in the GUI raises `AttributeError` inside the camera thread; the generic handler in `update_camera_feed()` prints `Camera N error: ...` and ends that camera's thread.
- **No YOLO weights ship with the repository.** `YOLOv8xHelmetDetector.setup_model()` passes the literal string `"yolov8x.pt"`, and `.gitignore` excludes `*.pt` / `*.weights`. Ultralytics fetches that release asset on first use when it is not already present, so the first launch needs network access; a custom helmet checkpoint can be supplied instead via `custom_model_path`.
- **The Haar cascades in `models/` are not used by the code.** `haarcascade_car.xml`, `haarcascade_eye.xml`, `haarcascade_frontalface_default.xml`, `haarcascade_fullbody.xml`, `models/helmet.names` and `models/yolov4.cfg` are unreferenced — the detector's class names come from the loaded model, and `yolov4.cfg` has no matching weights file.
- **No HTTP API and no server.** The desktop app is the only runtime that opens cameras or the model.
- **The browser page never detects anything.** Its incident feed is labelled *Demo incidents — sample data, not model output*, and is generated in JavaScript.
- **Three admin buttons are placeholders** — `generate_ticket()`, `system_settings()` and `user_management()` only show an informational message box.
- **`quasar/` is a Linux virtualenv snapshot** (`bin/`, `lib/`, `lib64`, `pyvenv.cfg` pointing at `/home/maqbool/anaconda3/bin`, Python 3.10.16). It cannot be activated on Windows; create your own environment.

## Technology Stack

| Layer | Technology | Where it appears |
|---|---|---|
| Desktop GUI | Tkinter (`tkinter`, `ttk`, `messagebox`, `filedialog`) | `source/main_app.py` |
| Detection | Ultralytics YOLO (YOLOv8x), PyTorch backend | `source/helmet_detection_yolo8_max_accuracy.py` |
| Vision | OpenCV (`cv2`) — capture, resize, drawing, Canny/contours, HSV | same file, plus `source/main_app.py` |
| Imaging | Pillow (`PIL` / `ImageTk`) | `source/main_app.py` (frame → Tk image) |
| Persistence | SQLite3 (`sqlite3`) — two databases | `source/database_manager.py`, `source/user_authentication_v1.py` |
| Browser UI | Vanilla HTML5 / CSS / JavaScript, no framework, no build step | `index.html`, `css/style.css`, `js/app.js` |
| Persistence (browser) | `localStorage` | `js/app.js` |
| Concurrency | `threading` (one daemon thread per camera) | `source/main_app.py` |

## Prerequisites

- **Windows 10/11** (the app itself is cross-platform Tkinter; only the bundled `quasar/` venv is Linux-only).
- **Python 3.9+** — the code uses `typing` generics and dataclasses; 3.10+ is recommended.
- **A camera** — camera index `0`–`3` via `cv2.VideoCapture(idx)`. Without one, the app still launches, logs in, and lets you record violations manually.
- **Disk space and time for PyTorch** — `torch` + `torchvision` + `ultralytics` are large downloads (CUDA build ≈ 2–3 GB).
- **Network access on first run** if you rely on Ultralytics downloading `yolov8x.pt`.
- **Optional:** a custom helmet checkpoint (`.pt`) to replace the COCO model.
- **Node.js is not required** — the browser page is plain static files.

## Project Structure

```
helmet-seatbelt-violation-detection/
├── source/
│   ├── main_app.py                              # Tkinter application — login, 4 cameras, detection toggles, reports
│   ├── helmet_detection_yolo8_max_accuracy.py   # YOLOv8x helmet detector + HelmetViolation dataclass
│   ├── database_manager.py                      # SQLite violation store, reports, statistics, export
│   └── user_authentication_v1.py                # SHA-256 credential store, default users, role checks
├── index.html                                   # Browser companion UI — "Signal Control Room"
├── css/style.css                                # Browser UI stylesheet
├── js/app.js                                    # Browser UI logic (demo feed, localStorage, exports)
├── models/                                      # UNUSED by the code
│   ├── haarcascade_car.xml
│   ├── haarcascade_eye.xml
│   ├── haarcascade_frontalface_default.xml
│   ├── haarcascade_fullbody.xml
│   ├── helmet.names                             # person, helmet, no_helmet, motorcycle, bicycle
│   └── yolov4.cfg                               # Darknet config, no weights next to it
├── helmet.names                                 # Duplicate of models/helmet.names (also unreferenced)
├── docs/
│   ├── UserAuth_V2.odt                          # Author's design document
│   └── UserLogin_Trouble.txt                    # A generic Flask login snippet — NOT this app's backend
├── quasar/                                      # Linux virtualenv snapshot — unusable on Windows
├── requirements.txt
├── .gitignore                                   # excludes *.pt, *.weights, *.db, venvs
├── LICENSE                                      # MIT, © 2025 Maqboor ur Rahman
├── README.md                                    # Upstream README (short, clone instructions only)
└── project-metadata.json                        # Catalog metadata
```

**Files created at runtime** (in the current working directory, both excluded by `.gitignore`):

- `traffic_violations.db` — `DatabaseManager` (violations, users, system_logs, cameras, violation_images).
- `traffic_system.db` — `UserAuth` (users table).

## Installation

Windows PowerShell, from the project root:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection"

py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

pip install opencv-python numpy pillow torch torchvision ultralytics pytest
```

Notes:

- **Do not use `requirements.txt` verbatim.** It lists `tk`, which is not a PyPI package — `tkinter` is part of the standard library and ships with the python.org Windows installer. The install command above is the same set with `tk` removed. `pytest` is optional and only relevant if you add tests.
- **Install a CPU-only PyTorch if you do not need a GPU** to keep the download small:
  ```powershell
  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
  pip install opencv-python numpy pillow ultralytics
  ```
- **Do not reuse `quasar/`.** It is a Linux virtualenv (`bin/`, `lib64`, `home = /home/maqbool/anaconda3/bin`); it will not activate on Windows.
- Linux/macOS equivalent: `python3 -m venv .venv && source .venv/bin/activate && pip install opencv-python numpy pillow torch torchvision ultralytics`.

## Environment Configuration

**The code reads no environment variables and no config file.** Everything is hardcoded:

| Setting | Value in source | Location |
|---|---|---|
| Violation database | `traffic_violations.db` | `DatabaseManager.__init__(db_path=...)` |
| Credential database | `traffic_system.db` | `UserAuth.__init__(db_path=...)` |
| Model file | `"yolov8x.pt"` (or `custom_model_path` if it exists) | `YOLOv8xHelmetDetector.setup_model()` |
| Confidence threshold | `0.6` | `create_helmet_detector(confidence_threshold=0.6)` in `main_app.py` |
| IoU threshold | `0.45` | `YOLOv8xHelmetDetector.__init__` default |
| Compute device | `auto` → `cuda` → `mps` → `cpu` | `setup_model()` |
| Camera indices | `0`–`3` | `start_camera(camera_idx)` |
| Default cameras seeded | 1 Main Entrance / 2 Roundabout / 3 Highway / 4 Parking Area | `DatabaseManager.setup_default_cameras()` |
| Seeded users | `admin`, `officer1`, `public`, `test` — passwords are hardcoded in the source | `UserAuth.create_default_users()` |
| Window | 1400×900, background `#2c3e50` | `TrafficViolationSystem.__init__` |

Because the two database paths are **relative**, the files are created in whatever directory you launch from. Running `python source/main_app.py` from the project root therefore puts both `.db` files in the project root.

**Recommended before any real use:** change the seeded passwords (they are stored as unsalted SHA-256 digests) or delete the seeded rows, and confirm the `officer` column is populated for your jurisdiction.

## How to Launch

**Desktop application (the real thing)**

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\helmet-seatbelt-violation-detection"
.\.venv\Scripts\Activate.ps1
python source/main_app.py
```

`source/main_app.py` imports its siblings with flat module names (`from helmet_detection_yolo8_max_accuracy import create_helmet_detector`), so it must be launched in a way that puts `source/` on `sys.path` — running the file by path does this automatically. Launching it with `cd source; python main_app.py` also works, but then the two SQLite files are created inside `source/`.

Log in with one of the seeded accounts (see `source/user_authentication_v1.py` for the hardcoded default credentials) and pick the matching role in the dropdown — the role must equal the role stored for that user or authentication fails.

**Browser companion UI**

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000/>. Serving over HTTP (rather than `file://`) is recommended so the page behaves like a normal origin, although this page does not fetch any data file.

**How the browser page reaches the desktop app:** it does not. There is no API to call and no shared database — the page keeps its own incident log in `localStorage` and its "camera feeds" are labeled *"No signal — live feeds need the desktop app"*. Its Export JSON / Export CSV buttons produce the same shape of record that `DatabaseManager.save_violation()` writes, so you can compare the two side by side.

**Stopping:** close the desktop window (the `on_closing()` handler stops every running camera thread before quitting). Stop the static server with `Ctrl+C`.

## Model and Dataset Setup

**Present in the repository**

| Path | Status |
|---|---|
| `models/haarcascade_car.xml`, `haarcascade_eye.xml`, `haarcascade_frontalface_default.xml`, `haarcascade_fullbody.xml` | Present but **not referenced** by any source file — the detector is YOLO-only |
| `models/helmet.names`, `helmet.names` | Present but **not loaded** by the code; the class list comes from the model object |
| `models/yolov4.cfg` | Present, but it is a Darknet architecture file with **no matching `.weights`**, and the code never loads it |
| `source/main_app.py`, the three `source/*.py` modules | All present and complete |
| `traffic_violations.db`, `traffic_system.db` | **Not present** — created automatically on first launch |

**Missing — you must supply it**

- **Model weights.** The detector calls `YOLO("yolov8x.pt")`. Ultralytics resolves that name to a published release asset and downloads it on first use if it is not already in the working directory. A first launch therefore needs internet access and a few hundred megabytes of disk.
- **A custom helmet model** (recommended for real deployments). To use one, pass its path to `create_helmet_detector(custom_model_path=...)` in `source/main_app.py`. The custom path expects the class set `person`, `helmet`, `no_helmet`, `motorcycle`, `bicycle` — exactly the contents of `helmet.names` — and switches the detector to `process_custom_helmet_detections()`.
- **Training data / annotation set.** The repository contains no dataset and no training script for a helmet model; the upstream project metadata describes the goal as a custom-labelled dataset, but no such data ships here.

**Database setup**

Nothing to do. `DatabaseManager.init_database()` creates `violations`, `users`, `system_logs`, `cameras` and `violation_images` with `CREATE TABLE IF NOT EXISTS`, adds indexes on `timestamp`, `type`, `camera_id` and `officer`, and seeds the four default cameras. `UserAuth.init_database()` creates the `users` table in the second database and `create_default_users()` seeds the default accounts.

## Usage

### 1. Sign in

1. Run `python source/main_app.py`.
2. Choose a role from the dropdown — `Administrator`, `Traffic Officer` or `Public`.
3. Enter a seeded username and its password. The role must match the account's stored role.

Wrong credentials produce the messagebox *"Login Failed — Invalid credentials or role!"*.

### 2. Start a camera

In the **Camera Feeds** grid, press **Start Cam 1** (… **4**) for Administrator and Traffic Officer roles. The feed renders at 300×200 in the tile; the status strip reports `Camera N started`. Press **Stop** to release the device. Public-role accounts do not get camera buttons.

### 3. Toggle detection

Press **Helmet Detection** (or **Toggle Helmet**) to switch helmet detection on and off; the button colour flips green/red and the status strip shows `Helmet detection: ON`.

Do **not** toggle *Seatbelt* or *Roundabout*: those detector objects do not exist in this repository, so enabling them raises `AttributeError` inside the camera thread and kills that camera's feed.

### 4. Read the violation log

Every detected violation is written to `violations` with `violation_id`, `type`, `camera_id`, `timestamp`, `confidence`, `officer`, `details`, `image_path`, `processed`. On screen, the counters in **System Status & Violations** increase per type, and the frame shows the rider's box in thick red with a `HELMET VIOLATION` banner and a `!` marker.

### 5. Record a violation by hand

As a Traffic Officer, press **Record Violation**, choose the violation type and camera, type the details, and press **Save Violation**. The row is written to SQLite and the counters update.

### 6. Report and export

- Traffic Officer → **View Daily Reports** (today only) and **Generate Ticket** (placeholder dialog).
- Administrator → **View All Reports** (a `ttk.Treeview` of type / camera / time / officer) and **Export Data** (JSON or CSV to a chosen path).
- Public → **View Statistics** (counts per violation type).

### 7. Use the browser companion page

```powershell
python -m http.server 8000
```

Open <http://localhost:8000/>:

1. Pick a role card — **Traffic Officer**, **Administrator** or **Public**. The choice is persisted in `localStorage` and re-gates the panels.
2. Toggle the **Helmet** chip per camera. **Seatbelt** and **Roundabout** are rendered as disabled *stub* chips that state that the detector module is a commented-out import.
3. Press **Play simulated feed** to generate demo incidents (clearly labelled *sample data, not model output*), or use **Record manual violation** for your own entries.
4. Filter the incident log by text, type and source; copy it as JSON, export it as CSV, or clear it.
5. The **Stats** tab (Administrator) shows per-type and per-camera bar counts computed from the browser-side log.

## API Documentation

**This project exposes no HTTP API.** There is no server, no Flask/FastAPI/Django application and no route table in the source; `docs/UserLogin_Trouble.txt` contains a generic Flask login snippet that is *not* part of this application and is not wired to anything. The only runtime surfaces are the Tkinter desktop app and a static file server for the browser page, whose `js/app.js` performs no network requests at all.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'ultralytics'` | Detector dependency missing | `pip install ultralytics torch torchvision` |
| `ImportError: YOLOv8 (ultralytics) is required` at startup | The module's guarded import failed, so `YOLO_AVAILABLE` is `False` | Install the packages; the error message printed at import time says so |
| Detector construction fails / model never loads | `yolov8x.pt` cannot be resolved or downloaded | Ensure network access on first run, or point `custom_model_path` at a local `.pt` |
| `Camera N error: 'YOLOv8xHelmetDetector' object has no attribute ...` | An exception inside the detection call | Check the printed traceback; the detector catches its own errors and draws `DETECTION ERROR CAM N` |
| Camera tile stays on "No Signal" | Device index busy or absent | Close other camera apps; `start_camera()` raises *"Cannot access Camera N"* when `VideoCapture` does not open |
| Seatbelt / Roundabout toggle breaks the camera feed | `self.seatbelt_detector` / `self.roundabout_detector` are never assigned (commented-out imports) | Leave those toggles off — the modules are not in this repository |
| `Login Failed` with correct credentials | The role in the dropdown does not match the account's stored role, or the username was typed with different case | `UserAuth.authenticate()` lowercases the username and compares the role literally |
| Cannot find `traffic_violations.db` | The file is created in the **current working directory**, not next to the source | Look in the directory you launched from, or `cd` into the project root before launching |
| `pip install tk` fails | `tk` is not a real PyPI package | Remove it; `tkinter` is bundled with Python |
| `quasar/` venv will not activate | It is a Linux virtualenv snapshot | Create a fresh `.venv` on your platform |
| Ultralytics writes to `runs/detect/` or caches models in the user profile | Normal ultralytics behaviour | Leave as is, or set `YOLO_CONFIG_DIR` if you need to relocate it |
| Browser page shows no incidents | The demo feed must be started | Press **Play simulated feed** — no incidents are generated automatically |

## Limitations

- **Two of the three advertised detectors do not exist** in the repository, and toggling them breaks the camera thread.
- **No model weights ship with the project**, and the default model is a *generic COCO* detector that has no helmet-specific classes — the helmet decision is then made by classical CV heuristics (head-region shape and colour), not by a learned helmet classifier.
- **No plate detection, no vehicle tracking, no evidence-image pipeline** in the shipped code, despite the upstream goal mentioning "detection + plate crop pipeline and evidence log". `DatabaseManager.save_violation_image()` and the `violation_images` table exist, but nothing calls them.
- **The COCO fallback is a heuristic, and the decision is confidence-gated rather than a single AND/OR test.** `check_helmet_with_cv()` crops the top 25 % of the rider's box, then runs two tests and picks the winner by confidence: the **shape** test (5×5 Gaussian blur → Canny (30, 100) → largest external contour → circularity `4πA/P²`) returns *helmet* only when `circularity > 0.65` (confidence `min(0.9, c + 0.2)` ≥ 0.85) and *no helmet* otherwise (confidence `1 − c`); the **colour** test (HSV) returns *helmet* when the brightness std `< 30` and the mean saturation is in `50..200` (confidence `0.75`, method `uniform_color`), *helmet* with lower confidence when the brightness std is `< 30` alone (`0.6`, `uniform_brightness`), and *no helmet* otherwise (`0.7`, `varied_texture`). The shape result is used when its confidence `> 0.7`, the colour result when its confidence `> 0.6`, and **everything else falls through to "no helmet" with confidence `0.8`** (method `cv_analysis`). Because `0.6` is not `> 0.6`, the `uniform_brightness` branch can never win on its own. This is lighting-, resolution- and helmet-colour-sensitive and will produce both false positives and false negatives.
- **Uncalibrated threshold** — `conf = 0.6` is a hard-coded constant with no validation set behind it.
- **No liveness / rider-identification**: the system cannot tell *who* is riding, so a violation cannot be attributed to a person or a plate.
- **Plain SHA-256 password hashing with no salt** and seeded accounts whose credentials are in the source file.
- **All database paths, the model name and the thresholds are hardcoded** — no configuration layer, no environment variables.
- **No HTTP API, no web front end** for live feeds, no remote operation, no authentication on any network boundary.
- **No tests.** `requirements.txt` lists `pytest`, but the repository contains no test suite (the upstream tree lists a `tests/` folder that is not present here).
- **Four placeholder features** (`generate_ticket`, `system_settings`, `user_management`) and a `docs/UserLogin_Trouble.txt` that shows a Flask example which is not part of this application.
- **A large, unusable `quasar/` virtualenv snapshot** is committed to the repository.

## License and Credits

- **Original project:** *Traffic Violation Detection System* by **Maqboor ur Rahman (@3T-InfoTinker)** — <https://github.com/3TInfoTinker/traffic_violation_detection>. Upstream README, `docs/` material and the MIT grant are retained.
- **License:** MIT — see `LICENSE`, © 2025 Maqboor ur Rahman.
- **Third-party assets:** the OpenCV Haar cascade XMLs and `models/yolov4.cfg` are redistributed OpenCV/Darknet artefacts with their own upstream licences (Apache-2.0 for OpenCV); the YOLOv8x weights are fetched from the Ultralytics release and are governed by the **AGPL-3.0** Ultralytics licence.
- **The browser UI** (`index.html`, `css/style.css`, `js/app.js`) and this documentation were added later on top of the upstream project. They are not part of the upstream release, no ownership of the upstream code is claimed, and the page deliberately labels every generated incident as demo data — it performs no detection and fabricates no model output.
