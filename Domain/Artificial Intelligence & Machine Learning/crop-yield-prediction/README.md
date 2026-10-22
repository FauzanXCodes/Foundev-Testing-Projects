# YieldSight

YieldSight is a static console for **PyCrop Yield Prediction** — a PyTorch implementation of Jiaxuan You's 2017 *Deep Gaussian Process for Crop Yield Prediction Based on Remote Sensing Data*. The repository predicts **soybean yields in US counties** from MODIS satellite imagery, and it does so as a **four-stage command-line pipeline** driven by Python Fire.

**There is no HTTP server and no API in this project.** `run.py` is a CLI (`export`, `process`, `engineer`, `train_cnn`, `train_rnn`); `js/app.js` contains **no `fetch()` call**, no URL and no port. The YieldSight page therefore does two honest things: it renders a **clearly-labelled illustrative sample series** so you can see what a forecast looks like, and its "Run prediction" button takes you to the Pipeline tab with the exact commands and the exact external prerequisites (a Google Earth Engine account, ~110 GB of MODIS imagery, ~97 GB of processed arrays).

---

## Features

### Implemented and verified in this repository

| Feature | Where | Status |
|---|---|---|
| MODIS export stage (Earth Engine → Google Drive) | `run.py` (`RunTask.export`), `cyp/data/exporting.py` (`MODISExporter.export_all()`) | Implemented — needs an Earth Engine account and Google Drive |
| Pre-processing stage (per-year `.npy` arrays, temperature merged, farmland mask applied) | `run.py` (`RunTask.process`), `cyp/data/preprocessing.py` (`DataCleaner.process()`) | Implemented — needs the exported `.tif` files |
| Feature-engineering stage (9-band histograms → `histogram_all_full.npz`) | `run.py` (`RunTask.engineer`), `cyp/data/feature_engineering.py` (`Engineer.process()`) | Implemented — needs the processed arrays |
| CNN training with an optional Gaussian process | `run.py` (`RunTask.train_cnn`), `cyp/models/convnet.py` (`ConvNet`, `ConvBlock`, `Conv2dSamePadding`) | Implemented — needs the histogram file |
| RNN (LSTM) training with an optional Gaussian process | `run.py` (`RunTask.train_rnn`), `cyp/models/rnn.py` (`RNNet`) | Implemented — needs the histogram file |
| Deep Gaussian process post-processing on top of the network | `cyp/models/gp.py` (`GaussianProcess.run()`) | Implemented |
| Combined L1+L2 loss, early stopping with patience | `cyp/models/loss.py` (`l1_l2_loss`), `cyp/models/base.py` (`_train()`) | Implemented |
| Per-year checkpoints and results CSVs | `cyp/models/base.py` (`ModelBase.run()`, `torch.save`) | Implemented — produced by a training run |
| County error maps | `cyp/analysis/counties_plot.py` (`plot_county_errors()`) | Implemented — needs `beautifulsoup4`, which is **not** in `environment.yml` |
| YieldSight console: region/year/model/bins inputs, canvas chart, sample metrics, CSV export | `index.html`, `js/app.js`, `css/style.css` | Working, static only |
| Pipeline tab with the four stage commands and storage requirements | `index.html` | Working |
| Method tab documenting the nine MODIS bands and the GP hyper-parameters | `index.html` | Working |

### Not available in this repository

