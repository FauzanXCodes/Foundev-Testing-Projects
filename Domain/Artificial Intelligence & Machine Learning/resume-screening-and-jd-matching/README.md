# TalentMatch Lens — AI Resume Screening & JD Matching

Folder id: `resume-screening-and-jd-matching` · UI display name: **TalentMatch Lens**

TalentMatch Lens ranks candidates against a job description using **transformer sentence
embeddings** instead of keyword overlap, and explains every score: which skills matched, which are
missing, and which extra skills the candidate brings.

The project contains **two independent layers**, and it is important to know which is which:

| Layer | Files | What it is | Status |
|---|---|---|---|
| **Real ML pipeline** | `app.py` (Streamlit) + `src/` | sentence-transformers `all-MiniLM-L6-v2` embeddings, spaCy `PhraseMatcher` skill extraction, scikit-learn cosine similarity, explainability report | **Implemented** — but the required Python packages are **not installed** on this machine |
| **Browser preview UI** | `index.html` + `css/style.css` + `js/app.js` | A dependency-free demo that reproduces the *look* of the recruiter workbench and scores candidates with a **simplified heuristic** | **Implemented and fully functional offline** — it does **not** call the Python backend |

The browser UI states this explicitly in its own header: *"Preview UI · real screening runs in
Streamlit"*, and it labels its own scores as a *demo heuristic*.

> **Note on this file.** This `README.md` replaces the upstream project README. The original is
> preserved verbatim inside `resume_screening_ai.zip` (`resume_screening_ai/README.md`).

---

## Features

### Implemented and verified by reading the code

**Real pipeline (`app.py` + `src/`)**

| Feature | Where | Notes |
|---|---|---|
| Job description input — paste text **or** upload PDF/DOCX/TXT | `app.py` (`st.radio` → `st.text_area` / `st.file_uploader`) | `extract_text()` dispatches on the file extension |
| Multi-file resume upload with a live count | `app.py` (`st.file_uploader(accept_multiple_files=True)`) | — |
| Full pipeline trigger with validation | `app.py` → `st.button("🚀 Run Screening")` | Empty JD or no resumes → `st.error(...)` + `st.stop()` |
| PDF / DOCX / TXT text extraction | `src/extractor.py` → `extract_text_from_pdf()`, `extract_text_from_docx()`, `extract_text_from_txt()` | pdfplumber, python-docx, UTF-8 with `errors="ignore"` fallback |
| Light text cleaning | `src/preprocessor.py` → `clean_text()` | Strips emails/URLs/special characters, collapses whitespace; deliberately keeps natural language |
| Curated 90-skill dictionary | `src/preprocessor.py` → `SKILL_KEYWORDS` | Languages, AI/ML, web, data/cloud, databases, practices, soft skills |
| Multi-word skill matching | `src/preprocessor.py` → `load_skill_matcher()` (spaCy `PhraseMatcher`, `attr="LOWER"`) | Matches "machine learning" as one phrase |
| Per-document skill sets | `src/preprocessor.py` → `extract_skills()` | Returns a deduplicated lowercase set |
| Sentence embeddings (384-dim) | `src/embedder.py` → `ResumeEmbedder.encode()` | `all-MiniLM-L6-v2`, `normalize_embeddings=True` |
| Cosine-similarity ranking | `src/matcher.py` → `rank_candidates()` | Sorted descending, best match first |
| Explainability report | `src/explainer.py` → `generate_explanation()` | matched / missing / extra skills, skill-match %, plain-English summary |
| Ranked results table + bar chart | `app.py` (`st.dataframe`, `st.bar_chart`) | — |
| CSV export of the ranking | `app.py` (`st.download_button`) → `resume_screening_results.csv` | — |
| Expensive models loaded once per session | `app.py` → `@st.cache_resource` on `load_models()` | Avoids reloading the ~90 MB model on every rerun |
| Sample JD for testing | `data/sample_job_description.txt` | Machine Learning Engineer posting |

**Browser preview UI (`index.html` + `js/app.js`, 1168 lines of vanilla JS)**

