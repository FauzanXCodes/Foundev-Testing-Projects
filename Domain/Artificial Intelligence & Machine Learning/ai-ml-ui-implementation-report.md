# AI & Machine Learning Domain — Frontend UI Implementation Report

**Domain:** `Domain/Artificial Intelligence & Machine Learning/`
**Date:** 2026-10-20
**Stack used everywhere:** HTML5 + CSS3 + vanilla JavaScript (Google Fonts / Chart.js optional CDNs with graceful fallback). No frameworks, no build tools.
**Testing performed:** static checks only (`node --check` on every JS file, JS↔HTML id cross-check, local asset path resolution, HTML structure/lang/viewport/title checks, CSS brace balance, forbidden-library grep, per-repo `git status` integrity audit, template backup verification, Jinja tag-balance verification for edited templates). **No browser was launched and no repository script, server, or model was executed.**

## Summary totals

| Metric | Count |
|---|---|
| Total projects discovered | 20 |
| Total projects completed | 20 |
| Total projects partially completed | 0 |
| Total projects blocked | 0 |
| UIs wired to a real executable backend/API/data | 6 |
| UIs with backend/model-dependent features clearly labeled | 20 (all; the 6 real integrations also label remaining gaps) |

### Projects requiring backend integration (model-dependent features)

| Project | What is needed |
|---|---|
| abstractive-text-summarizer | Wrap `modeling/run.py` (FactCC checkpoint download required) |
| college-faq-chatbot-rag | Run existing Streamlit app (`streamlit run app/app.py`, OpenRouter key) |
| crop-yield-prediction | Run CLI pipeline (`python run.py …`, Earth Engine + data) |
| currency-note-recognition-for-visually-impaired | Wrap `detect.py` ORB matcher in a server |
| driver-drowsiness-detection | Run Streamlit WebRTC app or dlib desktop script (+ landmark .dat download) |
| emotion-detection-from-text-and-face | FastAPI backend exists — `uvicorn app:app` (model auto-downloads) |
| face-recognition-attendance-system | Tkinter desktop app (`python AMS_Run.py`) |
| helmet-seatbelt-violation-detection | Tkinter desktop app + YOLOv8 weights (auto-download) |
| loan-default-prediction | Legacy Python 2 pipeline + Kaggle CSVs (needs porting) |
| plant-leaf-disease-detection-cnn | Implement CNN inference endpoint (weights not in repo) |
| question-paper-generator-from-syllabus | Flask + Ollama (`ollama run llama3`) |
| resume-screening-and-jd-matching | Run Streamlit app (downloads MiniLM from HuggingFace) |
| retail-sales-forecasting | No forecasting model exists in repo — would need Prophet/ARIMA service |
| sign-language-to-text-translation | Wrap the `slt` Python library in a server |
| stock-price-trend-predictor | Train models in notebooks; no serving code exists |
| student-dropout-risk-prediction | Run SQL + sklearn pipeline (data partially withheld) |
| vehicle-number-plate-recognition | Run Streamlit app (`streamlit run app.py`, weights `model/last.pt` included) |
| credit-card-fraud-detection | Flask API exists — needs `python src/train.py` + `flask run` |
| document-plagiarism-checker | Flask app exists — `flask run` (needs `googlesearch-python` install) |
| music-recommender-from-audio-features | **None** — full recommender runs in-browser on the repo's own CSV |

---

## Per-project results

### 1. abstractive-text-summarizer — FactCheck Studio
- **Folder:** `abstractive-text-summarizer/`
- **Concept:** Editorial verification desk — paper texture, serif masthead, rubber-stamp verdicts; source manuscript panel + 1–3 claim rows, span highlighting, confidence arc.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none exists (CLI-only FactCC research repo, no weights). Real JSONL contract + real CLI flags documented in an "API contract" panel; model selector marked "checkpoint required".
- **Features:** txt drag-drop, counters, per-claim span marking, labeled sample walkthrough (number-swap example), localStorage history + JSON export, copy/reset.
- **Limitations:** demo confidence value is illustrative; no live model.
- **Status:** completed

