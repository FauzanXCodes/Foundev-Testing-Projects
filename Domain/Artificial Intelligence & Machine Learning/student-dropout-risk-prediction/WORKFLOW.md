# DEWS (student-dropout-risk-prediction) — Setup & Test Workflow

### 1. Prerequisites

- **OS**: Windows (PowerShell)
- **Python**: README documents legacy setup; much of pipeline is **Python 2** code. For running Py2 scripts, need Python 2.7. For modern inspection/porting, Python 3.12.1 can parse some files but execution will fail on Py2 syntax.
- **PostgreSQL** (optional): `db_creation/` contains SQL to build DB from reference data.
- **Browser**: Modern browser for static UI.

### 2. Installation and Setup

From `N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\student-dropout-risk-prediction\`:

#### For static UI only (no deps needed)
No `requirements.txt`. UI is fully self-contained (synthetic data in JS).

#### For pipeline/DB exploration
**Python 2 environment (as documented):**
```powershell
py -2.7 -m venv .venv27  # if available
.\.venv27\Scripts\Activate.ps1
```
**Modern environment (for porting/inspection):**
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install pandas numpy scikit-learn statsmodels patsy matplotlib
```
**PostgreSQL setup (reference):**
```powershell
# Example (adjust credentials)
psql -d your_db -f db_creation/01_create_tables.sql
# ... run other db_creation/*.sql as needed
```
Reference data mentioned: `school_data_small.csv` (in db_creation context).

**Critical notes:**
- Real student data is **WITHHELD** (confidential). Pipeline expects data not present.
- Nearly all `pipeline/*.py` are Python 2 (failing `print` statements, removed `sklearn.cross_validation`, removed `sklearn.preprocessing.Imputer`). Only `pipeline/__3_Missing_Data_Processing.py` and one graph script parse on Py3.
- No tests present.

### 3. Launch the Complete Project

#### Component 1: Static UI (DEWS) — functional demo
```powershell
py -m http.server 8000
```
Open [http://localhost:8000/](http://localhost:8000/). `index.html` + `js/app.js` use **fully synthetic cohort** (IDs `SYN-4101..24`), hand-written weighted heuristic, `localStorage`. **No fetch, no API backend**.

#### Component 2: Pipeline scripts (investigation only, mostly broken on Py3)
Do **not** expect full pipeline to run on Python 3.12 as-is. Files: `pipeline/final_pipeline.py`, `pipeline/__1_*` through `__6_*`. Treat as legacy/Python 2 artifacts.

#### Component 3: Database build (optional)
Use PostgreSQL with `db_creation/*.sql` if you want schema/reference setup.

#### Component 4: Graphs
`graphs/` contains 7 published PR-curve PNGs for reference.

### 4. Test the Project

**Automated tests:** None.

**Manual verification:**
| Component | How to test | Expected |
|---|---|---|
| UI | Serve HTTP, load page | Synthetic dashboard loads, risk scoring uses local heuristic, persists via localStorage. No network requests. |
| Pipeline syntax (Py3) | `python -m py_compile pipeline/__3_Missing_Data_Processing.py` | May compile. Others likely fail on Py2 syntax (`print`, removed sklearn APIs). |
| DB scripts | Inspect `db_creation/*.sql` | SQL present for schema/setup (reference only). |

### 5. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| `SyntaxError` running pipeline on Python 3 | Python 2 code (`print` without parens, old sklearn imports) | Use Python 2.7 if you must run legacy code, or port to Py3. Real data withheld. |
| Missing data errors | Confidential data not included | Use synthetic UI only; pipeline cannot run end-to-end. |
| No deps to install | No `requirements.txt` | Install modern packages manually if porting, or use legacy env. |

### 6. Verification Checklist

- [ ] Static UI served: `py -m http.server 8000` loads `http://localhost:8000/`
- [ ] UI uses synthetic data (confirm IDs `SYN-4101..24`) and localStorage works
- [ ] Inspected `pipeline/` files — noted Python 2 legacy nature
- [ ] (Optional) Set up PostgreSQL and reviewed `db_creation/*.sql`
- [ ] (Optional) Reviewed `graphs/` PR-curve PNGs