| Feature | Notes |
|---|---|
| Job description panel — *Paste text* / *Upload file* tabs | `.txt` files are read in-browser with `FileReader`; PDF/DOCX are refused with a clear "needs the backend" message |
| "Load sample JD (repo)" button | `fetch("data/sample_job_description.txt")` — the only network call in the whole UI |
| Automatic skill extraction + manual skill chips | Same 90-skill dictionary; manual entries are marked and preserved across re-extraction |
| Candidate cards (max **8**) | Name + free-text body, add / remove / search |
| Demo scoring | `score = round1((0.55 × tokenCosine + 0.45 × skillJaccard) × 100)` — **a heuristic, not the model** |
| Strong / Partial / Weak banding | Threshold slider, 50–95, default 75 |
| Results with score ring, matched/missing/extra chips, shared terms | — |
| Side-by-side compare of two candidates | — |
| CSV export | `talentmatch_ranking.csv` (client-side Blob) |
| State persistence | `localStorage` key `tml-state-v1` (JD text, skills, candidates, threshold) |
| Accessibility touches | `aria-*` attributes, focus management, `prefers-reduced-motion` support, copy-to-clipboard with fallback |
| Honest labelling | "Demo heuristic — the real system uses all-MiniLM-L6-v2 embeddings via Streamlit; results differ." |

### NOT AVAILABLE / requires external setup

- **No HTTP/JSON API exists.** Neither layer exposes REST endpoints. The Streamlit app is a
  server-rendered UI; the browser UI is static and never contacts a backend. The upstream
  `project-metadata.json` lists `FastAPI` in the stack, but **no FastAPI server is present in the
  code** — the real entry point is `app.py` (Streamlit).
- **The Python dependencies are not installed** on this machine: `streamlit`, `sentence-transformers`,
  `spacy`, `pdfplumber` and `python-docx` are all missing. (`torch 2.13.0`, `scikit-learn 1.7.0`,
  `numpy 2.2.4`, `pandas 2.2.3` happen to be present in the system interpreter, but the pinned
  versions in `requirements.txt` are different.)
- **The `spaCy` model `en_core_web_sm` is not installed** — `spacy.load("en_core_web_sm")` is called
  at import time in `app.py`, so the app cannot start without it.
- **The `all-MiniLM-L6-v2` weights are not in the repository.** They are downloaded from Hugging Face
  on first run (~90 MB) and cached in the local Hugging Face cache.
- **No resume dataset ships with the project.** The only data file is the 683-byte
  `sample_job_description.txt`. To exercise the app you must supply your own PDF/DOCX/TXT resumes.
- **The bundled `venv/` is unusable.** It contains a single file, `venv/Scripts/activate` — a
  **bash** activation script pointing at the original author's machine
  (`VIRTUAL_ENV="C:\Users\thrin\AI_Internship\resume_screening_ai\venv"`). There is no
  `Scripts/python.exe` and no `Lib/site-packages`.
- **No trained/fine-tuned model** is included, and no training or evaluation script exists. The
  model is a **pretrained general-purpose sentence encoder** used zero-shot.

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Real UI | Streamlit 1.38.0 | `app.py`, `st.set_page_config`, `st.cache_resource` |
| Preview UI | Vanilla HTML5 + CSS + JS | `index.html` (10.8 KB), `css/style.css` (22.8 KB), `js/app.js` (40.4 KB) — no framework, no build step |
| Embeddings | `sentence-transformers` 3.0.1 → `all-MiniLM-L6-v2` | 384 dimensions, `normalize_embeddings=True` |
| Deep-learning runtime | `torch` 2.3.1 (pinned) | Pulled in by sentence-transformers |
| NLP / skill extraction | `spacy` 3.7.5 + `en_core_web_sm` | `PhraseMatcher` with `attr="LOWER"` |
| Similarity scoring | `scikit-learn` 1.5.1 | `cosine_similarity` from `sklearn.metrics.pairwise` |
| File parsing | `pdfplumber` 0.11.4, `python-docx` 1.1.2 | PDF / DOCX / TXT |
| Data handling | `pandas` 2.2.2, `numpy` 1.26.4 | Results table, embedding matrices |
| Core language | Python (3.11 recommended by upstream; 3.12.1 present on this machine) | — |

---

## Prerequisites

- **Windows 10/11** with PowerShell 5.1+ (Linux/macOS variants noted below).
- **Python 3.11** (upstream recommendation) or 3.12.1 (what is installed here).
- **Internet access on first run** to download the spaCy model and the sentence-transformer weights.
- **Disk space for ~90 MB** of cached model weights (plus the PyTorch wheel, which is the largest
  download in `requirements.txt`).
