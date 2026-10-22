# FraudGuard Console (credit-card-fraud-detection) — Setup & Test Workflow

This document covers **how to install, configure, launch and test the complete project**: the Flask
prediction service (`src/flask_app.py`, port **5000**) and the static FraudGuard console
(`index.html` + `css/style.css` + `js/app.js`, port **8000**), plus the optional training step that
produces the missing model artefact.

**Honest scope note up front:** the API exists and works, but **the trained model is not shipped** —
`models/model.pickle` is absent and `data/creditcard.csv` (the Kaggle dataset) is absent too. Until you
supply the dataset and run `src/train.py`, `POST /predict` correctly answers **HTTP 503 "Model not
loaded"**, and the console shows that error rather than a fabricated score. The API also has **no
`/health` endpoint** — it exposes exactly two routes: `POST /predict` and `OPTIONS /predict`.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 (commands below are PowerShell) | `Get-Host` |
| Python | **3.12.1** (already present as `.venv`) | `.\.venv\Scripts\python.exe --version` |
| Flask | **3.1.3** (already in `.venv`) | `.\.venv\Scripts\python.exe -m pip show flask` |
| scikit-learn | **1.9.1** (already in `.venv`) | `.\.venv\Scripts\python.exe -m pip show scikit-learn` |
| pandas / joblib / numpy | 3.0.6 / 1.6.0 / 2.5.4 (already in `.venv`) | `.\.venv\Scripts\python.exe -m pip list` |
| Node.js | **Not required** — the console is plain HTML/CSS/JS, no build step | — |
| API keys | **None.** The service reads no `.env` and no environment variables | — |
| Internet | Only for `pip install` and for downloading the Kaggle dataset | — |
| **Optional, for real inference** | Kaggle dataset `mlg-ulb/creditcardfraud` → `data/creditcard.csv` (~150 MB) | <https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud> |

Project root (used by every command below):

```powershell
$root = "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 The shipped virtual environment

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip list
```

Expected (verified in this checkout):

```
Python 3.12.1
Flask        3.1.3
joblib      1.6.0
numpy       2.5.4
pandas      3.0.6
scikit-learn 1.9.1
```

If you need to rebuild it:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-modern.txt
```

> **Do not use `requirements.txt`** — it pins 2017 versions (`Flask==0.12.2`, `numpy==1.13.1`,
> `pandas==0.20.3`, `scikit-learn==0.18.2`, `scipy==0.19.1`) that cannot be installed on Python 3.12.
> `requirements-modern.txt` is the supported set: `flask>=2.3`, `scikit-learn>=1.3`, `pandas>=2.0`,
> `joblib>=1.3`.
> `requirements-dev.txt` (`nose==1.3.7`) is also unusable on Python 3.10+ — see
> [Section 4.1](#41-automated--command-line-tests).

**pytest is not installed** in the shipped venv (verified: `No module named pytest`). If you want the
pytest flavour of the test suite, install it once:

```powershell
.\.venv\Scripts\python.exe -m pip install pytest
```

#### 2.2 Configuration

**There is none.** The service reads no environment variables and no `.env` file. The only two settings are
file paths hard-coded in `src/settings.py`:

```python
PARENT_DIR_PATH   = os.path.dirname(os.path.realpath(os.path.join(__file__, '..')))
DATASET_FILENAME  = os.path.join(PARENT_DIR_PATH, "data", "creditcard.csv")
MODEL_FILENAME    = os.path.join(PARENT_DIR_PATH, "models", "model.pickle")
```

**Browser-side settings** (`localStorage`, editable in the console's top bar):

| Key | Default | Purpose |
|---|---|---|
| `fraudguard.apiBase` | `http://127.0.0.1:5000` | Base URL of the API; re-probed when you change it |
| `fraudguard.threshold` | `0.50` | Alert threshold for the LOW / MEDIUM / HIGH bands |
| `fraudguard.auditLog` | *(empty)* | The audit trail (max 200 entries) |

