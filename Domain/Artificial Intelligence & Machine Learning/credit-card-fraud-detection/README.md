# FraudGuard Console

FraudGuard Console is a security-operations front-end for the **credit-card-fraud-detection** microservice. The repository contains a working **Flask API** (`src/flask_app.py`, port **5000**) that scores transactions with a scikit-learn classifier, plus a vanilla-JS console (`index.html` + `css/style.css` + `js/app.js`) that talks to it over `POST /predict`.

**The important caveat:** the classifier itself is *not* in this repository. The Kaggle `creditcard.csv` dataset is git-ignored and was never downloaded, so `models/model.pickle` does not exist and `/predict` answers **503** with a structured error until you supply the data and train the model.

---

## Features

### Implemented and verified in this repository

| Feature | Where | Status |
|---|---|---|
| `POST /predict` — single transaction (30 features) and batch (list of rows) | `src/flask_app.py` (`predict_fraud()`) | Implemented, **returns 503 while the model file is missing** |
| `OPTIONS /predict` preflight → 204 with CORS headers | `src/flask_app.py` (`predict_preflight()`, `add_cors_headers()`) | Implemented and verified |
| JSON error envelope for missing/empty features (400) | `src/flask_app.py` | Implemented and verified |
| Structured 503 with a remediation hint when the model is absent | `src/flask_app.py` | Implemented and verified |
| Training pipeline: `GridSearchCV` over a balanced `LogisticRegression` pipeline, scored by macro recall, 10-fold CV | `src/train.py` (`new_grid_search()`, `run_grid_search()`, `save_search_results()`) | Implemented — **not run**: needs the dataset |
| Modernised dependencies for Python 3.10+ | `requirements-modern.txt` | Added alongside the untouched 2017 `requirements.txt` |
| Ready-to-use virtual environment | `.venv\` (Python 3.12.1, Flask 3.1.3, scikit-learn 1.9.1, pandas 3.0.6, joblib 1.6.0) | Installed and working |
| Console: 30-field single-transaction form with numeric validation | `js/app.js` (`collectForm()`), `index.html` | Working |
| Console: reachability probe, editable API base, LED status | `js/app.js` (`probe()`) | Working |
| Console: batch scoring with sortable results and CSV export | `js/app.js` (`scoreBatch()`, `renderBatch()`, `exportBatchCsv()`) | Working |
| Console: audit log of every attempt (localStorage, cap 200) with CSV export | `js/app.js` (`addLog()`, `renderAudit()`, `exportAuditCsv()`) | Working |
| Console: adjustable alert threshold with LOW/MEDIUM/HIGH bands | `js/app.js` (`bandFor()`, `updateThresholdUI()`) | Working |
| Unit tests for the endpoint contract | `tests/test_flask.py` | 4 tests — **2 pass, 2 fail** (both failures are the missing model) |
| Original 2017 source preserved as backups | `src/flask_app.py.bak`, `src/train.py.bak` | Working |

### Not available in this repository

- **No trained model.** `models/model.pickle` does not exist (the whole `models/` directory is git-ignored).
- **No dataset.** `data/creditcard.csv` is not in the repository (`data/.gitignore` ignores everything).
- **No evaluation report.** `src/train.py` computes the metrics but logs them at DEBUG level; nothing is persisted.
- **The sample row in the console is demo input, not a model output** — the UI labels it *"SAMPLE ROW LOADED — demo values — not a model output"*.

---

## Technology Stack

| Layer | Technology |
|---|---|
| API | Flask 3.1.3 (`src/flask_app.py`), JSON over HTTP, CORS headers added in `@app.after_request` |
| Model | `LogisticRegression(class_weight="balanced")` inside a scikit-learn `Pipeline`, tuned with `GridSearchCV` |
| Persistence | `joblib` pickle at `models/model.pickle` (legacy `sklearn.externals.joblib` fallback kept for old installs) |
| Training data | Kaggle credit-card transaction CSV (30 features + `Class` label) |
| UI | Vanilla HTML5 + CSS + JavaScript — no frameworks, no build step |
| Python | 3.12.1 (the shipped `.venv`) |

---

## Prerequisites

- **Windows 10/11, macOS or Linux.**
- **Python 3.10+** for the modern dependency set (the shipped `.venv` already has 3.12.1).
- **The Kaggle dataset** `creditcard.csv` — download link as given in the upstream README:
  <https://clouda-labs-assets.s3-us-west-2.amazonaws.com/fraud-detection/creditcard.csv.zip>
  (~150 MB zipped). Unzip it and place `creditcard.csv` in `data/`.
- **Disk space** for the dataset plus the trained pickle (a few MB).
- **No API key, no cloud service, no GPU** — everything runs locally.

> The original `requirements.txt` pins 2017 versions (`Flask==0.12.2`, `scikit-learn==0.18.2`, `numpy==1.13.1`, `pandas==0.20.3`) that **do not install on Python 3.12**. Use `requirements-modern.txt` instead; the original file is kept untouched for reference.

---

## Project Structure

```
credit-card-fraud-detection/
├── index.html                     # FraudGuard Console UI
├── css/style.css
├── js/app.js                      # Probe, single form, batch, audit log, exports
├── src/
│   ├── flask_app.py               # THE API: POST /predict, OPTIONS /predict
│   ├── flask_app.py.bak           # Original 2017 version (eager model load, no CORS)
│   ├── train.py                   # Training script: grid search -> models/model.pickle
│   ├── train.py.bak               # Backup copy of the training script
│   ├── settings.py                # Absolute paths for the dataset and the model file
│   └── __init__.py
├── tests/
│   └── test_flask.py              # 4 unittest cases for the endpoint contract
├── data/
│   └── .gitignore                 # Ignores everything -> creditcard.csv is NOT committed
├── models/
│   └── .gitignore                 # Ignores everything -> model.pickle is NOT committed
├── .venv/                         # Python 3.12.1 with the modern dependency set installed
├── requirements.txt               # Original 2017 pins (kept untouched)
├── requirements-modern.txt        # flask>=2.3, scikit-learn>=1.3, pandas>=2.0, joblib>=1.3
├── requirements-dev.txt           # nose==1.3.7 (unusable on Python 3.12 - see Troubleshooting)
├── LICENSE                        # Apache License 2.0
└── project-metadata.json
```

**Paths the code expects** (`src/settings.py`, resolved from `__file__`, so they work from any working directory):

| Path | Purpose | Present? |
|---|---|---|
| `<root>/data/creditcard.csv` | Training data read by `split_dataset()` | **No** — external download |
| `<root>/models/model.pickle` | Trained pipeline loaded by `flask_app.py` at import | **No** — produced by `src/train.py` |

---

## Installation

The project ships a working `.venv`, so the fastest path is to use it. To rebuild from scratch:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"

# 1. Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# If PowerShell blocks the activation script:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 2. Install the modern dependency set (do NOT use the 2017 requirements.txt on Python 3.12)
python -m pip install --upgrade pip
pip install -r requirements-modern.txt
```

