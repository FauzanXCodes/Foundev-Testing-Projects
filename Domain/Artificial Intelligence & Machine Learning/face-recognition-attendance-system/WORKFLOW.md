# Roll-Call Kiosk (face-recognition-attendance-system) — Setup & Test Workflow

**Folder id:** `face-recognition-attendance-system`
**UI name:** Roll-Call Kiosk (the Tkinter app's own title is *"FAMS-Face Recognition Based Attendance Management System"*)
**Stack:** OpenCV contrib build (`cv2.face` LBPH) · NumPy · pandas · Pillow · PyMySQL + MySQL (optional) · Tkinter (stdlib) · vanilla HTML/CSS/JS (browser companion)
**Entry point:** `AMS_Run.py` (Tkinter desktop application)

**What it actually is:** a **desktop** face-recognition attendance system. It enrolls students
by capturing webcam samples into `TrainingImage/`, trains an OpenCV **LBPH** recognizer into
`TrainingImageLabel\Trainner.yml`, marks attendance from the webcam over a fixed 20-second
window (accepting a match when the LBPH confidence is `< 70`), writes a per-subject CSV into
`Attendance/`, and optionally mirrors each session into MySQL.

The browser page at the project root (`index.html` + `css/style.css` + `js/app.js`) mirrors
the enrollment / roll-call / CSV-export flows **visually only** — it never opens a camera,
never loads the model and never performs recognition. Its only external read is
`fetch("StudentDetails/StudentDetails.csv")`.

**Runtime surfaces:**

| Surface | Kind | Port | Notes |
|---|---|---|---|
| `python AMS_Run.py` | Tkinter desktop app | n/a | The real application — **no HTTP server** |
| `python testing.py` | Standalone LBPH webcam loop | n/a | Manual model sanity check |
| `python training.py` | Standalone **Fisher** trainer | n/a | ⚠ overwrites the LBPH model file — see Troubleshooting |
| `python -m http.server 8000` | Static server for the browser page | 8000 | Demo data only |

---

### 1. Prerequisites

- **Windows 10/11** — this is effectively a hard requirement. `AMS_Run.py` uses Windows-style
  relative paths such as `TrainingImageLabel\Trainner.yml` and
  `StudentDetails\StudentDetails.csv`; on Linux/macOS the backslashes are not path
  separators and those lookups fail. It also uses `AMS.ico` via `iconbitmap()`.
- **Python 3.x** (written for 3.6; runs on modern 3.x — 3.12.1 is fine). `tkinter` ships
  with the Windows python.org installer; if `import tkinter` fails, reinstall Python and
  enable *tcl/tk and IDLE*.
- **A working webcam** — capture and attendance both use `cv2.VideoCapture(0)`.
- **The OpenCV contrib build** — `opencv-contrib-python`. LBPH lives in the `cv2.face`
  submodule, which the plain `opencv-python` wheel does **not** contain.
- **A local MySQL server** — *optional*. The CSV output works without it; the app catches
  the connection error and continues.
- **Node.js is not required** — the browser page is plain static files.
- **Disk space:** ~50 MB (the shipped `Trainner.yml` is 50,332,718 bytes ≈ 48 MiB).

**Hard-coded settings in `AMS_Run.py` (no `.env`, no config file — edit the source):**

| Setting | Value | Line |
|---|---|---|
| MySQL host / user / password | `localhost` / `root` / *(empty)* | `AMS_Run.py:62` (manual), `AMS_Run.py:399` (automatic) |
| Automatic-attendance schema | `Face_reco_fill` | `AMS_Run.py:399` |
| Manual-attendance schema | `manually_fill_attendance` | `AMS_Run.py:62` |
| Model file | `TrainingImageLabel\Trainner.yml` | `AMS_Run.py:329`, `AMS_Run.py:578` |
| Capture folder | `TrainingImage/` (note the **trailing space** in the write path) | `AMS_Run.py:289` |
| Registry CSV | `StudentDetails\StudentDetails.csv` | `AMS_Run.py:304`, `AMS_Run.py:337` |
| Attendance CSV | `Attendance/<Subject>_<date>_<HH-MM-SS>.csv` | `AMS_Run.py:386` |
| Haar cascade | `haarcascade_frontalface_default.xml` | `AMS_Run.py:276`, `AMS_Run.py:335` |
| Recognition accept threshold | `conf < 70` | `AMS_Run.py:350` |
| Attendance capture window | 20 seconds | `AMS_Run.py:322` |
| Admin credential | a literal username/password pair in the source | `AMS_Run.py:489-490` |

**Three absolute paths point into the original author's home directory and must be edited
before the app is usable on your machine:**

| Line | What it does | Current value |
|---|---|---|
| `AMS_Run.py:159` | Writes the manual-attendance CSV | `C:/Users/kusha/PycharmProjects/Attendace managemnt system/Attendance/Manually Attendance/` |
| `AMS_Run.py:213`, `AMS_Run.py:462` | Opens the "Check Sheets" Explorer window | `C:\Users\kusha\PycharmProjects\Attendace managemnt system\Attendance\...` |
| `AMS_Run.py:434`, `AMS_Run.py:498` | Re-opens the attendance CSV and the student register for display | `C:/Users/kusha/PycharmProjects/Attendace managemnt system/...` |

> **The admin login is a hard-coded credential pair in the source** (username `kushal`,
> password `kushal14320`), compared in plain text with no hashing, no lockout and no
> database backing. It exists only to gate a read-only view of `StudentDetails.csv`.
> Treat it as a development placeholder — do not ship it as-is.

---

### 2. Installation and Setup

#### 2a. Create the environment

There is **no `requirements.txt`** in this repository. Install exactly what the source imports:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\face-recognition-attendance-system"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

pip install opencv-contrib-python numpy pandas pillow

# Optional — only if you want the MySQL mirror:
pip install pymysql
```

> **Install only ONE OpenCV distribution.** `opencv-python` and `opencv-contrib-python`
> install the same `cv2` package and conflict. Use `opencv-contrib-python`; if you already
> have `opencv-python` installed, run `pip uninstall -y opencv-python` first.

#### 2b. Verify the environment

```powershell
python --version
python -c "import cv2, numpy, pandas, PIL, tkinter; print('cv2', cv2.__version__); print('has cv2.face:', hasattr(cv2, 'face'))"
```

The second command **must** print `has cv2.face: True`. If it prints `False`, the wrong
OpenCV wheel is installed.

#### 2c. Create the `TrainingImage/` capture folder

`TrainingImage/` does **not** exist in the repository. `trainimg()` catches the failure and
shows *"please make "TrainingImage" folder & put Images"*.

```powershell
New-Item -ItemType Directory -Path .\TrainingImage -Force
Test-Path .\TrainingImage
```

> **Trailing-space bug:** `AMS_Run.py:289` writes to `"TrainingImage/ " + Name + "." +
> Enrollment + "." + str(sampleNum) + ".jpg"` — note the **space after the slash**. On
> Windows this creates a subfolder literally named `" "` (a single space) inside
> `TrainingImage/`, and `getImagesAndLabels()` (`os.listdir`) will still find those files, so
> capture and training do work — but the directory listing looks wrong. You may prefer to
> correct the source string to `"TrainingImage/"`; this workflow does not modify any
> application code.

#### 2d. Optional — MySQL setup

The app creates one table per session at runtime:
`CREATE TABLE <Subject>_<YYYY_MM_DD>_Time_<H>_<M>_<S>` with columns
`ID, ENROLLMENT, NAME, DATE, TIME`. You only need to create the two schemas and grant
access.

```powershell
# Start MySQL, then log in as root and create the two schemas:
mysql -u root -e "CREATE DATABASE IF NOT EXISTS Face_reco_fill;"
mysql -u root -e "CREATE DATABASE IF NOT EXISTS manually_fill_attendance;"
```

Confirm the app can reach them:

```powershell
python -c "import pymysql; c=pymysql.connect(host='localhost',user='root',password='',db='Face_reco_fill'); print(c.cursor().execute('SELECT 1')); c.close()"
```

If this fails, the app still works and writes CSVs — it just prints the connection error.

#### 2e. Assets and files the code expects

| Path | Status | Notes |
|---|---|---|
| `TrainingImageLabel/Trainner.yml` | **Present** (50,332,718 bytes) | OpenCV LBPH model (`opencv_lbphfaces`) trained by the original author |
| `TrainingImage/` | **Missing** | Create it (Section 2c) |
| `TrainingImage/` sample images | **Not shipped** | The shipped model can only recognise the original author's enrolled faces |
| `haarcascade_frontalface_default.xml` | **Present** | Loaded by `AMS_Run.py`, `testing.py`, `training.py` |
| `haarcascade_frontalface_alt.xml` | **Present** | Shipped but **not referenced** by the code |
| `StudentDetails/StudentDetails.csv` | **Present** | Header `Enrollment,Name,Date,Time`, plus real rows (e.g. `6007,Kushal,2019-02-26,14:45:10`) and many empty rows from earlier test runs |
| `Attendance/` and `Attendance/Manually Attendance/` | **Present** | Output directories, plus one sample manual export |
| `AMS.ico` | **Present** | Used by `iconbitmap()` |

**How capture files are named and read:** `take_img()` writes
`TrainingImage/<Name>.<Enrollment>.<N>.jpg` (grayscale face crop, one per detection).
`getImagesAndLabels()` recovers the label with `os.path.split(path)[-1].split(".")[1]` — the
**enrollment number is field index 1**, so the `Name.Enrollment.N.jpg` ordering matters.

---

### 3. Launch the Complete Project

#### 3a. The desktop application (the real thing)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\face-recognition-attendance-system"
.\.venv\Scripts\Activate.ps1
python AMS_Run.py
```

- Window title: *"FAMS-Face Recognition Based Attendance Management System"*, 1280×720.
- **Run from the project root.** The cascade XML, the model, the CSVs and the capture
  folder are all resolved relative to the current working directory.
- The window opens with a cyan header, an *Enter Enrollment* field (digits only — `testVal`
  rejects non-digits), an *Enter Name* field, two *Clear* buttons, and five action buttons:
  **Check Register students**, **Take Images**, **Train Images**, **Automatic Attendace**
  (sic), **Manually Fill Attendance**.
- **Quit:** close the window — it asks for confirmation (*"Do you want to quit?"*).

#### 3b. Standalone model check

```powershell
python testing.py
```

A bare OpenCV loop that runs the LBPH recognizer against the webcam and prints the predicted
`Id` over each detected face. No acceptance threshold, no CSV, no Tkinter.

#### 3c. Browser companion UI

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\face-recognition-attendance-system"
python -m http.server 8000
```

- **Port 8000.** Open <http://localhost:8000/>.
- The page **must** be served over HTTP, not opened as a `file://` URL: `js/app.js:255`
  fetches `StudentDetails/StudentDetails.csv`, and browsers block that over `file://`. The
  page shows a *"Could not read StudentDetails/StudentDetails.csv (blocked on file:// or
  missing). Serve this folder: python -m http.server 8000…"* hint when it fails.
