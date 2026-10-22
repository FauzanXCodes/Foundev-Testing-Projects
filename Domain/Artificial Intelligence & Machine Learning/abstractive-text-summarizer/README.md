# FactCheck Studio

Factual Consistency Verification desk built on top of the **FactCC** research code base (Salesforce Research). The project contains three things: the **original research CLI** (`modeling/`, `data_generation/`, `data_pairing/`) that trains and evaluates the FactCC / FactCCX neural models; a **lightweight consistency service** (`src/api.py`, Flask) that answers the browser UI's `POST /verify` contract using a deterministic lexical-entailment engine; and a **static front-end** (`index.html` + `css/style.css` + `js/app.js`) that drives that service. The neural FactCC / FactCCX checkpoints are **not bundled** and require the pinned 2020 dependency stack, so the service labels its engine explicitly as *heuristic — not a neural checkpoint*. A clearly-labelled **sample walkthrough** remains available with no backend at all.

---

## Features

### Implemented and verified in this repository

| Feature | Where | Status |
|---|---|---|
| Consistency service (`POST /verify`, `GET /health`, CORS) | `src/api.py` | Working, lightweight (Flask only) |
| Lexical-entailment engine (numeric-conflict + token-coverage + negation signal → CORRECT/INCORRECT) | `src/api.py` (`analyse()`) | Working, **heuristic — not a neural checkpoint** |
| Static verification desk UI (source panel, up to 3 claim rows, verdict card, history table) | `index.html`, `js/app.js` | Working |
| "Run consistency check" → calls `POST /verify`, renders label/confidence/spans; shows a clear error if the service is down | `js/app.js` (`runCheck()`, `renderResult()`) | Working |
| Labelled sample walkthrough (demo verdict, confidence arc, span highlighting) | `js/app.js` (`runSampleWalkthrough()`, `DEMO` object) | Working, **demo data only** |
| Claim-level span marking (supporting / inconsistent / user-marked) | `js/app.js` (`addSelectionMark()`) | Working, user annotations, not model output |
| Browser-local check history (max 100 entries, JSON export / copy / clear) | `js/app.js` (`pushHistory()`, `HISTORY_KEY = "factCheckStudio.history.v1"`) | Working |
| FactCC / FactCCX training + evaluation CLI | `modeling/run.py` | Implemented, requires checkpoints and data |
| Synthetic data generation with 7 claim augmentations | `data_generation/create_data.py`, `data_generation/augmentation_ops.py` | Implemented, needs `spacy` model + Google Cloud creds for backtranslation |
| Dataset pairing with the original CNN/DailyMail stories | `data_pairing/pair_data.py` | Implemented |

### Not available in this repository

- **No neural inference.** The FactCC/FactCCX **checkpoints are not bundled** (`factcc-checkpoint.tar.gz` / `factccx-checkpoint.tar.gz` are external downloads). The bundled service (`src/api.py`) is a heuristic lexical engine and never claims to be a model prediction.
- **No datasets.** The generated / annotated FactCC corpora and the CNN/DailyMail stories are external downloads.
- **No neural Python environment in this checkout.** The pinned 2019 stack (`torch==1.3.1`, `pytorch_transformers==1.0.0`, `numpy==1.17.4`, `scipy==1.3.0`) cannot be installed on the system Python 3.12.1 present on this machine. Only the lightweight service (Flask) is installed here (`.venv`).

---

## Technology Stack

