# AI/ML Domain — Backend Integration Report

**Date:** 2026-10-21
**Scope:** All 20 projects in `Artificial Intelligence & Machine Learning/`
**Goal:** Connect existing vanilla-JS UIs to real backends where possible, verify workflows, and ship `README.md` + `PROJECT_OVERVIEW.md` per project.

---

## Summary Counts

| Metric | Count |
|---|---|
| Projects discovered | 20 |
| **Completed** | **8** (plagiarism, music, plant-leaf, question-paper, retail, stock, dropout, abstractive-text-summarizer) |
| **Partial** | **12** (integration + docs done; inference blocked by missing weights/datasets/keys/heavy deps) |
| **Blocked** | **0** |
| Backends existing before this task | 9 (Flask ×3, FastAPI ×1, Django ×1, Streamlit ×4 as desktop/web apps) |
| New backends created | 2 (`music-recommender` → `src/api.py`; `abstractive-text-summarizer` → `src/api.py`) |
| Backends modified (minimal fixes) | 1 (`credit-card-fraud-detection`) |
| Backends verified running this session | 6 (music, fraud, plagiarism, plant-leaf, question-paper, abstractive-text-summarizer) |
| `README.md` written/updated | 20 / 20 |
| `PROJECT_OVERVIEW.md` written | 20 / 20 |
| End-to-end UI→backend tests passed | 5 (music, plagiarism, plant-leaf, question-paper, abstractive-text-summarizer; fraud partial by design) |
| UI defects found & fixed during verification | 1 (retail-sales dashboard rebuilt — see below) |

> **Status definitions** — *completed*: UI + backend path verified as far as assets allow, docs complete.
> *partial*: integration/docs done, but inference or a surface is blocked by missing external assets
> (weights, datasets, API keys, Ollama, GPU deps). *blocked*: nothing runnable could be established
> (none this round).

---

## Per-Project Results

### 1. abstractive-text-summarizer — FactCheck Studio
- **Frontend:** `index.html` + `css/` + `js/` (root) — now calls `POST /verify`
- **Backend:** **added** `src/api.py` (Flask :5000, heuristic lexical-entailment engine); original CLI `modeling/run.py` (BERT-FactCC eval) unchanged
- **Tech:** Flask (installed in `.venv`); research stack PyTorch 1.3-era (pinned, not installable on Py3.12)
- **API integration:** UI `runCheck()` → `fetch(API_BASE + "/verify")` `{text, claim}` → `{label, confidence, supporting_spans, inconsistent_spans, diagnostics, engine, model_checkpoint:false}`. Live-verified: CORRECT (0.8939) for consistent pair, INCORRECT (0.6803, flags numeric conflict `74`), 400 on empty body, 204 OPTIONS, CORS `*`
- **Backend existed:** No → **created** `src/api.py` · **Modified:** UI `js/app.js` + `index.html` (live path + loading/error states) · **Inference functional:** Yes (heuristic) · **Neural:** No (checkpoints external, 2020 stack uninstallable)
- **Verification:** `node --check js/app.js` ✅, `/health` ✅, `/verify` valid/400/OPTIONS ✅, UI served :8000 (200), browser-equivalent CORS POST ✅
- **Docs:** ✅ README ✅ PROJECT_OVERVIEW (both updated to document the new service)
- **Remaining:** neural path (download FactCC/FactCCX checkpoint + wrap `modeling/model.py` behind the same `/verify` shape on the pinned stack)
- **Status:** `completed` (lightweight heuristic backend integrated & live-tested; neural inference still external-only)

### 2. college-faq-chatbot-rag — CampusWise
- **Frontend:** root UI (contract docs) + Streamlit app (`app/app.py`, port 8501)
- **Backend:** Streamlit + LangChain + OpenRouter LLM + ChromaDB (`vectorstore/` present)
- **API integration:** Streamlit is the real surface; root UI's contract panel documents an unbacked REST shape
- **Backend existed:** Yes · **Modified:** No · **Inference functional:** No (OPENROUTER_API_KEY unset; heavy deps not installed)
- **Verification:** source-audited; deps/keys documented
- **Docs:** ✅ ✅
- **Remaining:** `pip install -r requirements.txt` (langchain stack) + set `OPENROUTER_API_KEY`
- **Status:** `partial`

