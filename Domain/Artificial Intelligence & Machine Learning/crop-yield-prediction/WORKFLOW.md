# YieldSight (crop-yield-prediction) — Setup & Test Workflow

This document covers **how to install, configure, launch and test the complete project**: the static YieldSight
console (`index.html` + `css/style.css` + `js/app.js`, port **8000**) and the PyTorch **command-line
pipeline** (`run.py` → `cyp/`) that actually produces predictions.

**Honest scope note up front — this project has no runnable model in this checkout:**

* **There is no HTTP server and no API.** `js/app.js` contains **no `fetch()` call**, no URL and no port.
  The console renders an explicitly labelled *illustrative sample series* and its **Pipeline** tab lists
  the real commands.
* **No trained weights ship.** `data/models/` does not exist; checkpoints (`<year>_<run>_<time>_gp.pth.tar`)
  are produced by a training run.
* **No model input ships.** `data/img_output/histogram_all_full.npz` is absent; it is produced by the
  `engineer` stage.
* **The flagship workflow needs ≈ 110 GB of MODIS downloads from Google Earth Engine** plus Earth Engine
  authentication and Google Drive — it is **not reproducible** in this environment.
* **No local environment exists.** There is no `.venv`, and the machine's Python 3.12.1 lacks `fire`,
  `ee`, `gdal` and `rasterio`. The dependencies are declared in `environment.yml` (Conda).

So: the **UI is fully runnable today**; the **pipeline is installable and inspectable**, but producing a
real prediction requires the external MODIS data and Earth Engine credentials.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 (commands below are PowerShell). Linux/macOS work identically | `Get-Host` |
| **Conda** | Miniconda / Anaconda — **strongly recommended**, `gdal` and `pytorch=1.0.0` have no pip wheels for modern Windows Python | `conda --version` |
| Python (project) | **3.7** per `environment.yml` / upstream README | `conda run -n crop_yield_prediction python --version` |
| Python (system) | 3.12.1 is present but **cannot host this pipeline** | `python --version` |
| **Google Earth Engine account** | Required for the `export` stage | <https://developers.google.com/earth-engine/> |
| **Google Drive** | Earth Engine writes the exports there; you download them into `data/` | — |
| Disk space | **≈ 110 GB** for the MODIS export + **≈ 97 GB** for the processed `.npy` arrays | `Get-PSDrive` |
| GPU | **Optional** — `run.py` defaults to `torch.device("cuda:0" if torch.cuda.is_available() else "cpu")` | `nvidia-smi` |
| Node.js | **Not required** — the console is plain HTML/CSS/JS, no build step | — |
| API keys | None of your own — Earth Engine uses its own OAuth login | — |

Project root (used by every command below):

```powershell
$root = "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\crop-yield-prediction"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 The console (static UI) — nothing to install

The console has **no dependencies at all** — pure HTML/CSS/JS with relative asset paths. Skip to
[Section 3.2](#32-frontend--the-yieldsight-console-static) if you only want the UI.

#### 2.2 The pipeline — Conda environment from `environment.yml`

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\crop-yield-prediction"

# 1. Create the environment exactly as declared (env name: crop_yield_prediction)
conda env create -f environment.yml

# 2. Activate it
conda activate crop_yield_prediction

# 3. Verify the pieces the code imports
python -c "import torch, fire, ee, numpy, pandas, scipy; print('torch', torch.__version__); print('ee ok'); print('fire ok')"

# 4. (optional) the error-map script needs BeautifulSoup, which is NOT in environment.yml
pip install beautifulsoup4
```

`environment.yml` (the shipped file) declares:

```yaml
name: crop_yield_prediction
channels: [pytorch, conda-forge, defaults]
dependencies:
  - pandas
  - numpy
  - gdal
  - matplotlib
  - scipy
  - tqdm
  - fire
  - pytorch=1.0.0
  - earthengine-api
```

> **Expect to relax the pins.** `pytorch=1.0.0` is from 2018 and the code is written against the PyTorch
> 1.0 API. If `conda env create` fails to resolve, install a modern torch into the same environment
> (`conda install pytorch>=1.10 -c pytorch`) and expect small API drift.
> **Never `pip install gdal`** — GDAL is not a pip package on most platforms; use
> `conda install -c conda-forge gdal` and do not mix conda and pip GDAL builds.

**Current state of this checkout (verified):** there is **no `.venv`**, and the system Python 3.12.1
**cannot** run the CLI. `python run.py --help` currently fails with:

```
  File "...\cyp\data\__init__.py", line 1, in <module>
    from .exporting import MODISExporter
  File "...\cyp\data\exporting.py", line 1, in <module>
    import ee
ModuleNotFoundError: No module named 'ee'
```

(`torch` 2.13.0+cpu is installed system-wide, but `fire`, `ee` and `gdal` are not — verified.)

#### 2.3 Earth Engine authentication (only needed for the `export` stage)

```powershell
conda activate crop_yield_prediction
earthengine authenticate

# Verify
python -c "import ee; ee.Initialize(); print('Earth Engine OK')"
```

`earthengine authenticate` opens a browser and stores a refresh token under
`~/.config/earthengine/credentials`. `ee.Initialize()` must succeed before `export` will run.

#### 2.4 Configuration

**There is no `.env` file and no environment variables** are read by this project's own code. The
configuration surface is:

| Mechanism | Value / flags |
|---|---|
| Earth Engine credentials | `earthengine authenticate` → `~/.config/earthengine/credentials` |
| Google Drive | The account signed up to Earth Engine; exports land there |
| Conda environment name | `crop_yield_prediction` (from `environment.yml`) |
| CLI flags | `--export_limit`, `--major_states_only`, `--check_if_done`, `--download_folder`, `--yield_data_path`, `--mask_path`, `--temperature_path`, `--image_path`, `--cleaned_data_path`, `--multiprocessing`, `--processes`, `--parallelism`, `--delete_when_done`, `--num_years`, `--checkpoint`, `--num_bins`, `--max_bin_val`, `--county_data_path`, `--dropout`, `--dense_features`, `--savedir`, `--times`, `--pred_years`, `--num_runs`, `--train_steps`, `--batch_size`, `--starter_learning_rate`, `--weight_decay`, `--l1_weight`, `--patience`, `--use_gp`, `--sigma`, `--r_loc`, `--r_year`, `--sigma_e`, `--sigma_b`, `--device` |

#### 2.5 Data paths the code expects

| Path | Constant / default | Present in this checkout? |
|---|---|---|
| `data/yield_data.csv` | `RunTask.export(yield_data_path=…)` | **Yes** |
| `data/county_data.csv` | `RunTask.engineer(county_data_path=…)` | **Yes** |
| `data/counties.svg` | `plot_county_errors(svg_file=…)` | **Yes** |
| `data/crop_yield-data_image/` | `RunTask.process(image_path=…)` | **No** — exported from Earth Engine |
| `data/crop_yield-data_mask/` | `RunTask.process(mask_path=…)` | **No** — exported from Earth Engine |
| `data/crop_yield-data_temperature/` | `RunTask.process(temperature_path=…)` | **No** — exported from Earth Engine |
| `data/img_output/` | `RunTask.process(cleaned_data_path=…)` | **No** — produced by the process stage |
| `data/img_output/histogram_all_full.npz` | `ModelBase.run(path_to_histogram=…)` | **No** — produced by the engineer stage |
| `data/models/<model_type>/` | `RunTask.train_cnn(savedir=Path("data/models"))` | **No** — produced by training |

---

### 3. Launch the Complete Project

#### 3.1 The pipeline — a four-stage CLI (no server, no port)

```powershell
conda activate crop_yield_prediction
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\crop-yield-prediction"

# Stage 1 — export MODIS imagery from Earth Engine to Google Drive
python run.py export

# Stage 2 — preprocess the downloaded .tif files into per-year .npy arrays
python run.py process

# Stage 3 — build the 9-band histograms the models consume
python run.py engineer --num_bins 32

# Stage 4 — train (pick one; both write to data/models/<model_type>/)
python run.py train_cnn --use_gp True
python run.py train_rnn --use_gp True
```

Each stage reads the previous stage's output from `data/` and writes its own output there.

* **Stage 1** (`cyp/data/exporting.py` → `MODISExporter.export_all()`) builds per-county, per-year Earth
  Engine image collections for the 11 major soybean states (`MAJOR_STATES` in `cyp/__init__.py`),
  concatenates the bands of a county across the export years into one file, and starts the Earth Engine
  export tasks into Google Drive. `check_if_done=True` skips counties whose `.tif` files already exist,
  which makes the stage resumable. **You must download the results from Drive** into the three
  `data/crop_yield-data_*` folders.