| Layer | Technology |
|---|---|
| UI | Vanilla HTML5 + CSS + JavaScript (no frameworks, no build step) |
| Model | FactCC (BERT classifier) and FactCCX (pointer-BERT span extractor) |
| Framework | `pytorch_transformers==1.0.0` (Salesforce's fork of HuggingFace Transformers) |
| Runtime | `torch==1.3.1`, CUDA optional (`--fp16`, `--no_cuda` flags) |
| Pre-processing | `spacy==2.2.3` (NER tagging), `numpy==1.17.4`, `scipy==1.3.0`, `scikit_learn==0.22.1` |
| Experiment tracking | Weights & Biases (`wandb` — **imported by `modeling/run.py` but missing from `requirements.txt`**) |
| Data synthesis | Google Cloud Translate (backtranslation), `google-cloud-translate==1.6.0` |
| Optimisation | `apex==0.9.10dev` (NVIDIA mixed-precision, optional but pinned) |

---

## Prerequisites

- **Windows 10/11, macOS or Linux.**
- **Python 3.6 or 3.7 (64-bit) for the research CLI.** The pins in `requirements.txt` predate Python 3.8 — `torch==1.3.1`, `numpy==1.17.4`, `scipy==1.3.0` and `spacy==2.2.3` have no wheels for Python 3.12 and will fail to build. Python 3.12.1 (the interpreter on this machine) can still serve the **static UI** fine.
- **A GPU is optional.** `--no_cuda` and `--fp16` are available; CPU training is extremely slow.
- **Free disk space** for the datasets (see [Model and Dataset Setup](#model-and-dataset-setup)).
- **Accounts / credentials (only for the optional steps):**
  - Weights & Biases account — `wandb login <API KEY>` (required because `modeling/run.py` calls `wandb.init(project="entailment-metric")` at import time).
  - Google Cloud project with the Cloud Translation API enabled — only for the `backtranslation` augmentation.
  - CNN/DailyMail article archive — needed to pair the released FactCC data with source stories.

---

## Project Structure

```
abstractive-text-summarizer/
├── index.html                     # FactCheck Studio static front-end (the UI)
├── css/style.css                  # UI stylesheet
├── js/app.js                      # UI logic: claims, demo walkthrough, history
├── LICENSE.txt                    # BSD-3-Clause (Salesforce.com, Inc., 2019)
├── project-metadata.json          # Repository provenance metadata
├── requirements.txt               # Pinned 2019 dependency set
│
├── modeling/                      # THE REAL MODEL CODE (not src/)
│   ├── run.py                     # Entry point: argparse CLI for train / eval
│   ├── model.py                   # BertPointer (pointer-BERT span extractor, FactCCX)
│   ├── utils.py                   # Processors, label space, feature conversion, metrics
│   ├── hyperparams.py             # Model hyper-parameter defaults
│   └── scripts/                   # Quickstart shell scripts
│       ├── factcc-train.sh  factcc-finetune.sh  factcc-eval.sh
│       └── factccx-train.sh factccx-finetune.sh factccx-eval.sh
│
├── data_generation/               # Synthetic training data generation
│   ├── create_data.py             # CLI: jsonl source docs -> augmented claim pairs
│   └── augmentation_ops.py        # The 7 transformations
│
├── data_pairing/
│   └── pair_data.py               # Pairs FactCC data with CNN/DailyMail stories
│
└── (checkpoints, datasets)        # NOT in the repo - see setup section
```

**Model / data paths the code expects**

| Path | Used by | Present? |
|---|---|---|
| `--data_dir` containing `data-train.jsonl` / `data-dev.jsonl` | `modeling/utils.py` processors | No — external download |
| `--output_dir` (checkpoint directory) | `modeling/run.py` | No — created by the run |
| `data/img_output/`-style artefacts | n/a (crop project only) | n/a |

---

## Installation

The repository has two halves with very different needs.

### A. Static UI (works on any modern Python, or no Python at all)

```powershell
# Option 1 - no install needed, open the file directly
start index.html

# Option 2 - serve it (recommended, relative paths only)
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\abstractive-text-summarizer"
python -m http.server 8000
# open http://localhost:8000
```

### B. Research CLI (needs Python 3.6/3.7 + the pinned stack)

Windows-first, using Conda (the only painless way to get a 3.7 interpreter with these wheels):

```powershell
# 1. Create a Python 3.7 environment
conda create -n factcc python=3.7 -y
conda activate factcc

# 2. Install the pinned dependencies (expect a long build: torch 1.3.1, spacy 2.2.3, scipy 1.3.0)
pip install -r requirements.txt

# 3. Install the one dependency the requirements file forgets
pip install wandb

# 4. (optional) NVIDIA mixed precision - needs CUDA and a compiler
pip install -v --install-option="--cpp" --install-option="--cuda" apex==0.9.10dev

# 5. Authenticate Weights & Biases (modeling/run.py calls wandb.init at import time)
wandb login <YOUR_WANDB_API_KEY>
```

Without Conda (any 3.6/3.7 interpreter):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
pip install wandb
```

> Linux/macOS: replace `.\.venv\Scripts\Activate.ps1` with `source .venv/bin/activate`.

**This checkout currently has no `.venv` and none of these packages are installed on the machine's Python 3.12.1** (`pytorch_transformers`, `spacy` and `wandb` are all absent). The installation above was **not** executed while writing this documentation.

---

## Environment Configuration

This project reads **no `.env` file and no environment variables from its own code**. The only external configuration is:

| Item | Mechanism | Needed for |
|---|---|---|
| Weights & Biases API key | `wandb login <KEY>` (stored by wandb in `~/.netrc`) | Any run of `modeling/run.py` — `wandb.init()` executes at import time, so even evaluation needs it |
| Google Cloud credentials | Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` pointing at a service-account key) | Only the `backtranslation` augmentation in `data_generation/augmentation_ops.py` (`translate.Client()`) |
| `spacy` NER model | `python -m spacy download en_core_web_sm` | `entity_swap`, `date_swap`, `number_swap`, `pronoun_swap` augmentations |
| Cache directories | `--cache_dir` CLI flag | Tokenizer / feature cache |

Everything else is a CLI flag on `modeling/run.py` (see [Usage](#usage)).

---

## How to Launch

### 1. The UI (static, port 8000 in the example)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\abstractive-text-summarizer"
python -m http.server 8000
```

Then open <http://localhost:8000>. **Stop it with `Ctrl+C`.**

### 2. The research CLI (no server)

```powershell
conda activate factcc
python modeling\run.py --help
```

`modeling/run.py` is a **training / evaluation script**, not an inference service. It writes checkpoints and metrics to `--output_dir`; it never listens on a port.

### 3. The consistency service (lightweight backend)

`src/api.py` is a small Flask service that answers the UI's `POST /verify` contract. Start it before using **Run consistency check**:

```powershell
.venv\Scripts\python.exe src\api.py      # http://127.0.0.1:5000
```

It implements a deterministic **lexical-entailment engine** (numeric-conflict detection + token coverage + negation signal) and labels its responses `engine: "lexical-entailment (heuristic)", model_checkpoint: false`. It is **not** the neural FactCC model.

### 4. How the front-end reaches the backend

`js/app.js` sends `fetch("http://127.0.0.1:5000/verify")` with `{text, claim}`. The base URL is overridable via `window.FACTCC_API_BASE`. The service returns CORS `Access-Control-Allow-Origin: *`, so the UI (served on another origin/port) can call it directly. If the service is down, the UI shows the *backend-required* card with the exact start command instead of inventing a verdict. For the **neural** path (real FactCC verdicts) you must supply a checkpoint and run `modeling/run.py` — the UI's proposed `POST /verify` contract matches that wrapper.

---

## Model and Dataset Setup

Nothing below ships with the repository. All four items are external downloads or accounts.

| Item | Source (from the upstream README) | Where the code expects it |
|---|---|---|
| Generated training data | `https://storage.googleapis.com/sfr-factcc-data-research/unpaired_generated_data.tar.gz` | Unpacked next to the CNN/DailyMail `cnndm/` folder, then paired |
| Annotated validation/test data | `https://storage.googleapis.com/sfr-factcc-data-research/unpaired_annotated_data.tar.gz` | Same as above |
| CNN/DailyMail articles | `https://cs.nyu.edu/~kcho/DMQA/` | Directory `cnndm/` in the repository root |
| FactCC checkpoint | `https://storage.googleapis.com/sfr-factcc-data-research/factcc-checkpoint.tar.gz` | `--output_dir` you point at after unpacking |
| FactCCX checkpoint | `https://storage.googleapis.com/sfr-factcc-data-research/factccx-checkpoint.tar.gz` | `--output_dir` you point at after unpacking |

### Pairing the datasets with the source stories

```powershell
# 1. Download the CNN/DailyMail archives and unpack them into a "cnndm" directory
#    in the repository root.
# 2. Download and unpack the FactCC data archives (do NOT rename the directories).
# 3. Pair them:
python data_pairing\pair_data.py <dir-with-factcc-data> <dir-with-stories>
```

### Preparing your own data

One JSON object per line in a `.jsonl` file, with keys `id`, `text` (source document) and `claim` (summary sentence). For evaluation, name the file **`data-dev.jsonl`** inside `--data_dir`:

```json
{"id": "example-001", "text": "Mercury Transit Pharma said Wednesday ...", "claim": "Mercury Transit Pharma said the therapy shrank tumors by 47 percent."}
```

### Generating synthetic training data

```powershell
python data_generation\create_data.py <source-data-file> [--augmentations backtranslation pronoun_swap date_swap number_swap entity_swap negation noise]
```

Output files are written next to the input as `<name>-clean.jsonl`, `<name>-btrans.jsonl` and `<name>-positive.jsonl` / `<name>-negative.jsonl`.

---

## Usage

### The UI walkthrough

1. **Start the service** (optional — see step 4 for what happens without it): `.venv\Scripts\python.exe src\api.py`.
2. **Open the desk** at <http://localhost:8000> (or open `index.html` directly). The masthead shows the model chip.
3. **Paste the source document** into Panel I, or drop a `.txt` file onto it. The footer counts characters and words.
4. **Add claim rows** in Panel II (up to three). Select the text of a claim and press **Mark selection supporting** / **Mark selection inconsistent** to tag spans — these are *your* annotations, drawn in the "user-marked span" colour.
5. **Press "Run consistency check"**. The UI calls `POST http://127.0.0.1:5000/verify` and renders the returned label, confidence and highlighted supporting/inconsistent spans. The result banner names the **lexical-entailment (heuristic)** engine — it is *not* a neural checkpoint output. If the service is not running, the card shows the exact start command instead of a fabricated verdict.
6. **Press "Sample walkthrough"** to see the layout with no backend at all. The result is stamped *"Sample walkthrough — illustrative data, not a model output"*.
7. **Check history** lists every run (max 100 rows) with time, model, claim, verdict, confidence and mode (`backend` / `sample`). Use **Download history JSON**, **Copy history** or **Clear history**.
8. **Reset desk** clears the panels but keeps the history.

> The `Model` dropdown (FactCC vs FactCCX) is a **visual preference only** — the page states this explicitly and changes nothing about the output. The service returns the identical lexical result regardless.

### The CLI walkthrough (evaluation with a released checkpoint)

```powershell
conda activate factcc
python modeling\run.py ^
  --task_name factcc_annotated ^
  --do_eval --eval_all_checkpoints --do_lower_case ^
  --max_seq_length 512 --per_gpu_train_batch_size 12 ^
  --model_type bert --model_name_or_path bert-base-uncased ^
  --data_dir "<DATA_PATH>" --output_dir "<CKPT_PATH>"
```

| Flag | Required | Meaning |
|---|---|---|
| `--task_name` | yes | `factcc_annotated` (manually annotated data) or `factcc_generated` (synthetic data) — must be a key of `processors` in `modeling/utils.py` |
| `--model_type` | yes | `bert` for FactCC, `pbert` for FactCCX (pointer-BERT) |
| `--model_name_or_path` | yes | e.g. `bert-base-uncased`, or the unpacked checkpoint directory |
| `--data_dir` | yes | Directory containing `data-train.jsonl` / `data-dev.jsonl` |
| `--output_dir` | yes | Where checkpoints and eval results are written |
| `--do_train` / `--do_eval` | no | Training / evaluation mode |
| `--max_seq_length` | no | Default `512` |
| `--per_gpu_train_batch_size` | no | Default `8` |
| `--loss_lambda` | no | Default `0.1` — weight of the auxiliary span-extraction losses |
| `--learning_rate`, `--num_train_epochs` (3.0), `--weight_decay`, `--adam_epsilon`, `--max_grad_norm` | no | Standard optimiser settings |
| `--do_lower_case`, `--no_cuda`, `--fp16`, `--fp16_opt_level`, `--seed` (42), `--overwrite_cache`, `--overwrite_output_dir`, `--eval_all_checkpoints`, `--evaluate_during_training`, `--train_from_scratch`, `--gradient_accumulation_steps`, `--warmup_steps`, `--logging_steps`, `--save_steps` | no | Behaviour switches |

**Label space** (`modeling/utils.py`): `CORRECT` / `INCORRECT`. Metrics come from `compute_metrics()` (balanced accuracy and F1 for the annotated task).

> The upstream README warns: *"Due to data pre-processing, the first run of training or evaluation code on a large dataset can take up to a few hours before the actual procedure starts."*

---

## API Documentation

The bundled service `src/api.py` (Flask, port **5000**) exposes two endpoints:

### `GET /health`

```json
{"status": "ok", "engine": "lexical-entailment (heuristic)", "model_checkpoint": false, "note": "..."}
```

### `POST /verify`

```http
POST /verify
Content-Type: application/json

{ "text": "<source document>", "claim": "<summary sentence>" }
```

→ **200 OK**

```json
{
  "label": "CORRECT" | "INCORRECT",
  "confidence": 0.0-1.0,
  "supporting_spans":   [ { "start": 0, "end": 0, "text": "..." } ],
  "inconsistent_spans": [ { "start": 0, "end": 0, "text": "..." } ],
  "diagnostics": { "source_coverage": 0.87, "mean_sentence_overlap": 0.38,
                   "numeric_conflicts": [], "negation_flip": false, "claim_terms": 14 },
  "engine": "lexical-entailment (heuristic)",
  "model_checkpoint": false,
  "disclaimer": "Heuristic lexical/entailment analysis — NOT a neural FactCC checkpoint prediction."
}
```

Missing/empty `text` or `claim` → **400** `{"error": "..."}`. `OPTIONS /verify` → **204** (CORS preflight). CORS: `Access-Control-Allow-Origin: *`.

The label space (`CORRECT` / `INCORRECT`) matches `modeling/utils.py`. The **neural** FactCC/FactCCX wrapper would use the same `POST /verify` request/response shape.

### Data format consumed by the research CLI (real)

```
{"id": "example-001", "text": "<source document>", "claim": "<summary sentence>"}
```

One JSON object per line (`jsonl`). Evaluation expects the dev file to be named `data-dev.jsonl`.

### The CLI (neural path)

`modeling/run.py` is a train/eval script; it has no HTTP endpoints. See [Usage](#usage) for its flags.

{
  "text":  "<source document>",
  "claim": "<summary sentence>"
}
```

```json
200 OK
{
  "label": "CORRECT",
  "confidence": 0.0,
  "supporting_spans":   [ { "start": 0, "end": 0, "text": "..." } ],
  "inconsistent_spans": [ { "start": 0, "end": 0, "text": "..." } ]
}
```

The bundled `src/api.py` implements this exact result shape with its heuristic engine. To make the **neural** path return the same shape, wrap the checkpoint-loaded `modeling/model.py` + `modeling/utils.py` in a service of your own; the UI needs no change beyond the base URL.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pip install -r requirements.txt` fails on `torch==1.3.1` / `numpy==1.17.4` | The pins have no wheels for Python 3.8+ (this machine runs 3.12.1) | Create a Python 3.7 environment with Conda (see [Installation](#installation)) |
| `ModuleNotFoundError: No module named 'wandb'` right after `import` | `modeling/run.py` imports `wandb` but `requirements.txt` does not list it | `pip install wandb` |
| The run dies asking for a Weights & Biases login | `wandb.init(project="entailment-metric")` runs at import time | `wandb login <API KEY>`, or export `WANDB_MODE=offline` for a local run |
| `ModuleNotFoundError: No module named 'spacy'` / `OSError: Can't find model 'en_core_web_sm'` | NER model missing | `pip install spacy==2.2.3` then `python -m spacy download en_core_web_sm` |
| `google.auth.exceptions.DefaultCredentialsError` during `create_data.py` | Backtranslation needs Google Cloud credentials | `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS`; or drop `backtranslation` from `--augmentations` |
| `apex` build failure | `apex==0.9.10dev` is a source-only NVIDIA extension | Skip it (it is only needed for `--fp16`) |
| `ValueError: Task not found: ...` | `--task_name` is not a key of `processors` | Use `factcc_annotated` or `factcc_generated` |
| Evaluation hangs for hours | Feature pre-processing on a large dataset | Expected — the upstream README documents this; reduce the dataset for a smoke test |
| `FileNotFoundError` for `data-dev.jsonl` | The processor looks for that exact filename | Rename the file to `data-dev.jsonl` inside `--data_dir` |
| UI page opens but "Run consistency check" shows a backend-unavailable card | The Flask service (`src/api.py`) is not running | Start it: `.venv\Scripts\python.exe src\api.py`, then retry |
| `POST /verify` returns "Could not reach ..." in the UI | Wrong port / service down | Confirm the service is on `127.0.0.1:5000`, or set `window.FACTCC_API_BASE` |
| Port 5000 already in use | Another backend holds the port | Stop that process, or change the port in `src/api.py` and `window.FACTCC_API_BASE` |
| Port 8000 already in use for the static server | Another process holds the port | `python -m http.server 8001` and open <http://localhost:8001> |

---

## Limitations

- **No neural inference path runnable here.** The repository's neural stack (`pytorch_transformers==1.0.0`, `torch==1.3.1`) cannot be installed on Python 3.12, and the checkpoints/datasets are external multi-GB downloads. The bundled `src/api.py` uses a **heuristic lexical engine**, not the FactCC model.
- **No checkpoint, no dataset** in the repository — both are external downloads of several GB.
- **Dependency stack is frozen in 2019** and cannot be installed on modern Python without a legacy interpreter.
- **The heuristic engine is deterministic, not semantic.** It flags numeric conflicts, low token coverage and negation flips — it can miss paraphrase-level falsehoods and should not be treated as FactCC accuracy.
- **The evaluation CLI produces metrics, not a service.** The bundled service is a separate, lightweight wrapper.
- **Backtranslation augmentation costs money** (Google Cloud Translation) and requires a billed account.
- **`--fp16` requires `apex`**, which needs a CUDA toolchain; CPU-only users should use `--no_cuda`.
- The upstream project asks users not to use the software to promote or profit from violence, hate and division, environmental destruction, abuse of human rights, or the destruction of people's physical and mental health.

---

## License and Credits

### Upstream project

**FactCC** — *Evaluating the Factual Consistency of Abstractive Text Summarization*, Wojciech Kryściński, Bryan McCann, Caiming Xiong, Richard Socher (Salesforce Research), 2019. Paper: <https://arxiv.org/abs/1910.12840>. Upstream repository: <https://github.com/salesforce/factCC>.

Licensed under the **BSD-3-Clause** licence — see `LICENSE.txt`:

> Copyright (c) 2019, Salesforce.com, Inc. All rights reserved.

The upstream project additionally asks that users not use the software to promote or profit from violence, hate and division, environmental destruction, abuse of human rights, or the destruction of people's physical and mental health.

### Added later (this front-end)

The **FactCheck Studio** UI — `index.html`, `css/style.css`, `js/app.js` — and this documentation were added on top of the upstream research code. They are **not** authored by Salesforce and carry no upstream endorsement. The UI layer is a visualisation layer: it contains no model, no inference code and no third-party JavaScript libraries.

### Citations

```
@article{kryscinskiFactCC2019,
  author    = {Wojciech Kry{\'s}ci{\'n}ski and Bryan McCann and Caiming Xiong and Richard Socher},
  title     = {Evaluating the Factual Consistency of Abstractive Text Summarization},
  journal   = {arXiv preprint arXiv:1910.12840},
  year      = {2019},
}
```

CNN/DailyMail article data is courtesy of the CNN/DailyMail summarisation corpus (`https://cs.nyu.edu/~kcho/DMQA/`).