The default `apiBase` matches the backend's bind address, so **no editing is required**. The service sets
`Access-Control-Allow-Origin: *` in an `@app.after_request` hook, so a console served from
`http://localhost:8000` can call `http://127.0.0.1:5000` cross-origin.

#### 2.3 Supplying the model (optional but required for real scores)

Both artefact folders currently contain only a `.gitignore` — verified:

```powershell
Get-ChildItem models, data -Force
```

To unlock real inference:

1. **Download the dataset** — Kaggle dataset `mlg-ulb/creditcardfraud` (sign-in required). The archive
   contains `creditcard.csv` (~150 MB, 284 807 rows, columns `Time, V1..V28, Amount, Class`).
2. **Place it as** `data/creditcard.csv`:

   ```powershell
   # after downloading and extracting the archive into your downloads folder
   Copy-Item "$HOME\Downloads\creditcard.csv" ".\data\creditcard.csv"
   Test-Path .\data\creditcard.csv     # -> True
   ```

3. **Train the model** (writes `models/model.pickle`):

   ```powershell
   Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"
   .\.venv\Scripts\python.exe src\train.py
   ```

   `src/train.py` runs a `GridSearchCV` over a `LogisticRegression(class_weight="balanced")` pipeline
   (`C ∈ {1e-4, 1e-2, 1e0, 1e2, 1e4}`, `cv=10`, `scoring="recall_macro"`, `n_jobs=-1`) over an 80/20
   split (`random_state=42`), then `joblib.dump`s the best estimator to `models/model.pickle`.
   **This takes several minutes** on the full dataset and is CPU-heavy.

4. **Restart the API** — the model is loaded once at import time:

   ```python
   app.model = None
   if os.path.exists(MODEL_FILENAME):
       app.model = joblib.load(MODEL_FILENAME)
   ```

   So `POST /predict` only stops returning 503 after a **fresh** start of `src/flask_app.py`.

> **Skipping all of this is a supported state.** The API stays up and returns a structured
> `503 {"error": "Model not loaded", "detail": "models/model.pickle is missing. Train it first: place
> data/creditcard.csv then run python src/train.py"}`, and the console renders that error. This is the
> documented behaviour of the repository as shipped, not a defect.

---

### 3. Launch the Complete Project

#### 3.1 Backend — Flask prediction service on port 5000

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"
.\.venv\Scripts\python.exe src\flask_app.py
```

Expected console output:

```
 * Serving Flask app 'Fraud Detection'
 * Debug mode: off
WARNING: This is a development server. ...
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
```

Stop with `Ctrl+C`.

**Equivalent Flask-CLI invocation** (same port, same behaviour):

```powershell
$env:FLASK_APP = "src/flask_app.py"
.\.venv\Scripts\python.exe -m flask run
```

> `src/flask_app.py` uses the flat import `from settings import MODEL_FILENAME`. Both commands work because
> the script's own directory (`src/`) is placed on `sys.path` automatically.

#### 3.2 Frontend — the FraudGuard console on port 8000

Open a **second** PowerShell window:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"
python -m http.server 8000
```

Open **http://localhost:8000**. (Opening `index.html` directly also works — all asset paths are relative.)
Stop with `Ctrl+C`.

#### 3.3 Ports summary

| Component | Port | Address |
|---|---|---|
| Flask API (`src/flask_app.py`) | 5000 | `http://127.0.0.1:5000` |
| Static console (`python -m http.server`) | 8000 | `http://localhost:8000` |

---

### 4. Test the Project

#### 4.1 Automated / command-line tests

The repository ships `tests/test_flask.py` (4 tests: 2 validation, 2 prediction). Two runners are possible.

**Runner A — `unittest` (works with the shipped venv, no extra install). Verified.**

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection"
$env:PYTHONPATH = "src"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Expected in the shipped state (model absent) — **verified output**:

```
test_empty_body (test_flask.EndpointTest.test_empty_body) ... ok
test_multiple_data_points (test_flask.EndpointTest.test_multiple_data_points) ... FAIL
test_no_features (test_flask.EndpointTest.test_no_features) ... ok
test_single_data_point (test_flask.EndpointTest.test_single_data_point) ... FAIL
======================================================================
FAIL: test_multiple_data_points (test_flask.EndpointTest.test_multiple_data_points)
    self.assertEqual(response.status_code, 200)
AssertionError: 503 != 200
----------------------------------------------------------------------
FAIL: test_single_data_point (test_flask.EndpointTest.test_single_data_point)
    self.assertEqual(response.status_code, 200)
AssertionError: 503 != 200
----------------------------------------------------------------------
Ran 4 tests in 0.035s
FAILED (failures=2)
```

**2 of 4 pass.** `test_empty_body` and `test_no_features` assert the 400 validation contract and pass.
`test_single_data_point` and `test_multiple_data_points` expect HTTP 200 with a `scores` array and
therefore fail with **503 Model not loaded** — they cannot pass until the dataset is downloaded and the
model trained (Section 2.3). This is the **expected** state of the repository.

**Runner B — `pytest`** (requires `.\.venv\Scripts\python.exe -m pip install pytest` first):

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\credit-card-fraud-detection\tests"
$env:PYTHONPATH = "..\src"
..\.venv\Scripts\python.exe -m pytest -q
```

Expect the same 2-pass / 2-fail split until `models/model.pickle` exists.

> `requirements-dev.txt` pins `nose==1.3.7`, which is broken on Python 3.10+. Use `unittest` or
> `pytest`, not `nosetests`.

**API tests with `curl.exe` (all verified against the running service).**

**Test 1 — empty body → HTTP 400**

```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST http://127.0.0.1:5000/predict -H "Content-Type: application/json" --data-binary "{}"
```

Expected — verified:

```
{"error": "No features found in input"}
HTTP 400
```

**Test 2 — 30 features but no model → HTTP 503**

```powershell
@'
{"features": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}
'@ | Set-Content -Path "$env:TEMP\fraud_features.json" -Encoding utf8

curl.exe -s -w "`nHTTP %{http_code}`n" --data-binary "@$env:TEMP\fraud_features.json" -H "Content-Type: application/json" http://127.0.0.1:5000/predict
```

Expected — verified:

```
{"error": "Model not loaded", "detail": "models/model.pickle is missing. Train it first: place data/creditcard.csv then run python src/train.py"}
HTTP 503
```

> After training the model (Section 2.3) the same request must return **HTTP 200** with
> `{"scores": [<fraud_probability>]}`.

**Test 3 — CORS preflight → HTTP 204**

```powershell
curl.exe -s -o NUL -w "HTTP %{http_code}`n" -X OPTIONS http://127.0.0.1:5000/predict
```

Expected — verified: `HTTP 204`.

**Test 4 — batch shape (list of rows)**

```powershell
@'
{"features": [[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0]]}
'@ | Set-Content -Path "$env:TEMP\fraud_batch.json" -Encoding utf8

curl.exe -s -w "`nHTTP %{http_code}`n" --data-binary "@$env:TEMP\fraud_batch.json" -H "Content-Type: application/json" http://127.0.0.1:5000/predict
```

Expected without a model: the same **HTTP 503** payload. After training: **HTTP 200** with a `scores`
array of two floats.

#### 4.2 Manual checks in the browser (FraudGuard console, http://localhost:8000)

1. Open the console. The status LED in the header starts **UNKNOWN**, then flips to **ONLINE** with a note
   like *"reachable · probe HTTP 400"* (the probe posts an empty body, so a 400 is a *success* signal —
   it proves the route answered) or **OFFLINE** if the API is down.
2. The **API BASE** field shows `http://127.0.0.1:5000` by default. Change it and the console re-probes
   automatically.