> Linux/macOS: `source .venv/bin/activate`.

> The existing `.venv\Scripts\python.exe` already provides: Flask 3.1.3, scikit-learn 1.9.1, pandas 3.0.6, joblib 1.6.0, numpy 2.5.4 on Python 3.12.1.

---

## Environment Configuration

**This service reads no environment variables and no `.env` file.** There are no API keys, no hosts to configure and nothing to export. The only two settings are file paths, hard-coded in `src/settings.py` and resolved relative to the project root:

```python
PARENT_DIR_PATH = os.path.dirname(os.path.realpath(os.path.join(__file__, '..')))
DATASET_FILENAME = os.path.join(PARENT_DIR_PATH, "data", "creditcard.csv")
MODEL_FILENAME   = os.path.join(PARENT_DIR_PATH, "models", "model.pickle")
```

The **browser** side has one user setting, stored in `localStorage`:

| Key | Default | Purpose |
|---|---|---|
| `fraudguard.apiBase` | `http://127.0.0.1:5000` | Base URL of the API; editable in the console's top bar and re-probed on change |
| `fraudguard.threshold` | `0.50` | Alert threshold used for the LOW/MEDIUM/HIGH bands |
| `fraudguard.auditLog` | *(empty)* | The audit trail (max 200 entries) |

---

## How to Launch

### 1. Backend — Flask on port 5000

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"

# Option A - the __main__ runner added to src/flask_app.py
.\.venv\Scripts\python.exe src\flask_app.py