- **No API keys, no accounts, no paid services.** Everything runs locally.
- For the preview UI only: any modern browser. No Node.js and no build step are required.

---

## Project Structure

```
resume-screening-and-jd-matching/
├── app.py                          # REAL entry point — Streamlit UI (212 lines)
├── src/
│   ├── __init__.py                 # Package marker (128 bytes)
│   ├── extractor.py                # PDF/DOCX/TXT → plain text (96 lines)
│   │                               #   extract_text_from_pdf / _docx / _txt, extract_text dispatcher
│   ├── preprocessor.py             # clean_text(), SKILL_KEYWORDS, load_skill_matcher(), extract_skills() (112 lines)
│   ├── embedder.py                 # class ResumeEmbedder — SentenceTransformer wrapper (58 lines)
│   ├── matcher.py                  # rank_candidates() — cosine similarity + sort (46 lines)
│   └── explainer.py                # generate_explanation() — matched/missing/extra + summary (65 lines)
├── index.html                      # PREVIEW UI — TalentMatch Lens workbench (10.8 KB)
├── css/style.css                   # PREVIEW UI stylesheet (22.8 KB)
├── js/app.js                       # PREVIEW UI logic — demo heuristic scorer (1168 lines, 40.4 KB)
├── data/
│   └── sample_job_description.txt  # 683-byte sample JD (Machine Learning Engineer)
├── requirements.txt                # 10 pinned packages (streamlit, sentence-transformers, torch,
│                                   #   scikit-learn, spacy, pdfplumber, python-docx, pandas, numpy)
├── venv/                           # ⚠ UNUSABLE — only Scripts/activate (a bash script) is present
├── resume_screening_ai.zip         # Upstream snapshot: src/ + app.py + requirements.txt + README + .gitignore
├── LICENSE                         # MIT, Copyright (c) 2026 Thrinath Polanki
├── project-metadata.json           # Catalogue metadata (id, repo, stack, license, entry=app.py)
├── README.md                       # This file (replaces the upstream README, preserved in the .zip)
└── PROJECT_OVERVIEW.md             # Developer deep-dive
```

**Model / data paths the code expects**

| Path | Expected by | Present? |
|---|---|---|
| spaCy `en_core_web_sm` (installed into the active environment) | `app.py` → `spacy.load("en_core_web_sm")` | **No** — must be downloaded |
| `all-MiniLM-L6-v2` (Hugging Face cache) | `src/embedder.py` → `SentenceTransformer(model_name)` | **No** — downloaded on first run |
| `data/sample_job_description.txt` | Streamlit workflow + the preview UI's "Load sample JD" button | **Yes** (683 bytes) |
| Resume corpus for testing | manual — you supply the files | **No** — no dataset in repo |

---

## Installation

The bundled `venv/` cannot be used (it has no interpreter). Create your own.

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\resume-screening-and-jd-matching"
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Install the spaCy model (this is a **separate** step — it is not in `requirements.txt`):

```powershell
python -m spacy download en_core_web_sm
```

Verify the whole stack:

```powershell
python -c "import spacy, streamlit, sentence_transformers, sklearn, pdfplumber, docx, pandas, numpy; spacy.load('en_core_web_sm'); print('OK - all core packages available')"
```

