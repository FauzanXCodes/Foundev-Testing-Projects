# TrendCast — stock-price-trend-predictor

TrendCast is a research terminal for **stock-price-trend-predictor**, an implementation of the *Preis, Moat & Stanley (2014)* hypothesis: that **Google search-query volumes for terms like "debt", "crisis" or "stock market" carry predictive information about the direction of the DJIA** before the market moves. The repository contains the full research pipeline — Google Trends collection, relative-scale adjustment, feature engineering, model training in Jupyter notebooks, and published research figures — plus a static front-end (`index.html` + `css/style.css` + `js/app.js`) that lets you explore the curated datasets and the pipeline documentation in the browser.

**This project is direction-only research.** It predicts whether the index went *up* or *down*. It is **not** a price forecaster and **not** financial advice.

> This file replaces the upstream README (a cookiecutter template). The upstream repository remains at <https://github.com/cristianpjensen/Njord>.

## Features

**Implemented and verifiable in this repository**

- **Google Trends collection** — `src/data/make_dataset.py` → `Trends` class: `pull_daily()`, `pull_weekly()`, `pull_monthly()`, `get_token()`, `adjust_weekly()`, `adjust_daily()`, `download()`. Pulls US-geo search volume for all **93 keywords** listed in `src/data/keywords.txt`.
- **Relative-scale adjustment** — `Trends.adjust_weekly()` anchors every 5-year weekly increment to a monthly anchor point and reconstructs intermediate weeks by applying each unadjusted week's percentage change; `Trends.adjust_daily()` anchors each 6-month increment to an adjusted weekly point. The result is divided by its maximum and rounded to 2 decimals, producing the `Adjusted` column (0–1) in `data/raw/`.
- **Incremental refresh** — `src/data/update_data.py` → `main()`, `update_daily()`, `update_weekly()`, `get_token()`: extends the existing raw CSVs with new data fetched from the Trends API.
- **Feature engineering** — `src/features/build_features.py` → `research()`, `sma()`, `ema()`, `delta()`, `pct_change()`, `lag()`, `target_binary()`, `target_bins()`.
- **Curated datasets** — `data/processed/` contains 8 processed CSVs, including the two the UI loads: `daily-rolling-binary-curated.csv` (4,127 rows) and `weekly-rolling-binary-curated.csv` (855 rows).
- **Model training and evaluation** — `notebooks/01-cpj-machine-learning.ipynb` trains `MLPClassifier` and `XGBClassifier` direction classifiers with a chronological `train_test_split` and `RandomizedSearchCV`; `notebooks/02-cpj-research-model.ipynb` replicates the Preis et al. trading signal; `notebooks/03-cpj-visualisation.ipynb` handles plotting.
- **Strategy backtest helper** — `stock_score(y_pred)` inside `notebooks/01-cpj-machine-learning.ipynb` turns a 0/1 prediction series into an annualised return and a position history.
- **TrendCast UI** — `js/app.js` fetches the curated CSVs, parses them client-side, renders an interactive multi-series chart, computes Pearson correlations against the `Target` column in the browser, and exports the current view as CSV.

**Not available in this repository**

- **No model weights, no serialised estimators.** The notebook that saves one (`joblib.dump(clf, '../models/MLPClassifier/0006.sav')`) is commented out, and no `models/` directory exists.
- **No prediction API and no server.** There is no Flask/FastAPI app, no route table and no port binding anywhere in the repository. The UI is static and reads CSV files directly.
- **No live data refresh.** `src/data/update_data.py` exists but is not wired into any server or schedule in this repo; the only CI is `.github/workflows/main.yml`, which runs `python scripts/script.py` — a file that does **not** exist in this repository, so that workflow would fail if triggered.
- **The `make train` target does not exist.** `Makefile` defines `requirements`, `data`, `clean`, `lint`, `sync_data_to_s3`, `sync_data_from_s3`, `create_environment` and `test_environment` — no `train`. Training lives exclusively in the notebooks.
- **The 272-feature matrix is not persisted.** The curated CSVs ship only the selected columns (`Target`, `index`, `lag_1`, and 11 keyword columns). The intermediate feature matrix exists only as `data/processed/daily-rolling-binary.csv` (uncurated) and in notebook memory.