### 2. college-faq-chatbot-rag — CampusWise
- **Folder:** `college-faq-chatbot-rag/`
- **Concept:** Institutional navy/brass campus assistant; chat column + knowledge-explorer sidebar.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (Streamlit-only app, no REST). Offline card quotes real run command + real `.env.example` variable names.
- **Features:** suggested-question chips, labeled demo transcript (incl. a refusal example), source pills, retrieval-diagnostics explainer, transcript export (JSON/MD), copy answer.
- **Limitations:** demo conversation is sample data; live answers need the Streamlit backend.
- **Status:** completed

### 3. credit-card-fraud-detection — FraudGuard Console
- **Folder:** `credit-card-fraud-detection/`
- **Concept:** Dark SOC console (mono digits, amber/red, scanlines); 30-feature transaction form + batch scoring + audit log.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** **REAL** — `POST /predict` with `{"features":[30 floats]}` / batch rows → `{"scores":[…]}`; 400 `{"error"}` handled; service probe honest about no `/health`; offline setup panel with real training/serving commands; CORS limitation documented.
- **Features:** paste-a-row parser, sample row (badged DEMO VALUES), SVG risk gauge, threshold slider recoloring live, sortable batch results, CSV export, localStorage audit log, Ctrl+Enter.
- **Limitations:** model + dataset not in repo, so offline is the default state; no CORS headers in Flask (cross-origin note shown).
- **Status:** completed

### 4. crop-yield-prediction — YieldSight
- **Folder:** `crop-yield-prediction/`
- **Concept:** Agriscience field console (soil/harvest palette, topographic contours, condensed type); control rail + forecast canvas + pipeline stepper.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (CLI pipeline, no weights/data). Real `run.py` commands generated live from UI settings (bins, GP flag) with copy buttons; README paper/RMSE facts cited.
- **Features:** region search, dual-year slider, uncertainty-band canvas chart, series toggles, labeled illustrative sample series, CSV export, method tab.
- **Limitations:** all charted values are labeled illustrative samples; real predictions need Earth Engine + ~110 GB data.
- **Status:** completed

### 5. currency-note-recognition-for-visually-impaired — Note Sense
- **Folder:** `currency-note-recognition-for-visually-impaired/`
- **Concept:** Voice-first, WCAG-AAA-style high contrast (black/yellow, ≥88px controls, Atkinson Hyperlegible) for visually impaired users.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (desktop OpenCV script). Run command + hardcoded-path caveat documented.
- **Features:** huge photo picker + preview, honest recognition state (never fakes a denomination), **working audio player for the repo's real `audio/20|50|100.mp3`**, reference gallery of all 40 real `files/*.jpg` with keyboard lightbox, Web Speech "read aloud" of UI text, ORB/Lowe-0.789 method explainer.
- **Limitations:** ₹200/₹500 audio clips absent in repo; recognition itself needs the script.
- **Status:** completed

### 6. document-plagiarism-checker — Similarity Radar (integrated redesign)
- **Folder:** `document-plagiarism-checker/`
- **Concept:** Scholarly radar desk (midnight ink on warm paper, cyan scanner accent, SVG gauge).
- **Files:** modified `templates/index.html` (backup `templates/index.html.bak`); created `static/css/style.css`, `static/js/app.js`.
- **Backend integration:** **REAL (server-rendered)** — all Jinja hooks preserved: `POST /` form (`text`/`file`), `/plagiarism/<name>` results (`hasil_persen` gauge, `hasil_plagiarism`/`link_output` loop, flashes, `#hasil` anchor). `test_app.py` GET path intact.
- **Features:** paste/PDF tabs, drag-drop with 16 MB check mirroring `MAX_CONTENT_LENGTH`, SVG gauge animation, matched-sentence cards with copy/open, "what was searched" transparency panel, print stylesheet.
- **Limitations:** scan speed depends on live Google searches (fragile/rate-limited, as in the original); status word is a UI reading of the percentage.
- **Status:** completed

### 7. driver-drowsiness-detection — Cockpit Fatigue Monitor
- **Folder:** `driver-drowsiness-detection/`
- **Concept:** Automotive HUD night cluster (phosphor green→amber→red, gauge, scanlines).
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none exposed (Tkinter + Streamlit variants). Real EAR formula/thresholds (0.27 dlib, 0.25/20 frames MediaPipe) rendered; run commands for all three entry points copyable; missing dlib .dat noted.
- **Features:** EAR tachometer with redline, **real Web Audio alarm beep** with volume/mute, simulated strip chart (persistent SIMULATED SIGNAL chip), blink/alert session metrics, canvas snapshot download, spacebar start/stop.
- **Limitations:** live webcam EAR requires the backend; all charted signals are labeled simulated.
- **Status:** completed

