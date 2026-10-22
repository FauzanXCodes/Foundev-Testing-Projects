# SignBridge Studio — sign-language-to-text-translation

SignBridge Studio is a documentation and demo front-end for the **sign-language-to-text-translation** repository, the upstream `sign_language_translator` Python package (v0.8.1). The package is a rule-based sign-language translation framework: it turns written text (English, Urdu, Hindi) into a sequence of sign-language video clips, and turns sign videos into landmark/embedding vectors that can be fed to machine-learning models. The static page in this folder (`index.html` + `css/style.css` + `js/app.js`) is a **labelled browser demo of that pipeline** — it ships with no backend and runs no model. Everything that needs the Python library is labelled `Requires library (slt CLI)` in the UI.

> This file replaces the upstream package README (which is still referenced by `pyproject.toml`'s `readme = "README.md"`). The upstream README remains available at <https://github.com/sign-language-translator/sign-language-translator>.

## Features

**Implemented and verifiable in this repository**

- **Rule-based text → sign synthesis** — `sign_language_translator/models/text_to_sign/concatenative_synthesis.py` (`ConcatenativeSynthesis`) tokenises text, maps tokens to sign clips through `PakistanSignLanguage`, downloads the required clips and concatenates them into a playable sign video.
- **Text preprocessing pipeline** — `sign_language_translator/text/` provides `preprocess.py`, `tokenizer.py`, `tagger.py` (token classes `WORD`, `NUMBER`, `PUNCTUATION`, `SUPPORTED_WORD`), `synonyms.py`, `metrics.py` and `subtitles.py`.
- **Sign-language grammar rules** — `sign_language_translator/languages/sign/pakistan_sign_language.py` and `mapping_rules.py` implement `restructure_sentence()` and `tokens_to_sign_dicts()` (direct word mapping, digit-by-digit numbers, character-by-character spelling fallback).
- **Video embedding** — `sign_language_translator/models/video_embedding/mediapipe_landmarks_model.py` (`MediaPipeLandmarksModel`) extracts pose + hand landmarks from video frames (MediaPipe is an optional dependency).
- **Language models** — `sign_language_translator/models/language_models/` contains `ngram_language_model.py`, `beam_sampling.py` (`BeamSampling`) and a `transformer_language_model/` implementation for sequence completion.
- **`slt` command-line interface** — `sign_language_translator/cli.py` exposes `slt assets`, `slt complete`, `slt translate` and `slt embed`.
- **Asset manager** — `sign_language_translator/config/assets.py` (`Assets`) plus `sign_language_translator/config/urls.json` define the downloadable dataset/model URLs and the on-disk asset cache.
- **Browser demo (SignBridge Studio UI)** — `js/app.js` reproduces the five-stage flow (`preprocess → tokenize → get_tags → restructure_sentence → tokens_to_sign_dicts → concatenate`) using a small embedded demo lexicon, and exports the resulting gloss as `.txt` / `.csv`.

**Not available in this repository**

- **No sign-to-text neural translation model.** `sign_language_translator/__init__.py` marks the PyTorch sign-to-text model as `COMING SOON!`; `models/sign_to_text/__init__.py` ships no usable checkpoint. Only *text → sign* synthesis works.
- **No runtime assets on disk.** There is no `assets/` directory. Every sign clip, n-gram model and `tlm_14.0M.pt` checkpoint must be downloaded (see *Model and Dataset Setup*).
- **No HTTP server / REST API.** The upstream project is a library + CLI. The `index.html` page is static and calls no backend.
- **No real sign video is rendered in the browser.** Stage 5 of the UI is a placeholder frame plus a copyable `slt translate` command.
- **No `slt` console script is installed until you install the package** (see *Installation*).

## Technology Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Core package | Python `>=3.8,<3.13` | Declared in `pyproject.toml` |
| Build / packaging | Poetry (`poetry-core` backend) | `pyproject.toml` `[tool.poetry]` |
| CLI | Click `^8.1.4` | `sign_language_translator/cli.py` |
| Numerics | NumPy `1.26.*` (Python ≥ 3.9), `1.24.4` (Python < 3.9) | `pyproject.toml` |
| Plotting | Matplotlib `^3.7.4` | Frame/landmark rendering |
| Computer vision | `opencv-contrib-python` `^4.8.0.74` | Video read/write, concatenation |
| Deep learning (optional) | PyTorch `==2.2.*` | Needed for landmark/transformer models |
| Pose/hand landmarks (optional) | MediaPipe `0.10.9` (Python ≥ 3.8, ≤ 3.11) | `mediapipe` extra |
| Synonym expansion (optional) | `deep-translator` `^1.11.4` | `synonyms` extra |
| Networking | `requests` `^2.31.0` | Asset downloads |
| Front-end | Vanilla HTML5 / CSS / ES5-compatible JS | `index.html`, `css/style.css`, `js/app.js` — no framework, no build step |

`requirements.txt` pins a slightly different set (`torch==2.1.2`, `numpy==1.25.1`, `matplotlib==3.7.2`, `click==8.1.6`, `mediapipe==0.10.11`, `deep_translator==1.11.4`) than `pyproject.toml`. Both are real files in the repo; see *Troubleshooting*.

## Prerequisites

- **Windows (primary):** PowerShell 5.1+, Python 3.9–3.12 installed and on `PATH` (`py --version`).
  - MediaPipe requires **Python ≤ 3.11**; do not use 3.12 if you need the `mediapipe` extra.
- **Linux / macOS:** Python 3.9–3.12, `python3` on `PATH`. The upstream CI runs Python 3.8–3.11.
- **Disk space and network:** the first translation downloads sign-clip assets from the URLs in `sign_language_translator/config/urls.json`; the full Pakistan-SL collection is hundreds of megabytes.
- **Optional:** a browser for SignBridge Studio (any modern browser).
- **Optional:** MediaPipe's Python wheels are only published for Python ≤ 3.11.

## Project Structure

```
sign-language-to-text-translation/
├── index.html                     # SignBridge Studio — static demo UI (5-stage pipeline lab)
├── css/style.css                 # UI stylesheet
├── js/app.js                     # UI logic: demo tokenizer, gloss rules, lexicon, exports
├── pyproject.toml                # Poetry metadata, deps, [tool.poetry.scripts] slt = cli:slt
├── poetry.lock                   # Locked dependency resolution
├── requirements.txt              # pip-style pins (slightly older than pyproject)
├── project-metadata.json         # Catalogue metadata
├── MANIFEST.in                   # Packaging manifest
├── LICENSE                       # Apache-2.0
├── docs/                         # Sphinx documentation sources (index.rst, datasets.rst, …)
├── tests/                        # pytest suite (test_cli.py, tests/models/…, etc.)
├── sign_language_translator/     # ← the actual Python package
│   ├── __init__.py               # Public API exports (Assets, Video, Landmarks, get_model, …)
│   ├── cli.py                    # `slt` console script (click group)
│   ├── config/
│   │   ├── assets.py             # Assets class: download / list / delete / root dir
│   │   ├── enums.py              # ModelCodes, TextLanguages, SignLanguages, SignFormats
│   │   ├── settings.py           # Settings class (default asset root)
│   │   └── urls.json             # Verified download URLs for datasets and models
│   ├── languages/
│   │   ├── text/{english,urdu,hindi,text_language}.py
│   │   └── sign/{pakistan_sign_language,sign_language,mapping_rules}.py
│   ├── models/
│   │   ├── text_to_sign/concatenative_synthesis.py   # ConcatenativeSynthesis
│   │   ├── video_embedding/mediapipe_landmarks_model.py  # MediaPipeLandmarksModel
│   │   ├── language_models/{ngram_language_model,beam_sampling,mixer}.py
│   │   └── language_models/transformer_language_model/
│   ├── text/                     # preprocess, tokenize, tagger, synonyms, metrics, subtitles
│   ├── vision/                   # video/, landmarks/, sign/ wrappers
│   └── utils/                    # download, archive, arrays, parallel, tree helpers
```

Key paths referenced by the code:

- **CLI entry:** `sign_language_translator/cli.py` → `slt` (declared in `pyproject.toml` `[tool.poetry.scripts]`).
- **Model/data download manifest:** `sign_language_translator/config/urls.json`.
- **Asset cache location:** `Assets.ROOT_DIR` — defaults to the installation directory's `assets/` folder; overridable via `slt.Assets.set_root_dir(...)` or `slt assets tree --directory`.
- **Front-end entry:** `index.html` → `css/style.css` → `js/app.js`.

## Installation

### Option A — from this clone (recommended; gives you the `slt` console script)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\sign-language-to-text-translation"

py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -e .
```

If `Activate.ps1` is blocked by the execution policy, run this once in the same PowerShell session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Option B — Poetry (matches `pyproject.toml` / `poetry.lock` exactly)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\sign-language-to-text-translation"
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install poetry
poetry install
poetry run slt --help
```

### Option C — the flat `requirements.txt` (no packaging metadata)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\sign-language-to-text-translation"
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
```

Option C does **not** install the package, so `slt` will not be on `PATH`. Add `pip install -e . --no-deps` afterwards if you want the console script with the pinned versions.

### Optional extras

```powershell
pip install -e ".[mediapipe]"   # MediaPipe landmarks (Python <= 3.11 only)
pip install -e ".[synonyms]"     # deep-translator synonym lookup
pip install -e ".[all]"          # both
pip install -e ".[dev]"          # pytest, pytest-cov, black, isort
```

**Linux / macOS:** replace `py -3.11 -m venv .venv` with `python3 -m venv .venv`, and `.\.venv\Scripts\Activate.ps1` with `source .venv/bin/activate`.

## Environment Configuration

The package reads **no environment variables and no `.env` file**. Configuration is done through the `Assets` / `Settings` classes in Python and through the `slt assets` CLI:

| What | How | Where |
| --- | --- | --- |
| Asset cache root | `slt.Assets.set_root_dir("path/to/folder")` | `sign_language_translator/config/assets.py` |
| Asset cache root (CLI) | `slt assets tree --directory "path\to\folder"` | `sign_language_translator/cli.py` |
| Which resources exist | `slt.Assets.FILE_TO_URL.keys()` | `sign_language_translator/config/urls.json` |
| Downloaded resource tree | `slt assets tree` | `sign_language_translator/cli.py` |

`sign_language_translator/config/urls.json` is the only place where download URLs are defined — it is a committed repo file, not something you must supply. There is no API key, no token and no database connection anywhere in this project.

## How to Launch

There are **two independent surfaces**: the Python library/CLI and the static browser demo.

### 1. The `slt` CLI (the real product)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\sign-language-to-text-translation"
.\.venv\Scripts\Activate.ps1

slt --help          # list the command groups
slt --version
```

On Linux/macOS use `source .venv/bin/activate` instead of `.\.venv\Scripts\Activate.ps1`.

### 2. SignBridge Studio (static UI — no server needed)

The UI is plain HTML/CSS/JS with no build step and no backend, so any static server works:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\sign-language-to-text-translation"
py -m http.server 8000
```

Then open <http://localhost:8000/>.

- **Port:** 8000 is the port used in the upstream `docs/` instructions and is free by default. Any other port works (`py -m http.server 8080` → <http://localhost:8080/>).
- **How the front-end reaches the backend:** it does not. `js/app.js` contains no `fetch()` call and no API URL. Stage 5 hands you a copyable `slt translate …` command instead.
- **Stop:** press `Ctrl+C` in the PowerShell window running `http.server`.

**Note:** opening `index.html` directly via `file://` also works for this project (it loads no external data), but a local HTTP server is the recommended way.

## Model and Dataset Setup

**What is present in the repository**

- The `pk-hfad-1` / `pk-hfad-2` sign collections, the English/Urdu/Hindi lexicons and the n-gram / transformer language models are **not** committed. They are downloaded on demand.
- `sign_language_translator/config/urls.json` lists every downloadable resource and its URL. `Assets.FILE_TO_URL` is built from it.
- The `slt` CLI's `assets` group manages the cache: `slt assets path` shows the root directory, `slt assets tree` lists what is already downloaded, `slt assets download <pattern>` fetches resources.

**What you must do before a real translation**

```powershell
# 1. See where assets will land
slt assets path

# 2. Inspect / download the Pakistan Sign Language clip collection
slt assets tree
slt assets download ".*pk-hfad.*"
```

The `Assets` class also auto-downloads missing files the first time a translation needs them, so an explicit download is optional.

**Language models for `slt complete`**

```powershell
slt assets download ".*urdu-mixed-ngram.*"
slt assets download ".*tlm_14.0M.*"     # transformer checkpoint for ur-supported-gpt
```

**Sign embedding models (optional)**

`mediapipe-world`, `mediapipe-image` and the `mediapipe-pose-*-hand-*` video embedders are downloaded from the same manifest. They additionally require the `mediapipe` extra and a MediaPipe-capable Python version.

**What is genuinely missing**

- A **sign-to-text neural model**. The upstream `__init__.py` marks it `COMING SOON!`. Nothing to download, nothing to configure — it does not exist yet.
- Any **private or paid dataset**. Everything this project uses is publicly downloadable through `config/urls.json`.

## Usage

### A. SignBridge Studio (browser)

1. Open <http://localhost:8000/>.
2. **Stage 01 — Input text.** The textarea is pre-filled with `What is your name?`. Pick a text language: English (`en`), Urdu (`ur`) or Hindi (`hi`). Character and word counters update live.
3. **Stage 02 — Tokenizer.** The demo tagger splits the sentence and labels each token `SUPPORTED_WORD` (present in the demo lexicon), `WORD`, `NUMBER` or `PUNCTUATION`. It is a regex tagger mirroring the library's `Tags` enum — no part-of-speech guessing.
4. **Stage 03 — Gloss restructure.** The demo rules drop punctuation and stopwords and apply a gloss word order, mirroring `SignLanguage.restructure_sentence`. The "Original order" and "Gloss order" chip rows show the change.
5. **Stage 04 — Sign selection.** Each gloss token is mapped to a demo sign-clip id using the same three strategies as `PakistanSignLanguage`: direct word mapping, digit-by-digit numbers, and a character-by-character spelling fallback. The cards below are **placeholders**, not real footage.
6. **Stage 05 — Stage output.** The synthesized-video frame is a placeholder (nothing is rendered in the browser). Use **Copy gloss**, **Download .txt** or **Download .csv** to export the gloss, or **Copy** the generated command and run it in a terminal with the library installed:

   ```powershell
   slt translate --model-code rule-based --text-lang english --sign-lang pk-sl --sign-format video "What is your name?"
   ```

### B. Real translation with the library (CLI)

```powershell
# Text -> sign video (Urdu example from the upstream README)
slt translate --model-code rule-based --text-lang urdu --sign-lang pk-sl --sign-format video "ایک سیب اچھا ہے۔"

# Same, but save an MP4 instead of displaying it
slt translate --model-code rule-based --text-lang english --sign-lang pk-sl --sign-format video --output-dir .\out --save-format mp4 --display False "What is your name?"

# Complete a sequence with a language model
slt complete "<" --model-code urdu-mixed-ngram --join ''

# Embed videos into landmark vectors
slt embed .\dataset\*.mp4 --model-code mediapipe-pose-2-hand-1 --embedding-type all --processes 4 --save-format csv
```

### C. Real translation with the library (Python)

```python
import sign_language_translator as slt

model = slt.models.ConcatenativeSynthesis(
    text_language="english", sign_language="pk-sl", sign_format="video"
)
sign = model.translate("What is your name?")
sign.show()
```

### D. Inspecting and downloading assets

```powershell
slt assets path                       # where assets live
slt assets tree                       # hierarchy of already-downloaded files
slt assets download ".*pk-hfad.*"     # fetch a group of resources
```

## API Documentation

**This project exposes no HTTP/REST API.** There is no Flask/FastAPI server, no route table, no port binding and no JSON contract anywhere in `sign_language_translator/`. `js/app.js` contains no `fetch()` call.

The supported programmatic interfaces are the Python API and the `slt` CLI:

| Interface | Signature / command | Purpose |
| --- | --- | --- |
| Python | `slt.models.ConcatenativeSynthesis(text_language=…, sign_language=…, sign_format=…).translate(text)` | Rule-based text → sign |
| Python | `slt.Assets.download(pattern)`, `slt.Assets.FILE_TO_URL`, `slt.Assets.set_root_dir(path)` | Asset cache management |
| Python | `slt.Video.load_asset(name)`, `slt.models.MediaPipeLandmarksModel().embed(frames)` | Video loading and landmark embedding |
| Python | `slt.get_model(model_code=…)`, `slt.get_text_language(…)`, `slt.get_sign_language(…)` | Factory functions from `config/enums.py` |
| CLI | `slt assets path\|tree\|download [options] FILENAMES…` | Asset manager |
| CLI | `slt translate -m MODEL --text-lang LANG --sign-lang LANG --sign-format FMT [options] INPUTS…` | Text → sign (options: `--sign-embedding-model`, `--output-dir`, `--overwrite/-o`, `--display/-d`, `--save-format`, `--codec`) |
| CLI | `slt complete [options] INPUTS…` | Language-model completion (options: `--model-code/-m`, `--end-token`, `--max-length`, `--beam-width`, `--model-weight/-w`, `--selection-strategy`, `--join`) |
| CLI | `slt embed [options] INPUTS…` | Video/text embedding (options: `--model-code/-m`, `--processes`, `--embedding-type`, `--output-dir`, `--save-format`, `--overwrite`) |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `slt` is not recognised | The package was never installed. Run `pip install -e .` inside the activated venv (Option A). |
| `pip install -e ".[mediapipe]"` fails | MediaPipe publishes no wheels for Python 3.12. Recreate the venv with `py -3.11 -m venv .venv`. |
| `Cannot import name 'mediapipe'` / `ImportError` in the landmarks model | The optional extra is missing. `pip install -e ".[mediapipe]"`. |
| `ModuleNotFoundError: No module named 'sign_language_translator'` | You ran the script from outside the repo root without installing the package. Either `pip install -e .` or run from the clone root. |
| Translation hangs or fails on the first run | Assets are being downloaded. Check `slt assets path` and `slt assets tree`; the Pakistan-SL collection is large. |
| `FileNotFoundError` on a sign clip | The asset is missing from the cache. Run `slt assets download ".*pk-hfad.*"`. |
| `numpy` / `torch` version conflict between `requirements.txt` and `pyproject.toml` | They genuinely differ (`torch==2.1.2` vs `==2.2.*`, `numpy==1.25.1` vs `1.26.*`). Pick one source of truth — prefer `pyproject.toml` via `pip install -e .`. |
| `AttributeError: module 'streamlit'`-style import errors on Python 3.12 | `mediapipe` is the usual culprit; stay on Python ≤ 3.11 for the full extra set. |
| The UI's stage 5 shows a placeholder frame | By design. The browser demo never renders real sign video; run the copied `slt translate` command instead. |
| `slt complete` produces nothing | The language-model checkpoint was not downloaded. `slt assets download ".*urdu-mixed-ngram.*"`. |
| Two runs pick different clips for the same word | Expected: the library weights clip choices by usage frequency using `random.choices`, so ambiguous words can resolve differently. |
| `poetry install` fails on lock mismatch | `poetry lock` to refresh, or use the plain `pip install -e .` route. |

## Limitations

- **Text → sign only.** There is no trained sign-to-text model in the repo; `sign_language_translator/__init__.py` marks it "COMING SOON!". The framework currently produces embeddings suitable for training such a model, not the model itself.
- **Pakistan Sign Language only.** The bundled `PakistanSignLanguage` is the only sign language implementation. Other regional languages require subclassing `SignLanguage` and `TextLanguage` yourself.
- **Three input languages.** English, Urdu and Hindi only.
- **Rule-based, not generative.** Output is a deterministic concatenation of dictionary clips; it cannot improvise, and ambiguous words resolve by frequency-weighted random choice.
- **The browser demo is a simulation.** The demo lexicon in `js/app.js` is a placeholder subset, the gloss rules are an illustrative mirror of the real ones, and no sign video is rendered or synthesised in the browser.
- **Asset downloads are required and network-dependent.** First use needs internet access to the URLs in `config/urls.json`.
- **MediaPipe is Python ≤ 3.11 only**, which caps the supported interpreter range for landmark embedding.
- **The upstream package README was replaced** by this document; `pyproject.toml` still points `readme = "README.md"` at this file.

## License and Credits

- **Upstream project:** `sign-language-to-text-translation` — the `sign_language_translator` package, authored by **Mudassar Iqbal** (<mdsriqb@gmail.com>), licensed under the **Apache License 2.0** (see `LICENSE`). Upstream repository: <https://github.com/sign-language-translator/sign-language-translator>. Documentation: <https://sign-language-translator.readthedocs.io/en/latest/>.
- **This repository** also ships the upstream `docs/` Sphinx sources, the `tests/` suite, `poetry.lock` and `project-metadata.json` — all upstream artefacts.
- **SignBridge Studio** (`index.html`, `css/style.css`, `js/app.js`) is a **later-added static UI layer** authored for this documentation effort. It is not part of the upstream package and is not covered by any upstream warranty. It renders no model output and fabricates no sign footage.
- **`requirements.txt`** is an upstream convenience pin list; `pyproject.toml` is the authoritative dependency source.
- **Third-party code remains with its authors** — MediaPipe (Google), PyTorch, OpenCV, Click, NumPy, Matplotlib and the upstream contributors listed in `poetry.lock` / `LICENSE`.
