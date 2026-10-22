# DEWS — student-dropout-risk-prediction

DEWS is a **Dropout Early-Warning System** for school systems that need to decide *which* students to reach first. This folder contains the upstream research project — a SQL data-construction layer plus a Python machine-learning pipeline built for a *Machine Learning in Public Policy* course at the University of Chicago with its Center for Data Science in Public Policy — together with **DEWS Risk Register**, a static front-end (`index.html` + `css/style.css` + `js/app.js`) that demonstrates the ranking-and-capacity idea on a clearly-labelled **synthetic** cohort.

**The upstream goal, verbatim from the original README:** "develop a scalable ranking system that will allow a school system to target their interventions to individuals who are most immediately at risk for dropping out of high school."

> This file replaces the upstream README (11 lines). The upstream project remains at <https://github.com/BridgitDonnelly/Student-Dropout-Risk-Prediction>.

## Features

**Implemented and verifiable in this repository**

- **SQL database construction** — `db_creation/`:
  - `upload_data.sql` creates the yearly cohort tables (`cohort1_2006` … `cohort1_2012`) with columns `id, school_name, school_id, pid, year, gradeexp, grade, gender, byrmm, absrate, tardyr, nsusp, mobility, q1mpa…q4mpa, g6mapr, g6msam, wcode` and `\copy` loads the raw MCPS CSVs.
  - `create_new_tables.sql` joins grade 6→12 into `temp6_7` via `FULL OUTER JOIN … ON g6.pid = g7.pid`, producing one wide row per student.
  - `add_school_data.sql` attaches school-level attributes with seven `LEFT JOIN`s on `school_id`.
  - `add_dropout_column.sql` derives the labels: `g6_dropout` … `g12_dropout` and an overall `dropout` from withdrawal codes `IN (30,31,32,33,34,35,36,37,38,39,40,44,46,50,71,85)`.
  - `school_data_small.csv` — a small extract of the `school_data` table: the DDL for the table (columns `ssname, school, closed_or_closing, address, geocode, census_tract, principal, associatesuperintendent, cluster, phone, suspensionrate, mobilityrateentrantswithdra, attendancerate, avg_class_size, studentinstructionalstaffratio, dropoutrate, grade12documenteddecisionco/em/mi, grad12docdec_col_emp, graduationrate, studentsmeetinguniversitysyste` plus the 2012 census/demographic columns) with one worked example row for `SENECA VALLY HS` (school `104`).
- **Python pipeline** — `pipeline/`:
  - `__1_and_2_Read_and_Describe_Data.py` — ingest + summary statistics.
  - `__3_Missing_Data_Processing.py` — imputation.
  - `__4_Generate_Features.py` — `discretize_quartiles()`, `make_discrete_df()`, `makeDummies()`-style binary encoding.
  - `__5_Classifier.py` — classifier suite (logistic regression, linear/ANOVA SVM, decision tree, random forest, bagging, boosting, gradient boosting, KNN).
  - `__6_Evaluate.py` — `evalualte_base_split()`, `evalualte_K_fold()`, `plot_precision_recall_curve()`; 5-fold CV reporting accuracy, average precision, precision, recall, F1 and ROC-AUC.
  - `final_pipeline.py` — the consolidated entry point (`python pipeline/final_pipeline.py 9 False`), with `getSumStats`, `cleanData`, `makeDummies`, `limitRows`, `chooseCols`, `imputeData`, `imputeConditionalMean`, `featureGen`, `prepareData`, `buildModel`, `fitClf`, `getScores`, `findMisClf`, `plot_precision_recall_n`, `test_second_dataset`.
  - `mcps_pipeline.py`, `__5_MCPS_Classifier.py`, `__6_MCPS__Evaluate.py`, `cook-pipeline*.py`, `pipeline.py` — earlier and cohort-2 variants.