## Technology Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Data collection | `requests` `2.23.0`, `urllib3` `1.26.5`, `json` | Talks to the Google Trends `explore` and `widgetdata/multiline/csv` endpoints |
| Data wrangling | `pandas` `1.0.4`, `numpy` `1.18.5`, `python-dateutil` `2.8.1`, `DateTime` `4.3` | `Trends` class, `update_data.py` |
| Market prices | `yfinance` `0.1.54` | DJIA download in the notebooks (`yf.download('DJIA', …)`) |
| ML | `scikit-learn` `0.23.1` | `MLPClassifier`, `train_test_split`, `RandomizedSearchCV` |
| ML | `xgboost` `1.1.0` | `XGBClassifier` + `RandomizedSearchCV` |
| Notebooks | `jupyter` `1.0.0` | `notebooks/01…03-cpj-*.ipynb` |
| Build | GNU Make | `Makefile` (POSIX-style shell commands; `make` works best under WSL/Git Bash on Windows) |
| CI | GitHub Actions | `.github/workflows/main.yml` (cron `0 8 * * 2-6`, branch `webpage`) |
| Packaging | `setuptools` | `setup.py` (package name `src`, version `0.1.0`) |
| Front-end | Vanilla HTML5 / CSS / JS | `index.html`, `css/style.css`, `js/app.js` — no framework, no bundler |
| Charts | Chart.js (CDN) | Loaded by `index.html`; the only external front-end dependency |

## Prerequisites

- **Windows (primary):** PowerShell, Python 3.8–3.10 recommended (the pins target that era; `numpy==1.18.5` has no wheels for Python 3.11+), and a browser.
- **Linux / macOS:** Python 3.8–3.10, `python3` on `PATH`, `make`.
- **Optional:** `make` (WSL/Git Bash on Windows) for the `Makefile` targets.
- **Network:** only needed if you re-collect Google Trends data. Browsing TrendCast and the notebooks' existing data work offline.
- **Note:** `yfinance==0.1.54` and the pinned `pandas`/`numpy` combination are old; a modern environment will need the pins relaxed.

## Project Structure

```
stock-price-trend-predictor/
├── index.html                     # TrendCast — static research terminal (5 tabs)
├── css/style.css                 # UI stylesheet
├── js/app.js                     # CSV fetch + parse, chart, Pearson correlations, CSV export
├── Makefile                      # requirements / data / lint / sync targets (no `train` target)
├── setup.py                      # setuptools stub (name='src', version='0.1.0')
├── test_environment.py           # asserts the interpreter is Python 3
├── requirements.txt              # pinned Python dependencies
├── project-metadata.json         # Catalogue metadata
├── LICENSE                       # MIT — Copyright (c) 2020 Cristian Perez Jensen
├── data/
│   ├── README.md                 # Data notes + figures
│   ├── raw/daily/*.csv           # 93 keyword files, columns: Date, Adjusted
│   ├── raw/weekly/*.csv          # 93 keyword files, columns: Date, Adjusted
│   └── processed/
│       ├── daily-rolling-binary-curated.csv     (4,127 rows — loaded by the UI)
│       ├── daily-rolling-binary.csv             (uncurated daily feature matrix)
│       ├── weekly-rolling-binary-curated.csv    (855 rows — loaded by the UI)
│       ├── weekly-rolling-binary.csv
│       ├── weekly-delta-binary-curated.csv
│       ├── weekly-delta-binary.csv
│       ├── weekly-pct_change-binary-curated.csv
│       └── weekly-pct_change-binary.csv
├── src/
│   ├── data/keywords.txt         # 93 search terms, one per line
│   ├── data/make_dataset.py      # Trends class — pull + adjust + download
│   ├── data/update_data.py       # incremental refresh of raw CSVs
│   └── features/build_features.py  # research/sma/ema/delta/pct_change/lag/target_binary/target_bins
├── notebooks/
│   ├── 01-cpj-machine-learning.ipynb  # MLP + XGBoost direction classifiers
│   ├── 02-cpj-research-model.ipynb    # Preis et al. replication
│   └── 03-cpj-visualisation.ipynb     # plotting
├── docs/figures/                 # research figures (strategy comparisons, Bollinger bands, …)
├── reports/figures/              # figure copies used in the write-up
├── references/                   # the two source papers (PDF)
├── .github/workflows/main.yml    # scheduled data-update workflow (references a missing script)
└── Makefile / LICENSE
```