- **Stop with `Ctrl+C`.**

> **How the browser page reaches the desktop app: it does not.** There is no HTTP API, no
> server and no channel. The page re-implements the same fields, the same CSV columns and the
> same `conf < 70` rule as *documentation*, and stores its register in `localStorage` so it
> can be exported as CSV for comparison against the desktop app's output.

#### 3d. Typical end-to-end flow (for reference)

1. **Enroll** — type the enrollment number and name, press **Take Images**. The webcam
   opens, the cascade draws a blue rectangle per detected face, and a grayscale crop is
   saved per detection. Press `q` to stop early, or let it stop when the counter passes 70.
   The notification reads *"Images Saved for Enrollment : `<id>` Name : `<name>`"* and a row
   is appended to `StudentDetails/StudentDetails.csv`.
2. **Train** — press **Train Images**. `trainimg()` trains LBPH over `TrainingImage/` and
   writes `TrainingImageLabel\Trainner.yml`; the notification reads *"Model Trained"*.
   For a ten-person set this takes roughly 5–10 minutes on a reference machine.
3. **Mark attendance** — press **Automatic Attendace**, enter a subject (e.g. `OOP`), press
   **Fill Attendance**. The camera runs for 20 seconds; a match with `conf < 70` draws a
   green rectangle labelled `<Id>-<Name>`, anything else a red rectangle labelled
   `Unknown`. On exit the app writes
   `Attendance/OOP_<YYYY-MM-DD>_<HH-MM-SS>.csv` with columns `Enrollment,Name,Date,Time`,
   removes duplicates per enrollment, opens the CSV in a table window, and (if MySQL is
   reachable) mirrors the row into a per-session table in `Face_reco_fill`.