- **Published figures** — `graphs/*_precision_recall_n.png`: precision-recall vs. population share for Logistic Regression, Random Forest, Decision Tree, AdaBoost, Bagging, Nearest Neighbors and SGD.
- **DEWS Risk Register UI** — `js/app.js`:
  - A **synthetic** 24-row cohort (`COHORT`, ids `SYN-4101` … `SYN-4124`) with a transparent demo heuristic: `scoreOf()`, `components()`, `bandOf()` and `WEIGHTS = {absence: 0.30, gpa: 0.25, credits: 0.25, behavior: 0.20}`.
  - A **risk register** with grade/band filters, search, sortable columns and a profile drawer.
  - A **policy lab** — `rankedCohort()`, `labMetrics()`, `renderLab()`, `drawPrCurve()` — computing precision@k, recall@k, missed cases and a full precision/recall curve against the cohort base rate.
  - **Intervention logging** persisted to `localStorage` under the key `dews.interventions.v1`, with CSV export of the register and of the intervention log.

**Not available in this repository**

- **The real student data.** `pipeline/data/Data_Readme.md`: "Data for this project was stored in this directory on a secure server. To maintain confidentiality, it is not uploaded here." Only the school-level reference extract `db_creation/school_data_small.csv` ships.
- **No saved model weights.** Nothing is pickled, joblib'd or serialised anywhere.
- **No server, no API, no end-to-end command.** The pipeline scripts hard-code the authors' server paths (e.g. `/mnt/data2/education_data/mcps/DATA_DO_NOT_UPLOAD/cohort1_all_school.csv`).
- **The pipeline does not run on a modern scikit-learn.** It imports `from sklearn.cross_validation import train_test_split, cross_val_score, KFold` — removed in scikit-learn 0.20 — and uses Python-2 `print` statements.
- **The UI does not score real students.** It scores a hard-coded synthetic cohort with a demo heuristic; the UI itself says the model-based scoring "lives in the repository's Python pipeline".
- **No `requirements.txt`** exists for the pipeline; the dependencies are implied by the imports.

## Technology Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Database | PostgreSQL (assumed) | `\copy … from 'MCPS_2006.csv' with DELIMITER ',' NULL 'NA' HEADER CSV;` and `FULL OUTER JOIN` syntax in `db_creation/` |
| Language | **Python 2 era** | `print "Model score, accuracy : %.3f" % …` throughout `pipeline/` |
| Data | `pandas`, `numpy` | `read_csv`, `describe()`, `mode()`, `qcut`, `fillna` |
| ML | `scikit-learn` (legacy, `sklearn.cross_validation`) | `KFold(n_folds=5)`, `cross_val_score`, `train_test_split`, `LogisticRegression`, `SVC`, `LinearSVC`, `DecisionTreeClassifier`, `RandomForestClassifier`, `BaggingClassifier`, `AdaBoostClassifier`, `GradientBoostingClassifier`, `KNeighborsClassifier`, `SGDClassifier` |
| Statistics | `statsmodels` (`sm`), `patsy` (`dmatrices`) | Used for logistic-regression coefficient tables |
| Metrics / plots | `sklearn.metrics`, `matplotlib` (`Agg` backend), `pylab` | `precision_recall_curve`, `auc`, PR curve PNGs |
| Front-end | Vanilla HTML5 / CSS / JS | `index.html`, `css/style.css`, `js/app.js` — no framework, no build step, no network calls |
| Persistence (UI only) | `window.localStorage` | Key `dews.interventions.v1` |

## Prerequisites

- **Windows (primary):** PowerShell, a browser, and — only if you want to attempt the original pipeline — a **Python 2.7** interpreter (the scripts use Python-2 `print` syntax and `sklearn.cross_validation`).
- **Linux / macOS:** `python2.7` (or a `python` alias to it) plus PostgreSQL client tools for the SQL steps.
- **PostgreSQL** if you intend to rebuild the database from `db_creation/` against your own MCPS extracts.
- **No `.venv` exists in this repository** and there is no `requirements.txt`; the environment must be assembled by hand.
- **A modern-Python port** (recommended if you want to run anything): Python 3.12 works once `sklearn.cross_validation` is replaced with `sklearn.model_selection` and the `print` statements are fixed.

