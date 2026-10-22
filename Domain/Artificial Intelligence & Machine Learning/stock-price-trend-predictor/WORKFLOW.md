# TrendCast (stock-price-trend-predictor) — Setup & Test Workflow

### 1. Prerequisites

- **OS**: Windows (PowerShell)
- **Python**: 3.12.1 (context). **Warning:** `requirements.txt` pins very old packages (pandas==1.0.4, scikit-learn==0.23.1, numpy==1.18.5, yfinance==0.1.54, xgboost==1.1.0) — these may not install cleanly on Python 3.12. Consider a legacy environment or modernizing carefully.
- **Node.js**: v22.15.0 (not required for scripts/UI serving)
- **Browser**: Modern browser
- **GNU Make** (optional): `Makefile` present (Windows may need `mingw32-make`/WSL)

### 2. Installation and Setup

From `N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\stock-price-trend-predictor\`:

```powershell
py -3.12 -m venv .venv  # may need older Python for pinned deps
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Known issues (ground truth):**
- `src/data/make_dataset.py` lines ~73-74 contain an **IndentationError** (`except:` followed by same-indent `i += 1`) — the module **cannot be imported** as-is.
- `scripts/script.py` referenced by CI does **not exist**.
- No trained weight files shipped (notebook save line commented). Data present in `data/raw/*` and `data/processed/*` (includes `daily-rolling-binary-curated.csv`, weekly curated files).
- `test_environment.py` exists to check environment.

### 3. Launch the Complete Project

**No HTTP backend/API.** Components are scripts, notebooks, and a static UI.

#### Option A: Static UI (primary visual)
```powershell
py -m http.server 8000
```
Open [http://localhost:8000/](http://localhost:8000/). `js/app.js` fetches processed CSVs (e.g. `data/processed/daily-rolling-binary-curated.csv`, weekly) and computes Pearson correlations in-browser; charts via Chart.js CDN. Must be served over HTTP.

#### Option B: Environment check
```powershell
python test_environment.py
```
Checks basic environment setup per repo conventions.

#### Option C: Data/scripts/notebooks (investigation)
- `src/data/make_dataset.py` — **broken** due to indentation error (documented). Do not expect import to succeed.
- `src/data/update_data.py`, `src/features/build_features.py` — may have their own deps/expectations.
- Notebooks in `notebooks/` (`01 MLP+XGBoost training`, `02 research`, `03 viz`) — run in Jupyter with deps installed (old pins).

### 4. Test the Project

**Automated tests:** None obvious in repo root; `Makefile` has `test_environment` but no `test` target that runs a pytest suite visible here.

**Manual verification:**
| Component | How to test | Expected |
|---|---|---|
| UI | Serve HTTP, load page | Fetches processed CSVs, renders charts/tables with correlations. |
| Env check | `python test_environment.py` | Runs environment validation script. |
| Data presence | Inspect `data/raw/` and `data/processed/` | Raw daily/weekly CSVs present (93 each), processed CSVs present including curated sets. |
| `make_dataset.py` import | `python -c "import src.data.make_dataset"` (in repo root) | **Will raise IndentationError** (known bug at ~73-74). |

### 5. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Old deps fail to install on Python 3.12 | Pinned 2020 versions | Try Python 3.7/3.8 in a separate env, or upgrade packages carefully (may break code). |
| `IndentationError` in `src/data/make_dataset.py` | Syntax bug in repo | Do not import/run as-is; treat as known broken module (documented). |
| UI CSV fetch fails | Opened as `file://` | Use `python -m http.server 8000`. |
| Missing `scripts/script.py` | Referenced by CI but absent | Ignore CI path or create if extending. |

### 6. Verification Checklist

- [ ] Venv created/activated
- [ ] Attempted `pip install -r requirements.txt` (note any failures due to old pins on Python 3.12)
- [ ] Ran `python test_environment.py`
- [ ] Served UI: `py -m http.server 8000` and loaded `http://localhost:8000/`
- [ ] Confirmed processed CSVs present and UI fetches them
- [ ] Noted `src/data/make_dataset.py` IndentationError (import test)
- [ ] (Optional) Opened notebooks in Jupyter if exploring