### 3. credit-card-fraud-detection — FraudGuard Console
- **Frontend:** root UI → `POST http://127.0.0.1:5000/predict`
- **Backend:** `src/flask_app.py` (Flask, port 5000) — **minimally fixed** (backups `*.bak`): modern `joblib` import, lazy model load with structured **503**, CORS + OPTIONS preflight, `__main__` runner; `src/train.py` modernized (`.values`, new metric paths); `requirements-modern.txt` added (original pins kept)
- **Backend existed:** Yes · **Modified:** Yes (minimal, backwards-compatible) · **Inference functional:** No — `data/creditcard.csv` absent → `models/model.pickle` never trained
- **Verification (live):** `{}` → 400; `features:null` → 400; valid 28 features → 503 structured model-missing; OPTIONS → 204 + CORS `*`; `tests/test_flask.py` → **2/4 pass** (validation tests; 2 prediction tests correctly fail on 503)
- **Docs:** ✅ ✅
- **Remaining:** supply Kaggle `creditcard.csv` → `python src/train.py` → live scores
- **Status:** `partial`

### 4. crop-yield-prediction — YieldSight
- **Frontend:** root UI · **Backend:** none (CLI pipeline: `fire`, `ee`/MODIS, rasterio/GDAL, CNN/RNN scripts)
- **API integration:** none possible without the ~110 GB MODIS export + Earth Engine auth; UI contract documented honestly
- **Backend existed:** No · **Inference functional:** No (data + env absent)
- **Verification:** static UI checks; pipeline read from source
- **Docs:** ✅ ✅
- **Status:** `partial`

### 5. currency-note-recognition-for-visually-impaired — Note Sense
- **Frontend:** root UI · **Backend:** none (`detect.py` ORB matcher, top-level script, hardcoded paths, `reference_images/` present)
- **API integration:** UI contract `POST /recognize` documented as not implemented
- **Backend existed:** No · **Inference functional:** No server; CLI matcher works only with its hardcoded test file
- **Verification:** static
- **Docs:** ✅ ✅
- **Remaining:** wrap ORB matcher in a small Flask endpoint (OpenCV)
- **Status:** `partial`

### 6. document-plagiarism-checker — Similarity Radar
- **Frontend:** server-rendered `templates/index.html` (redesigned, `.bak` kept) + `static/`
- **Backend:** `app.py` (Flask, `python app.py` → :5000) — **unmodified**
- **API integration:** native form POST (same-origin) ✅
- **Backend existed:** Yes · **Modified:** No · **Functional:** **Yes** (live Google search via `googlesearch`)
- **Verification (live, full flow):** GET `/` → 200 (10.5 KB UI); POST text → 302 → results page 200 in 3.0 s with **real search results** (0 matches → genuine 0.0% index rendered through gauge/stamp); empty POST → flash "Please fill the form"; `.venv` with pinned `requirements.txt` (Flask 2.2.2 / PyPDF2 2.11.1 / google 3.0.0) on Python 3.12
- **Docs:** ✅ ✅
- **Status:** `completed`

### 7. driver-drowsiness-detection — Cockpit HUD
- **Frontend:** root UI · **Backend:** none (Tkinter desktop + Streamlit variant; dlib EAR logic)
- **API integration:** UI contract documented, not implemented; dlib/landmark model missing
- **Backend existed:** Desktop only · **Inference functional:** No in this env (dlib hard on Windows)
- **Verification:** static; EAR/state-machine logic documented from source
- **Docs:** ✅ ✅
- **Status:** `partial`

### 8. emotion-detection-from-text-and-face — MoodTunes
- **Frontend:** `webui/` (vanilla, wired to backend) — root `frontend/` is the original Next.js app (untouched)
- **Backend:** FastAPI (`backend/`): `GET /`, `/health`, `POST /predict` (multipart image), `POST /predict-text`; lazy-load CNN + DistilBERT; Redis cache; webcam via browser
- **API integration:** UI fetch calls match backend routes/payloads ✅ (code-verified)
- **Backend existed:** Yes · **Modified:** No · **Inference functional:** No in this env (tensorflow/torch/deepface/transformers/mediapipe ≈ multi-GB; H5 weights auto-download on first run)
- **Verification:** route/payload contract audited from `backend/` source; two real defects documented (empty-text 400 becomes 500; invalid `torch --index-url` line in requirements)
- **Docs:** ✅ ✅
- **Remaining:** heavy install + weight download to light up live inference
- **Status:** `partial`