* **Stage 2** (`cyp/data/preprocessing.py` → `DataCleaner.process()`) merges the temperature bands into the
  reflectance bands, applies the farmland land-cover mask, splits the time series into years and writes one
  `.npy` per county-year into `data/img_output/`. `ProcessPoolExecutor` parallelises across counties
  (`--multiprocessing True --processes 4 --parallelism 6`).
* **Stage 3** (`cyp/data/feature_engineering.py` → `Engineer.process()`) keeps the 49–305 day window, builds
  a 32-bin normalised histogram for each of the 9 bands, and writes `data/img_output/histogram_all_full.npz`
  with the arrays `output_image`, `output_locations`, `output_yield`, `output_year`, `output_index`.
* **Stage 4** (`cyp/models/base.py` → `ModelBase.run()`) trains one model per (year, run, time index),
  evaluates on the held-out year, runs the Gaussian process on the network's last dense layer, and saves
  `data/models/<model_type>/<year>_<run>_<time>_gp.pth.tar` plus a results CSV
  (`year, run_number, time_idx, RMSE, ME` and `RMSE_GP, ME_GP` when the GP is enabled).

**CLI help**

```powershell
python run.py --help                      # lists: export, process, engineer, train_cnn, train_rnn
python run.py export -- --help            # flags for one stage (note the `--` separator for Fire)
```

#### 3.2 Frontend — the YieldSight console (static, port 8000)

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\crop-yield-prediction"
python -m http.server 8000
```

Open **http://localhost:8000** — or open `index.html` directly; the page uses relative paths only.
Stop the server with `Ctrl+C`.

#### 3.3 Ports summary

| Component | Port | Address |
|---|---|---|
| YieldSight console (`python -m http.server`) | 8000 | `http://localhost:8000` |
| Pipeline CLI (`run.py`) | — | no server |
| Google Earth Engine | 443 | outbound only (export stage) |

#### 3.4 How the front-end reaches the backend

**It doesn't — there is no backend to reach.** The console's header chip reads
*"No backend — pipeline runs via `python run.py` only"*, and a second chip reads
*"Charts show an illustrative sample series"*. Pressing **Run prediction** requires a region name and
then switches to the **Pipeline** tab, which lists the four stage commands, the Earth Engine
authentication step and the storage requirements, each with a **Copy** button. The chart is generated
entirely in the browser from a deterministic pseudo-random function seeded by the region name.

---

### 4. Test the Project

#### 4.1 Automated / command-line tests

**There is no test suite in this repository** (no `tests/`, no CI). The checks below are CLI invocations
whose outputs you verify yourself.

**Test 1 — the CLI is importable and its commands are listed**

```powershell
conda activate crop_yield_prediction
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\crop-yield-prediction"
python run.py --help
```

Expected: a Fire-generated listing of `export`, `process`, `engineer`, `train_cnn`, `train_rnn`.

> **In the current checkout this command fails** with
> `ModuleNotFoundError: No module named 'ee'` (verified) because the Conda environment does not exist yet.
> After `conda env create -f environment.yml` it must succeed.

**Test 2 — a single stage's flags**

```powershell
python run.py export -- --help
```

Expected: the Fire help for `RunTask.export` listing `--export_limit`, `--major_states_only`,
`--check_if_done`, `--download_folder`, `--yield_data_path`.

**Test 3 — Earth Engine authentication (export stage only)**

```powershell
python -c "import ee; ee.Initialize(); print('Earth Engine OK')"
```

Expected: `Earth Engine OK`. Any authentication error here means `earthengine authenticate` was not
completed or was completed for a different account.

**Test 4 — the shipped data files are present and readable**

```powershell
Get-ChildItem data | Select-Object Name, Length
```

Expected: `county_data.csv` (~3.2 MB), `counties.svg` (~2.0 MB), `yield_data.csv` (~4.3 MB), `README.md`.
These three are the **only** data files that ship with the repository.

**Test 5 — the packages the code imports are importable**

```powershell
python -c "import torch, fire, ee, numpy, pandas, scipy, tqdm; print('torch', torch.__version__); print('all imports OK')"
```

**Test 6 — a fast smoke test of the training path (only after stages 1–3 have produced real data)**

```powershell
python run.py train_cnn --pred_years 2014 --num_runs 1 --train_steps 2000 --use_gp False
```

Expected: a training log, a checkpoint under `data/models/cnn/` and a results CSV. **This requires the
≈ 110 GB export and the ≈ 97 GB processed arrays first — it was not executed in this checkout.**