# Option B - the Flask CLI
$env:FLASK_APP = "src/flask_app.py"
.\.venv\Scripts\python.exe -m flask run
```

The service listens on **http://127.0.0.1:5000**. Stop it with `Ctrl+C`.

`src/flask_app.py` uses the flat import `from settings import MODEL_FILENAME`; both commands above work because the script's own directory (`src/`) is placed on `sys.path` automatically (the Flask CLI does the same when given a file path).

### 2. Front-end — the console (any static server)

```powershell
python -m http.server 8000
```

Open **http://localhost:8000** (or open `index.html` directly — all asset paths are relative). Stop with `Ctrl+C`.

### How the front-end reaches the backend

The console sends `POST {apiBase}/predict` with `Content-Type: application/json`. The default `apiBase` is `http://127.0.0.1:5000`, matching the backend's bind address, so the default configuration works with no editing.

Because the API adds `Access-Control-Allow-Origin: *` in an `@app.after_request` hook, a console served from `http://localhost:8000` can call `http://127.0.0.1:5000` cross-origin.

> **Stale note in the UI:** `index.html` still says *"NOTE: `src/flask_app.py` sends no CORS headers."* That was true of the original 2017 file (kept as `src/flask_app.py.bak`); the current `src/flask_app.py` **does** send CORS headers. The note is out of date — this README follows the code.

---

## Model and Dataset Setup

Nothing is bundled. The pipeline is two steps.

### 1. Get the dataset

Download and unzip:

```
https://clouda-labs-assets.s3-us-west-2.amazonaws.com/fraud-detection/creditcard.csv.zip
```

Place the extracted `creditcard.csv` in the `data/` folder:

```
data/creditcard.csv
```

The CSV has 30 feature columns (`Time`, `V1`…`V28`, `Amount`) and a final `Class` column (1 = fraud, 0 = legitimate). `split_dataset()` in `src/train.py` takes `df.columns[:-1]` as `X` and `df.columns[-1]` as `y`.

### 2. Train the model

```powershell
.\.venv\Scripts\python.exe src\train.py
```

What happens:

1. `new_grid_search()` builds a `Pipeline([("clf", LogisticRegression(class_weight="balanced"))])` and a `GridSearchCV` over `clf__C ∈ (1e-4, 1e-2, 1e0, 1e2, 1e4)` with `scoring="recall_macro"`, `cv=10`, `n_jobs=-1`.
2. `split_dataset()` reads the CSV and splits it with `test_size=0.2, random_state=42`.
3. `run_grid_search()` fits the search and logs macro recall, precision/recall/F1 and the confusion matrix (DEBUG level).
4. `save_search_results()` pickles the winning pipeline to `models/model.pickle` with `joblib.dump(grid_search.best_estimator_, MODEL_FILENAME)`.

Training takes a few minutes on a normal CPU (10-fold CV over 5 hyper-parameter values).

### 3. Restart the API

`flask_app.py` loads the model **at import time**:

```python
app.model = None
if os.path.exists(MODEL_FILENAME):
    app.model = joblib.load(MODEL_FILENAME)
```

so the service must be **restarted** after training. Until then `/predict` keeps returning 503.

---

## Usage

### The console (FraudGuard Console)

1. Open the console. The status LED starts as **UNKNOWN** and immediately runs a reachability probe.
2. The probe sends `POST {apiBase}/predict` with `{"features": []}` and an 8-second timeout. **Any HTTP answer counts as reachable** (the service replies 400 *"No feature values available"*), only a network failure means offline. The LED turns **ONLINE** with the HTTP status, or **OFFLINE** and the setup panel appears.
3. **Enter a transaction** — 30 numeric fields `F1`…`F30` (Time, V1…V28, Amount). Empty or non-numeric fields are marked red and the request is blocked with *"Exactly 30 numeric fields are required"*.
   - **Load sample row** fills a hand-written demo row and states *"SAMPLE ROW LOADED — demo values — not a model output"*.
   - **Paste row** accepts 30 values separated by spaces, commas or semicolons.
4. **Set the alert threshold** with the slider (0…1). The bands are: `score >= t` → **HIGH**, `score >= t/2` → **MEDIUM**, otherwise **LOW**. The gauge fill colour follows the band.
5. **Press SCORE TRANSACTION** (or `Ctrl+Enter`). The console shows the live request JSON, the raw response body, the HTTP status and the latency, and paints the gauge with the fraud probability.
6. **Batch tab** — paste one transaction per line (30 values each), press **SCORE BATCH**; the result table is sortable by score and exportable as `fraudguard-batch-YYYYMMDD-HHMMSS.csv` (row, score, band, f1…f30).
7. **Audit log tab** — every attempt (single or batch) is recorded with time, mode, score, band, status and detail; export as `fraudguard-audit-*.csv` or clear it (with a confirmation dialog).
8. **Copy JSON** copies the request/response pair for bug reports.