### 8. emotion-detection-from-text-and-face — MoodTunes Sessions (vanilla webui)
- **Folder:** `emotion-detection-from-text-and-face/webui/`
- **Concept:** Immersive emotion-radio player; theme morphs to detected emotion's palette; orb + now-playing band + song reel (kept separate from the untouched Next.js app).
- **Files:** new `webui/index.html`, `webui/css/style.css`, `webui/js/app.js`. Existing `frontend/` (Next.js) and `backend/` untouched.
- **Backend integration:** **REAL** — `GET /health` (15s poll), `POST /predict-text` (JSON), `POST /predict` (multipart file+language); FastAPI `{"detail"}` errors, 30s timeout, offline panel with real uvicorn commands + honest first-run model-download note.
- **Features:** text + face tabs, 10-language list matching the Next.js app, drag-drop + **webcam capture** (getUserMedia→toBlob), 7-emotion bar chart, face_detected warning, YouTube links by real `video_id`, playlist copy, localStorage API base.
- **Limitations:** webcam needs localhost/https; backend must be started separately.
- **Status:** completed

### 9. face-recognition-attendance-system — Roll-Call Kiosk
- **Folder:** `face-recognition-attendance-system/`
- **Concept:** School register ledger (ruled paper, lanyard blue, rubber-stamp PRESENT/ABSENT, mono enrollment).
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (Tkinter desktop). **Real roster fetch** of `StudentDetails/StudentDetails.csv`; Trainner.yml real size shown (~48 MiB); run commands + real thresholds (LBPH conf < 70); hardcoded-login caveat noted without exposing credentials.
- **Features:** 3-step enrollment wizard with labeled demo progress ring, register with stamp toggles, mark-all-present, manual attendance entry, search, CSV export/copy, print view, localStorage persistence.
- **Limitations:** browser cannot capture/train; desktop CSV outputs still depend on repo's hardcoded absolute paths.
- **Status:** completed

### 10. helmet-seatbelt-violation-detection — Signal Control Room
- **Folder:** `helmet-seatbelt-violation-detection/`
- **Concept:** Traffic NOC: asphalt charcoal + signal colors, 2×2 camera wall with scanlines, mono incident IDs, signal-lamp gauges.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (Tkinter + SQLite + YOLOv8, weights absent). Role switcher mirrors Officer/Admin/Public chrome; real `violation_dict` schema displayed; yolov8x.pt absence + stub seatbelt/roundabout detectors stated honestly.
- **Features:** role gating, labeled demo incident feed with pulses, manual entry (localStorage, badged "Manual"), log filters, JSON/CSV export, admin stats bars, live clock.
- **Limitations:** no live camera/model in browser; demo + manual entries clearly badged.
- **Status:** completed