Key paths referenced by the code:

- **Front-end entry:** `index.html` → `css/style.css` → `js/app.js`.
- **UI data sources (real, in-repo):** `data/processed/daily-rolling-binary-curated.csv` and `data/processed/weekly-rolling-binary-curated.csv` (paths hard-coded in `js/app.js` → `DATASETS`).
- **Feature library:** `src/features/build_features.py`.
- **Collector:** `src/data/make_dataset.py`.
- **Keyword universe:** `src/data/keywords.txt` (93 terms).
- **Training entry points:** the three `.ipynb` files in `notebooks/`.

## Installation

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\stock-price-trend-predictor"

py -3.9 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
```

If `Activate.ps1` is blocked by the execution policy, run this once in the session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**Linux / macOS:** `python3 -m venv .venv` and `source .venv/bin/activate`.

**If `pip install -r requirements.txt` fails on a modern Python** (expected — `numpy==1.18.5` and `pandas==1.0.4` predate Python 3.10 wheels), create the venv with an older interpreter (`py -3.9 -m venv .venv`), or install the unpinned set for exploration only:

```powershell
pip install pandas numpy scikit-learn xgboost yfinance jupyter requests python-dateutil
```

Verifying the environment:

```powershell
python test_environment.py     # prints ">>> Development environment passes all tests!"
```

## Environment Configuration

The project reads **no environment variables and no `.env` file.** Configuration lives in three places:

| What | Where |
| --- | --- |
| S3 sync bucket (optional) | `Makefile` → `BUCKET = [OPTIONAL] your-bucket-for-syncing-data (do not include 's3://')`; override with `make sync_data_to_s3 BUCKET=my-bucket` |
| AWS profile (optional) | `Makefile` → `PROFILE = default`; override with `make sync_data_to_s3 PROFILE=myprofile` |
| Project/interpreter name | `Makefile` → `PROJECT_NAME`, `PYTHON_INTERPRETER = python3` |
| Collection window | `Trends(start_date=datetime.date(2004, 1, 1), end_date=datetime.date.today())` in `src/data/make_dataset.py` — edit the default or pass arguments |
| Keyword universe | `src/data/keywords.txt` (93 lines) |
| Market index | `yf.download('DJIA', start='2004-01-01', end='2020-06-26')` inside `notebooks/01-cpj-machine-learning.ipynb` |

There is **no API key** for Google Trends (the `Trends.get_token()` helper fetches a session token with a plain `requests` session) and **no key** for Yahoo Finance.

## How to Launch

### TrendCast UI (static — the only runnable surface out of the box)

Browsers block `fetch()` of local CSV files over `file://`, so the folder must be served over HTTP:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\stock-price-trend-predictor"
py -m http.server 8000
```

Then open <http://localhost:8000/>.

- **Port:** 8000 is the port named in the UI's own "DATA FEED UNREACHABLE" panel. Any free port works (`py -m http.server 8080` → <http://localhost:8080/>). If 8000 is taken, stop that process or pick another port.
- **How the front-end reaches the backend:** it doesn't need one. `js/app.js` fetches the two curated CSVs directly from `data/processed/` using relative paths defined in the `DATASETS` map — the same origin as the page.
- **Stop:** `Ctrl+C` in the PowerShell window running `http.server`.

### The research pipeline (optional, needs network + time)

```powershell
# Install deps and collect Google Trends data (long-running: 93 keywords x 90s sleep)
make requirements
make data