## Project Structure

```
student-dropout-risk-prediction/
├── index.html                     # DEWS Risk Register — static preview (3 tabs + drawer)
├── css/style.css                 # UI stylesheet
├── js/app.js                     # Synthetic cohort, heuristic scoring, policy lab, exports
├── README.md                     # (replaced by this file — upstream text preserved below)
├── LICENSE                       # MIT — Copyright (c) 2015 Bridgit Donnelly
├── project-metadata.json         # Catalogue metadata
├── db_creation/
│   ├── upload_data.sql           # CREATE TABLE cohort1_2006…2012 + \copy loads
│   ├── create_new_tables.sql     # FULL OUTER JOIN of grades 6-12 into wide rows
│   ├── add_school_data.sql       # LEFT JOIN school-level attributes
│   ├── add_dropout_column.sql    # derive g6..g12_dropout + dropout from wcode
│   └── school_data_small.csv     # `school_data` table DDL + one example row
├── pipeline/
│   ├── __1_and_2_Read_and_Describe_Data.py   # ingest + summary stats
│   ├── __3_Missing_Data_Processing.py          # imputation
│   ├── __4_Generate_Features.py                # discretize + dummies
│   ├── __5_Classifier.py                       # classifier factory functions
│   ├── __5_MCPS_Classifier.py                  # MCPS cohort variant
│   ├── __6_Evaluate.py                         # metrics, K-fold CV, PR curves
│   ├── __6_MCPS__Evaluate.py                   # MCPS evaluation variant
│   ├── final_pipeline.py                       # ← consolidated entry point
│   ├── mcps_pipeline.py                        # MCPS pipeline variant
│   ├── cook-pipeline.py, cook-pipeline-2.py, cook-pipeline-3.py, pipeline.py  # earlier versions
│   ├── precision_recall_population graph.py    # graph generation
│   ├── data/Data_Readme.md       # states the real data is withheld
│   └── output/                   # Output_Readme.md, evaluation/Evaluation_Readme.md, histograms/
└── graphs/                       # published precision-recall-vs-population PNGs (7 files)
```

Key paths referenced by the code:

- **Front-end entry:** `index.html` → `css/style.css` → `js/app.js`.
- **Pipeline entry:** `pipeline/final_pipeline.py` (argv: `pred_grade`, `ready_to_test`).
- **Hard-coded data paths (must be edited):** `/mnt/data2/education_data/mcps/DATA_DO_NOT_UPLOAD/cohort1_all_school.csv` and `.../cohort2_all_school.csv` in `final_pipeline.py`; `data/cs-training#3B.csv` and `data/g11g12onlyimputed_data.csv` / `data/g12imputed_data.csv` in `__5_Classifier.py` / `__6_Evaluate.py`.
- **Label definition:** `db_creation/add_dropout_column.sql` (withdrawal-code list).

## Installation

### A — the UI only (no installation required)

DEWS Risk Register is a static page with **no dependencies and no build step**. Serve it over HTTP:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\student-dropout-risk-prediction"
py -m http.server 8000
```

Then open <http://localhost:8000/>. (Opening `index.html` directly via `file://` also works — the page fetches nothing — but HTTP is the recommended way.)

### B — attempting the original pipeline

The pipeline has **no `requirements.txt`**. Create a legacy environment and install the implied stack by hand:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\student-dropout-risk-prediction"

py -2.7 -m venv .venv27
.\.venv27\Scripts\Activate.ps1