### 11. loan-default-prediction — Underwriting Desk
- **Folder:** `loan-default-prediction/`
- **Concept:** Bank ledger paper aesthetic; rubber-stamp verdict plate + semicircular risk dial + reason-code waterfall.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (legacy Python 2 CLI; metadata's "XGBoost/Streamlit" claim flagged as wrong in the About tab). Real `comb/comb1/comb2` coefficients from `models.py` drive live combo sliders; real P>0.6 decision cut mirrored.
- **Features:** single-case worksheet with validation, transparent demo scorecard ("Show formula"), portfolio ledger, batch CSV → histogram + submission-preview (`id,loss`), exports, Ctrl+Enter.
- **Limitations:** demo heuristic only — the trained GBM needs Kaggle CSVs + a Python 2 port.
- **Status:** completed

### 12. music-recommender-from-audio-features — Groove Observatory
- **Folder:** `music-recommender-from-audio-features/`
- **Concept:** Vinyl record-crate listening room; feature-derived sleeve gradients; Audio DNA comparison.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** **REAL client-side engine** — faithful JS port of the repo's algorithm (semicolon CSV parse incl. trailing-space columns, per-column min-max, cosine similarity) over the repo's real `data/best_songs_spotify_2000_2023.csv` (~2,300 songs).
- **Features:** artist typeahead, top-10 crate cards with similarity bars, expanded Audio DNA (raw + normalized), genre/year filters, top-20 artists chart, CSV/copy export, file:// fallback instructions.
- **Limitations:** requires an HTTP server to fetch the CSV (in-page instructions provided).
- **Status:** completed

### 13. plant-leaf-disease-detection-cnn — LeafLens (integrated redesign)
- **Folder:** `plant-leaf-disease-detection-cnn/`
- **Concept:** Botanical field-guide notebook (cream paper, forest greens, leaf SVGs) inside the existing Django shell.
- **Files:** modified `templates/base.html`, `templates/index.html` (backups `*.bak`); created `static/css/style.css`, `static/js/app.js`. Existing `/about` `/services` `/contact` links, `{% static %}` images and views untouched.
- **Backend integration:** Django routes preserved; **no prediction endpoint exists** — analyze flow shows the honest "requires CNN backend" panel (proposed POST /predict contract clearly marked "not implemented"), result frame watermarked "Preview layout — no model output"; 15-class list not invented (not stored in repo).
- **Features:** drag-drop preview, rotate/zoom, validation, 3-step pipeline explainer, sticky nav + hamburger, print/reduced-motion.
- **Limitations:** legacy `/action_page.php` demo form remains in untouched `contact.html`.
- **Status:** completed

### 14. question-paper-generator-from-syllabus — ExamForge (integrated redesign)
- **Folder:** `question-paper-generator-from-syllabus/`
- **Concept:** Bright examination-paper aesthetic (ink navy + exam red, ruled lines, OMR bubble motifs).
- **Files:** created `static/css/qp-style.css`, `static/js/qp-style.js`; fully redesigned `templates/index.html`; link/script injected into 8 flow templates (`select`, `next_step`, `recursive_prereq`, `review_questions`, `result`, `select_fib_topics`, `fib_results`, `svg_generator`). **9 backups** (`templates/*.html.bak`). Jinja tag counts verified identical to backups in all 9 files.
- **Backend integration:** **REAL (server-rendered)** — all form actions, field names, `url_for`, `textbooks_json | safe` preserved; generation still requires Ollama/llama3 (documented with real commands).
- **Features:** mode entry cards, flow stepper, requirements panel, JS progress indicator, selection counters, client validation (additive), auto copy-buttons, toasts.
- **Limitations:** non-core templates (e.g., `study_material`, `view_svg`) not restyled; other variants (`app_fib.py`, `app_last.py`) untouched.
- **Status:** completed

### 15. resume-screening-and-jd-matching — TalentMatch Lens
- **Folder:** `resume-screening-and-jd-matching/`
- **Concept:** Modern HR recruiting desk (indigo/coral, chip-heavy skill visualization).
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (Streamlit + MiniLM). Real repo sample JD loadable (`data/sample_job_description.txt`); real engine facts (384-dim MiniLM, spaCy, pdfplumber) + run command documented.
- **Features:** JD tabs (paste/file), editable skill chips, candidate CRUD with .txt FileReader parsing, **labeled browser demo heuristic** (token cosine + skill Jaccard), score rings, matched/missing/bonus chips mirroring `src/explainer.py` fields, threshold slider, compare, CSV export, localStorage.
- **Limitations:** demo scores differ from embedding-based results (stated in-UI); .pdf/.docx parsing requires the backend.
- **Status:** completed

### 16. retail-sales-forecasting — DemandSight
- **Folder:** `retail-sales-forecasting/`
- **Concept:** Executive retail command center (paper white + ink navy/teal, top filter ribbon, wide charts).
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** **REAL data, no forecast model exists** — full client-side quoted-CSV parser over the repo's real `dataset/Superstore.csv` (~10k rows).
- **Features:** live filters (date presets, region/category/segment), KPI strip (sales/profit/margin/orders/discount), monthly trend chart, category/region bars, sub-category profit divergences, sortable top-products table, filtered CSV export, insights copy.
- **Limitations:** Forecast tab honestly states no Prophet/ARIMA code exists in the repo; sparkline placeholders; Chart.js optional.
- **Status:** completed

### 17. sign-language-to-text-translation — SignBridge Studio
- **Folder:** `sign-language-to-text-translation/`
- **Concept:** Accessibility-first indigo/lime pipeline lab — five connected stations as the primary metaphor.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none (Python library + `slt` CLI). Real CLI commands, model-zoo enums (from `enums.py`) and asset system documented.
- **Features:** live tokenizer → gloss restructure (transparent demo rule set R1–R9, verified via node harness on 11 sentences) → sign mapping with demo lexicon cards → honest "requires library" synthesis stage; gloss .txt/.csv export; Urdu RTL input with limited-demo labeling.
- **Limitations:** gloss rules are an illustrative subset; sign clip assets download only inside the library.
- **Status:** completed

### 18. stock-price-trend-predictor — TrendCast
- **Folder:** `stock-price-trend-predictor/`
- **Concept:** Green-phosphor quant terminal (CRT scanlines, mono everything, NOT-FINANCIAL-ADVICE ticker).
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** **REAL data** — charts + client-side Pearson-r table computed over the repo's curated processed CSVs (`daily` 4,127 rows / `weekly` 855 rows); real feature-engineering function names from `build_features.py`; real Makefile targets (honest note: no `make train` exists).
- **Features:** daily/weekly switcher, real column chips, crosshair chart, target step-plot, raw preview, feature family catalog, 93 real keyword chips from `keywords.txt`, pipeline explainer, CSV download, tab hotkeys.
- **Limitations:** no model serving; Pearson only (matches notebooks); Chart.js optional.
- **Status:** completed

### 19. student-dropout-risk-prediction — DEWS
- **Folder:** `student-dropout-risk-prediction/`
- **Concept:** Civic education policy tool (slate guilloche header, dense register + side drawer) — action-oriented.
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new). Also repaired the clone: 33 tracked source files restored from git (working tree had been empty; 2 PNGs with `:` in filenames cannot exist on Windows and stay missing — pre-existing).
- **Backend integration:** none. Synthetic cohort (24 rows, clearly labeled); real pipeline architecture documented with real filenames (`db_creation/*.sql`, `pipeline/__*.py`); 7 real `graphs/*.png` rendered as thumbnails; states plainly there is no single run command.
- **Features:** risk register with filters/sort/search, drawer with factor bars + intervention CRUD (localStorage), **real precision@k/recall@k math** on demo scores vs capacity slider with canvas PR curve, CSV exports.
- **Limitations:** synthetic data only; no FERPA-approved handling; preview not a system of record.
- **Status:** completed