Expected: `OK - all core packages available`. If this line fails, the Streamlit app cannot start
(see [Troubleshooting](#troubleshooting)).

The `all-MiniLM-L6-v2` weights (~90 MB) are **downloaded automatically on first run** and cached
locally; every later run works fully offline.

Linux / macOS equivalent:

```bash
cd "/path/to/resume-screening-and-jd-matching"
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

**The preview UI needs none of the above** — it is plain HTML/CSS/JS (see
[How to Launch](#how-to-launch)).

---

## Environment Configuration

**The Python pipeline reads no environment variables at all.** There is no `.env` file, no
`os.environ` lookup, and no `python-dotenv` dependency in `requirements.txt`. The only
configuration surface is the **model name**, which is hard-coded in two places:

| Setting | Hard-coded value | File / line |
|---|---|---|
| spaCy pipeline | `"en_core_web_sm"` | `app.py` → `load_models()` |
| Sentence-Transformer model | `"all-MiniLM-L6-v2"` | `app.py` → `load_models()` |
| Embedding model default | `"all-MiniLM-L6-v2"` | `src/embedder.py` → `ResumeEmbedder.__init__` |
| Streamlit page title / icon | `"AI Resume Screening System"` / `"📄"` | `app.py` → `st.set_page_config` |
| Streamlit port | 8501 (Streamlit default) | set with `--server.port` if needed |

To change the model, edit `app.py` (both `load_models()` arguments) — the wrapper class in
`src/embedder.py` was written specifically so the model can be swapped without touching calling
code.

Useful Streamlit runtime flags (no file changes needed):

```powershell
streamlit run app.py --server.port 8501 --server.address 127.0.0.1 --browser.gatherUsageStats false
```

The Hugging Face and spaCy caches are controlled by the standard environment variables
`HF_HOME` (model cache) and `HF_HUB_OFFLINE=1` (force offline), but the project itself does not
set or read them.

---

## How to Launch

The project has **two launch paths**. They are independent — you can run either, both, or neither.

### Path A — the real ML application (Streamlit)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\resume-screening-and-jd-matching"
.\.venv\Scripts\Activate.ps1
streamlit run app.py
```

Streamlit prints its URL; by default that is **http://localhost:8501**.

- The browser talks to the Streamlit server over its own websocket/HTTP protocol. **There is no
  separate REST API and no CORS configuration** — Streamlit handles the session internally.
- The first run downloads the spaCy model (if not already present) and the `all-MiniLM-L6-v2`
  weights, then caches them.
- **Stop:** press `Ctrl+C` in the terminal.

### Path B — the browser preview UI (static files)

The preview UI is a **static page**; it needs a plain file server, not a Python backend. The
`fetch("data/sample_job_description.txt")` call means it must be served over HTTP — opening
`index.html` from `file://` will fail that one request (the "Load sample JD" button).

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\resume-screening-and-jd-matching"
python -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000/**.

- The UI explicitly tells the user to open `http://localhost:8000` from the project folder.
- **Stop:** press `Ctrl+C` in the terminal.
- Port 8000 is the project's own choice — the code hard-codes it only in that helper message in
  `js/app.js`; any static server port works as long as you use the same one in the browser.

Linux / macOS equivalent:

```bash
source .venv/bin/activate
streamlit run app.py
python -m http.server 8000 --bind 127.0.0.1
```

### How the two paths relate

They do **not** talk to each other. The preview UI contains its own JavaScript scorer; it never
calls Streamlit, and Streamlit never serves `index.html`.

---

## Model and Dataset Setup

### What exists in the repository

- **No model weights.** The repository contains no `.bin`, `.safetensors`, `.onnx` or `.pkl`
  model files.
- **No dataset.** The only data file is `data/sample_job_description.txt` (683 bytes).
- **No training or evaluation script.** Nothing in the repo trains, fine-tunes or benchmarks a
  model — `all-MiniLM-L6-v2` is used zero-shot, exactly as downloaded.
- `resume_screening_ai.zip` contains **source only** (10 entries: `src/*.py`, `app.py`,
  `requirements.txt`, `README.md`, `.gitignore`, `data/sample_job_description.txt`) — **no models,
  no datasets**.

### What is missing, and where the code expects it

| Missing item | Where the code expects it | How to obtain |
|---|---|---|
| spaCy `en_core_web_sm` | `app.py` → `spacy.load("en_core_web_sm")` — called at **module import time**, so the app fails to start without it | `python -m spacy download en_core_web_sm` |
| `all-MiniLM-L6-v2` weights | `src/embedder.py` → `SentenceTransformer("all-MiniLM-L6-v2")`; the Hugging Face cache (`HF_HOME`, default `~/.cache/huggingface`) | Downloaded automatically on first run (~90 MB) |
| `torch` runtime | Required by `sentence-transformers` | `pip install -r requirements.txt` (pins `torch==2.3.1`) |
| A resume corpus for testing | User-supplied PDF/DOCX/TXT files | Any realistic resumes; use `data/sample_job_description.txt` as the JD |
| A `venv` interpreter | `venv/` has no `Scripts/python.exe` | Recreate it (see [Installation](#installation)) |

### Optional: offline operation after the first run

Once the model is cached, the Streamlit app runs without internet. Add `HF_HUB_OFFLINE=1` to force
it if you want to guarantee no network calls.

---

## Usage

### A — Real screening in Streamlit

1. Start the app: `streamlit run app.py` → open **http://localhost:8501**.
2. The header reads *"📄 AI-Based Resume Screening System"*.
3. **Step 1️⃣ Job Description** (left column):
   - Choose **Paste text** or **Upload file**.
   - Paste text, e.g. the contents of `data/sample_job_description.txt` (a Machine Learning
     Engineer posting asking for Python, PyTorch, scikit-learn, NLP/transformers, FastAPI/Flask,
     SQL, AWS/GCP, Docker, CI/CD, Agile).
   - With **Upload file** you can upload a `.pdf`, `.docx` or `.txt` JD; the extracted text is shown
     in a read-only box.
4. **Step 2️⃣ Candidate Resumes** (right column): upload one or more `.pdf` / `.docx` / `.txt`
   resumes. A green success line confirms the count.
5. Press **🚀 Run Screening**.
   - If the JD is empty → *"Please provide a job description before running screening."*
   - If no resume was uploaded → *"Please upload at least one resume before running screening."*
6. A spinner reads *"Analyzing resumes... this may take a few seconds."* while the pipeline runs
   (extract → clean → skill extraction → embedding → cosine ranking → explanation).
7. **📊 Ranked Candidates**: a table with Rank, Candidate (file name), Match Score (×100, 1 dp) and
   Skills Matched (%), followed by a bar chart of the scores.
8. **⬇️ Download Results as CSV** → `resume_screening_results.csv`.
9. **🔍 Detailed, Explainable Insights per Candidate**: expand a candidate to read the one-line
   summary (e.g. *"This candidate is a strong match for the role (semantic similarity: 0.78),
   matching 8 of 10 required skills (80.0%)."*) and the three skill lists — **✅ Matched Skills**,
   **❌ Missing Skills**, **➕ Extra Skills (bonus)**.
10. Score band thresholds used by the summary text: ≥ 0.75 = "a strong overall match",
    ≥ 0.55 = "a moderate match", otherwise "a weak match".

**Illustrative only** — the numbers above show the *format* the app produces; real values depend on
your resumes.

### B — Preview UI walkthrough (`http://localhost:8000/`)

1. Open the page; the header shows **TalentMatch Lens** with the role switch
   *"Preview UI · real screening runs in Streamlit"* and a copyable `streamlit run app.py` command.
2. **Job description** panel:
   - **Paste text** tab — paste a JD.
   - **Upload file** tab — `.txt` is parsed in the browser; `.pdf`/`.docx` produce the explicit
     warning *"Parsing <file> needs the backend (pdfplumber/python-docx) - use the Paste text tab
     instead."*
   - **Load sample JD (repo)** → fetches `data/sample_job_description.txt` and shows
     *"Loaded data/sample_job_description.txt (the repo sample)."*
   - Skills are extracted automatically into chips; **Re-extract skills** re-runs it, and you can
     add/remove skills by hand (manual chips are preserved).
3. **Candidates** panel: **+ Add candidate** (up to 8). Each card has a name field, a text area, and
   a `.txt` file picker. Paste resume text or load a `.txt` file; PDF/DOCX again shows the
   backend-required warning.
4. Move the **threshold** slider (50–95, default 75) to change the Strong/Partial/Weak banding.
5. Press **Run screening**. After a short simulated delay you get the result cards: a score ring,
   the band, the cosine and Jaccard components, matched/missing/extra chips, and the shared
   terms.
6. Use **Filter results**, **Export CSV** (→ `talentmatch_ranking.csv`), **Clear results** and
   **Clear all** (which also wipes the `localStorage` entry).
7. Open the **Side-by-side compare** panel to contrast two candidates.
8. Scroll to **What actually runs in Streamlit** for the real-pipeline instructions.

**All scores in this UI are demo data** produced by the in-browser heuristic
(`0.55 × token cosine + 0.45 × skill Jaccard`). They are *not* the MiniLM embedding scores and the
page says so.

---

## API Documentation

**This project exposes no HTTP API.** There is nothing to call from another program:

- The real application is a **Streamlit** app. Its UI is served by the Streamlit server and driven
  over Streamlit's own session protocol; there is no route table, no JSON endpoints and no
  `st.write` of a REST payload anywhere in `app.py`.
- The preview UI is **static**. Its only network request is `GET data/sample_job_description.txt`,
  a static file relative to the page. It never calls a scoring endpoint, and `js/app.js` contains
  no `fetch()` to any API, no `XMLHttpRequest`, and no `localhost`/`127.0.0.1` backend reference.
- `project-metadata.json` mentions **FastAPI** in its `stack` field, but **no FastAPI application
  exists in the code** — there is no `uvicorn` call, no `@app.post`/`@app.get` decorator and no
  `fastapi` import. Treat that field as aspirational.

The only programmatic entry points are the Python functions in `src/`, which you can import
directly:

| Function | Module | Signature → returns |
|---|---|---|
| `extract_text` | `src/extractor.py` | `(filename: str, file_bytes: bytes) → str` — raises `ValueError` for unsupported extensions |
| `extract_text_from_pdf` | `src/extractor.py` | `(file_bytes: bytes) → str` — page-by-page pdfplumber extraction; scanned pages may yield `None` |
| `extract_text_from_docx` | `src/extractor.py` | `(file_bytes: bytes) → str` — non-empty paragraphs joined by `\n` |
| `extract_text_from_txt` | `src/extractor.py` | `(file_bytes: bytes) → str` — UTF-8, `errors="ignore"` on failure |
| `clean_text` | `src/preprocessor.py` | `(text: str) → str` — emails/URLs/special chars removed, whitespace collapsed |
| `load_skill_matcher` | `src/preprocessor.py` | `(nlp: spacy.language.Language) → PhraseMatcher` |
| `extract_skills` | `src/preprocessor.py` | `(text, nlp, matcher) → set[str]` |
| `ResumeEmbedder.__init__` | `src/embedder.py` | `(model_name: str = "all-MiniLM-L6-v2")` |
| `ResumeEmbedder.encode` | `src/embedder.py` | `(texts: list[str]) → np.ndarray` (n × 384, L2-normalised) |
| `rank_candidates` | `src/matcher.py` | `(jd_embedding, resume_embeddings, resume_names) → list[dict]` sorted by descending score |
| `generate_explanation` | `src/explainer.py` | `(jd_skills: set, resume_skills: set, similarity_score: float) → dict` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `OSError: [E0501] Can't find model 'en_core_web_sm'` on startup | The spaCy model is not installed | `python -m spacy download en_core_web_sm` |
| `ModuleNotFoundError: No module named 'streamlit'` (or `sentence_transformers`, `spacy`, `pdfplumber`, `docx`) | The project environment was never created | Create `.venv` and run `pip install -r requirements.txt` |
| `ModuleNotFoundError: No module named 'src'` | Streamlit was started from the wrong directory | `cd` to the project root before `streamlit run app.py` |
| The app starts then dies while loading models | The `all-MiniLM-L6-v2` download failed (no internet / proxy) | Re-run with internet access; once cached it works offline. `HF_HUB_OFFLINE=1` proves the cache is complete |
| `ValueError: Unsupported file type: '.doc'` | `extract_text()` only handles `pdf`, `docx`, `txt` | Convert the file, or rename it to `.txt` |
| A PDF resume comes back empty | Scanned/image-only PDF — pdfplumber extracts no text layer | Run OCR first, or paste the text |
| Every candidate scores similarly / all low | Too much text — the model truncates long inputs, and `clean_text()` keeps natural language | Shorten the resume text, or use a longer-context model |
| The preview UI's "Load sample JD" button fails | The page was opened via `file://` instead of a server | Serve the folder: `python -m http.server 8000 --bind 127.0.0.1` |
| The preview UI warns "PDF/DOCX parsing needs the backend" | By design — the browser cannot parse PDF/DOCX | Use the Paste text tab, or use the real Streamlit app |
| The preview UI's results differ from Streamlit's | The browser uses a token/Jaccard heuristic, not embeddings | Expected and stated in the UI; use Streamlit for real scores |
| `streamlit run app.py` reports the port is in use | Another Streamlit instance is running | `streamlit run app.py --server.port 8502` |
| `venv\Scripts\activate` fails | The bundled `venv/` contains only a bash `activate` script | Ignore it and create `.venv` with `py -3.11 -m venv .venv` |
| `torch` install is slow or fails | The PyTorch wheel is large | Expect a long download; or pre-install `torch` from the official index for your CUDA/CPU build |
| `ModuleNotFoundError` after `pip install -r requirements.txt` on Python 3.12 | `torch==2.3.1` has no 3.12 wheel for every platform | Use Python 3.11 (the upstream recommendation) |
| Candidate list is capped | The preview UI allows at most 8 candidates | `MAX_CANDIDATES = 8` in `js/app.js`; the Streamlit app has no such limit |

---

## Limitations

**Real pipeline**

- **The environment is not ready** — `streamlit`, `sentence-transformers`, `spacy`, `pdfplumber`
  and `python-docx` are not installed here, so the Streamlit app cannot start as shipped.
- **The bundled `venv/` is broken** (bash-only `activate`, pointing at a path that no longer
  exists on this machine).
- **Heavy dependencies.** `torch==2.3.1` is a multi-hundred-megabyte install for a demo.
- **No HTTP API** — the pipeline can only be driven through the Streamlit UI, so it cannot be
  embedded in an ATS or called from another service without extra work.
- **Scanned PDFs yield empty text** — no OCR anywhere in the project.
- **Text truncation.** `all-MiniLM-L6-v2` has a 256-token limit; long resumes are cut off.
- **The skill dictionary is hard-coded** — 90 entries in `src/preprocessor.py` and duplicated in
  `js/app.js`. Skills outside the list are invisible to the explainability layer even if the
  embedding score reflects them.
- **No training, fine-tuning, or evaluation.** There is no dataset, no metrics, no benchmark and
  no regression test in the repository.
- **The skill vocabulary has no weights or aliases** — "ML" is not mapped to "machine learning",
  so a resume written with abbreviations scores lower on the skill axis.
- **No persistence, auth, or multi-user support** — every session is isolated in the Streamlit
  session, and nothing is stored.
- **No bias or fairness audit** — a skill dictionary and a similarity score can reproduce
  discrimination in the training corpus.
- **No PII redaction** — `clean_text()` removes email addresses and URLs, but names, phone numbers
  and addresses are embedded and sent to the model.
- **`load_models()` runs at import time** — a missing spaCy model or a failed download crashes the
  app at startup rather than at the point of use.

**Preview UI**

- **The scoring is a heuristic, not the model.** `0.55 × token cosine + 0.45 × skill Jaccard` is a
  bag-of-words approximation. The page states this in two places.
- **No PDF/DOCX parsing in the browser** — those uploads are explicitly refused.
- **State lives in `localStorage`** (`tml-state-v1`) — it is per-browser, unencrypted, and capped
  at 8 candidates.
- **A 420 ms artificial delay** simulates processing time; no real work happens.
- **Skilled extraction is a regex scan** over the same 90 keywords, without spaCy's phrase
  matching, so multi-word skills can be matched partially.
- **No tests** anywhere in the repository.

---

## License and Credits

**Upstream project:** MIT License — Copyright (c) 2026 Thrinath Polanki (`LICENSE`).
Upstream repository: `https://github.com/thrinathpolanki/resume_screening_ai`
(`project-metadata.json` → `repository`).

The original `app.py`, the `src/` package (`extractor.py`, `preprocessor.py`, `embedder.py`,
`matcher.py`, `explainer.py`), `requirements.txt` and `data/sample_job_description.txt` are the
upstream work and remain MIT-licensed.

**Added later (this repository's own layer):**

- The **TalentMatch Lens preview UI** — `index.html`, `css/style.css`, `js/app.js` — a
  dependency-free browser demo with its own scorer, CSV export, comparison view, accessibility
  affordances and localStorage persistence. It is **not** the upstream code and it is **not** wired
  to the Streamlit pipeline.
- This `README.md` and `PROJECT_OVERVIEW.md`, which **replace** the upstream README (the original
  is preserved inside `resume_screening_ai.zip`).

**Third-party components and credits:**

| Component | Role | Terms |
|---|---|---|
| `sentence-transformers` | Sentence-embedding API | Apache-2.0 |
| `all-MiniLM-L6-v2` (Hugging Face / sentence-transformers) | Pre-trained encoder, 384-dim | Apache-2.0; weights are **downloaded**, not redistributed here |
| `en_core_web_sm` (spaCy) | Tokenisation + `PhraseMatcher` vocabulary | MIT |
| `scikit-learn` | `cosine_similarity` | BSD-3-Clause |
| `pdfplumber` | PDF text extraction | MIT |
| `python-docx` | DOCX text extraction | MIT |
| PyTorch | Inference runtime | BSD-3-Clause |
| Plus Jakarta Sans / JetBrains Mono (Google Fonts) | Preview UI typography | SIL Open Font License |