4. **Manual attendance** — press **Manually Fill Attendance**, enter a subject, then add
   enrollment + name rows with **Enter Data**; **Convert to CSV** exports the session table
   (⚠ the export path is hardcoded to the original author's machine — see Section 1).
5. **Register view** — press **Check Register students** and log in with the hard-coded
   credential to view `StudentDetails/StudentDetails.csv` in a table.

---

### 4. Test the Project

#### 4a. Automated tests — there are none

- There is **no** test file, no `pytest` dependency and no CI for this project.
- `testing.py` is **not** an automated test. It is a manual webcam verification loop — it
  requires a camera and a human face, and it asserts nothing.
- `retrain.py` is **not** part of this pipeline at all: it is a vendored 2015 TensorFlow 1.x
  Inception-v3 transfer-learning script (Apache 2.0) that needs TF1 and an ImageNet
  checkpoint. It will not import on modern TensorFlow. **Do not run it.**

Every check below is therefore manual.

#### 4b. Desktop application — entry points and expected behaviour

| # | Entry point / action | How to exercise it | Expected output |
|---|---|---|---|
| 1 | `python AMS_Run.py` | Launch from the project root | A 1280×720 window titled *"FAMS-Face Recognition Based Attendance Management System"* with the cyan header and five action buttons |
| 2 | Enrollment field validation | Type `12ab` into *Enter Enrollment* | Non-digit characters are rejected (`validatecommand` with `'%d'`) |
| 3 | **Take Images** | Enter `15624031` / `Aditi Sharma`, press **Take Images** | The *"Frame"* camera window opens with a blue rectangle over the detected face; grayscale crops are written under `TrainingImage/`; the label reads *"Images Saved for Enrollment : 15624031 Name : Aditi Sharma"*; a row is appended to `StudentDetails/StudentDetails.csv` |
| 4 | **Take Images** then `q` | Press `q` in the camera window | The capture stops early and the notification still appears |
| 5 | **Train Images** with an empty `TrainingImage/` | Press **Train Images** | The label *"please make "TrainingImage" folder & put Images"* appears (caught exception), then training proceeds on the empty set |
| 6 | **Train Images** with samples present | Press **Train Images** | The label *"Model Trained"* appears and `TrainingImageLabel\Trainner.yml` is rewritten |
| 7 | **Automatic Attendace** → subject `OOP` → **Fill Attendance** | Watch the 20-second capture window | A match with `conf < 70` draws a **green** rectangle labelled `<Id>-<Name>`; a non-match draws a **red** rectangle labelled `Unknown` |
| 8 | Same, after the capture ends | Inspect the output | `Attendance/OOP_<date>_<HH-MM-SS>.csv` exists with columns `Enrollment,Name,Date,Time`, one row per recognised enrollment (duplicates removed), and a table window opens showing it |
| 9 | Same, with MySQL running | Inspect MySQL | A table `<Subject>_<YYYY_MM_DD>_Time_<H>_<M>_<S>` exists in `Face_reco_fill` with one mirrored row |
| 10 | **Manually Fill Attendance** → subject → **Enter Data** | Enter enrollment + name, press **Enter Data** | A row is inserted into the per-session table in `manually_fill_attendance`; the entry fields clear |
| 11 | **Manually Fill Attendance** → **Convert to CSV** | Press it | ⚠ Fails on any machine other than the original author's, because the output path is hardcoded (`AMS_Run.py:159`) — edit the path first |
| 12 | **Check Register students** | Enter the hard-coded credential pair | The register CSV opens in a grid window; a wrong credential shows *"Incorrect ID or Password"* |
| 13 | **Manually Fill Attendance** → **Check Sheets** | Press it | ⚠ Opens nothing on any machine other than the original author's (hardcoded `explorer /select` path) — edit it first |
| 14 | `python testing.py` | Run standalone | The *"im"* window opens, showing the predicted `Id` over each detected face |
| 15 | Closing the window | Click the X | A confirmation dialog *"Do you want to quit?"* appears |

#### 4c. Browser companion UI — entry point and expected behaviour

```powershell
python -m http.server 8000
```

| # | Action | Expected output |
|---|---|---|
| 1 | Open <http://localhost:8000/> | The Roll-Call Kiosk page renders (enrollment wizard, camera cards, register panel) |
| 2 | Observe the roster source | The page loads `StudentDetails/StudentDetails.csv` over HTTP and reports *"Loaded N enrolled students from StudentDetails/StudentDetails.csv."* — or *"StudentDetails.csv loaded but contained no populated rows yet."* because the shipped CSV is mostly empty rows |
| 3 | Open the page over `file://` instead | The status line shows *"Could not read StudentDetails/StudentDetails.csv (blocked on file:// or missing). Serve this folder: python -m http.server 8000…"* |
| 4 | Run the enrollment wizard | The enrollment is stored in `localStorage` only — **no** image is captured and no model runs |
| 5 | Use **Add to register** / **Mark all present** / filter / **Export CSV** / **Copy CSV** / **Print** / **Clear register** | Each acts on the browser-side register; the exported CSV matches the desktop app's column layout |
| 6 | Compare the numbers with the desktop app | Every number on the page is browser-side demo state, **not** model output |

#### 4d. Database checks (optional MySQL)

| # | Check | Expected output |
|---|---|---|
| 1 | Automatic-attendance session with MySQL up | A table exists in `Face_reco_fill` named `<Subject>_<YYYY_MM_DD>_Time_<H>_<M>_<S>` with columns `ID, ENROLLMENT, NAME, DATE, TIME` |
| 2 | Manual-attendance session with MySQL up | The same table shape exists in `manually_fill_attendance` |
| 3 | MySQL down | The app prints the connection error and **continues**; the CSV is still written and the table window still opens |
| 4 | Inspect the row | The automatic path mirrors the **last** recognised face only (it inserts `Id`/`aa` after the capture loop) — this is a real limitation, not a bug in your setup |

#### 4e. What is *not* tested here

- There is **no automated test** of recognition accuracy, CSV generation, or the database
  mirror.
- Recognition accuracy cannot be reproduced without the original training samples — the
  shipped `Trainner.yml` only knows the original author's faces.
- Every database, webcam and GUI check above requires a **physical camera**, a **real face**
  and a **running MySQL**; none of it can be asserted in a headless environment.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `AttributeError: module 'cv2' has no attribute 'face'` | `opencv-python` installed instead of the contrib build | `pip uninstall -y opencv-python` then `pip install opencv-contrib-python` |
| `ModuleNotFoundError: No module named 'pymysql'` | Optional MySQL mirror dependency missing | `pip install pymysql` — or ignore it; the app catches the error and continues with CSV output only |
| `ModuleNotFoundError: No module named 'pandas'` / `'PIL'` / `'numpy'` | Incomplete install | `pip install numpy pandas pillow` |
| `import tkinter` fails | Tcl/Tk not installed | Reinstall Python with *tcl/tk and IDLE* enabled |
| *"please make "TrainingImage" folder & put Images"* | No capture folder and no samples | `New-Item -ItemType Directory -Path .\TrainingImage -Force`, then use **Take Images** to populate it |
| *"Model not found,Please train model"* | `TrainingImageLabel\Trainner.yml` missing or unreadable | Train from the app (**Train Images**), or restore the shipped file |
| Every face shows as `Unknown` | The shipped model only knows the original author's faces; or `training.py` overwrote the LBPH file with a Fisher model | Enroll your own faces via **Take Images**, then retrain with **Train Images** — and **never** run `training.py` |
| `FileNotFoundError` on `StudentDetails\StudentDetails.csv` | Wrong working directory, or a non-Windows OS | `cd` to the project root; on Linux/macOS replace the backslashes with `/` |
| Manual-attendance CSV export fails | Hardcoded absolute path `C:/Users/kusha/PycharmProjects/...` (`AMS_Run.py:159`) | Edit `create_csv()` to a path under your project folder |
| "Check Sheets" opens nothing | Same hardcoded absolute path (`AMS_Run.py:213`, `AMS_Run.py:462`) | Edit the path in `AMS_Run.py` |
| The attendance table window throws `FileNotFoundError` | Hardcoded absolute path at `AMS_Run.py:434` | Edit the path |
| The register window throws `FileNotFoundError` | Hardcoded absolute path at `AMS_Run.py:498` | Edit the path |
| Webcam opens but no face is detected | Poor lighting, or a cascade mismatch | Improve lighting; capture uses `detectMultiScale(gray, 1.3, 5)` and attendance uses `1.2, 5` |
| Camera opens but the frame is black | Camera index 0 is busy or the device is virtual | Close other camera apps; the app hardcodes `cv2.VideoCapture(0)` |
| The browser page shows *"Could not read StudentDetails/StudentDetails.csv"* | Page opened over `file://` | Serve the folder: `python -m http.server 8000` |
| `mysql.connector` / `pymysql` connection error `Access denied` | The root password is not empty | Edit `AMS_Run.py:62` and `AMS_Run.py:399` to match your server, or create a user with the right grants |
| `Unknown database 'Face_reco_fill'` | The schemas were never created | `mysql -u root -e "CREATE DATABASE IF NOT EXISTS Face_reco_fill;"` (and the same for `manually_fill_attendance`) |
| `TrainingImage/` contains a folder named `" "` | The trailing-space bug at `AMS_Run.py:289` | Harmless — `os.listdir` still finds the files. Correct the source string to `"TrainingImage/"` if you want a tidy tree |
| `training.py` was run and broke recognition | `training.py` builds a **Fisher** recognizer and saves to the same `trainner.yml` the app reads as **LBPH** | Retrain from the app with **Train Images** |
| `retrain.py` fails to import | It is a TensorFlow 1.x script unrelated to this pipeline | Ignore it; it is not part of the attendance flow |

---

### 6. Verification Checklist

**Prerequisites and environment**

- [ ] Windows 10/11 is in use (the desktop app's paths are Windows-specific).
- [ ] Python 3.x is the interpreter in use (`python --version`).
- [ ] A webcam is connected and not held open by another application.
- [ ] The working directory is `N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\face-recognition-attendance-system`.
- [ ] `.\.venv\Scripts\Activate.ps1` completes.
- [ ] `python -c "import cv2; print(hasattr(cv2,'face'))"` prints **True**.
- [ ] `python -c "import numpy, pandas, PIL, tkinter"` succeeds.
- [ ] Only one OpenCV distribution is installed (no `opencv-python` alongside `opencv-contrib-python`).

**Files and folders**

- [ ] `AMS_Run.py` exists and is the entry point.
- [ ] `TrainingImageLabel\Trainner.yml` exists (50,332,718 bytes).
- [ ] `TrainingImage\` exists and is writable (`Test-Path .\TrainingImage` → `True`).
- [ ] `haarcascade_frontalface_default.xml` exists.
- [ ] `StudentDetails\StudentDetails.csv` exists and has the header `Enrollment,Name,Date,Time`.
- [ ] `Attendance\` and `Attendance\Manually Attendance\` exist.
- [ ] `AMS.ico` exists (used by `iconbitmap()`).

**Optional MySQL**

- [ ] MySQL is running, or the absence of it is a deliberate choice (CSV output still works).
- [ ] The `Face_reco_fill` and `manually_fill_attendance` schemas exist.
- [ ] A PyMySQL connection test from the project root succeeds.
- [ ] The hard-coded credentials at `AMS_Run.py:62` and `AMS_Run.py:399` match the local server.

**Hard-coded paths and credentials (must be reviewed before any shared use)**

- [ ] `AMS_Run.py:159` — manual-attendance CSV output path — is edited to a local path.
- [ ] `AMS_Run.py:434` and `AMS_Run.py:498` — CSV/Register display paths — are edited to local paths.
- [ ] `AMS_Run.py:213` and `AMS_Run.py:462` — "Check Sheets" Explorer paths — are edited to local paths.
- [ ] The hard-coded admin credential pair in `AMS_Run.py:489-490` is understood to be a
      development-only, plain-text comparison and is replaced before any shared use.

**Launch**

- [ ] `python AMS_Run.py` opens the 1280×720 window with the expected title and all five action buttons.
- [ ] The app was launched from the project root.
- [ ] The window closes with a *"Do you want to quit?"* confirmation.
- [ ] `python -m http.server 8000` serves the browser page and <http://localhost:8000/> opens.
- [ ] `Ctrl+C` stops the static server cleanly.

**Functional checks**

- [ ] The enrollment field accepts digits only.
- [ ] **Take Images** captures grayscale crops, appends a row to `StudentDetails/StudentDetails.csv`, and shows *"Images Saved for Enrollment…"*.
- [ ] `q` stops the capture early.
- [ ] **Train Images** reports *"Model Trained"* and rewrites `TrainingImageLabel\Trainner.yml`.
- [ ] **Automatic Attendace** captures for ~20 seconds and colours matches green / non-matches red.
- [ ] An attendance CSV appears in `Attendance\` with the columns `Enrollment,Name,Date,Time`.
- [ ] The attendance table window opens and shows the captured rows.
- [ ] **Manually Fill Attendance** → **Enter Data** inserts a row; **Convert to CSV** works after the path is edited.
- [ ] **Check Register students** opens the register after login, and shows *"Incorrect ID or Password"* on a wrong credential.
- [ ] `python testing.py` opens the *"im"* window with predicted IDs.

**Browser companion checks**

- [ ] Over HTTP, the page reports the roster source as `StudentDetails.csv`.
- [ ] Over `file://`, the page shows the "serve this folder over HTTP" hint.
- [ ] The enrollment wizard, filter, export/copy/print and clear controls all work.
- [ ] It is understood that the browser page performs **no** recognition and every number on it is browser-side demo state.

**Limitations acknowledged**

- [ ] There are **no automated tests** in this project; every check above is manual.
- [ ] The shipped `Trainner.yml` is only meaningful for the faces it was trained on — no
      samples ship with the repository.
- [ ] `training.py` (Fisher) and `retrain.py` (TensorFlow 1.x) are **not** part of the
      attendance pipeline and must not be used to train.
- [ ] There is no HTTP API and no web deployment of the recognition pipeline.
- [ ] There is no anti-spoofing / liveness check — a printed photo of an enrolled person can
      be matched.
- [ ] The workflow is single-camera (index 0), single-session, with a fixed 20-second window.
