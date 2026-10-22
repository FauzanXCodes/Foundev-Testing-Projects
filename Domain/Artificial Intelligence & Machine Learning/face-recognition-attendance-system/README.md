# FAMS Roll-Call Kiosk

Folder id: `face-recognition-attendance-system`. This repository holds a face-recognition attendance management system: a **Tkinter desktop application** (`AMS_Run.py`) that enrolls students, trains an OpenCV LBPH face model, marks attendance from a webcam, and writes a per-subject CSV. A **companion browser page** (`index.html` + `css/style.css` + `js/app.js`) mirrors the same enrollment / roll-call / CSV-export flows visually, but it never opens a camera, never loads the model, and never performs recognition.

| Surface | Role | Runs recognition? |
|---|---|---|
| `AMS_Run.py` (Tkinter) | Real application: capture, train, mark attendance, write CSV | Yes |
| `testing.py` (Tkinter-free webcam loop) | Quick model sanity check | Yes |
| `index.html` + `js/app.js` (browser) | Companion preview, demo data only | No |

The browser layer was added later on top of the original upstream project; the original Tkinter application and its attribution are unchanged.

## Features

**Implemented and verified in the source**

- **Student enrollment** — `take_img()` in `AMS_Run.py` opens camera 0, detects faces with `haarcascade_frontalface_default.xml`, and saves grayscale crops until the sample counter passes 70 or `q` is pressed.
- **Student registry** — enrollment, name, date and time are appended to `StudentDetails/StudentDetails.csv`.
- **Model training** — `trainimg()` trains `cv2.face.LBPHFaceRecognizer_create` over `TrainingImage/` and writes `TrainingImageLabel\Trainner.yml`.
- **Automatic attendance** — `subjectchoose()` → `Fillattendances()` runs a 20-second capture window, accepts a match when the LBPH confidence is **< 70**, drops duplicate enrollments, and writes `Attendance/<Subject>_<YYYY-MM-DD>_<HH-MM-SS>.csv` with columns `Enrollment,Name,Date,Time`.
- **Manual attendance** — `manually_fill()` → `fill_attendance()` records enrollment/name pairs for a subject without any recognition.
- **Register viewer** — `admin_panel()` opens `StudentDetails/StudentDetails.csv` in a Tk grid view behind a hardcoded login check.
- **Optional MySQL mirroring** — via `pymysql`, one table per session in the `Face_reco_fill` (automatic) and `manually_fill_attendance` (manual) schemas.
- **Standalone helpers** — `testing.py` (LBPH webcam prediction, no threshold, no CSV) and `training.py` (Fisher-face trainer).
- **Browser companion UI** — enrollment wizard, today's roll-call register, filter, CSV export / copy / print, register clear, subject persistence; register state lives in `localStorage`.

**Not available / requires external setup**

- **`TrainingImage/` is absent from the repository.** You must create it (and populate it with captured samples) before `trainimg()` or `training.py` can train anything.
- **No HTTP API and no server.** The desktop app is the only component that touches the camera, the model, the CSVs, or MySQL. The browser page has no backend to talk to.
- **The browser page never recognizes faces.** Its "Run demo walkthrough" button animates a sample counter only, and its roster data is demo/CSV data — not model output.
- **`retrain.py` is not part of this pipeline.** It is a vendored 2015 TensorFlow 1.x Inception-v3 transfer-learning script (Apache 2.0, TensorFlow Authors) that needs TensorFlow 1 and an ImageNet checkpoint; it is unrelated to the LBPH attendance flow.
- **`training.py` is incompatible with the app's own model.** It trains a Fisher recognizer but saves to the same `TrainingImageLabel/trainner.yml` file that `AMS_Run.py` and `testing.py` read as LBPH. Running it overwrites the shipped model with one that `LBPHFaceRecognizer` cannot load.

## Technology Stack