### 20. vehicle-number-plate-recognition — PlateSight
- **Folder:** `vehicle-number-plate-recognition/`
- **Concept:** Light British registry aesthetic (yellow number-plate masthead, ink type, inspection accents).
- **Files:** `index.html`, `css/style.css`, `js/app.js` (new).
- **Backend integration:** none REST (Streamlit in-process). Honest model facts from `app.py` (weights `model/last.pt` present, 14,378,245 bytes; conf 0.5; IoU 0.45; size 640; torch.hub load line shown); run command copyable.
- **Features:** drag-drop intake with preview, watermarked empty results frame (never fabricated detections), samples tab with all 7 real `uploads/` images + keyboard lightbox, about-model panel (Docker/Procfile, old-pin warnings), **explicit note that Tesseract OCR from metadata is not implemented — plates are detected, not read**.
- **Limitations:** inference only inside Streamlit; sample images load via HTTP server.
- **Status:** completed

---

## Cross-cutting notes

- **Existing frontends:** 4 projects had established frontends. `document-plagiarism-checker`, `plant-leaf-disease-detection-cnn` and `question-paper-generator-from-syllabus` were improved in place with backups (12 `.bak` files total) and byte-verified Jinja preservation; `emotion-detection-from-text-and-face`'s Next.js app was left untouched and the new vanilla UI lives in `webui/` to avoid conflict.
- **Honesty:** every model-dependent feature is labeled ("Requires backend", "Demo — not a model output", "Simulated", "Preview layout — no model output"). No API endpoints were invented; only verified real routes are called (`POST /predict` Flask, `GET /health` + `POST /predict` + `POST /predict-text` FastAPI, plus real form/HTML flows).
- **Data integrity:** `git status` verified per repo — only the intended new files (and, in 3 template projects, the documented template edits) exist. No README, license, backend, model, dataset, or metadata file was modified. One repair: missing source checkout in `student-dropout-risk-prediction` restored from its own git history.
- **Browser testing:** not performed (no browser automation available in this environment); all verification was static. Serving locally (e.g., `python -m http.server 8000` from a project folder) is recommended before use; `file://` limitations are handled in-page where relevant.