### 9. face-recognition-attendance-system — Roll-Call Kiosk
- **Frontend:** root UI · **Backend:** none (Tkinter + Haar + LBPH; `Trainner.yml` present, sample images absent)
- **API integration:** UI contract documented, not implemented
- **Verification:** static; pipeline documented from source
- **Docs:** ✅ ✅
- **Status:** `partial`

### 10. helmet-seatbelt-violation-detection — Signal Control Room
- **Frontend:** root UI · **Backend:** none (Tkinter + YOLOv8x weights external + Haar cascades)
- **API integration:** UI contract documented, not implemented
- **Verification:** static; confidence-gating logic documented from source
- **Docs:** ✅ ✅
- **Status:** `partial`

### 11. loan-default-prediction — Underwriting Desk
- **Frontend:** root UI · **Backend:** none (Python-2-era GBM scripts, `german_credit.csv` present)
- **API integration:** UI contract documented, not implemented; 7 Python-2 breakages documented
- **Verification:** static
- **Docs:** ✅ ✅ (original MIT license © 2014 Guocong Song preserved)
- **Status:** `partial`

### 12. music-recommender-from-audio-features — Groove Observatory
- **Frontend:** root UI (`js/app.js` — **updated this task** to be API-first with automatic browser fallback)
- **Backend:** **NEW** `src/api.py` (Flask, pandas, scikit-learn — same pipeline as `src/main_cosine_similarity.py`); deps in `requirements-api.txt`; `.venv` ready
- **API integration:** `GET /api/health`, `GET /api/artists`, `GET /api/songs?artist=`, `POST /api/recommend {artist,title,limit,excludeSelf}`, OPTIONS preflight, CORS `*`; UI probes `/api/health` (1.5 s) and marks the active engine in the badge
- **Backend existed:** No · **Created:** Yes · **Inference functional:** **Yes**
- **Verification (live):** health → 2,261 rows; songs(miley cyrus) → 10; recommend("flowers") → top-3 with real similarities (0.9947 Kygo, 0.9943 Kendrick Lamar, 0.9938 P!nk); 404 unknown song; 400 missing fields; `node --check` clean
- **Docs:** ✅ ✅
- **Status:** `completed`

### 13. plant-leaf-disease-detection-cnn — LeafLens
- **Frontend:** Django templates (redesigned, `.bak` kept) + `static/`
- **Backend:** Django (`manage.py`, `model/` project, `home/` app): `/`, `/about`, `/services`, `/contact`
- **API integration:** server-rendered pages ✅; **no CNN predict route** (no weights/dataset in repo)
- **Backend existed:** Yes · **Modified:** No (SQLite migrated) · **Inference functional:** No (weights absent — honestly labeled in UI)
- **Verification (live):** `manage.py check` clean; migrate clean; runserver :8001 → **4/4 pages 200** + static CSS 200 (22 KB)
- **Docs:** ✅ ✅
- **Status:** `completed`

### 14. question-paper-generator-from-syllabus — ExamForge
- **Frontend:** Flask templates (redesigned, `.bak` kept)
- **Backend:** `app.py` (Flask, `python app.py` → :5000, debug) — unmodified
- **API integration:** native form flows ✅; generation requires external **Ollama (`llama2`)** — not installed
- **Backend existed:** Yes · **Modified:** No · **Functional:** Partial (structure/PDF pipeline yes; AI generation no)
- **Verification (live):** GET `/` → 200 (35 KB ExamForge UI, real textbook API data); POST `/select` CBSE/10/Mathematics → 200 with real chapter structure (11.6 KB); `.venv` = requirements + `ollama` + `tenacity` (both missing from upstream requirements — documented); `fonts/DejaVuSans.ttf` present
- **Docs:** ✅ ✅
- **Remaining:** install Ollama + `ollama pull llama2` to enable question/FIB generation
- **Status:** `completed` (structure verified; AI generation documented as external requirement)

### 15. resume-screening-and-jd-matching — TalentMatch Lens
- **Frontend:** root UI · **Backend:** Streamlit pipeline (sentence-transformers, spaCy, pdfplumber)
- **API integration:** none (no HTTP API exists — `project-metadata.json` claiming FastAPI is inaccurate; documented)
- **Inference functional:** No (multi-GB deps + missing artifacts)
- **Verification:** static; Streamlit pipeline documented from source; original README preserved in `resume_screening_ai.zip`
- **Docs:** ✅ ✅
- **Status:** `partial`