3. Press **LOAD SAMPLE ROW** — the 30 fields are filled with a demo row and the page states
   *"SAMPLE ROW LOADED — demo values — not a model output"*.
   (The demo row is `118.0, 1.0, -0.35, 1.12, …, 89.99, 1.0` — see `SAMPLE_ROW` in `js/app.js:12`.)
4. Press **SCORE TRANSACTION** (or `Ctrl+Enter`). With no model you will see the HTTP status `503` and the
   body `{"error": "Model not loaded", …}` in the response panel — the console renders the error rather
   than a score. With a trained model you get the fraud probability, the LOW/MEDIUM/HIGH band from the
   threshold slider, the request/response JSON, the HTTP status and the latency.
5. **Batch tab** — paste one 30-value transaction per line and press **SCORE BATCH**; the result table is
   sortable by score and exportable as `fraudguard-batch-YYYYMMDD-HHMMSS.csv`.
6. **Audit log tab** — every attempt (single or batch) is recorded with time, mode, score, band, status
   and detail; export as `fraudguard-audit-*.csv` or clear it.
7. **Copy JSON** copies the request/response pair for bug reports.
8. Browser DevTools → Network: confirm a `POST http://127.0.0.1:5000/predict` request with
   `Content-Type: application/json` and a CORS-friendly response.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'flask_app'` when running the tests | `src/` is not on `PYTHONPATH` | From the project root: `$env:PYTHONPATH = "src"`; from `tests\`: `$env:PYTHONPATH = "..\src"` |
| `No module named pytest` | pytest is not in the shipped venv (verified) | `.\.venv\Scripts\python.exe -m pip install pytest`, or use the `unittest` runner (Runner A) |
| `nosetests: command not found` / crashes | `requirements-dev.txt` pins `nose==1.3.7`, broken on Python 3.10+ | Use `unittest` or `pytest` |
| `pip install -r requirements.txt` fails | 2017 pins (`numpy==1.13.1`, `pandas==0.20.3`, `scikit-learn==0.18.2`, `Flask==0.12.2`) | Use `requirements-modern.txt` |
| `Address already in use` / port 5000 busy | Another Flask app is running | `Get-NetTCPConnection -LocalPort 5000` to find it, stop it, or `.\.venv\Scripts\python.exe -m flask --app src/flask_app.py run --port 5001` and update the console's API base |
| The console LED stays **OFFLINE** | The API is not running, the API base is wrong, or the browser blocked the request | Check `curl.exe -s -X POST http://127.0.0.1:5000/predict -H "Content-Type: application/json" --data-binary "{}"` returns 400, confirm the API base field, and look at the DevTools console for CORS errors |
| `POST /predict` returns **503 "Model not loaded"** | `models/model.pickle` does not exist | **Expected** in the shipped state. Follow Section 2.3 (download the dataset → `python src\train.py` → restart the API) |
| `python src\train.py` fails with `FileNotFoundError: ... creditcard.csv` | The dataset was not placed at `data/creditcard.csv` | `Copy-Item "$HOME\Downloads\creditcard.csv" ".\data\creditcard.csv"` and confirm `Test-Path .\data\creditcard.csv` |
| `python src\train.py` fails with `ModuleNotFoundError: No module named 'settings'` | The script was run from the wrong directory | `src/train.py` uses the flat import `from settings import ...`; run it as `.\.venv\Scripts\python.exe src\train.py` from the project root (Python puts `src/` on `sys.path`) |
| Training appears to hang | `GridSearchCV` runs 5 C-values × 10 folds over ~284 k rows with `n_jobs=-1` | Let it run (several minutes); the progress is logged by `verbose=3` |
| The API still returns 503 after training | The model is loaded at import time only | **Restart** `src/flask_app.py` |
| `500` with a pickle/AttributeError on a stale `model.pickle` | The pickle was produced by a different scikit-learn version | Delete `models/model.pickle` and retrain with the current venv |
| The UI's "Paste row" rejects a value | Only numbers are accepted (spaces, commas or semicolons as separators) | Use exactly 30 numeric values |
| Port 8000 busy | Another static server is running | `python -m http.server 8001` and open `http://localhost:8001` |