| Layer | Technology | Where it appears |
|---|---|---|
| Desktop GUI | Tkinter (`tkinter`, `ttk`) | `AMS_Run.py` |
| Vision | OpenCV (`cv2`) — Haar cascades + `cv2.face` LBPH | `AMS_Run.py`, `testing.py`, `training.py` |
| Imaging | Pillow (`PIL`) | `AMS_Run.py` (`Image`, `ImageTk`), `training.py` |
| Data | NumPy, pandas | `AMS_Run.py` (attendance DataFrame), `training.py` |
| Optional DB | PyMySQL → MySQL | `AMS_Run.py` (`import pymysql.connections`) |
| Browser UI | Vanilla HTML5 / CSS / JavaScript, no framework, no build step | `index.html`, `css/style.css`, `js/app.js` |
| Persistence (browser) | `localStorage` | `js/app.js` |
| Asset | OpenCV Haar cascade XML | `haarcascade_frontalface_default.xml`, `haarcascade_frontalface_alt.xml` |

`cv2.face` (LBPH) ships only in the **contrib** build, so `opencv-contrib-python` is required — the plain `opencv-python` wheel has no `cv2.face` submodule.

## Prerequisites

- **Windows 10/11** — `AMS_Run.py` uses Windows-style relative paths such as `TrainingImageLabel\Trainner.yml` and `StudentDetails\StudentDetails.csv`. On Linux/macOS those backslashes are not path separators, so the desktop app needs path edits.
- **Python 3.x** (the project was written for Python 3.6; it also runs on modern 3.x for the desktop app).
- **A working webcam** — capture and attendance both use `cv2.VideoCapture(0)`.
- **OpenCV contrib build** — `opencv-contrib-python` (LBPH lives in `cv2.face`).
- **Optional:** a local MySQL server, only if you want the database mirror. The CSV output works without it.
- **Node.js is not required.** The browser page is plain static files.

## Project Structure

```
face-recognition-attendance-system/
├── AMS_Run.py            # Tkinter desktop app — enrollment, training, attendance (entry point)
├── testing.py            # Standalone LBPH webcam prediction loop
├── training.py           # Standalone Fisher-face trainer (overwrites the LBPH model file)
├── retrain.py            # Unrelated vendored TF1 Inception-v3 script (Apache 2.0)
├── training code.txt     # 2-line scratch note about the training command
├── index.html            # Browser companion UI — "FAMS Roll-Call Kiosk"
├── css/style.css         # Browser UI stylesheet
├── js/app.js             # Browser UI logic (localStorage + static CSV read)
├── haarcascade_frontalface_default.xml   # Cascade used by the code
├── haarcascade_frontalface_alt.xml        # Alternate cascade (shipped, unused by the code)
├── TrainingImageLabel/
│   └── Trainner.yml      # Trained LBPH model — 50,332,718 bytes (~48 MiB), "opencv_lbphfaces"
├── TrainingImage/        # NOT PRESENT — capture output folder you must create
├── StudentDetails/
│   └── StudentDetails.csv# Registry: Enrollment,Name,Date,Time
├── Attendance/
│   └── Manually Attendance/
│       └── OOP_2019_02_22_Time_11_32_41.csv   # Sample manual-attendance export
├── AMS.ico / AMS.png / AMS.gif              # App icons and demo animation
├── Screenshot (41..44).png                   # Upstream screenshots
├── LICENSE                # MIT, (c) 2018 Kushal Bhavsar
└── project-metadata.json # Catalog metadata (stack field is inaccurate — see Limitations)
```

## Installation

Windows PowerShell, from the project root:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\face-recognition-attendance-system"

py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

pip install opencv-contrib-python
pip install numpy pandas pillow