### The API directly

```powershell
# Single transaction (single quotes keep the JSON intact in PowerShell)
curl.exe -X POST http://127.0.0.1:5000/predict `
  -H "Content-Type: application/json" `
  -d '{"features": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}'

# Batch (a list of 30-value lists)
curl.exe -X POST http://127.0.0.1:5000/predict `
  -H "Content-Type: application/json" `
  -d '{"features": [[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0]]}'
```

### Running the tests

```powershell
# From the project root
$env:PYTHONPATH = "src"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Expected result in this checkout: **2 of 4 pass**. `test_empty_body` and `test_no_features` assert the 400 validation contract and pass. `test_single_data_point` and `test_multiple_data_points` expect HTTP 200 with a `scores` array and therefore fail with **503 Model not loaded** — they cannot pass until the dataset is downloaded and the model trained. This is the *expected* state of the repository, not a code defect.

---

## API Documentation

Base URL: `http://127.0.0.1:5000`

### `POST /predict`

Scores one or more transactions. The route is `predict_fraud()` in `src/flask_app.py`.

**Request**

```http
POST /predict HTTP/1.1
Host: 127.0.0.1:5000
Content-Type: application/json

{
  "features": [0.0, 1.0, -0.35, 1.12, ... 30 numbers total ...]
}
```

Batch form — a list of rows:

```json
{ "features": [[...30 numbers...], [...30 numbers...]] }
```

The service decides the shape by inspecting the first element: if it is itself a list, the payload is treated as a batch.

**Success response — 200**

```json
{ "scores": [0.0323602000089039] }
```

`scores[i]` is the predicted probability of class **1 (fraud)** for the i-th submitted transaction. The field is built from `predict_proba(...).tolist()` by taking `result[1]` of every row.

**Error responses**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error": "No features found in input"}` | The JSON body has no `features` key |
| `400` | `{"error": "No feature values available"}` | `features` is `null`, empty, or not a list |
| `503` | `{"error": "Model not loaded", "detail": "models/model.pickle is missing. Train it first: place data/creditcard.csv then run python src/train.py"}` | `models/model.pickle` does not exist (the current state of this repository) |

A malformed body is not an error: `request.get_json(silent=True) or {}` turns unparseable JSON into `{}`, which is then reported as `400 No features found in input`.