**Known limitations to state honestly**

* **The trained model is not in the repository** — `models/model.pickle` and `data/creditcard.csv` are
  both absent, so real scoring requires a ~150 MB Kaggle download plus a multi-minute training run.
* **The shipped test suite fails 2 of 4 tests by design** until the model exists; that is the documented
  state, not a regression.
* **There is no `/health` endpoint.** Use an empty `POST /predict` (HTTP 400) as the liveness probe.
* The API returns **only** the fraud probability (`scores`), with no explanation, feature names or
  transaction id.
* No CI, no linting configuration and no additional test coverage in the repository.

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result.

**Environment**

- [ ] `.\.venv\Scripts\python.exe --version` prints `Python 3.12.1`
- [ ] `.\.venv\Scripts\python.exe -m pip show flask` reports `3.1.3`
- [ ] `.\.venv\Scripts\python.exe -m pip show scikit-learn` reports `1.9.1`
- [ ] `Get-ChildItem models, data -Force` shows only `.gitignore` in each (confirming the model/dataset are absent)

**Backend**

- [ ] `.\.venv\Scripts\python.exe src\flask_app.py` starts and logs `Running on http://127.0.0.1:5000`
- [ ] An empty JSON body to `POST /predict` returns HTTP `400` with `{"error": "No features found in input"}`
- [ ] A 30-value feature vector returns HTTP `503` with `{"error": "Model not loaded", "detail": "models/model.pickle is missing …"}`
- [ ] `curl.exe -X OPTIONS http://127.0.0.1:5000/predict` returns HTTP `204`
- [ ] The response headers include `Access-Control-Allow-Origin: *`
- [ ] The service is reachable only from `127.0.0.1` (not exposed on the LAN)

**Automated tests**

- [ ] `$env:PYTHONPATH = "src"` then `.\.venv\Scripts\python.exe -m unittest discover -s tests -v` runs 4 tests
- [ ] `test_empty_body` and `test_no_features` report `ok`
- [ ] `test_single_data_point` and `test_multiple_data_points` report `FAIL` with `AssertionError: 503 != 200` (expected while no model exists)
- [ ] (Optional, after training) the same command reports **4 passed**

**Model training (only if you want real scores)**

- [ ] `data/creditcard.csv` is present (`Test-Path .\data\creditcard.csv` → `True`)
- [ ] `.\.venv\Scripts\python.exe src\train.py` completes and writes `models/model.pickle`
- [ ] After restarting the API, a 30-value request returns HTTP `200` with `{"scores": [<float>]}`
- [ ] The same request for a batch of two rows returns two scores

**Frontend**

- [ ] `python -m http.server 8000` starts and `http://localhost:8000` loads the FraudGuard Console
- [ ] The header LED shows **ONLINE** while the API is running, and **OFFLINE** after you stop it
- [ ] **LOAD SAMPLE ROW** fills the 30 input fields and shows the "demo values — not a model output" notice
- [ ] **SCORE TRANSACTION** shows the request JSON, the response body, the HTTP status and the latency
- [ ] Without a model the console shows the `503` / "Model not loaded" error rather than a fabricated score
- [ ] The **Batch** tab scores multiple rows and exports `fraudguard-batch-*.csv`
- [ ] The **Audit log** tab lists every attempt and can export/clear `fraudguard-audit-*.csv`

**Cleanup**

- [ ] Both servers were stopped with `Ctrl+C`
- [ ] `Remove-Item Env:\PYTHONPATH -ErrorAction SilentlyContinue` was run
- [ ] Ports 5000 and 8000 are free
      (`Get-NetTCPConnection -LocalPort 5000,8000 -ErrorAction SilentlyContinue` returns nothing)
