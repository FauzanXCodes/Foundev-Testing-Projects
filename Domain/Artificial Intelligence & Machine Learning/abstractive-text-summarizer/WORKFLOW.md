# FactCheck Studio (abstractive-text-summarizer) — Setup & Test Workflow

This document covers **how to install, configure, launch and test the complete project**: the
Flask consistency service (`src/api.py`), the static browser UI (`index.html` + `css/style.css` +
`js/app.js`), and the optional research CLI (`modeling/run.py`).

**Honest scope note up front:** the shipped backend (`src/api.py`) is a **deterministic lexical-entailment
engine**, not the neural FactCC / FactCCX pointer-BERT model. It reports this itself in every response
(`"engine": "lexical-entailment (heuristic)"`, `"model_checkpoint": false`). The neural path lives in
`modeling/run.py`, requires the pinned 2020 dependency stack and external multi-GB checkpoints, and **cannot
be installed on Python 3.12** — details in [Section 5](#5-troubleshooting).

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 (commands below are PowerShell) | `Get-Host` |
| Python | **3.12.1** (already present as `.venv`) | `.\.venv\Scripts\python.exe --version` |
| Flask | **3.1.3** (already present in `.venv`) | `.\.venv\Scripts\python.exe -m pip show flask` |
| Node.js | **Not required.** The UI is plain HTML/CSS/JS with no build step | — |
| Network | Only for `pip install`; the app itself runs fully offline | — |
| API keys | **None.** The service reads no `.env`, no environment variables | — |
| Browser | Any modern Chrome/Edge/Firefox (used for the UI + CORS) | — |

> **No API key, no account, no model download is required for the shipped UI + service.**

Project root (used by every command below):

```powershell
$root = "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\abstractive-text-summarizer"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 The shipped service + UI (the supported path)

The repository already contains a ready `.venv` with Flask installed. Verify it:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\abstractive-text-summarizer"
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip show flask
```

Expected (verified in this checkout):

```
Python 3.12.1
Name: flask
Version: 3.1.3
```

If `.venv` were missing, recreate it:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install "flask>=3.0"
```

> Use the interpreter **directly** (`.venv\Scripts\python.exe …`) as shown above. Activating the venv is
> optional; activation scripts are often blocked by the Windows execution policy.

#### 2.2 Configuration

**There is none.** `src/api.py` reads no environment variables, no `.env` file and no config file. Its
host/port are hard-coded at the bottom of the file:

```python
app.run(host="127.0.0.1", port=5000, debug=False)
```

The **browser** side has exactly one optional override, read in `js/app.js:10`:

```javascript
var API_BASE = (window.FACTCC_API_BASE || "http://127.0.0.1:5000").replace(/\/+$/, "");
```

So the default UI → backend pairing works with no editing. To point the UI at a different backend, set
`window.FACTCC_API_BASE` before `js/app.js` loads.

The service sends `Access-Control-Allow-Origin: *` on every response (`src/api.py:151-156`), so the UI
served from `http://localhost:8000` can call `http://127.0.0.1:5000` cross-origin without any proxy.

#### 2.3 Optional: the neural research CLI (`modeling/run.py`)

`modeling/run.py` is a **training / evaluation script**, not a server. It needs:

* Python **3.6/3.7** and the pins in `requirements.txt` — `pytorch_transformers==1.0.0`,
  `torch==1.3.1`, `spacy==2.2.3`, `scipy==1.3.0`, `numpy==1.17.4`, `apex==0.9.10dev`, `protobuf==3.11.2`,
  `scikit_learn==0.22.1`, `google-cloud-translate==1.6.0`, `tqdm==4.32.1`.
* `wandb` (imported at module scope; `wandb.init()` runs at import time).
* External data + checkpoints (multi-GB downloads listed in `README.md`).

```powershell
# Only meaningful on Python 3.6/3.7 — the pins do NOT build on 3.12
conda create -n factcc python=3.7 -y
conda activate factcc
pip install -r requirements.txt
pip install wandb
```

**Not runnable in this checkout on Python 3.12.1** — see [Section 5](#5-troubleshooting). Treat the
CLI as an optional, documented-but-unreproducible path.

---

### 3. Launch the Complete Project

Two processes are needed: the **backend** and the **static UI server**.

#### 3.1 Backend — Flask consistency service on port 5000

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\abstractive-text-summarizer"
.\.venv\Scripts\python.exe src\api.py
```

Expected console output:

```
 * Serving Flask app 'api'
 * Debug mode: off
WARNING: This is a development server. ...
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
```

Keep this window open. Stop with `Ctrl+C`.

#### 3.2 Frontend — static UI on port 8000

Open a **second** PowerShell window:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\abstractive-text-summarizer"
python -m http.server 8000
```

Open **http://localhost:8000** in the browser. (Opening `index.html` directly also works — all asset
paths are relative — but serving over HTTP is more reliable.) Stop with `Ctrl+C`.

#### 3.3 Optional: the research CLI (no server, no port)

```powershell
conda activate factcc
python modeling\run.py --help
```

This writes checkpoints/metrics to `--output_dir`; it never listens on a port.

#### 3.4 Ports summary

| Component | Port | Address |
|---|---|---|
| Flask service (`src/api.py`) | 5000 | `http://127.0.0.1:5000` |
| Static UI (`python -m http.server`) | 8000 | `http://localhost:8000` |
| Research CLI (`modeling/run.py`) | — | no server |

---

### 4. Test the Project

#### 4.1 Automated / command-line tests

There is **no pytest suite in this repository** — the tests below are direct API calls made with
`curl.exe` (available on Windows 10+). Each was executed against `src/api.py` on this machine.

**Test 1 — health check**

```powershell
curl.exe -s http://127.0.0.1:5000/health
```

Expected response (HTTP 200) — verified:

```json
{"engine":"lexical-entailment (heuristic)","model_checkpoint":false,
 "note":"Deterministic lexical engine. The neural FactCC/FactCCX checkpoints are not bundled and require the pinned 2020 dependency stack; this service does not load them.",
 "status":"ok"}
```

**Test 2 — a consistent (source, claim) pair → `CORRECT`**

Send the JSON body from a file (avoids PowerShell quote-mangling):

```powershell
@'
{"text":"Mercury Transit Pharma said its experimental antibody therapy reduced tumor size by 47 percent in a Phase II trial of 320 patients.","claim":"Mercury Transit Pharma said its therapy reduced tumors by 47 percent in a Phase II trial of 320 patients."}
'@ | Set-Content -Path "$env:TEMP\factcc_ok.json" -Encoding utf8

curl.exe -s --data-binary "@$env:TEMP\factcc_ok.json" -H "Content-Type: application/json" http://127.0.0.1:5000/verify
```

Expected (HTTP 200) — verified, `label` = **`CORRECT`**, `confidence` ≈ **0.9792**:

```json
{"confidence":0.9792,
 "diagnostics":{"claim_terms":13,"mean_sentence_overlap":0.7059,"negation_flip":false,
                "numeric_conflicts":[],"source_coverage":0.9231},
 "disclaimer":"Heuristic lexical/entailment analysis — NOT a neural FactCC checkpoint prediction.",
 "engine":"lexical-entailment (heuristic)",
 "inconsistent_spans":[],
 "label":"CORRECT",
 "model_checkpoint":false,
 "supporting_spans":[{"end":131,"start":0,"text":"Mercury Transit Pharma said its experimental antibody therapy reduced tumor size by 47 percent in a Phase II trial of 320 patients."}]}
```

**Test 3 — a numeric conflict → `INCORRECT` with the number flagged**

```powershell
@'
{"text":"Mercury Transit Pharma said its experimental antibody therapy reduced tumor size by 47 percent in a Phase II trial of 320 patients.","claim":"Mercury Transit Pharma said its therapy reduced tumors by 87 percent in a Phase II trial of 320 patients."}
'@ | Set-Content -Path "$env:TEMP\factcc_bad.json" -Encoding utf8

curl.exe -s --data-binary "@$env:TEMP\factcc_bad.json" -H "Content-Type: application/json" http://127.0.0.1:5000/verify
```

Expected (HTTP 200) — verified, `label` = **`INCORRECT`**, `confidence` ≈ **0.6446**, and the offending
number `87` is reported in `diagnostics.numeric_conflicts` and in `inconsistent_spans`:

```json
{"confidence":0.6446,
 "diagnostics":{"claim_terms":13,"mean_sentence_overlap":0.6111,"negation_flip":false,
                "numeric_conflicts":["87"],"source_coverage":0.8462},
 "engine":"lexical-entailment (heuristic)",
 "inconsistent_spans":[{"end":60,"start":58,"text":"87"}],
 "label":"INCORRECT","model_checkpoint":false, "supporting_spans":[ ... ]}
```

**Test 4 — empty body → HTTP 400**

```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST http://127.0.0.1:5000/verify -H "Content-Type: application/json" --data-binary "{}"
```

Expected — verified:

```
{"error":"'text' (source document) is required and must be a non-empty string"}
HTTP 400
```

**Test 5 — CORS preflight → HTTP 204**

```powershell
curl.exe -s -o NUL -w "HTTP %{http_code}`n" -X OPTIONS http://127.0.0.1:5000/verify
```

Expected — verified: `HTTP 204`.

**Test 6 — optional: the research CLI's argument parser**

```powershell
conda activate factcc
python modeling\run.py --help
```

Expected: the argparse usage block listing `--data_dir`, `--model_type`, `--model_name_or_path`,
`--task_name`, `--output_dir`, `--do_train`, `--do_eval`, etc. **This command was not executed in this
checkout** — the pinned stack cannot be installed on Python 3.12.1.

#### 4.2 Manual checks in the browser

1. Open **http://localhost:8000**. The masthead shows the chip **"Model: not loaded (backend required)"**
   and a second chip **"Checkpoints: external download"** — both are correct, because no checkpoint ships.
2. Paste the example source document into **Panel I — Source document**, and a claim into **Panel II**.
3. Press **Run consistency check**. With the backend running you get a verdict banner naming
   **"lexical-entailment (heuristic)"**, a confidence value and highlighted supporting / inconsistent
   spans. With the backend stopped you get the *backend-required* card with the exact start command
   instead of a fabricated verdict.
4. Press **Sample walkthrough** — it renders with no backend at all and stamps the result
   *"Sample walkthrough — illustrative data, not a model output"*.
5. **Model** dropdown (FactCC / FactCCX) is a **visual preference only** — the page says so, and the
   service returns the identical result either way.
6. **History** lists each run (time, model, claim, verdict, confidence, mode `backend`/`sample`);
   **Download history JSON** / **Copy history** / **Clear history** are available.
7. Open the browser DevTools **Network** tab, trigger a check, and confirm a `POST /verify` request to
   `http://127.0.0.1:5000/verify` returning HTTP 200 (or HTTP 400 if the panels are empty).

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'flask'` | Wrong interpreter | Use `.\.venv\Scripts\python.exe src\api.py` — do not use the bare `python` |
| `Address already in use` / port 5000 busy | Another Flask app is running | `Get-NetTCPConnection -LocalPort 5000` to find it, stop it, or run `.\.venv\Scripts\python.exe -m flask --app src\api.py run --port 5001` and set `window.FACTCC_API_BASE = "http://127.0.0.1:5001"` |
| UI shows *"backend-required"* card / `CONNECTION FAILED` | Backend not running, or the UI's base URL is wrong | Start `src\api.py`; confirm `curl.exe -s http://127.0.0.1:5000/health` returns `status: ok` |
| Browser console shows a CORS error | The service was started from a different port/host | The service always sets `Access-Control-Allow-Origin: *`; make sure you are hitting port 5000 and not a proxy |
| `400` with `'text' (source document) is required…` | Empty source or claim, or a non-string field | Both `text` and `claim` must be non-empty strings in the JSON body |
| `curl.exe` returns `{"error":"'text' … is required"}` even though the JSON looks right | PowerShell stripped the double quotes when passing `-d` inline | Write the body to a file and use `--data-binary "@file.json"` (see Test 2/3 above) |
| `pip install -r requirements.txt` fails on Python 3.12 | The pins are from 2019/2020 (`torch==1.3.1`, `numpy==1.17.4`, `scipy==1.3.0`, `pytorch_transformers==1.0.0`, `apex==0.9.10dev`) and have no 3.12 wheels | **Do not use `requirements.txt` for the service.** Install only `flask` into a 3.12 venv. The neural CLI needs Python 3.6/3.7 via Conda — see [Section 2.3](#23-optional-the-neural-research-cli-modelingrunpy) |
| `import pytorch_transformers` fails / `ModuleNotFoundError: No module named 'pytorch_transformers'` | The research CLI's stack is not installed | Expected on 3.12. Use Conda + Python 3.7 as in Section 2.3, and expect a long build for `torch==1.3.1` and `spacy==2.2.3` |
| `wandb login` / `wandb.ApiException` | `modeling/run.py` calls `wandb.init()` at import time | `pip install wandb` then `wandb login <YOUR_WANDB_API_KEY>` |
| `ModuleNotFoundError: No module named 'en_core_web_sm'` | spaCy NER model missing (only needed for the augmentation scripts) | `python -m spacy download en_core_web_sm` |
| `google.auth` / `DefaultCredentialsError` | The `backtranslation` augmentation needs Google Cloud credentials | Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key file, or skip that augmentation |
| The UI loads but the chart/history is empty | `localStorage` was cleared or the page is opened via `file://` | Use `http://localhost:8000`; history is stored under `factCheckStudio.history.v1` |
| Port 8000 busy | Another static server is running | `python -m http.server 8001` and open `http://localhost:8001` |

**Known limitations to state honestly**

* The service is a **heuristic lexical/entailment engine**, not a neural model — every response says so.
* The neural FactCC / FactCCX checkpoints are **not bundled**; they are external multi-GB downloads.
* The pinned 2020 dependency stack **cannot be installed on Python 3.12.1**; the neural CLI is therefore
  not runnable in this checkout.
* There is **no automated test suite** in the repository — the checks in Section 4.1 are manual
  `curl.exe` calls.
* The UI's model selector is cosmetic and does not change the service's output.

---

### 6. Verification Checklist

Work through this list after following Sections 2–4. Tick each box only once **you** have observed the
result — these are the checks the reader performs, not results already proven by this document.

**Environment**

- [ ] `.\.venv\Scripts\python.exe --version` prints `Python 3.12.1`
- [ ] `.\.venv\Scripts\python.exe -m pip show flask` reports Flask `3.1.3`
- [ ] `Get-ChildItem src, modeling, js, css` shows `src\api.py`, `modeling\run.py`, `js\app.js`, `css\style.css`

**Backend**

- [ ] `.\.venv\Scripts\python.exe src\api.py` starts and logs `Running on http://127.0.0.1:5000`
- [ ] `curl.exe -s http://127.0.0.1:5000/health` returns `"status":"ok"` and `"engine":"lexical-entailment (heuristic)"`
- [ ] The health response also shows `"model_checkpoint":false` (confirming no neural checkpoint is loaded)
- [ ] The consistent-pair POST returns `"label":"CORRECT"` with a confidence value near `0.98`
- [ ] The numeric-conflict POST returns `"label":"INCORRECT"` and `"numeric_conflicts":["87"]`
- [ ] The numeric-conflict POST lists the `87` inside `inconsistent_spans`
- [ ] An empty JSON body returns HTTP `400` with an `"error"` key
- [ ] `curl.exe -X OPTIONS http://127.0.0.1:5000/verify` returns HTTP `204`
- [ ] The response headers contain `Access-Control-Allow-Origin: *`

**Frontend**

- [ ] `python -m http.server 8000` starts and `http://localhost:8000` loads the FactCheck Studio page
- [ ] The masthead chip reads "Model: not loaded (backend required)"
- [ ] Pressing **Run consistency check** with both panels filled shows a verdict banner naming the
      lexical-entailment engine (i.e. the backend was actually reached)
- [ ] Pressing **Sample walkthrough** shows the "illustrative data, not a model output" stamp
- [ ] Stopping the backend and pressing **Run consistency check** again shows the backend-required card
      with the start command instead of a fabricated verdict
- [ ] Browser DevTools → Network shows the `POST /verify` call to `http://127.0.0.1:5000/verify`
- [ ] The **History** panel lists the runs and **Download history JSON** produces a file

**Cleanup**

- [ ] Both servers were stopped with `Ctrl+C` and ports 5000 / 8000 are free
      (`Get-NetTCPConnection -LocalPort 5000,8000 -ErrorAction SilentlyContinue` returns nothing)