- **No MODIS imagery.** The `data/crop_yield-data_image`, `-mask` and `-temperature` folders are absent; they are exported from Earth Engine and downloaded from Google Drive (≈ **110 GB**).
- **No processed arrays and no model input.** `data/img_output/` (≈ **97 GB** of `.npy` files) and `data/img_output/histogram_all_full.npz` are absent.
- **No trained models.** `data/models/` does not exist; checkpoints (`<year>_<run>_<time>_gp.pth.tar`) and result CSVs are produced by a training run.
- **No HTTP API and no server** — the project is CLI-only by design.
- **No local environment.** There is no `.venv`; `environment.yml` targets Python 3.7 with `pytorch=1.0.0`, and the machine's Python 3.12.1 has neither `fire`, `ee`, `rasterio` nor `gdal` installed.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Entry point | `run.py` with **Python Fire** (`fire.Fire(RunTask)`) — the CLI surface |
| Deep learning | PyTorch (`pytorch=1.0.0` in `environment.yml`), CPU or CUDA |
| Model | `ConvNet` (1-D-over-time CNN) and `RNNet` (LSTM) over 9-band histograms, optionally topped by a **deep Gaussian process** |
| Satellite data | MODIS aboard NASA Terra: **MOD09A1** (surface reflectance), **MCD12Q1** (land-cover mask), **MYD11A2** (land-surface temperature) |
| Cloud data platform | **Google Earth Engine** (`earthengine-api`) for the export stage; Google Drive as the transfer medium |
| Geospatial processing | **GDAL** (`gdal`) for reading the `.tif` composites, `ProcessPoolExecutor` for parallel county processing |
| Numeric / scientific | `numpy`, `pandas`, `scipy` (the GP's `pdist`/`squareform`), `matplotlib` (error maps), `tqdm` |
| UI | Vanilla HTML5 + CSS + JavaScript (`index.html`, `css/style.css`, `js/app.js`) — no frameworks, no build step, no network calls |

---

## Prerequisites

- **Windows 10/11, macOS or Linux** — but the geospatial stack is far easier on Linux/macOS; **Conda is strongly recommended** because `gdal` and `pytorch=1.0.0` have no wheels for modern pip on Windows.
- **Python 3.7** (as stated in the upstream README) and Anaconda / Miniconda.
- **A Google Earth Engine account** — <https://developers.google.com/earth-engine/> — plus `earthengine authenticate`.
- **A Google account with Drive space** for the export (Earth Engine writes there).
- **Disk space: ≈ 110 GB** for the MODIS export plus **≈ 97 GB** for the processed `.npy` arrays, plus the histogram file and checkpoints.
- **Time**: the export is the slow part; the export class supports checkpointing (`check_if_done=True`) so an interrupted run can resume.
- **A GPU is optional.** `torch.device("cuda:0" if torch.cuda.is_available() else "cpu")` is the default in `run.py`.

---

## Project Structure

```
crop-yield-prediction/
├── run.py                     # THE entry point: Fire CLI with export/process/engineer/train_cnn/train_rnn
├── environment.yml            # Conda env "crop_yield_prediction" (pytorch 1.0.0, gdal, earthengine-api, fire)
├── index.html                 # YieldSight console (static)
├── css/style.css
├── js/app.js                  # Deterministic sample series, chart, CSV export (no fetch())
├── LICENSE                    # MIT (Gabriel Tseng, 2019)
├── README.md                  # Upstream README (paper, results table, setup)
│
├── cyp/
│   ├── __init__.py            # MAJOR_STATES = the 11 soybean-producing states
│   ├── data/
│   │   ├── exporting.py       # MODISExporter: Earth Engine export
│   │   ├── preprocessing.py   # DataCleaner: tif -> per-year npy
│   │   ├── feature_engineering.py  # Engineer: npy -> histogram_all_full.npz
│   │   └── utils.py           # get_tif_files(), load_clean_yield_data()
│   ├── models/
│   │   ├── base.py            # ModelBase: training loop, GP hookup, checkpointing, results CSV
│   │   ├── convnet.py         # ConvModel, ConvNet, ConvBlock, Conv2dSamePadding
│   │   ├── rnn.py             # RNNModel, RNNet
│   │   ├── gp.py              # GaussianProcess (squared-exponential kernel over location + year)
│   │   └── loss.py            # l1_l2_loss()
│   └── analysis/
│       └── counties_plot.py   # plot_county_errors(): county map coloured by error
│
├── data/
│   ├── yield_data.csv         # USDA yield data (4 274 567 bytes) - PRESENT
│   ├── county_data.csv        # US 2010 Census fusion table (3 178 767 bytes) - PRESENT
│   ├── counties.svg           # US county map (1 995 563 bytes) - PRESENT
│   └── README.md              # Data provenance + MODIS product descriptions
├── diagrams/
│   └── 2014_cnn_errors.png    # Published 2014 CNN error map
└── (MODIS exports, img_output/, models/ are NOT in the repository)
```

**Paths the code expects**

| Path | Constant / default | Present? |
|---|---|---|
| `data/yield_data.csv` | `RunTask.export(yield_data_path=…)`, `Engineer` | Yes |
| `data/county_data.csv` | `RunTask.engineer(county_data_path=…)` | Yes |
| `data/counties.svg` | `plot_county_errors(svg_file=…)` | Yes |
| `data/crop_yield-data_image`, `-mask`, `-temperature` | `RunTask.process(...)` | **No** — exported from Earth Engine |
| `data/img_output/` | `RunTask.process(cleaned_data_path=…)` | **No** — produced by the process stage |
| `data/img_output/histogram_all_full.npz` | `ModelBase.run(path_to_histogram=…)` | **No** — produced by the engineer stage |
| `data/models/<model_type>/` | `RunTask.train_cnn(savedir=Path("data/models"))` | **No** — produced by training |

---

## Installation

Windows-first with Conda (recommended; GDAL and PyTorch 1.0.0 are the hard part):

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\crop-yield-prediction"

# 1. Create the environment from the shipped file (name: crop_yield_prediction)
conda env create -f environment.yml
conda activate crop_yield_prediction

# 2. (Optional) the error-map analysis script needs BeautifulSoup, which is NOT in environment.yml
pip install beautifulsoup4
```

Authenticate with Earth Engine (required only for the export stage):

```powershell
earthengine authenticate

# Verify
python -c "import ee; ee.Initialize()"
```

> Linux/macOS: same commands; `environment.yml` works unchanged.

> **This checkout has no `.venv` and none of the pipeline dependencies are installed** on the machine's Python 3.12.1 (`fire`, `ee`, `rasterio` and `gdal` are all absent). The commands above were **not** executed while writing this documentation.

**A note on the pinned versions.** `pytorch=1.0.0` is from 2018 and has no modern wheel; `gdal` likewise needs a conda-forge build. If you only want to *read* the code, the environment does not matter. If you want to run the pipeline, expect to relax the pins (`pytorch>=1.10`, a conda-forge `gdal`) and to fix small API drift — the code is written against the PyTorch 1.0 API.

---

## Environment Configuration

**No `.env` file and no environment variables are read by this project's own code.** The configuration surface is:

| Mechanism | Value | Notes |
|---|---|---|
| **Earth Engine credentials** | `earthengine authenticate` | Stores a refresh token in `~/.config/earthengine/credentials`; `ee.Initialize()` must succeed before `export` runs |
| **Google Drive** | The account used to sign up to Earth Engine | Earth Engine writes the exports to that Drive; you then download them into `data/` |
| **CLI flags** | `--export_limit`, `--major_states_only`, `--check_if_done`, `--download_folder`, `--num_bins`, `--max_bin_val`, `--pred_years`, `--num_runs`, `--train_steps`, `--batch_size`, `--starter_learning_rate`, `--weight_decay`, `--l1_weight`, `--patience`, `--use_gp`, `--sigma`, `--r_loc`, `--r_year`, `--sigma_e`, `--sigma_b`, `--device` | All defined in `run.py`; Python Fire also accepts `--flag=value` |
| **Conda environment name** | `crop_yield_prediction` | From `environment.yml` |

---

## How to Launch

### The pipeline (the only executable surface)

```powershell
conda activate crop_yield_prediction

# Stage 1 - export MODIS imagery from Earth Engine to Google Drive
python run.py export

# Stage 2 - preprocess the downloaded .tif files into per-year .npy arrays
python run.py process

# Stage 3 - build the 9-band histograms the models consume
python run.py engineer --num_bins 32

# Stage 4 - train (pick one; both write to data/models/<model_type>/)
python run.py train_cnn --use_gp True
python run.py train_rnn --use_gp True
```

Each stage reads the previous stage's output from `data/` and writes its own output there. `python run.py --help` lists the Fire-generated commands; `python run.py <command> -- --help` lists a command's flags.

### The YieldSight console (static, no port required)

```powershell
python -m http.server 8000
```

Open **http://localhost:8000** — or open `index.html` directly; the page uses relative paths only. Stop the server with `Ctrl+C`.

### How the front-end reaches the backend

**It doesn't — there is no backend to reach.** The console chip reads *"No backend — pipeline runs via `python run.py` only"*. Pressing **Run prediction** requires a region name and then switches to the **Pipeline** tab, where the four stage commands, the Earth Engine authentication step and the storage requirements are listed with copy buttons. The forecast chart is generated **entirely in the browser** from a deterministic pseudo-random function seeded by the region name, and is labelled *"Illustrative sample series — real predictions require running the pipeline."*

---

## Model and Dataset Setup

### What ships in the repository

| File | Size | Content |
|---|---|---|
| `data/yield_data.csv` | 4 274 567 B | USDA soybean yields (bushels per acre) per county and year — reproduced from the USDA NASS Quick Stats site (see `data/README.md`) |
| `data/county_data.csv` | 3 178 767 B | US 2010 Census fusion table with the county lat/long used for the export footprints and for the GP's location kernel |
| `data/counties.svg` | 1 995 563 B | US map with county delineations, used as the base map for the error plots |
| `diagrams/2014_cnn_errors.png` | 2 927 476 B | The published 2014 CNN error map (from the upstream README) |

### What you must obtain yourself

| Item | How | Where it goes |
|---|---|---|
| **MODIS imagery** (MOD09A1 reflectance, MCD12Q1 land cover, MYD11A2 temperature) | `python run.py export` → Google Drive → download | `data/crop_yield-data_image/`, `data/crop_yield-data_mask/`, `data/crop_yield-data_temperature/` |
| **Processed arrays** (≈ 97 GB) | `python run.py process` | `data/img_output/*.npy` |
| **Model input** | `python run.py engineer` | `data/img_output/histogram_all_full.npz` (keys: `output_image`, `output_locations`, `output_yield`, `output_year`, `output_index`) |
| **Model checkpoints and results** | `python run.py train_cnn` / `train_rnn` | `data/models/<model_type>/<year>_<run>_<time>_gp.pth.tar` and `data/models/<model_type>/<timestamp>.csv` |

### The default training configuration

| Parameter | Default | Where |
|---|---|---|
| Prediction years | `range(2009, 2016)` | `ModelBase.run(pred_years=None)` |
| Runs per year | `2` (to average out random initialisation) | `ModelBase.run(num_runs=2)` |
| Time indices | `"all"` → `[32]`; `"realtime"` → `range(10, 31, 4)` | `ModelBase.run(times="all")` |
| Training steps | `25 000` (CNN) / `10 000` (RNN) | `RunTask.train_cnn` / `train_rnn` |
| Batch size | `32` | both |
| Starter learning rate | `1e-3`, divided by 10 after 2 000 and 4 000 steps | `ModelBase._train()` |
| Weight decay / L1 weight | `1` / `0` (CNN), `0` / `0` (RNN) | `RunTask.train_cnn` / `train_rnn` |
| Early stopping | patience `10` | `ModelBase._train()` |
| Histogram | 9 bands, 32 bins, max bin value 4 999, channels-first | `Engineer.process()` |
| GP | `use_gp=True`, `sigma=1`, `r_loc=0.5`, `r_year=1.5`, `sigma_e=0.32`, `sigma_b=0.01` | `RunTask.train_cnn` / `train_rnn` |

---

## Usage

### The console (YieldSight)

1. Open the console. The header chips read **"No backend — pipeline runs via `python run.py` only"** and **"Charts show an illustrative sample series"**.
2. Enter a **region** (any US county or state name — it only seeds the illustrative series; the field is pre-filled with `Story County, Iowa` and offers a datalist of Iowa and Illinois counties), pick the **years** (the paper's models cover 2009–2015), choose the **model** (`CNN (ConvModel)` or `RNN / LSTM (RNNModel)`) and toggle the **Gaussian Process head** (checked by default).
3. The **Histogram bins** selector (16 / 32 / 64, default **32** = the repo default) does not change the chart — it rewrites the engineer command in the Pipeline tab to `python run.py engineer --num_bins <bins>`.
4. The chart draws three series: *Actual (sample)*, *Predicted (sample)* and an *Uncertainty band (sample)*, with a hover tooltip marked *"illustrative sample - not a model output"*. The band widens for years outside 2009–2015, the years the pipeline's models actually cover.
5. The metric strip shows **RMSE**, **MAE** and **R²** computed **on the sample series itself** — the note under it reads *"Metrics describe the illustrative series only — they are not model evaluation results."*
6. **Export CSV** writes `yieldsight-sample-<slug>-<y0>-<y1>.csv` (the region is slugified to lowercase with non-alphanumerics replaced by `-`, e.g. `Story County, Iowa` → `story-county-iowa`) with the columns `region, year, model, use_gp, series_type, actual_bu_ac, predicted_bu_ac, band_lower_bu_ac, band_upper_bu_ac`, where `series_type` is always `illustrative_sample`.
7. **Run prediction** (requires a region) switches to the **Pipeline** tab with the four stage commands and the prerequisite list; the toast says *"No backend here - showing the real pipeline stages"*.
8. The **Method** tab documents the nine MODIS bands, the GP hyper-parameters, the four-stage structure and the fact that only the three CSV/SVG files ship with the repository.
9. The **Model comparison** table reproduces the **published** RMSE values from the upstream README (LSTM, LSTM+GP, CNN, CNN+GP for 2009–2015) — these are the authors' reported numbers, not a local run.

### The pipeline, stage by stage

**Stage 1 — export**

```powershell
python run.py export --export_limit 100 --major_states_only True --check_if_done True
```

`MODISExporter.export_all()` builds per-county, per-year Earth Engine image collections for the 11 major states (`MAJOR_STATES` in `cyp/__init__.py`), concatenates the bands of a county across the export years into a single file to reduce the file count, and starts the Earth Engine export tasks into Google Drive. `check_if_done=True` skips counties whose `.tif` files are already present, which makes the stage resumable.

**Stage 2 — process**

```powershell
python run.py process --num_years 14 --checkpoint True --delete_when_done False
```

`DataCleaner.process()` reads the three `.tif` folders, merges the temperature bands into the reflectance bands, applies the land-cover mask so only farmland pixels remain, splits the time series into years and writes one `.npy` per county-year into `data/img_output/`. `ProcessPoolExecutor` parallelises across counties (`--multiprocessing True --processes 4 --parallelism 6`).

**Stage 3 — engineer**

```powershell
python run.py engineer --num_bins 32 --max_bin_val 4999
```

`Engineer.process()` loads the `.npy` files, keeps the 49–305 day window, builds a 32-bin normalised histogram for each of the 9 bands, and writes `data/img_output/histogram_all_full.npz` with the arrays `output_image`, `output_locations`, `output_yield`, `output_year` and `output_index`.

**Stage 4 — train**

```powershell
python run.py train_cnn --use_gp True --pred_years 2014
```

`ModelBase.run()` trains one model per (year, run, time index), evaluating on the held-out year, then runs the Gaussian process on the network's last dense layer and saves a checkpoint `<year>_<run>_<time>_gp.pth.tar` plus a results CSV with the columns `year, run_number, time_idx, RMSE, ME` (and `RMSE_GP, ME_GP` when the GP is enabled).

**Optional — the county error map**

```python
from pathlib import Path
from cyp.analysis.counties_plot import plot_county_errors

plot_county_errors(Path("data/models/cnn/2014_1_32_gp.pth.tar"))
```

It colours the county map by prediction error and saves a colour bar. It needs `beautifulsoup4` (not in `environment.yml`) and `matplotlib`.

---

## API Documentation

**This project has no HTTP API.** There is no web framework, no route, no server, and `js/app.js` performs **no `fetch()` call**. The console states this in its own Pipeline tab.

The real interfaces are the CLI and the Python modules:

### 1. CLI (Python Fire)

| Command | Function | Key flags | Output |
|---|---|---|---|
| `python run.py export` | `RunTask.export()` | `--export_limit`, `--major_states_only`, `--check_if_done`, `--download_folder`, `--yield_data_path` | Earth Engine tasks in Google Drive |
| `python run.py process` | `RunTask.process()` | `--mask_path`, `--temperature_path`, `--image_path`, `--cleaned_data_path`, `--multiprocessing`, `--processes`, `--parallelism`, `--delete_when_done`, `--num_years`, `--checkpoint` | `data/img_output/*.npy` |
| `python run.py engineer` | `RunTask.engineer()` | `--cleaned_data_path`, `--yield_data_path`, `--county_data_path`, `--num_bins`, `--max_bin_val` | `data/img_output/histogram_all_full.npz` |
| `python run.py train_cnn` | `RunTask.train_cnn()` | `--dropout`, `--dense_features`, `--savedir`, `--times`, `--pred_years`, `--num_runs`, `--train_steps`, `--batch_size`, `--starter_learning_rate`, `--weight_decay`, `--l1_weight`, `--patience`, `--use_gp`, `--sigma`, `--r_loc`, `--r_year`, `--sigma_e`, `--sigma_b`, `--device` | `data/models/cnn/<year>_<run>_<time>_gp.pth.tar` + results CSV |
| `python run.py train_rnn` | `RunTask.train_rnn()` | same as above plus `--num_bins`, `--hidden_size` (128), `--rnn_dropout` (0.75), `--train_steps` default 10 000 | `data/models/rnn/…` |

### 2. Python API

```python
from cyp.data import MODISExporter, DataCleaner, Engineer
from cyp.models import ConvModel, RNNModel
from pathlib import Path

model = ConvModel(in_channels=9, dropout=0.5, savedir=Path("data/models"), use_gp=True)
model.run(
    Path("data/img_output/histogram_all_full.npz"),
    times="all", pred_years=[2014], num_runs=2,
    train_steps=25000, batch_size=32, starter_learning_rate=1e-3,
)
```

`ConvModel` and `RNNModel` both extend `ModelBase`, which owns the training loop, the early stopping, the GP hook-up and the artefact writing.

### 3. The result contract the console mirrors

The console's sample series uses the same units and the same fields the pipeline produces: `actual_bu_ac` (bushels per acre, the unit of `data/yield_data.csv`), `predicted_bu_ac`, and an uncertainty band. The console marks its rows `series_type = illustrative_sample` so they can never be confused with a real prediction.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'fire'` | The Conda environment is not active | `conda activate crop_yield_prediction`; `pip install fire` if the env is incomplete |
| `ModuleNotFoundError: No module named 'ee'` | `earthengine-api` is not installed in the active env | `pip install earthengine-api` (it is in `environment.yml`) |
| `ee.Initialize()` raises an authentication error | Earth Engine is not initialised for this machine | `earthengine authenticate`, then re-run the `python -c "import ee; ee.Initialize()"` check |
| `ImportError: No module named 'gdal'` | GDAL is not a pip package on most platforms | `conda install -c conda-forge gdal` (do **not** `pip install gdal` — it needs a system library) |
| `OSError: [Errno 126] cannot load library 'libgdal'` | The conda GDAL and the system GDAL disagree | Recreate the environment with `conda env create -f environment.yml` and never mix conda and pip GDAL builds |
| The export stage produces no files | Earth Engine writes to Google Drive, not to `data/` | Download the exported `.tif` files from Drive into `data/crop_yield-data_image`, `…-mask`, `…-temperature` |
| `python run.py process` finds no tif files | Wrong folder names | The defaults are `data/crop_yield-data_mask`, `data/crop_yield-data_temperature`, `data/crop_yield-data_image`; override with the flags if your layout differs |
| The process stage runs out of disk | ≈ 97 GB of `.npy` files | Free space, or use `--delete_when_done True` to drop the `.tif` files as they are converted (destructive) |
| `FileNotFoundError: data/img_output/histogram_all_full.npz` | The engineer stage was never run | `python run.py engineer` |
| `torch.load` fails on a 1.x checkpoint | `pytorch=1.0.0` checkpoints use the old pickle format | Use the pinned environment, or re-save the `state_dict` under the modern torch version |
| `RuntimeError: expected device cuda:0` | A GPU was requested but is unavailable | Drop the `--device` flag; the default already falls back to CPU when `torch.cuda.is_available()` is False |
| Training is extremely slow | 25 000 steps × 2 runs × 7 years, per model | Start with `--pred_years 2014 --num_runs 1 --train_steps 2000` to smoke-test the pipeline |
| `plot_county_errors()` raises `ModuleNotFoundError: No module named 'bs4'` | `beautifulsoup4` is not in `environment.yml` | `pip install beautifulsoup4` |
| The console shows a chart but no real numbers | There is no backend — the series is illustrative | Run the pipeline; the console itself never produces predictions |
| **"Run prediction" refuses to work** | The region field is empty | Enter any county or state name — it only seeds the sample series |
| The console's port is already in use | Another static server is running | `python -m http.server 8001` and open <http://localhost:8001> |

---

## Limitations

- **No API, no server, no interactive inference.** The only way to get a real forecast is to run the four-stage pipeline and read the results CSVs.
- **The data volume is extreme**: ~110 GB of MODIS export, ~97 GB of processed arrays, plus a multi-hour export and a long feature-engineering pass. This is a research pipeline, not a demo.
- **A Google Earth Engine account and a Google Drive are mandatory** for the export stage; the pipeline cannot run offline.
- **The model input is a lossy summary**: 9 bands are reduced to 32-bin histograms, discarding per-pixel structure. That is the paper's design, but it caps achievable accuracy.
- **The pinned stack is from 2018** (`pytorch=1.0.0`, Python 3.7) and requires a Conda environment; the code uses the PyTorch 1.0 API.
- **The GP is a post-hoc layer**: it re-fits on the network's last dense layer, so it cannot fix an under-trained network.
- **Only 11 states are exported by default** (`major_states_only=True`), so the pipeline covers the major soybean producers, not the whole country.
- **Results are per-year models** (a model per predicted year, using all preceding years for training) — 7 years × 2 runs × time indices is a lot of training jobs.
- **The console's chart and metrics are illustrative only**; the RMSE/MAE/R² shown describe the sample series, not the model. The only genuine numbers in the UI are the **published** RMSE values reproduced from the upstream README, and they are labelled as reported.
- **No repository in this project is served or tested by CI**; there is no test suite at all.

---

## License and Credits

### Upstream project

**PyCrop Yield Prediction** — a PyTorch implementation of [Jiaxuan You](https://cs.stanford.edu/~jiaxuan/)'s 2017 *Crop Yield Prediction* project.

- **Paper:** *Deep Gaussian Process for Crop Yield Prediction Based on Remote Sensing Data* — <https://cs.stanford.edu/~ermon/papers/cropyield_AAAI17.pdf> (AAAI 2017). The paper won the Food Security category of the World Bank's 2017 Big Data Innovation Challenge.
- **Original implementation:** TensorFlow — <https://github.com/JiaxuanYou/crop_yield_prediction> (credited throughout `data/README.md`; the yield data and county map are analogous to files in that repository).
- **This PyTorch port:** <https://github.com/gabrieltseng/pycrop-yield-prediction>, MIT licensed — see `LICENSE` (Copyright © 2019 Gabriel Tseng).

### Data credits

- **Yield data** — USDA NASS Quick Stats (reproduction instructions in `data/README.md`).
- **County boundaries and coordinates** — US 2010 Census fusion table (note: the original fusion-table source was retired by Google in December 2019).
- **Satellite data** — MODIS aboard NASA's Terra satellite: [MOD09A1](https://modis.gsfc.nasa.gov/data/dataprod/mod09.php) surface reflectance, [MCD12Q1](https://modis.gsfc.nasa.gov/data/dataprod/mod12.php) land-cover type (used as the farmland mask), [MYD11A2](https://modis.gsfc.nasa.gov/data/dataprod/mod11.php) land-surface temperature. Distributed through Google Earth Engine.
- **County map** — `data/counties.svg`, taken from the original repository.

### Added later (this front-end)

The **YieldSight** console — `index.html`, `css/style.css`, `js/app.js` — and this documentation were added on top of the PyCrop repository. They are not authored by the upstream maintainers and carry no upstream endorsement. The console contains no model and no inference code; its chart is a deterministic pseudo-random sample series, labelled as such everywhere.
