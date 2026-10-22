# Underwriting Desk

Folder id: `loan-default-prediction`. This repository contains the prize-winning solution to the [Kaggle Loan Default Prediction competition](https://www.kaggle.com/c/loan-default-prediction) by **Guocong Song**: a two-stage machine-learning pipeline that first estimates the *probability of default* and then estimates the *severity of the loss*, multiplying the two with a hard decision cut. A **companion browser page** (`index.html` + `css/style.css` + `js/app.js`) named *Underwriting Desk* reproduces the underwriting workflow — a scorecard, a risk dial, verdict bands and batch scoring — but it is explicitly a **demo worksheet**: it runs a transparent JavaScript heuristic, has no backend, and loads no model weights.

| Surface | Role | Runs the trained model? |
|---|---|---|
| `train_predict.py` + `models.py` (original, Python 2 era) | The real pipeline: train → `test_proba.csv` → `submission.csv` | Yes — after a port to modern Python (see Limitations) |
| `tools/lr_clf.py` (original) | Logistic-regression baseline with ROC-AUC evaluation | Yes — after the same kind of port |
| `index.html` + `js/app.js` (browser) | Underwriting worksheet with a documented demo heuristic | No |

> **Status warning.** As shipped, the Python pipeline does **not** execute on a modern interpreter: `train_predict.py` contains Python 2 `print` statements, and the code depends on scikit-learn and pandas APIs that have since been removed. This is a historical Kaggle solution, not a turnkey service. The browser worksheet is the part you can actually run today.

## Features

**Implemented and verified in the source**

- **Feature engineering** — `models.FeatureSelector` derives `f528-f527`, `f528-f274`, `f527-f274`, `trial2 = 5·f528 − 4·f274 − f527`, a `hasnull` missing-value flag, and three weighted linear combinations `comb`, `comb1`, `comb2`.
- **Column triage and de-duplication** — `FeatureSelector.fit` buckets columns by dtype (`int64` except `id`/`loss`, `float64`, `object`), and `_reduce` collapses statistically identical columns by grouping on `(count, min, max, mean, median)`.
- **Curated feature list** — a hand-picked `strong` list (14 features, including the derived `trial2`) plus everything not in the ~300-entry `exclude` tail list.
- **Stage 1 — default probability** — `DefaultClassifier` binarises the target (`loss > 0 → 1`) and wraps a `GradientBoostingClassifier(loss='deviance', learning_rate=0.01, n_estimators=3000, subsample=0.6, min_samples_split=12, min_samples_leaf=12, max_depth=6, random_state=1357)`.
- **Stage 2 — loss severity** — `PartialRegressor` trains a `GradientBoostingRegressor(loss='ls', learning_rate=0.0075, n_estimators=5000, subsample=0.5, min_samples_split=20, min_samples_leaf=20, max_leaf_nodes=30, random_state=9753)` **only on rows with `loss > 0`**, in log space, and clips predictions to `[1, 100]`.
- **The decision cut** — `submission['loss'] = pred_loss * (prob_default > 0.6)`: severity is applied only when the default probability exceeds `0.6`.
- **Pipeline plumbing** — `get_clf_pipeline()` / `get_reg_pipeline()` assemble `FeatureSelector → Imputer(median) → StandardScaler → model`.
- **Outputs** — `test_proba.csv` (columns `c0`, `c1`) and `submission.csv` (`id`, `loss`).
- **A logistic-regression baseline** — `tools/lr_clf.py` fits `LogisticRegression(C=1e20, penalty='l2', tol=1e-6, class_weight={0: 0.2, 1: 0.8})` on the same 13 features (missing values filled with `0`, not the median), splits 80/20 with `train_test_split`, and prints the coefficient vector and the ROC-AUC.
- **Browser worksheet** — single-case scoring with a live SVG risk dial, a contribution bar chart, a "Show formula" panel, three blend sliders, verdict/band labels, a batch scorer for pasted `test_v2`-style rows, a decision ledger and a case counter, all persisted in `localStorage`.

**Not available / requires external setup**

- **The competition dataset is not in the repository.** `train_predict.py` expects `train_v2.csv` and `test_v2.csv` in the folder you pass on the command line. Download them from Kaggle yourself.
- **No trained weights ship** — no pickled model, no saved booster. Every run retrains from scratch.
- **No HTTP API and no server.** The browser worksheet never contacts a backend.
- **The browser scores are a documented heuristic, not model output.** `js/app.js` computes a logistic-style score from a hand-written weighted sum (`DEMO_INTERCEPT = -1.6` plus 15 `DEMO_FACTORS`) and a demo severity derived from `exp(...)` clipped to `[1, 100]`. It reuses the real `models.py` combination coefficients for `comb`/`comb1`/`comb2`, but the final probability is **not** the GBM's.
- **There is no SMOTE and no `imblearn` anywhere in the repository.** Class imbalance is handled by the explicit `class_weight={0: 0.2, 1: 0.8}` in `tools/lr_clf.py` and by the two-stage decomposition (a binary default classifier plus a severity regressor fitted only on positive-loss rows).
- **`project-metadata.json` is wrong.** It claims `Python; XGBoost; Streamlit` and lists `models.py` as the entry point. There is no XGBoost, no Streamlit app, no server and no saved weights anywhere in the tree; the actual entry point is `train_predict.py`. The browser page itself points this out.
- **The code does not run on modern Python as shipped** (Python 2 `print` statements, removed scikit-learn/pandas/numpy APIs). The browser page states this in its own "Legacy Python 2 pipeline" panel.

## Technology Stack

| Layer | Technology | Where it appears |
|---|---|---|
| Data handling | pandas (historical target ≥ 0.13.1), NumPy | `models.py`, `train_predict.py`, `tools/lr_clf.py` |
| Modelling | scikit-learn — `GradientBoostingClassifier`, `GradientBoostingRegressor`, `LogisticRegression`, `StandardScaler`, `Imputer` | `train_predict.py`, `tools/lr_clf.py` |
| Preprocessing | Custom `FeatureSelector` / `DefaultClassifier` / `PartialRegressor` wrappers | `models.py` |
| Browser UI | Vanilla HTML5 / CSS / JavaScript, no framework, no build step | `index.html`, `css/style.css`, `js/app.js` |
| Persistence (browser) | `localStorage` — decision ledger (`ud.ledger.v1`) and case counter (`ud.caseno.v1`) | `js/app.js` |
| Dataset | Kaggle *Loan Default Prediction* — `train_v2.csv`, `test_v2.csv` (anonymised `f*` features) | external, not in repo |

No deep-learning framework, no GPU requirement, no external service, no API key.

## Prerequisites

- **For the browser worksheet (recommended path):** a modern browser and either Python's built-in static server or any static file host. **No Python packages, no Node.js, no build step.**
- **For the original pipeline:** a **historical** Python environment. The upstream README pins pandas ≥ 0.13.1 and a scikit-learn development build from commit `884889a4` (2015). Those versions do not install on Python 3.12 — expect to port the code (see Limitations for the exact list of breakages) before it runs.
- **Python 3.12.1** is the environment present on this machine, along with Node 22; neither is sufficient to run the original pipeline unpatched.
- **The Kaggle dataset** with an accepted Kaggle account.
- **Disk space** for the two CSVs (they are a few hundred megabytes in total).

## Project Structure

```
loan-default-prediction/
├── train_predict.py        # Original entry point — two-stage train + predict (Python 2 syntax)
├── models.py               # FeatureSelector, DefaultClassifier, PartialRegressor
├── tools/
│   └── lr_clf.py           # Logistic-regression baseline with ROC-AUC (Python 2 syntax)
├── index.html              # Browser worksheet — "Underwriting Desk"
├── css/style.css           # Browser UI stylesheet
├── js/app.js               # Demo scorecard, risk dial, batch scorer, localStorage ledger
├── LICENSE                 # MIT, © 2014 Guocong Song
├── README.md               # Upstream README (21 lines: description, deps, how to run)
├── project-metadata.json   # Catalog metadata — stack field is inaccurate
└── .gitignore              # Python build artefacts (no data exclusion — the data was never committed)
```

**Not present:** `requirements.txt`, any `data/` folder, `train_v2.csv`, `test_v2.csv`, `submission.csv`, `test_proba.csv`, or any serialised model.

## Installation

### A. Browser worksheet (works today, no dependencies)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\loan-default-prediction"
python -m http.server 8000
```

Open <http://localhost:8000/>. Serve it over HTTP rather than opening `index.html` from disk — the page is static, but HTTP avoids the odd browser restrictions that apply to `file://` origins.

### B. Original pipeline (requires a port first)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\loan-default-prediction"

py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

pip install "pandas<2.0" "numpy<1.24" "scikit-learn<0.22"
```

These pins get you as close as possible to the original API surface. **The result still does not start**, because of the Python 2 `print` statements and the `Imputer`/`cross_validation` imports. The minimum edits needed are listed under *Limitations* → *What the port requires*.

Linux/macOS equivalent: `python3 -m venv .venv && source .venv/bin/activate && pip install "pandas<2.0" "numpy<1.24" "scikit-learn<0.22"`.

There is **no `requirements.txt`** in the repository, so the command above is the closest reproducible approximation of the upstream instructions.

## Environment Configuration

**The code reads no environment variables and no config file.** The only "configuration" is a command-line argument and two literal paths:

| Setting | Value in source | Location |
|---|---|---|
| Data folder | `sys.argv[1]` — the folder holding `train_v2.csv` and `test_v2.csv` | `train_predict.py`, `__main__` block |
| Output folder | the same `sys.argv[1]` folder | `default_clf()` → `test_proba.csv`; `loss_reg()` → `submission.csv` |
| Training data filename | `train_v2.csv` | `train_predict.py`, `filenames` list |
| Test data filename | `test_v2.csv` | `train_predict.py`, `filenames` list |
| Loss threshold | `0.6` | `train_predict.py` — `submission['loss'] = pred_loss * (prob_default_test.values > 0.6)` |
| Baseline data path | `'\path\to\train\set'` — **a placeholder you must edit** | `tools/lr_clf.py` |
| Browser loss cut | `0.6` (`LOSS_CUT`) | `js/app.js` |
| Browser verdict bands | `> 0.60` decline, `≥ 0.45` review, else approve; bands `A/B/C/D` at `0.30 / 0.45 / 0.60` | `js/app.js` — `verdictOf()`, `bandOf()` |
| Browser case numbering | `ud.caseno.v1` in `localStorage`, cases formatted `UD-000001` | `js/app.js` |

## How to Launch

**Browser worksheet (the runnable path)**

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\loan-default-prediction"
python -m http.server 8000
```

Open <http://localhost:8000/>. The page shows a boot overlay, then the worksheet. Stop the server with `Ctrl+C`.

**Original pipeline (after porting)**

```powershell
.\.venv\Scripts\Activate.ps1
python train_predict.py path\to\data\folder
```

where `path\to\data\folder` contains `train_v2.csv` and `test_v2.csv`. The run trains the default classifier, writes `test_proba.csv` into that folder, then trains the severity regressor and writes `submission.csv` beside it.

**Logistic-regression baseline (after porting)**

```powershell
python tools\lr_clf.py
```

after editing `train_path` at the top of the file to point at your training CSV. It prints the fitted coefficients and the ROC-AUC.

**How the browser reaches the pipeline:** it does not. There is no API, no shared model file and no server. The worksheet reproduces the *shape* of the pipeline (a default probability, a severity, a `0.6` cut, a `loss` value) using a transparent JavaScript heuristic whose formula the page prints on demand.

**Stopping:** `Ctrl+C` in the server terminal; `Ctrl+C` also interrupts a long training run.

## Model and Dataset Setup

**Present in the repository**

| Path | Content |
|---|---|
| `models.py` | The complete feature-engineering and estimator-wrapper layer |
| `train_predict.py` | The complete two-stage pipeline |
| `tools/lr_clf.py` | The logistic baseline |
| `js/app.js` | The demo scorecard, including the **verbatim** `comb`/`comb1`/`comb2` coefficient vectors from `models.py` |

**Missing — you must supply it**

- **`train_v2.csv` and `test_v2.csv`** — download from the Kaggle *Loan Default Prediction* competition. `train_predict.py` hard-codes those two file names, so keep them exactly.
- **A trained model** — none is stored. Every run retrains the two gradient-boosting ensembles from scratch (3,000 trees at `lr = 0.01` and 5,000 trees at `lr = 0.0075`) over the full competition training set, so expect a long first run and no inference-only mode.
- **Historical dependency versions** — see *Installation*.

**Dataset shape expected by the code**

- `train_v2.csv` must contain an `id` column, a `loss` column (the target), and the anonymised `f*` feature columns referenced by `models.FeatureSelector.strong` — `f528`, `f527`, `f274`, `f271`, `f2`, `f332`, `f776`, `f336`, `f777`, `f4`, `f5`, `f647` — plus the columns used by `comb2` (`f67`, `f670`, `f598`, `f596`).
- `test_v2.csv` must contain the same feature columns and an `id` column; `loss` is read from the training file only.
- `loss` is a continuous severity in `[1, 100]` with many exact zeros — `DefaultClassifier.fit` binarises it (`yy[yy > 0] = 1.0`) and `PartialRegressor.fit` keeps only the positive rows.

**What the code produces**

| File | Content |
|---|---|
| `test_proba.csv` | One row per test row, columns `c0` (P(no default)) and `c1` (P(default)) |
| `submission.csv` | `id` and `loss`, where `loss = predicted_severity × (P(default) > 0.6)` |

## Usage

### 1. Open the worksheet

`python -m http.server 8000` → <http://localhost:8000/>. The header carries a `DEMO / SAMPLE` flag and the statement that nothing on the page is output of the trained model.

### 2. Score a single case

1. Fill the **Borrower profile** fields: loan amount, term, interest rate, age, annual income, debt-to-income, credit lines, derogatory reports, and late-30/60/90-day counts. Defaults are `18000 / 36 / 11.9 / 34 / 64000 / 38 / 9 / 0 / 1 / 0 / 0`.
2. Optionally open **Anonymized demo f-fields (16)** and change the `f528`, `f527`, `f274`, … values — these feed the `comb`, `comb1` and `comb2` combinations using the real `models.py` coefficients. They default to `1`.
3. Watch the **risk dial**: the needle animates to `P(default)` and a marker sits at the `0.60` loss cut. The contribution bars show which factor pushed the score up (red) or down (green).
4. Read the **verdict**: `approve` below `0.45`, `review` between `0.45` and `0.60`, `decline` above `0.60`; bands `A`, `B`, `C`, `D` at `0.30`, `0.45`, `0.60`.
5. Open **Show formula — demo scorecard** to see every term, its weight and its contribution.
6. **Copy to clipboard** / **Export CSV** to record the decision. The decision is appended to the local ledger.

Realistic example: amount `45000`, term `60`, rate `18.5`, age `27`, income `38000`, DTI `52`, lines `14`, derogatory `2`, late-30 `4`, late-60 `2`, late-90 `1`. The demo heuristic pushes this well above the `0.45` review band and typically past the `0.60` cut, so the verdict reads **decline** and the demo loss becomes `amount × severity / 100` instead of `0`.

### 3. Batch-score pasted rows

1. Switch to the **Batch** tab.
2. Load the sample rows or paste your own `test_v2`-style CSV.
3. Press **Score batch** (or `Ctrl+Enter`). Each row is scored with the same demo heuristic — never with the trained GBM — and the result table is formatted like the repository's submission file.
4. Export the batch as CSV.

### 4. Run the real pipeline (after porting)

```powershell
python train_predict.py "D:\kaggle\loan-default"
```

Expect a long training run, then `D:\kaggle\loan-default\test_proba.csv` and `D:\kaggle\loan-default\submission.csv`. The `loss` column is zero for every row whose default probability is ≤ `0.6` — that is the intended behaviour of this competition solution, not a bug.

## API Documentation

**This project exposes no HTTP API.** There is no server, no Flask/FastAPI/Django application and no route table in the source; `js/app.js` performs no network requests at all — it reads only `window.localStorage`. The original pipeline is a command-line script whose "interface" is the `sys.argv[1]` data folder and two output CSV files. If you need an API, you would have to add one; nothing exists to document against today.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `SyntaxError: Missing parentheses in call to 'print'` | Python 2 `print` statements at `train_predict.py` lines 76, 77, 78 and 80, and `tools/lr_clf.py` line 41 | Port them to `print(...)` — Python 2 is not available on a modern install |
| `ImportError: cannot import name 'Imputer' from 'sklearn.preprocessing'` | `Imputer` was removed in scikit-learn 0.22 | Use `SimpleImputer(strategy='median')`; the pipeline step name `Impute` can stay |
| `ImportError: cannot import name 'train_test_split' from 'sklearn.cross_validation'` | The `cross_validation` module was removed in scikit-learn 0.20 | Import `train_test_split` from `sklearn.model_selection` |
| `AttributeError: 'float' object has no attribute 'lower'` / `TypeError: Cannot interpret 'np.float'` | `np.float` was removed in NumPy 1.24 (`models.py` line 70) | Use `np.float64` |
| `AttributeError: 'Series' object has no attribute 'iteritems'` | `Series.iteritems()` was removed in pandas 2.0 (`models.py` line 28) | Use `.items()` |
| `hasnull` is always 0 | `data['hasnull'][mask] = 1` is chained assignment, which pandas ≥ 2 no longer propagates | Assign via a mask: `data.loc[mask, 'hasnull'] = 1` |
| `FileNotFoundError: ... train_v2.csv` | The folder passed on the command line does not contain the competition files | Download them from Kaggle and pass the folder that holds both CSVs |
| `KeyError: 'f528'` | `FeatureSelector.transform` needs the exact anonymised columns; a differently shaped CSV breaks it | Use the original competition `train_v2.csv` / `test_v2.csv` unmodified |
| `tools/lr_clf.py` reads `'\path\to\train\set'` | That path is a literal placeholder | Edit `train_path` at the top of the file |
| The browser page shows every case as "approve" | The demo heuristic is a separate formula from the GBM | Adjust the borrower fields, or lower the blend sliders' influence; the page labels these numbers as demo output |
| Browser page blank at <http://localhost:8000/> | The server is not running in the right folder | `cd` to the project root and restart `python -m http.server 8000` |
| Training is extremely slow | 3,000 + 5,000 boosting trees with `min_samples_leaf` 12 / 20 on a large CSV | Expected; this is the historical competition configuration |
| "Demo scorecard" numbers differ from the original notebook | The worksheet uses its own weighted sum, not `GradientBoostingClassifier` | Use `train_predict.py` for real numbers; the page says so explicitly |

## Limitations

- **The pipeline does not run on a modern Python as shipped.** Concrete breakages, all verified in the source:
  - `train_predict.py` lines 76, 77, 78 and 80 — Python 2 `print` statements → `SyntaxError` on Python 3.
  - `tools/lr_clf.py` line 41 — Python 2 `print list(clf.coef_[0])` → `SyntaxError`.
  - `train_predict.py` line 9/25/38 — `from sklearn.preprocessing import ... Imputer` → removed in scikit-learn 0.22.
  - `tools/lr_clf.py` line 4 — `from sklearn.cross_validation import train_test_split` → removed in scikit-learn 0.20.
  - `models.py` line 70 — `np.float` → removed in NumPy 1.24.
  - `models.py` line 28 — `dtypes.iteritems()` → removed in pandas 2.0.
  - `models.py` line 54 and `tools/lr_clf.py` line 20 — chained assignment `data['hasnull'][mask] = 1` → no longer propagates under pandas copy-on-write.
- **The dataset is not in the repository** and cannot be redistributed; you need a Kaggle account.
- **No trained weights are stored**, so there is no inference-only mode and no way to score a new case without a full retrain.
- **The browser worksheet is a demo**, not a model: `DEMO_INTERCEPT` and the 15 `DEMO_FACTORS` weights are hand-authored, not fitted. Only the `comb`/`comb1`/`comb2` coefficients are taken verbatim from `models.py`.
- **No HTTP API, no web service, no deployment story.**
- **No SMOTE / no resampling.** Imbalance is handled by `class_weight={0: 0.2, 1: 0.8}` (baseline) and by the two-stage decomposition (production pipeline). If you expected an SMOTE pipeline, it is not here.
- **No unit tests, no CI, no `requirements.txt`, no linter configuration.**
- **`project-metadata.json` misdescribes the project** — it claims `Python; XGBoost; Streamlit` and names `models.py` as the entry point; the browser page explicitly contradicts this.
- **No explainability beyond the hand-built contributions**; there is no SHAP, no permutation importance and no feature-importance export.
- **The `loss` cut at `0.6` is a single hard-coded number** with no calibration analysis in the repository.
- **Privacy**: the Kaggle dataset is anonymised (`f*` feature names), which also makes the feature semantics impossible to explain to an underwriter.

**What the port requires** (minimum edits to make `train_predict.py` run on Python 3.12):

1. Replace the four Python 2 `print` statements with function-call syntax.
2. `sklearn.preprocessing.Imputer` → `sklearn.impute.SimpleImputer`.
3. `np.float` → `np.float64`.
4. `dtypes.iteritems()` → `dtypes.items()`.
5. Replace the two chained `hasnull` assignments with `data.loc[mask, 'hasnull'] = 1`.
6. `tools/lr_clf.py`: move `train_test_split` to `sklearn.model_selection` and fix its `print`.
7. Optionally raise `n_estimators`/`min_samples_leaf` or switch to `HistGradientBoosting*` for speed — but that changes the model and therefore the predictions.

## License and Credits

- **Original project:** *Loan Default Prediction* by **Guocong Song** — <https://github.com/songgc/loan-default-prediction>, MIT licensed (see `LICENSE`, © 2014 Guocong Song). The upstream README states the solution *"got the prize"* in the Kaggle *Loan Default Prediction* competition.
- **The browser worksheet** (`index.html`, `css/style.css`, `js/app.js`) and this documentation were added later on top of the upstream project. They are not part of the upstream release and no ownership of the upstream code is claimed.
- **The worksheet is honest about its own limits** — every panel that would need a trained model is labelled as demo output, the "Legacy Python 2 pipeline" panel documents the breakages, and the page explicitly corrects the wrong stack claim in `project-metadata.json`. No fabricated predictions are presented as model output.