# Optional — only if you want the MySQL mirror:
pip install pymysql
```

Notes:

- There is **no `requirements.txt`** in this repository; the command list above is the exact dependency set the source imports.
- Install **only one** OpenCV distribution. `opencv-python` and `opencv-contrib-python` conflict (they install the same `cv2` package). Use `opencv-contrib-python`.
- `tkinter` ships with the Windows python.org installer. If `import tkinter` fails, reinstall Python and enable *tcl/tk and IDLE*.
- Linux/macOS equivalent: `python3 -m venv .venv && source .venv/bin/activate && pip install opencv-contrib-python numpy pandas pillow`, and install the OS Tk package (`python3-tk` on Debian/Ubuntu). The desktop app's Windows-only paths still need editing.

## Environment Configuration

**The code reads no environment variables.** There is no `.env` file and no config file. Everything is hardcoded in `AMS_Run.py`:

| Setting | Value in source | Location |
|---|---|---|
| MySQL host / user / password | `localhost` / `root` / *(empty)* | `AMS_Run.py` (`pymysql.connect`, automatic-attendance branch and manual branch) |
| Automatic-attendance schema | `Face_reco_fill` | `AMS_Run.py`, automatic-attendance branch |
| Manual-attendance schema | `manually_fill_attendance` | `AMS_Run.py`, manual branch |
| Model file | `TrainingImageLabel\Trainner.yml` | `AMS_Run.py` (`trainimg`, `Fillattendances`), `testing.py` |
| Capture folder | `TrainingImage/` | `AMS_Run.py` (`take_img`) |
| Registry CSV | `StudentDetails\StudentDetails.csv` | `AMS_Run.py` (`take_img`, `Fillattendances`, `admin_panel`) |
| Attendance CSV | `Attendance/<Subject>_<date>_<time>.csv` | `AMS_Run.py` (`Fillattendances`) |
| Haar cascade | `haarcascade_frontalface_default.xml` | `AMS_Run.py`, `testing.py`, `training.py` |
| Recognition accept threshold | `conf < 70` | `AMS_Run.py` (`Fillattendances`) |
| Admin credential | hardcoded username/password pair | `AMS_Run.py` (`admin_panel` → `log_in`) |

Three values need editing before the app is usable on a different machine:

1. **Absolute output paths.** `AMS_Run.py` writes the manual-attendance CSV, opens the "Check Sheets" Explorer window, and reads the register from a hardcoded `C:/Users/kusha/PycharmProjects/Attendace managemnt system/...` prefix. On any other machine these point at a directory that does not exist.
2. **MySQL credentials**, if you use the database mirror.
3. **The admin login**, which is a literal username/password comparison inside `AMS_Run.py` with no hashing and no database backing.

## How to Launch

**Desktop application (the real thing)**

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\face-recognition-attendance-system"
.\.venv\Scripts\Activate.ps1
python AMS_Run.py
```

The window title is *FAMS-Face Recognition Based Attendance Management System* (1280×720). Run it from the project root — the cascade XML, the model, the CSVs and the capture folder are all resolved relative to the current working directory.

**Standalone model check** (LBPH prediction, no acceptance threshold, no CSV written)

```powershell
python testing.py
```

**Browser companion UI**

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000/>. The page needs to be served over HTTP (not opened as a `file://` URL) because `js/app.js` fetches `StudentDetails/StudentDetails.csv`; over `file://` the browser blocks the request and the page shows the "serve this folder over HTTP" hint.

**How the browser page reaches the desktop app:** it does not. There is no channel. The page re-implements the same fields, the same CSV columns and the same `conf < 70` rule as *documentation*, and stores its register in `localStorage` so it can be exported as CSV for comparison against the desktop app's output.

**Stopping:** press `q` in the camera window or `Esc` during the attendance capture to exit the capture loop, then close the Tk window (it asks for confirmation). Stop the static server with `Ctrl+C`.

## Model and Dataset Setup

**Present in the repository**

| Path | Size | Content |
|---|---|---|
| `TrainingImageLabel/Trainner.yml` | 50,332,718 bytes (~48 MiB) | OpenCV LBPH model (`opencv_lbphfaces`) trained by the original author |
| `haarcascade_frontalface_default.xml` | 930,127 bytes | Cascade loaded by `AMS_Run.py`, `testing.py`, `training.py` |
| `haarcascade_frontalface_alt.xml` | 676,709 bytes | Alternate cascade, shipped but not referenced by the code |
| `StudentDetails/StudentDetails.csv` | 262 bytes | Header `Enrollment,Name,Date,Time` plus three real rows (e.g. `6007,Kushal,2019-02-26,14:45:10`) and many empty rows from earlier test runs |
| `Attendance/Manually Attendance/OOP_2019_02_22_Time_11_32_41.csv` | 116 bytes | Sample manual export, header `ID,ENROLLMENT,NAME,DATE,TIME` |

**Missing — you must create it**

- **`TrainingImage/`** — the capture folder does not exist. `trainimg()` catches the failure and shows *"please make "TrainingImage" folder & put Images"*. Create it before training.
- **Sample images** — no face samples are shipped, so the shipped `Trainner.yml` can only recognise the original author's enrolled faces.

**How capture files are named and read**

