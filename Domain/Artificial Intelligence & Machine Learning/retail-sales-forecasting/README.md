# DemandSight — Retail Sales Analytics (retail-sales-forecasting)

Browser-based executive analytics command center over the classic **Superstore** dataset. A vanilla
HTML/CSS/JavaScript dashboard loads `dataset/Superstore.csv` (9,994 real order lines, 2014–2017) and
computes every KPI, chart, and table **client-side — no backend required**. The upstream repository's
own assets are a MySQL-oriented SQL analytics kit (`sql/retail_analysis.sql`, `run_all_queries.py`,
`app.py` cleaning pipeline), which remain untouched and documented below.

## Features

**Implemented and working (UI — verified against the bundled dataset):**
- CSV loader with robust quoted-field parsing (product names contain commas)
- KPI strip: Total Sales, Total Profit, Margin %, unique Orders, sales-weighted Avg Discount + sparklines
- Filter ribbon: date-range chips (All / latest-year H1 / latest-year H2 / By year + year select),
  Region chips, Category chips, Segment select, Reset (chip labels adapt to the latest year in the data)
- Chart.js charts: monthly Sales with Profit overlay toggle, Sales by Category, Sales by Region,
  Sub-Category profitability (diverging green/red bars)
- Top-10 Products table with column sorting, search, CSV export, and copy-insight-summary
- Data notes panel with row/column counts and column glossary

**Not implemented (clearly labeled in the UI):**
- Forecasting — no model exists in this repo; the Forecast panel documents what a Prophet/ARIMA
  backend would need. **The UI makes no fabricated predictions.**

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (no frameworks), Chart.js 4 (CDN, guarded if offline) |
| Data | `dataset/Superstore.csv` (in-repo, 2.2 MB) |
| Upstream backend (optional, separate) | Python, pandas, MySQL (`app.py`, `run_all_queries.py`) |

## Prerequisites

- A modern browser
- Any static file server to avoid `file://` fetch restrictions, e.g. Python 3:
  `python -m http.server 8000`
- (Optional, upstream SQL kit only) Python 3 + pandas + a MySQL server — see Limitations

## Project Structure

```
retail-sales-forecasting/
├── index.html              # Dashboard UI (entry point)
├── css/style.css           # Styling
├── js/app.js               # Full analytics engine (loader, KPIs, filters, charts, table)
├── dataset/Superstore.csv  # Real dataset (9,994 rows, 2014–2017)
├── app.py                  # Upstream: CSV cleaning pipeline (hard-coded paths — see Troubleshooting)
├── sql/retail_analysis.sql # Upstream: 15 analytical SQL queries
├── run_all_queries.py      # Upstream: runs the SQL kit against MySQL
├── requirements.txt        # Upstream Python deps (pandas era pins)
├── README.md
└── PROJECT_OVERVIEW.md
```

## Installation

The dashboard itself needs **no installation**. For the optional upstream Python kit:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
pip install -r requirements.txt
```

Note: upstream `requirements.txt` is old; `pymysql` (used by `app.py`/`run_all_queries.py`) is not
declared — add `pip install pymysql` if you run them.

## Environment Configuration

No environment variables are read by the UI. The upstream `app.py` contains **hard-coded values**
(`E:\` drive paths, MySQL credentials) — edit them locally before use; do not commit real credentials.

## How to Launch

```powershell
cd "retail-sales-forecasting"
python -m http.server 8000
```

Open `http://localhost:8000/`. The page fetches `dataset/Superstore.csv` from the same origin,
parses it, and renders the dashboard (typically < 1 s). Stop with `Ctrl+C` in the server console.

There is no separate backend for the UI. The upstream MySQL kit, if used, runs via
`python run_all_queries.py` against your own database.

## Model and Dataset Setup

- **Dataset: included.** `dataset/Superstore.csv` — 9,994 rows, columns `Row ID … Profit`, dates
  `M/D/YYYY`, covering 2014–2017.
- **No forecasting model exists** in the repository (no weights, no training script).

## Usage

1. Serve the folder and open `http://localhost:8000/`.
2. Wait for the badge to show *“9994 rows loaded”*; the KPI strip and charts fill immediately.
3. Filter with the chips (e.g. *By year → 2017*, Region *West*, Category *Furniture*).
4. Toggle *Show Profit* on the Monthly Sales panel.
5. Sort the Top-10 Products table by clicking column headers; search by product name.
6. *Export filtered CSV* downloads the current product aggregation; *Copy insight summary* copies
   a one-line summary.
7. *Reset filters* restores the full dataset view.

## API Documentation

The dashboard has **no HTTP API** — all computation happens in the browser. (The Forecast panel
sketches a hypothetical future `/forecast` endpoint; it does not exist.)

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Page stuck on *“Loading Superstore.csv…”* with a failure message | Opened via `file://` (fetch blocked) | Serve with `python -m http.server 8000` |
| Charts do not render | Chart.js CDN unreachable (offline) | Charts are skipped gracefully; KPIs/tables still work — reconnect once to cache |
| H1/H2 chips seem mismatched vs. memory of the data | Chips are labeled from the **latest year in the data** (2017 here) | Use *All* or *By year* |
| Upstream `app.py` fails on missing paths / DB | Hard-coded `E:\` paths and MySQL creds | Edit paths/creds locally; install `pymysql` |

## Limitations

- No forecasting (honestly labeled in the UI).
- Upstream MySQL kit is untested here (no MySQL server; hard-coded environment paths).
- Avg Discount is a sales-weighted approximation, not a per-order statistic.
- Chart.js is loaded from a CDN; offline use degrades charts only.

## License and Credits

- Dataset and SQL analytics kit: upstream `retail-sales-forecasting` project (see original
  `LICENSE` if present in git history; metadata lists license as unknown — attribution retained).
- Dashboard UI layer (`index.html`, `css/`, `js/app.js`): added later for this collection;
  original upstream files were not modified.