**Test 7 — the optional county error map**

```powershell
python -c "from pathlib import Path; from cyp.analysis.counties_plot import plot_county_errors; plot_county_errors(Path('data/models/cnn/2014_1_32_gp.pth.tar'))"
```

Requires `beautifulsoup4` (not in `environment.yml`) and `matplotlib`.

#### 4.2 Manual checks in the browser (YieldSight console, http://localhost:8000)

1. Open the console. The two header chips read **"No backend — pipeline runs via `python run.py` only"**
   and **"Charts show an illustrative sample series"**.
2. The **Region** field is pre-filled with `Story County, Iowa` and offers a datalist of Iowa and Illinois
   counties. Any US county or state name works — it only seeds the illustrative series.
3. Pick the **years** (the paper's models cover 2009–2015), the **model** (`CNN (ConvModel)` or
   `RNN / LSTM (RNNModel)`) and toggle the **Gaussian Process** head (checked by default).
4. The **Histogram bins** selector (16 / 32 / 64, default **32**) does not change the chart — it rewrites
   the engineer command in the Pipeline tab to `python run.py engineer --num_bins <bins>`.
5. The chart draws *Actual (sample)*, *Predicted (sample)* and an *Uncertainty band (sample)*; the tooltip
   says *"illustrative sample - not a model output"*.
6. The metric strip shows **RMSE**, **MAE** and **R²** computed on the sample series itself — the note
   under it reads *"Metrics describe the illustrative series only — they are not model evaluation results."*
7. **Export CSV** downloads `yieldsight-sample-<slug>-<y0>-<y1>.csv` with the columns
   `region, year, model, use_gp, series_type, actual_bu_ac, predicted_bu_ac, band_lower_bu_ac,
   band_upper_bu_ac`, where `series_type` is always `illustrative_sample`.
8. **Run prediction** (requires a region) switches to the **Pipeline** tab; the toast says
   *"No backend here — showing the real pipeline stages"*. Each of the four commands has a working
   **Copy** button.
9. The **Method** tab documents the nine MODIS bands, the GP hyper-parameters and the four-stage structure.
10. The **Model comparison** table reproduces the **published** RMSE values from the upstream README — these
    are the authors' reported numbers, not a local run.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'ee'` | The Conda environment is not active (verified in this checkout) | `conda activate crop_yield_prediction`; `pip install earthengine-api` if the env is incomplete |
| `ModuleNotFoundError: No module named 'fire'` | Same as above | `conda activate crop_yield_prediction`; `pip install fire` |
| `ModuleNotFoundError: No module named 'gdal'` | GDAL is not a pip package on most platforms | `conda install -c conda-forge gdal` — **do not** `pip install gdal` |
| `OSError: [Errno 126] cannot load library 'libgdal'` | The conda GDAL and the system GDAL disagree | Recreate the environment with `conda env create -f environment.yml`; never mix conda and pip GDAL builds |
| `conda env create` cannot resolve `pytorch=1.0.0` | The 2018 pin has no modern build | Install a newer torch into the same env (`conda install "pytorch>=1.10" -c pytorch`) and fix minor API drift |
| `ee.Initialize()` raises an authentication error | Earth Engine is not initialised for this machine | `earthengine authenticate`, then re-run `python -c "import ee; ee.Initialize()"` |
| The export stage produces no files in `data/` | Earth Engine writes to **Google Drive**, not to `data/` | Download the exported `.tif` files from Drive into `data/crop_yield-data_image`, `…-mask`, `…-temperature` |
| `python run.py process` finds no tif files | Wrong folder names | Defaults are `data/crop_yield-data_mask`, `data/crop_yield-data_temperature`, `data/crop_yield-data_image`; override with the flags |
| The process stage runs out of disk | ≈ 97 GB of `.npy` files | Free space, or `--delete_when_done True` to drop the `.tif` files as they convert (destructive) |
| `FileNotFoundError: data/img_output/histogram_all_full.npz` | The `engineer` stage was never run | `python run.py engineer` |
| `torch.load` fails on a 1.x checkpoint | `pytorch=1.0.0` checkpoints use the old pickle format | Use the pinned environment, or re-save the `state_dict` under the modern torch version |
| `RuntimeError: expected device cuda:0` | A GPU was requested but is unavailable | Drop the `--device` flag — the default already falls back to CPU when `torch.cuda.is_available()` is False |
| Training is extremely slow | 25 000 steps × 2 runs × 7 years, per model | Smoke-test first with `--pred_years 2014 --num_runs 1 --train_steps 2000` |
| `plot_county_errors()` raises `No module named 'bs4'` | `beautifulsoup4` is not in `environment.yml` | `pip install beautifulsoup4` |
| The console shows a chart but no real numbers | There is no backend — the series is illustrative | Run the pipeline; the console itself never produces predictions |
| **"Run prediction" refuses to work** | The region field is empty | Enter any county or state name — it only seeds the sample series |
| The console's port is already in use | Another static server is running | `python -m http.server 8001` and open <http://localhost:8001> |
| `python run.py <cmd> --help` behaves oddly | Fire's flag separator | Use `python run.py <cmd> -- --help` (double `--`) |