`take_img()` writes `TrainingImage/<Name>.<Enrollment>.<N>.jpg` (grayscale face crop, one per detection). `getImagesAndLabels()` recovers the label with `os.path.split(path)[-1].split(".")[1]`, i.e. the **enrollment number** is field index 1 — so the `Name.Enrollment.N.jpg` ordering matters.

**Training**

- Inside the app: press **Train Images** (`trainimg()`), which trains LBPH and writes `TrainingImageLabel\Trainner.yml`.
- Standalone: `python training.py` trains a **Fisher** recognizer and writes `TrainingImageLabel/trainner.yml` — the same file. Do not use it unless you also switch the app to `createFisherFaceRecognizer_create`.

**Database setup**

No schema file ships. The app creates one table per session at runtime (`CREATE TABLE <Subject>_<YYYY_MM_DD>_Time_<H>_<M>_<S>` with columns `ID, ENROLLMENT, NAME, DATE, TIME`) inside the `Face_reco_fill` or `manually_fill_attendance` schema. You only need to create the schema and grant access to your MySQL user.

## Usage

### 1. Enroll a student

1. Run `python AMS_Run.py`.
2. Type the **enrollment number** in *Enter Enrollment* (digits only — `testVal` rejects non-digits) and the **student name** in *Enter Name*.
3. Press **Take Images**. The webcam opens, the cascade draws a blue rectangle on each detected face, and a grayscale crop is saved per detection.
4. Press `q` to stop early, or let it stop by itself once the sample counter exceeds 70.
5. The notification reads *"Images Saved for Enrollment : <id> Name : <name>"* and a row is appended to `StudentDetails/StudentDetails.csv`.

Realistic values: enrollment `15624031`, name `Aditi Sharma`.

### 2. Train the model

Press **Train Images**. The app runs `getImagesAndLabels("TrainingImage")`, trains the LBPH recognizer and saves `TrainingImageLabel\Trainner.yml`; the notification reads *"Model Trained"*. For a ten-person set this takes roughly 5–10 minutes on the reference machine.

### 3. Mark attendance automatically

1. Press **Automatic Attendance**.
2. Enter the subject (e.g. `OOP`) and press **Fill Attendance**.
3. The camera runs for 20 seconds. Faces are matched against the model; a match with `conf < 70` draws a green rectangle and the label `<Id>-<Name>`, anything else draws a red rectangle labelled `Unknown`.
4. On exit the app writes `Attendance/OOP_2026-10-21_14-05-33.csv` (subject, date, `HH-MM-SS`) with columns `Enrollment,Name,Date,Time`, duplicates removed per enrollment, and opens the CSV in a table window.
5. If MySQL is reachable, the same row is mirrored into a per-session table in `Face_reco_fill`.

### 4. Mark attendance manually