# Or directly:
python src/data/make_dataset.py
```

`make data` runs `src/data/make_dataset.py`, which pulls daily/weekly/monthly Trends data per keyword, adjusts it to a common relative scale and writes `data/raw/daily/*.csv` and `data/raw/weekly/*.csv`. It sleeps 90 s between keywords and retries up to 3 times per keyword, so a full run takes hours.

### The notebooks

```powershell
jupyter lab   # then open notebooks/01-cpj-machine-learning.ipynb
```

### Refreshing existing raw data

```powershell
python src/data/update_data.py
```

`update_data.py` extends the existing raw CSVs with newly downloaded data and writes to `data/interim/daily/` and `data/interim/weekly/` — **note that `data/interim/` does not exist in this repository and must be created first**, and the merge back into `data/raw/` is not automated.

## Model and Dataset Setup

**What exists in the repository**

- **Raw keyword series:** `data/raw/daily/` and `data/raw/weekly/`, 93 files each, columns `Date, Adjusted` (0–1 relative scale).
- **Curated processed datasets:** 8 CSVs in `data/processed/`. The two the UI loads have columns `Target, index, lag_1, debt, stocks, dow_jones, markets, unemployment, money, stock_market, crisis, nasdaq, finance, invest`.
- **Label definition:** `target_binary(series)` in `src/features/build_features.py` converts the close-price percentage change into `1` (up) / `0` (down). The `Target` column in the curated CSVs is this binary label.
- **Feature definition:** `research(series, length=3)` in `src/features/build_features.py` is the exact Preis/Moat/Stanley feature — today's value minus the previous *n*-day simple moving average, shifted by one period.

**What is missing**

- **No trained model files.** There is no `models/` directory and no `.sav`/`.joblib`/`.pkl` artefact. The notebook's `joblib.dump(clf, '../models/MLPClassifier/0006.sav')` line is commented out.
- **No prediction service.** No Flask/FastAPI app exists; TrendCast computes no predictions.
- **No API keys or secrets** are needed for anything in this repository.

**How to produce a model yourself**

1. Open `notebooks/01-cpj-machine-learning.ipynb`.
2. Run the cells in order — they call `yf.download('DJIA', start='2004-01-01', end='2020-06-26')` (network required) and load `../data/raw/daily/stock_market.csv`.
3. The notebook builds lagged features (`lag` 3–10), merges with the DJIA data, creates the binary target, splits chronologically with `train_test_split(X, y, test_size=0.2, shuffle=False)`, selects the **top 50 features by absolute Pearson correlation** with the target, and tunes `XGBClassifier` and `MLPClassifier` with `RandomizedSearchCV(cv=5, n_iter=20, scoring='recall')`.
4. Metrics printed by the notebook: accuracy, F1, recall, precision, plus the `stock_score()` annualised return.
5. Uncomment and re-point the `joblib.dump(...)` line to save a model, and add your own serving code if you need predictions — **the repository contains none**.

## Usage

### TrendCast UI (browser)

1. Open <http://localhost:8000/>. The **TRENDS** tab loads automatically; the status line reads `LOADING daily-rolling-binary-curated.csv ...` and then `LOADED … 4,127 rows x 14 cols`.
2. **Column chips.** Each CSV column becomes a toggle chip (`debt`, `stocks`, `dow_jones`, `markets`, `unemployment`, `money`, `stock_market`, `crisis`, `nasdaq`, `finance`, `invest`, `lag_1`, `Target`). Default selection for the daily set is `debt`, `stock_market`, `crisis`, `Target`; for the weekly set it is `debt`, `stock_market`, `Target`. Use **ALL / KEYWORDS / NONE** to switch groups in bulk (KEYWORDS excludes `Target` and `lag_1`).
3. **Chart.** The selected series are plotted against the row index. Hover tooltips show the index and the value.
4. **Stats panel.** Shows total rows, column count, the index range, and the up/down split of the `Target` label.
5. **Preview table.** The first 25 rows of the loaded CSV.
6. **Export.** **DOWNLOAD VIEW AS CSV** writes the currently selected columns to `trendcast-view-<dataset>.csv`.
7. **Switch dataset.** Click the daily / weekly chips in the toolbar to reload `data/processed/weekly-rolling-binary-curated.csv` (855 rows).
8. **FEATURES tab.** Lists the real feature functions from `src/features/build_features.py` with their signatures, and computes **Pearson correlation against `Target`** in the browser over the loaded rows — for each column: count, min, max, mean and the correlation coefficient. The status line confirms `DONE — correlations computed client-side from N rows … (Pearson)`.
9. **PIPELINE tab.** The four research stages (pull Trends → adjust to one relative scale → engineer features → train & evaluate) with the real commands, plus the explicit "SERVING REALITY CHECK" note that the repository ships no weights, no serialised estimators and no prediction API.
10. **KEYWORDS tab.** All 93 search terms as click-to-copy chips, plus the raw daily file listing.

### Python API (the feature library)

```python
from src.features.build_features import research, sma, ema, delta, pct_change, lag, target_binary

research(series, length=3)      # Preis et al. feature: value - previous n-day SMA (shifted by 1)
target_binary(series)           # binary up/down labels from close-price pct_change
```

### Refresh the data

```powershell
python src/data/update_data.py     # extend data/raw/* with newly downloaded Trends data
```

## API Documentation

**This project exposes no HTTP/REST API of its own.** There is no Flask/FastAPI app, no route definitions, no port binding and no JSON request/response contract in `src/` or at the repository root. The only HTTP surface is:

| Direction | Method & path | Purpose | Notes |
| --- | --- | --- | --- |
| Outbound (collection) | `GET https://trends.google.com/trends/api/explore` | Obtain a request token for a keyword + timespan | `Trends.get_token()` / `update_data.py:get_token()`. No API key. Response is JSON prefixed with 4 characters, which the code strips (`content = response.text[4:]`). |
| Outbound (collection) | `GET https://trends.google.com/trends/api/widgetdata/multiline/csv?req=…&token=…&tz=-120` | Download the search-volume CSV for a keyword | `Trends.pull_daily/pull_weekly/pull_monthly()`, `update_data.py:update_daily/update_weekly`. |
| Outbound (prices) | `yf.download('DJIA', start='2004-01-01', end='2020-06-26')` | DJIA OHLC history | Yahoo Finance via `yfinance`; used in `notebooks/01-cpj-machine-learning.ipynb`. |
| Inbound (browser → static files) | `GET /data/processed/daily-rolling-binary-curated.csv` | Daily curated dataset | Fetched by `js/app.js` → `loadDataset('daily')` from `DATASETS.daily.path`. |
| Inbound (browser → static files) | `GET /data/processed/weekly-rolling-binary-curated.csv` | Weekly curated dataset | Fetched by `js/app.js` → `loadDataset('weekly')` from `DATASETS.weekly.path`. |

The two inbound paths are plain static file requests served by `python -m http.server`; they are not application endpoints and accept no parameters.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "DATA FEED UNREACHABLE" panel and `FETCH FAILED: TypeError` | The page was opened via `file://`. Browsers block `fetch()` of local files. Serve the folder: `py -m http.server 8000`, then open <http://localhost:8000/> and press **RETRY FETCH**. |
| `Address already in use` | Port 8000 is taken. Use another: `py -m http.server 8080`. |
| `pip install -r requirements.txt` fails on `numpy==1.18.5` | No wheels for Python ≥ 3.10. Recreate the venv with `py -3.9 -m venv .venv`, or install the unpinned set for exploration. |
| `ModuleNotFoundError: No module named 'src'` | The notebooks do `sys.path.append('..')` and import `from src.features.build_features import *`. Launch Jupyter from the **repository root** so `src/` is importable. |
| `FileNotFoundError: ../data/raw/daily/stock_market.csv` | The notebook expects `data/raw/daily/stock_market.csv` relative to `notebooks/`. It exists in the repo — verify you launched Jupyter from the repo root. |
| `yf.download` returns an empty frame | Yahoo changed or rate-limited the endpoint for this old `yfinance` version. Upgrade `yfinance` or supply the DJIA CSV manually. |
| `make data` runs for hours | Expected: 93 keywords with a 90-second sleep between each and up to 3 retries. Ctrl+C to stop; already-downloaded keywords are skipped on the next run (`os.path.exists` check in `Trends.__init__`). |
| `make train` says "No rule to make target" | There is no `train` target. Training lives in `notebooks/`. |
| `make sync_data_to_s3` fails | `BUCKET` is the literal placeholder `[OPTIONAL] your-bucket-for-syncing-data`. Override it: `make sync_data_to_s3 BUCKET=my-bucket`. |
| `update_data.py` raises `FileNotFoundError: data/interim/daily/...` | `data/interim/` is not in the repository. Create `data/interim/daily` and `data/interim/weekly` before running. |
| `make requirements` uses `python3` on Windows | `Makefile` hard-codes `PYTHON_INTERPRETER = python3`. Override it: `make requirements PYTHON_INTERPRETER=python`, or run `pip install -r requirements.txt` directly. |
| `test_environment.py` raises `TypeError` | It requires Python 3 exactly (`REQUIRED_PYTHON = "python3"`); Python 2 or a mis-parsed interpreter fails the check. |
| The GitHub Actions workflow fails | `.github/workflows/main.yml` runs `python scripts/script.py`, and `scripts/` does not exist in this repository. The workflow is not runnable as-is. |

## Limitations

- **Direction only.** The models predict up/down, not price or magnitude. `target_binary()` is the label function.
- **Single market.** Only the DJIA (`yf.download('DJIA', …)`) is used as the price target.
- **Single hold-out split, not walk-forward.** The notebook uses `train_test_split(..., shuffle=False)` — one chronological 80/20 split. No rolling or walk-forward splitter appears anywhere in the notebooks.
- **No shipped weights and no serving code.** Everything a user would need for live inference must be written from scratch.
- **Google Trends sampling bias.** Trends returns normalised relative frequencies, not absolute search counts; the adjustment procedure (`adjust_weekly()` / `adjust_daily()`) reconstructs a common scale from anchors but cannot recover absolute volume.
- **Curated CSVs are a projection.** They carry 13 data columns, not the ~272 engineered features the notebook builds; the notebooks reconstruct the full matrix in memory.
- **Correlation ≠ causation.** The upstream paper itself frames the finding as predictive signal, not causation; nothing in this repository establishes a causal link between search volume and index returns.
- **Research only — not financial advice.** No position sizing, no transaction costs, no slippage, no risk management, and no walk-forward validation of the reported returns.
- **Legacy stack.** `pandas==1.0.4`, `numpy==1.18.5`, `scikit-learn==0.23.1`, `yfinance==0.1.54` are all from 2020 and do not install on modern Python without changes.
- **The CI workflow references a missing script** and would fail if it ran.
- **The upstream README was replaced** by this document.

## License and Credits

- **Upstream project:** `stock-price-trend-predictor` (upstream repository name "Njord"), authored by **Cristian Perez Jensen**, licensed under the **MIT License** (see `LICENSE`, "Copyright (c) 2020 Cristian Perez Jensen"). Upstream: <https://github.com/cristianpjensen/Njord>.
- **Research this implements:** Preis, D. J., Moat, J., & Stanley, L. (2014), *Quantifying Trading Behavior in Financial Markets Using Google Trends*, and Can We Predict the Financial Markets Based on Google's Search Queries? Both PDFs are included under `references/`.
- **TrendCast** (`index.html`, `css/style.css`, `js/app.js`) is a **later-added static UI layer** authored for this documentation effort. It is not part of the upstream project, renders no model output, and fabricates no predictions.
- **Derived code:** `src/data/update_data.py:get_token()` is adapted from **Pytrends** by GeneralMills (Apache-2.0); the attribution is stated in the function's docstring.
- **Third-party code remains with its authors** — pandas, NumPy, scikit-learn, XGBoost, yfinance, Jupyter and Chart.js.