**CORS** — every response carries:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: POST, OPTIONS
```

### `OPTIONS /predict`

Preflight. The route is `predict_preflight()`.

| Status | Body | Notes |
|---|---|---|
| `204` | *(empty)* | With the CORS headers above |

### No other endpoints

There is no `/health`, no `/`, no model-info route and no training route. The console deliberately probes with an empty `features` array instead of a health endpoint.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `POST /predict` returns **503 "Model not loaded"** | `models/model.pickle` does not exist — the dataset was never downloaded | Download `creditcard.csv` into `data/`, run `python src/train.py`, **restart** the API |
| `ModuleNotFoundError: No module named 'flask'` | The venv is not active, or the 2017 `requirements.txt` failed to install | `.\.venv\Scripts\Activate.ps1` and `pip install -r requirements-modern.txt` |
| `ImportError: cannot import name 'joblib' from 'sklearn.externals'` | An old scikit-learn is installed | The code already falls back to `import joblib`; install `joblib>=1.3` and use `requirements-modern.txt` |
| `FileNotFoundError: ... creditcard.csv` when training | The dataset is missing or in the wrong place | It must be exactly `data/creditcard.csv` (see `src/settings.py`) |
| `ModuleNotFoundError: No module named 'settings'` | The API was started from the wrong directory or with the wrong app path | Run `python src\flask_app.py`, or `flask --app src/flask_app.py run` — both put `src/` on `sys.path` |
| `Address already in use` / port 5000 busy | Another Flask app is running | Stop it, or run on another port: `python -m flask --app src/flask_app.py run --port 5001` (then change the console's API base) |
| The console LED stays **OFFLINE** | The API is not running, the API base is wrong, or the browser blocked the request | Check `http://127.0.0.1:5000/predict` manually, confirm the API base field, and look at the browser console for CORS errors |
| The console says *"CONNECTION FAILED … blocked by the browser's CORS policy"* | The API is running an **old copy** of `flask_app.py` (the 2017 `.bak` has no CORS) | Confirm you run `src/flask_app.py`, not `src/flask_app.py.bak` |
| `nosetests` command not found / crashes | `requirements-dev.txt` pins `nose==1.3.7`, which is broken on Python 3.10+ | Use `unittest` instead (see [Usage](#usage)) |
| `python -m unittest` fails with `ModuleNotFoundError: No module named 'flask_app'` | `PYTHONPATH` was not set | `$env:PYTHONPATH = "src"` from the project root |
| The 2 prediction tests fail | Expected — the model cannot exist without the dataset | Train the model; the tests then pass |
| The console rejects a valid row | Fewer or more than 30 values, or a non-numeric entry | The form must contain exactly 30 numbers; check the highlighted field names in the error message |
| `pandas` errors about `.as_matrix()` | The original 2017 code path | The current `src/train.py` uses `.values`; the 2017 `requirements.txt` is the incompatible part |
| PowerShell blocks `.\.venv\Scripts\Activate.ps1` | Execution policy | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |

---

## Limitations

- **No model and no dataset in the repository.** `/predict` answers 503 until the user downloads the data and trains. This is the single biggest limitation of the checkout.
- **Training is slow and unlogged.** The metrics are emitted through `logger.debug(...)`, so nothing is visible at the default log level and no report file is produced.
- **Class imbalance is handled by class weights only.** The upstream project goal mentions SMOTE and cost-aware thresholding, but `src/train.py` implements only `class_weight="balanced"`; there is no resampling and no cost matrix.
- **The threshold lives in the browser, not the server.** The API returns raw probabilities; the LOW/MEDIUM/HIGH banding is a client-side decision and is not enforced for other consumers.
- **The model is a linear classifier.** Logistic regression with grid search is fast and interpretable, but it cannot capture the non-linear structure of transaction fraud.
- **No authentication, no rate limiting, no request logging** — the service is a local microservice, not an internet-facing API.
- **CORS is fully open** (`Access-Control-Allow-Origin: *`).
- **The model is loaded once at import time**; retraining requires a restart, and there is no hot-reload.
- **The audit log lives in `localStorage`** (max 200 entries) and is lost when the browser data is cleared; it is not a compliance-grade trail.
- **The console's sample row is demo input**, not a real transaction, and it is labelled as such in the UI.

---

## License and Credits

### Upstream project

**fraud-detection** — Cloud Academy, `https://github.com/cloudacademy/fraud-detection` (as recorded in `project-metadata.json`). Licensed under the **Apache License 2.0** — see `LICENSE` in the project root. The upstream README, the original `requirements.txt` (2017 pins) and the dataset download link are preserved.

The dataset is the well-known **credit card fraud detection** dataset distributed by Cloud Academy / Kaggle (anonymised European cardholder transactions, September 2013, 284 807 transactions of which 492 are fraudulent). Its redistribution terms come from that distribution — check them before sharing the CSV.

### Changes made to the upstream code

`src/flask_app.py` was modernised (the original is preserved verbatim as `src/flask_app.py.bak`):

- modern `import joblib` with a legacy `sklearn.externals.joblib` fallback;
- the model is now loaded **lazily** — the service starts even when `models/model.pickle` is missing and returns a structured 503 from `/predict` instead of crashing at import;
- a CORS `@app.after_request` hook and an `OPTIONS /predict` preflight route were added;
- a `__main__` runner (`app.run(host="127.0.0.1", port=5000, debug=False)`) was added, preserving the historical `flask run` behaviour.

`src/train.py` was modernised alongside it (`src/train.py.bak` is kept as a backup copy; the two files are currently byte-identical).

`requirements-modern.txt` was added; the original `requirements.txt` was left untouched.

### Added later (this front-end)

The **FraudGuard Console** UI — `index.html`, `css/style.css`, `js/app.js` — and this documentation were added on top of the upstream microservice. They are not part of the Cloud Academy project and carry no upstream endorsement. The console contains no client-side scoring: every number it displays comes from a live `POST /predict` response.