python -m pip install --upgrade "pip<21"
pip install "pandas==0.20.3" "numpy==1.16.6" "scikit-learn==0.19.2" "statsmodels" "patsy" "matplotlib" "numpy"
```

> `scikit-learn==0.19.2` is the last release that still provides `sklearn.cross_validation`. Newer wheels do not exist for Python 2.7 and will not install.

**Linux / macOS:** `python2.7 -m venv .venv27` and `source .venv27/bin/activate`.

### C — a modern-Python port (recommended path)

If you only want the *logic* to run (not the original environment), port the two Python-2 obstacles and use current libraries:

1. Replace `from sklearn.cross_validation import train_test_split, cross_val_score, KFold` with `from sklearn.model_selection import train_test_split, cross_val_score, KFold` (and `KFold(len(y), n_folds=5, shuffle=True)` → `KFold(n_splits=5, shuffle=True)`).
2. Convert `print "text" % x` to `print("text" % x)`.
3. Repoint the hard-coded data paths to your own CSVs.

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\student-dropout-risk-prediction"

py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install pandas numpy scikit-learn statsmodels patsy matplotlib
```

Verify the environment:

```powershell
python -c "import sklearn, pandas, numpy; print(sklearn.__version__, pandas.__version__, numpy.__version__)"
```

## Environment Configuration

The upstream pipeline reads **no environment variables and no `.env` file**. Configuration is hard-coded in the scripts:

| What | Where | Value |
| --- | --- | --- |
| Training CSV | `pipeline/final_pipeline.py` | `/mnt/data2/education_data/mcps/DATA_DO_NOT_UPLOAD/cohort1_all_school.csv` |
| Test CSV | `pipeline/final_pipeline.py` | `/mnt/data2/education_data/mcps/DATA_DO_NOT_UPLOAD/cohort2_all_school.csv` |
| Working datasets | `pipeline/__5_Classifier.py`, `pipeline/__6_Evaluate.py` | `data/cs-training#3B.csv`, `data/g11g12onlyimputed_data.csv`, `data/g12imputed_data.csv` |
| Raw CSV loader | `db_creation/upload_data.sql` | `\copy mcps.cohort1_2006 from 'MCPS_2006.csv' …` (relative to the server's working directory) |
| Target column | `pipeline/final_pipeline.py` | `DV = 'g' + str(pred_grade) + '_dropout'` |
| Graph output directory | `pipeline/__6_Evaluate.py` | `output/evaluation/<model>_precision-recall-curve.jpg` |
| UI storage key | `js/app.js` | `STORE_KEY = 'dews.interventions.v1'` (browser-local) |

There is **no database credential, no API key and no cloud service** anywhere in this project.

## How to Launch

### 1. DEWS Risk Register (the runnable surface)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\student-dropout-risk-prediction"
py -m http.server 8000
```

Open <http://localhost:8000/>.

- **Port:** 8000 (any free port works). The UI makes **no network requests at all** — there is no backend to reach.
- **Stop:** `Ctrl+C` in the PowerShell window.

### 2. The original pipeline (requires the withheld data)

There is **no single end-to-end command**. The order of operations is:

```powershell
# 1. Build the database in PostgreSQL from db_creation/*.sql
#    (against MCPS cohort extracts that you supply yourself)
psql -d your_db -f db_creation/upload_data.sql
psql -d your_db -f db_creation/create_new_tables.sql
psql -d your_db -f db_creation/add_school_data.sql
psql -d your_db -f db_creation/add_dropout_column.sql

# 2. Run the pipeline steps in order
python pipeline/__1_and_2_Read_and_Describe_Data.py
python pipeline/__3_Missing_Data_Processing.py
python pipeline/__4_Generate_Features.py
python pipeline/__5_Classifier.py
python pipeline/__6_Evaluate.py

# 3. Or the consolidated entry point:  python pipeline/final_pipeline.py <pred_grade> <ready_to_test>
python pipeline/final_pipeline.py 9 False     # build + evaluate on the training cohort
python pipeline/final_pipeline.py 9 True      # apply the best models to the test cohort
```

**Before any of this will work you must** edit the hard-coded `/mnt/data2/...` paths in `final_pipeline.py` and place your own cohort CSVs where the scripts expect them. The training data is **not** in this repository.

**Linux / macOS:** identical, with `source .venv27/bin/activate` in place of the PowerShell activation.

## Model and Dataset Setup

**What exists in the repository**

| Artefact | Path | Status |
| --- | --- | --- |
| SQL schema + loaders | `db_creation/*.sql` | Real, complete |
| School reference extract | `db_creation/school_data_small.csv` | Real — the `school_data` table DDL plus one example row (`SENECA VALLY HS`, school `104`) |
| Label rule | `db_creation/add_dropout_column.sql` | Real — the 16 withdrawal codes |
| Pipeline code | `pipeline/*.py` | Real, legacy Python 2 |
| Precision-recall figures | `graphs/*.png` | Real, published results |
| Output directories | `pipeline/output/`, `pipeline/output/evaluation/`, `pipeline/output/histograms/` | Present but contain only readme placeholders |

**What is missing**

- **The student-level cohort data** (`cohort1_all_school.csv`, `cohort2_all_school.csv`, `cs-training#3B.csv`, the imputed datasets). `pipeline/data/Data_Readme.md` states the data "was stored in this directory on a secure server" and "is not uploaded here" for confidentiality.
- **Trained model weights.** Nothing is serialised; `final_pipeline.py` fits classifiers in memory and scores them within the same run.
- **A `requirements.txt`.** The dependency set is implied by the imports only.

**How to supply your own data**

The pipeline expects a wide student-level frame with one column per grade (`g6_*` … `g12_*`) plus the derived dropout flags. The minimum contract is visible in `final_pipeline.py:chooseCols()` and `imputeData()`:

1. Provide `cohort1_all_school.csv` (training) and `cohort2_all_school.csv` (testing) with the columns the SQL creates — `school_id`, `pid`, `grade`, `gender`, `absrate`, `tardyr`, `nsusp`, `mobility`, `q1mpa`…`q4mpa`, `g*mapr`, `g*msam`, `g*wcode` — plus `g6_dropout` … `g12_dropout` (created by `add_dropout_column.sql`).
2. Point `final_pipeline.py` and `__5_Classifier.py` / `__6_Evaluate.py` at your paths.
3. Run `python pipeline/final_pipeline.py <pred_grade> False` where `pred_grade` is the grade you want to predict (e.g. `9`).

**Deployed models.** `final_pipeline.py` names the two best-performing classifiers when applying them to the test cohort: `name = ['logistic regression', 'random forest']` with `LinearSVC`-style `linear_model.LogisticRegression()` and `RandomForestClassifier(max_depth=5, n_estimators=10, max_features=1, class_weight={0: 1, 1: 10})`.

## Usage

### DEWS Risk Register (browser)

1. Open <http://localhost:8000/> → the **Register** tab.
2. **KPI band** — total cohort rows, HIGH-risk count, MED-risk count and the number of logged interventions.
3. **Filter and sort.** Search by enrollment ID (press `/` to focus), filter by grade chip (All / 9 / 10 / 11 / 12) and by band chip (All / High / Med / Low); click any column header to sort.
4. **Open a profile.** Click a row → the drawer shows enrollment, grade, absences (flagged `· chronic` at ≥ 35 days), GPA trend, credits earned (flagged below 70%), behaviour flags and the *illustrative* outcome label, plus the last logged intervention.
5. **Risk factors.** Four bars — Absence rate (weight 30%), GPA decline (25%), Credit shortfall (25%), Behaviour flags (20%) — each showing the normalised component, the weighted point contribution and a plain-language reason.
6. **Suggested interventions.** Five templates (Tutoring check-in, Mentor assignment, Attendance contract, Credit recovery plan, Family outreach). **Use** loads the template into the form below.
7. **Log an intervention.** Pick a type, a date (today or earlier — future dates are rejected), an owner and an optional note → **Save intervention**. The record is stored in `localStorage` and appears in the row's "Last intervention" column and in the drawer's History list. Saving a second time with the same record edits it (Cancel edit appears).
8. **Exports.** **Export register CSV** writes `dews-register.csv` with columns `enrollment, grade, absences, gpa_trend, credits_pct, risk_score, band, last_intervention, synthetic_outcome`. **Export interventions CSV** writes `dews-interventions.csv` with `enrollment, type, date, owner, note, logged_at`.
9. **Policy Lab tab.** Drag the **Capacity** slider from 5 % to 100 % of the cohort. The lab recomputes in real time:
   - **Flagged** — `k = round(n × pct / 100)` top-ranked rows.
   - **Precision@k** — of the flagged rows, the share that are illustrative dropouts.
   - **Recall@k** — of all illustrative dropouts, the share captured.
   - **Missed** — dropouts outside the capacity budget.
   - **PR curve** — precision and recall plotted against the share of the cohort flagged, with a dashed **baseline** line at the cohort base rate and a marker at your operating point.
   - The interpretation line states plainly that at near-universal capacity precision collapses to the base rate.
10. **Pipeline tab.** The honest inventory: what the SQL and Python steps are, which models were evaluated, which outputs are in the repo, how to run it (with the path-editing caveat), and FERPA-conscious notes.

### Running the original pipeline

```powershell
.\.venv27\Scripts\Activate.ps1

# Build the DB first (needs your own MCPS extracts)
# Then, in order:
python pipeline/__1_and_2_Read_and_Describe_Data.py
python pipeline/__3_Missing_Data_Processing.py
python pipeline/__4_Generate_Features.py
python pipeline/__5_Classifier.py
python pipeline/__6_Evaluate.py
```

`__6_Evaluate.py` prints, per classifier and per dataset, the mean cross-validated accuracy, average precision, precision, recall, F1 and ROC-AUC, plus a `Baseline = 1-Mean of DV` line, and writes `output/evaluation/<model>_precision-recall-curve.jpg`.

## API Documentation

**This project exposes no HTTP/REST API.** There is no Flask/FastAPI/Django app, no route table, no port binding and no JSON contract anywhere in the repository. `js/app.js` contains **no `fetch()` call and no API URL** — the synthetic cohort is embedded directly in the file.

The only structured interfaces are:

| Interface | Signature | Purpose |
| --- | --- | --- |
| SQL | `psql -f db_creation/upload_data.sql` etc. | Database construction (`CREATE TABLE`, `\copy`, `FULL OUTER JOIN`, `LEFT JOIN`, `UPDATE … SET dropout = 1 WHERE g*_wcode IN (…)`) |
| CLI | `python pipeline/final_pipeline.py <pred_grade> <ready_to_test>` | Consolidated training (`False`) / test-cohort scoring (`True`) run. `pred_grade` is an int (e.g. `9`); `ready_to_test` is the literal string `'False'` or `'True'`. |
| CLI | `python pipeline/__1_and_2_Read_and_Describe_Data.py` … `__6_Evaluate.py` | Step-by-step pipeline execution. |
| Python (module) | `buildModel(data, x, y)`, `fitClf(...)`, `getScores(...)`, `plot_precision_recall_n(...)`, `prepareData(data, cohort, pred_grade)` | Reusable functions if you import `final_pipeline` as a module. |
| Browser storage | `localStorage['dews.interventions.v1']` → `[{id, type, date, owner, note, ts}]` | The UI's persistence contract (JSON array). Written by `storeSave()`, read by `storeGet()`. |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `SyntaxError: Missing parentheses in call to 'print'` | The pipeline is Python 2. Use Python 2.7, or port the `print` statements and the `sklearn.cross_validation` imports. |
| `ImportError: cannot import name 'cross_validation' from 'sklearn'` | Removed in scikit-learn 0.20. Install `scikit-learn==0.19.2` (Python 2.7 only) or change the import to `sklearn.model_selection`. |
| `TypeError: KFold() got an unexpected keyword argument 'n_folds'` | Modern scikit-learn renamed it: `KFold(n_splits=5, shuffle=True)`. |
| `FileNotFoundError: '/mnt/data2/education_data/.../cohort1_all_school.csv'` | The authors' server path. Edit `final_pipeline.py` (and `__5_Classifier.py`, `__6_Evaluate.py`) to point at your own CSVs. |
| `FileNotFoundError: 'data/cs-training#3B.csv'` | Same cause — the working dataset files are not in the repo. |
| `No module named 'patsy'` / `statsmodels` | Not installed; they are only needed by the logistic-regression table helpers in `__5_Classifier.py`. |
| `psql: COPY failed: file "MCPS_2006.csv" not found` | `\copy` paths are relative to the server's working directory. Supply the MCPS extracts or rewrite the loaders with `COPY ... FROM PROGRAM` / `\copy` absolute paths. |
| The UI shows a cohort of 24 rows with ids `SYN-41xx` | Expected — that is the hard-coded synthetic cohort, not real data. |
| "Could not save — localStorage is blocked in this browser" | Private-browsing or a blocked storage policy. Use a normal window; the register still works, only the log is lost. |
| The intervention form rejects a date | `initInterventionForm()` sets `intervDate.max = today()`; future dates are invalid by design. |
| The PR curve is blank | `drawPrCurve()` needs canvas 2-D context; a browser without it shows the "Canvas drawing is unavailable" fallback. |
| Nothing happens when clicking a register row | The drawer requires `state.openId`; it opens on row click and closes with Esc or the ✕ button. |
| The Pipeline tab's commands fail immediately | Expected without the withheld data and a legacy environment; the tab documents the real order of operations, not a runnable one-liner. |
| `graphs/*.png` links 404 | Serve the folder over HTTP from the project root so the relative `graphs/…` paths resolve. |

## Limitations

- **The student-level data is withheld** for confidentiality (`pipeline/data/Data_Readme.md`). The repository cannot be run end to end as published.
- **No model weights and no serving code.** Nothing is deployed; there is no API and no saved artefact.
- **The pipeline targets a legacy stack** — Python 2 syntax, `sklearn.cross_validation`, `KFold(n_folds=…)`. It will not run unmodified on any current scikit-learn.
- **Hard-coded absolute server paths** in every script, and hard-coded relative dataset names.
- **No `requirements.txt`**, so the environment cannot be reproduced from the repo alone.
- **The UI is a preview, not a system of record.** It scores a hard-coded synthetic cohort with a transparent demo heuristic (30 % absence, 25 % GPA decline, 25 % credit shortfall, 20 % behaviour flags). It is not the upstream model and makes no claim about any real student.
- **The policy lab's precision@k / recall@k are computed on the synthetic cohort** against illustrative outcome labels. Real evaluation happens in `pipeline/__6_Evaluate.py` on the confidential data.
- **Interventions live only in the browser's `localStorage`** — no sync, no audit trail, no server record.
- **Single static host with no access control.** Anyone with the URL sees the page.
- **The upstream README was replaced** by this document.
- **FERPA/PII**: even the synthetic preview is not an approved system of record, and the original data was withheld for exactly this reason.

## License and Credits

- **Upstream project:** `student-dropout-risk-prediction`, authored for a *Machine Learning in Public Policy* course at the **University of Chicago** in partnership with its **Center for Data Science in Public Policy**. Licensed under the **MIT License** (see `LICENSE`, "Copyright (c) 2015 Bridgit Donnelly"). Contributors named in the source headers: **Bridgit Donnelly** (`mcps_pipeline.py`), **Christine Cook** (`final_pipeline.py`, `cook-pipeline*.py`) and **Joshua Mausolf** (`__5_Classifier.py`, `__6_Evaluate.py`, `__4_Generate_Features.py`).
- **Data source:** MCPS (Chicago Public Schools) cohort records, referenced by `db_creation/upload_data.sql` as `MCPS_2006.csv` … — **the student-level data is not redistributed here**.
- **DEWS Risk Register** (`index.html`, `css/style.css`, `js/app.js`) is a **later-added static UI layer** authored for this documentation effort. It is not part of the upstream project, contains no real student records, and fabricates no model predictions.
- **The upstream README text is preserved** in *Project Structure* and *Limitations* above, and the original repository remains the authoritative description of the project.
- **Third-party code remains with its authors** — pandas, NumPy, scikit-learn, statsmodels, patsy, matplotlib, PostgreSQL.