**Known limitations to state honestly**

* **No API, no server, no interactive inference.** The only way to get a real forecast is to run the
  four-stage pipeline and read the results CSVs.
* **The data volume is extreme** — ~110 GB export, ~97 GB processed arrays, plus a multi-hour export and a
  long feature-engineering pass. This is a research pipeline, not a demo.
* **Earth Engine + Google Drive are mandatory** for the export stage; the pipeline cannot run offline.
* **The model input is lossy** — 9 bands reduced to 32-bin histograms, discarding per-pixel structure.
* **The pinned stack is from 2018** (`pytorch=1.0.0`, Python 3.7) and requires Conda.
* **The GP is a post-hoc layer** — it re-fits on the network's last dense layer and cannot fix an
  under-trained network.
* **Only 11 states are exported by default** (`major_states_only=True`).
* **There is no test suite and no CI** in this repository.

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result.

**Environment**

- [ ] `conda --version` runs and Anaconda/Miniconda is installed
- [ ] `conda env list` shows an environment named `crop_yield_prediction`
- [ ] `conda activate crop_yield_prediction` succeeds and `python --version` reports the environment's Python
- [ ] `python -c "import torch, fire, ee, numpy, pandas, scipy, tqdm"` succeeds
- [ ] `python -c "import gdal"` succeeds (or `python -c "from osgeo import gdal"` succeeds)
- [ ] `earthengine authenticate` completed and `python -c "import ee; ee.Initialize()"` prints without error

**CLI**

- [ ] `python run.py --help` lists `export`, `process`, `engineer`, `train_cnn`, `train_rnn`
- [ ] `python run.py export -- --help` lists the export flags
- [ ] `Get-ChildItem data` shows `county_data.csv`, `counties.svg`, `yield_data.csv` and `README.md`
- [ ] `Test-Path .\data\img_output` is `False` and `Test-Path .\data\models` is `False` (confirming the
      pipeline outputs are genuinely absent)
- [ ] (Only after the export) `data/crop_yield-data_image`, `…-mask`, `…-temperature` contain the downloaded
      `.tif` files
- [ ] (Only after stage 2) `data/img_output` contains `.npy` files
- [ ] (Only after stage 3) `data/img_output/histogram_all_full.npz` exists
- [ ] (Only after stage 4) `data/models/<model_type>/` contains a `*.pth.tar` checkpoint and a results CSV

**Console**

- [ ] `python -m http.server 8000` starts and `http://localhost:8000` loads the YieldSight page
- [ ] The header chips read "No backend — pipeline runs via `python run.py` only" and
      "Charts show an illustrative sample series"
- [ ] The chart renders three series (Actual / Predicted / Uncertainty band) and the tooltip says
      *"illustrative sample - not a model output"*
- [ ] The metrics strip shows RMSE / MAE / R² with the note *"Metrics describe the illustrative series only"*
- [ ] **Export CSV** downloads `yieldsight-sample-*.csv` whose `series_type` column is `illustrative_sample`
- [ ] Changing the **Histogram bins** selector rewrites the engineer command to
      `python run.py engineer --num_bins <bins>` in the Pipeline tab
- [ ] **Run prediction** switches to the Pipeline tab and shows the toast
      "No backend here — showing the real pipeline stages"
- [ ] Each of the four pipeline commands has a working **Copy** button
- [ ] The **Model comparison** table values are labelled as published figures, not local results

**Cleanup**

- [ ] The static server was stopped with `Ctrl+C`
- [ ] `conda deactivate` was run
- [ ] Port 8000 is free
      (`Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue` returns nothing)