Press **Manually Fill Attendance**, enter a subject, then type enrollment + name and press **Enter Data** for each student. Press **Convert to CSV** to export the session table to CSV (note: the export path is hardcoded to the original author's machine and must be edited).

### 5. Review the register

Press **Check Register students** and log in with the credentials hardcoded in `AMS_Run.py` to view `StudentDetails/StudentDetails.csv` in a table.

### 6. Use the browser companion page

```powershell
python -m http.server 8000
```

Open <http://localhost:8000/>:

- **Enrollment wizard** — enter enrollment + name, walk through the (simulated) capture step, finish. The enrollment is stored in `localStorage` only.
- **Today's roll-call** — the roster loads from `StudentDetails/StudentDetails.csv` when the folder is served over HTTP; add students manually with **Add to register**, or mark everyone present with **Mark all present**.
- **Filter / Export CSV / Copy CSV / Print / Clear register** — all operate on the browser-side register.

Every number on that page is browser-side demo state. It is not a model output.

## API Documentation

**This project exposes no HTTP API.** There is no server, no Flask/FastAPI/Django app, and no route table anywhere in the source; the only runtime surfaces are the Tkinter desktop app and a static file server for the browser page, whose `js/app.js` reads exactly one file (`StudentDetails/StudentDetails.csv`) via `fetch()` and never posts to a service. If you need an API, you would have to add one — nothing to document against today.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `AttributeError: module 'cv2' has no attribute 'face'` | `opencv-python` installed instead of the contrib build | `pip uninstall -y opencv-python` then `pip install opencv-contrib-python` |
| `ModuleNotFoundError: No module named 'pymysql'` | Optional MySQL mirror dependency missing | `pip install pymysql` — or ignore, the app catches the error and continues with CSV output only |
| *"please make "TrainingImage" folder & put Images"* | No capture folder and no samples | `mkdir TrainingImage`, then use **Take Images** to populate it |
| *"Model not found,Please train model"* | `TrainingImageLabel\Trainner.yml` missing or unreadable | Train from the app, or restore the shipped file |
| `FileNotFoundError` on `StudentDetails\StudentDetails.csv` | Run from the wrong working directory, or a non-Windows OS | `cd` to the project root; on Linux/macOS replace the backslashes with `/` |
| Manual-attendance CSV export fails | Hardcoded absolute path `C:/Users/kusha/PycharmProjects/...` | Edit `create_csv()` in `AMS_Run.py` to a path under your project folder |
| "Check Sheets" opens nothing / Explorer window missing | Same hardcoded absolute path in `subprocess.Popen(r'explorer /select,...')` | Edit the path in `AMS_Run.py` |
| Webcam opens but no face is detected | Poor lighting, or a cascade mismatch | Improve lighting; the app uses `detectMultiScale(gray, 1.3, 5)` for capture and `1.2, 5` for attendance |
| Camera opens but the frame is black | Camera index 0 is busy or the device is virtual | Close other camera apps; the app hardcodes `cv2.VideoCapture(0)` |
| `import tkinter` fails | Tcl/Tk not installed | Reinstall Python with *tcl/tk and IDLE* enabled |
| Browser page shows "Could not read StudentDetails/StudentDetails.csv" | Page opened over `file://` | Serve the folder: `python -m http.server 8000` |
| Model loads but every face is "Unknown" | Trained model belongs to different faces, or `training.py` overwrote the LBPH file with a Fisher model | Retrain from the app (**Train Images**), never with `training.py` |

## Limitations

- **Windows-only paths** in the desktop app (`TrainingImageLabel\Trainner.yml`, `StudentDetails\StudentDetails.csv`), plus three hardcoded absolute paths into the original author's home directory.
- **Hardcoded admin credential** in `AMS_Run.py`, stored in plain text with no hashing, no lockout, and no session handling.
- **The shipped `Trainner.yml` is only meaningful for the faces it was trained on** — no samples ship with the repo.
- **`retrain.py` is dead weight** for this application: a TensorFlow 1.x Inception-v3 transfer-learning script unrelated to the LBPH pipeline, and it will not import on modern TensorFlow.
- **`project-metadata.json` overstates the stack.** It lists `OpenCV/face_recognition` and `SQLite`, plus a goal mentioning *"anti-spoof basic check"*. There is no `face_recognition` or dlib import anywhere, the database is MySQL (optional) and not SQLite, and there is no anti-spoofing logic in the code.
- **No HTTP API, no server, no web deployment** of the recognition pipeline; the browser page is a visual mirror only.
- **No anti-spoofing / liveness checks** — a printed photo of an enrolled person can be matched.
- **Single-camera, single-session workflow**: camera 0 only, a fixed 20-second attendance window, no multi-camera support and no concurrency handling.
- **Face crops are stored unencrypted** on disk in `TrainingImage/`.
- **The upstream README's dependency list is incomplete** — it omits `opencv-contrib-python` and `pymysql`.

## License and Credits

- **Original project:** *Attendance Management system using Face Recognition* by **Kushal Bhavsar** — <https://github.com/Spidy20/Attendace_management_system>. Upstream README, screenshots and `AMS.gif` are retained in this repository.
- **License:** MIT — see `LICENSE`, © 2018 Kushal Bhavsar. The MIT terms cover the original code in this repository.
- **`retrain.py`** is a vendored TensorFlow example under the **Apache License 2.0**, © 2015 The TensorFlow Authors (its header is reproduced at the top of the file). It is not covered by the MIT grant.
- **The browser UI** (`index.html`, `css/style.css`, `js/app.js`) and this documentation were added later on top of the upstream project. They are not part of the upstream release and no ownership of the upstream code is claimed. The browser UI performs no recognition and displays no fabricated model outputs — all of its numbers are labeled demo or locally stored data.