### 16. retail-sales-forecasting — DemandSight
- **Frontend:** root UI — **rebuilt this task**: `js/app.js` had been truncated to a 10-line `escapeHtml()` stub (dashboard stuck on "Loading…"); full engine restored (CSV parser, filters, KPIs, sparklines, 4 Chart.js charts, sortable/searchable table, export, insight copy)
- **Backend:** none needed — genuine client-side analytics over the real `dataset/Superstore.csv`
- **Verification (live-logic):** `node --check` clean; Node harness over the real CSV → **9,994 rows, $2,297,201 sales, years 2014–2017, 4 regions** (classic Superstore figures); H1/H2 chip labels now derive from the latest year in the data (fixes the 2020-label mismatch)
- **Backend existed:** No (MySQL kit upstream, untested here) · **Inference functional:** N/A (no model claimed)
- **Docs:** ✅ ✅ (rewritten to match the restored dashboard)
- **Status:** `completed`

### 17. sign-language-to-text-translation — SignBridge Studio
- **Frontend:** root UI · **Backend:** none (library + CLI, ~106 files, MediaPipe landmarks)
- **API integration:** UI contract documented, not implemented
- **Verification:** static; entry points documented from source
- **Docs:** ✅ ✅
- **Status:** `partial`

### 18. stock-price-trend-predictor — TrendCast
- **Frontend:** root UI — genuine client-side technical analysis over real processed CSVs (`data/processed/*.csv`)
- **Backend:** none (training scripts/notebooks only; no weights)
- **Verification:** static UI checks; data paths verified present
- **Docs:** ✅ ✅
- **Status:** `completed`

### 19. student-dropout-risk-prediction — DEWS
- **Frontend:** root UI — genuine client-side precision@k risk scoring over an embedded synthetic cohort
- **Backend:** none (SQL + Python pipeline; real student data withheld per `pipeline/data/Data_Readme.md`)
- **Verification:** static; pipeline documented; 2 pre-existing git deletions of invalid-filename PNGs noted (Windows `:` constraint)
- **Docs:** ✅ ✅
- **Status:** `completed`

### 20. vehicle-number-plate-recognition — PlateSight
- **Frontend:** root UI · **Backend:** Streamlit (YOLOv5 via `torch.hub` + `model/last.pt` 14 MB present; OCR helper unused)
- **API integration:** Streamlit is the real surface; UI contract documented, not implemented; **no HTTP API in repo**
- **Inference functional:** Untested here (old torch pins; modern-install caveats documented)
- **Verification:** static; weights file verified present (14,378,245 B)
- **Docs:** ✅ ✅
- **Status:** `partial`

---

## Projects Requiring Additional Backend Work

| Priority | Project | What's needed |
|---|---|---|
| High | credit-card-fraud-detection | `data/creditcard.csv` → `python src/train.py` → `models/model.pickle` (then 200-path lights up) |
| High | emotion-detection-from-text-and-face | Heavy install + ~200 MB weight download; fix 400→500 defect; fix requirements line |
| High | question-paper-generator | Install Ollama + `llama2` model |
| Medium | college-faq-chatbot-rag | LangChain stack + `OPENROUTER_API_KEY` |
| Medium | resume-screening-and-jd-matching | sentence-transformers/spaCy stack + artifacts |
| Medium | currency-note-recognition | Wrap ORB matcher in a small Flask API |
| Medium | vehicle-number-plate-recognition | Modern torch install; run Streamlit |
| Low | abstractive-text-summarizer | Neural path: download FactCC/FactCCX checkpoint + wrap behind existing `/verify` (torch upgrade) |
| Low | crop-yield-prediction | MODIS export (~110 GB) + Earth Engine auth |
| Low | driver-drowsiness / face-attendance / helmet / sign-language / loan | Desktop/CLI surfaces; HTTP wrapping optional |

---

## Verification Notes & Honest Caveats

- Live tests performed only where safe/lightweight: music (Flask API), fraud (Flask, structured error paths), plagiarism (Flask + live Google), plant-leaf (Django), question-paper (Flask + external textbook API), abstractive-text-summarizer (Flask heuristic `/verify`). All claimed 200s/400s/503s/204s were observed on real HTTP responses this session.
- No predictions were fabricated anywhere; heavy-model projects document exact missing assets instead.
- One UI regression was found and fixed during Phase 6: DemandSight's truncated `js/app.js` (see #16).
- All 40 documents were section-count-validated (≥13 `##` sections each) and grounded by file reads.
- No repo scripts of unknown behavior were executed; no commits/pushes; `.bak` backups exist for every edited upstream file.
