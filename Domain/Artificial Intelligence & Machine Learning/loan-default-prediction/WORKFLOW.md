# Underwriting Desk (loan-default-prediction) — Setup & Test Workflow

### 1. Prerequisites

- **OS:** Windows (PowerShell)
- **Python:** 3.12.1 (works for inspection; the original pipeline is legacy)
- **Node:** v22.15.0 (not required — this is a static UI)
- **No data included:** `train_v2.csv` / `test_v2.csv` from Kaggle "Loan Default Prediction" are **not** present. 
- **Notes about legacy code:**
  - `train_predict.py` uses Python 2 syntax (`print` statements) and old scikit-learn APIs
  - `models.py` uses `dict.iteritems()` and `np.float` (removed in modern libraries)
  - `sklearn.preprocessing.Imputer` was removed (replaced by `SimpleImputer`)
  - `GradientBoostingClassifier` loss `'deviance'` / `GradientBoostingRegressor` loss `'ls'` renamed to `'log_loss'` / `'squared_error'`
- **Runtime deps for the legacy pipeline (if ported):** an older pandas/scikit-learn build from ~2015 (README pins commit `884889a4`); modern versions will require code changes.

### 2. Installation and Setup

#### Step 1: Open the project directory
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\loan-default-prediction"
```

#### Step 2: (Optional) Create a virtual environment
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

#### Step 3: Understand what exists (no install required for UI)
- **Static UI:** `index.html`, `css/style.css`, `js/app.js` (vanilla JS, no backend, no model weights). The UI is a labeled demo scorecard using transparent heuristics.
- **Pipeline code:** `models.py`, `train_predict.py`, `tools/lr_clf.py` (for reference only as-is).
- **No `requirements.txt`**, no `package.json`, no weights, no dataset files.

> **If** you want to attempt running the real pipeline, you must supply Kaggle `train_v2.csv` and `test_v2.csv` to some `<data-folder>` and port the Python 2/legacy APIs first. The UI does **not** require this.

### 3. Launch the Complete Project

The "complete project" as implemented is the static **Underwriting Desk** UI (demo worksheet). The real ML pipeline is not runnable as-is.

#### Launch the UI (recommended)
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\loan-default-prediction"
python -m http.server 8000
```
Open: [http://localhost:8000/](http://localhost:8000/)

#### Attempt the legacy pipeline (only if data + porting available)
```powershell
# After obtaining train_v2.csv and test_v2.csv in <data-folder> and porting code:
python train_predict.py <data-folder>
# Expects: <data-folder>\train_v2.csv and <data-folder>\test_v2.csv
# Writes:  <data-folder>\test_proba.csv and <data-folder>\submission.csv
```
This will fail on unmodified code in modern Python due to the issues listed above.

### 4. Test the Project

#### UI tests (manual)
1. Load [http://localhost:8000/](http://localhost:8000/) — boot animation, header "Underwriting Desk", honesty banner stating demo/heuristic.
2. **Single case tab:** Fill form (defaults provided). Adjust f-fields/blends. Verify dial, P(default), expected loss, verdict, reason codes update.
3. **Portfolio ledger tab:** File a decision → appears in `localStorage` ledger; test sort, export CSV/JSON, delete/clear.
4. **Batch tab:** Paste CSV or load sample → score batch → histogram renders; export `submission.csv` (format `id,loss` matching repo rule).
5. **About the pipeline tab:** Confirms two-stage GBM, 0.60 cut, and lists legacy issues.

#### Pipeline tests (manual/conditional)
- Not automated. `tools/lr_clf.py` has a literal placeholder `train_path = '\path\to\train\set'` and uses `sklearn.cross_validation` (old API). No tests present.

### 5. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| UI loads but nothing scores | JS disabled or form invalid | Check console; fix invalid fields (validation messages shown). |
| `train_predict.py` syntax errors | Python 2 `print` statements | Port to Python 3 (`print(...)`). |
| `AttributeError: 'Imputer'` | Removed from scikit-learn | Replace with `sklearn.impute.SimpleImputer`. |
| `AttributeError: dict has no attribute 'iteritems'` | Python 3 | Use `X.dtypes.items()`. |
| `TypeError: np.float` deprecated/removed | NumPy | Use `float` or `np.float64`. |
| `loss='deviance'/'ls'` errors | Renamed in modern sklearn | Use `loss='log_loss'` / `loss='squared_error'`. |
| Missing `train_v2.csv`/`test_v2.csv` | Not in repo (Kaggle) | Obtain from Kaggle competition data. |

### 6. Verification Checklist

- [ ] Project directory opened at correct path
- [ ] Reviewed `index.html`, `js/app.js`, `models.py`, `train_predict.py` (legacy confirmed)
- [ ] Launched UI via `python -m http.server 8000` and opened http://localhost:8000/
- [ ] Verified demo banner and that no real weights/data are used
- [ ] Tested Single case, Ledger, Batch, About tabs
- [ ] Confirmed no `requirements.txt` / backend / dataset present
- [ ] Acknowledged need to port legacy pipeline if attempting real training/inference
