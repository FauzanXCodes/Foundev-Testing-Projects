# ExamForge — AI Question Paper, OMR & FIB Generator

Folder id: `question-paper-generator-from-syllabus` · UI display name: **ExamForge**

ExamForge is a Flask application that builds school question papers from a real syllabus. It pulls
the live textbook catalogue from the Pragament public API, lets a teacher pick board / class /
subject / chapters / topics / subtopics, asks a local Ollama `llama2` model to identify prerequisite
chapters and to draft one MCQ per selected topic, verifies each answer with the model, and exports
the result as a PDF question paper, a CSV sheet, a prerequisite-tree PDF, a study-material PDF, or a
fill-in-the-blanks worksheet in student + answer-key flavours.

**What runs today:** the syllabus browser and chapter selection are fully functional — `GET /`
renders the 35 KB ExamForge UI and `POST /select` returns the real chapter structure for the
chosen board/class/subject.

**What needs one more thing:** every *generation* step (MCQs, FIB worksheets, study material,
SVG explanations, prerequisite detection) calls a **local Ollama service with the `llama2` model**.
Ollama and that model are **not installed on this machine**, so those routes return their handled
error messages instead of content. Everything else — the API integration, the caching layer, the PDF
writers, the OMR generator — is present and exercised.

---

## Features

### Implemented and verified

| Feature | Where | Status |
|---|---|---|
| Textbook catalogue home page populated from the live Pragament API | `app.py` → `index()`, `templates/index.html` | Implemented — `GET /` returns 200 (35 KB UI) |
| Board / class / subject selection, cascading in the browser from the fetched catalogue | `templates/index.html` (inline JS) | Implemented |
| Chapter / topic / subtopic tree for the selected subjects | `app.py` → `select()` | Implemented — `POST /select` (board=CBSE, class=10, subject=Mathematics) returns 200 with the real chapter structure (11.6 KB) |
| Textbook API cache + fallback list | `load_cached_textbooks()`, `save_cached_textbooks()`, `FALLBACK_TEXTBOOKS` | Implemented (`structured_data/textbook_cache.json`) |
| Subject/class normalisation (`maths`→`Mathematics`, `class 10`→`10`) | `normalize_subject()`, `normalize_class()` | Implemented |
| MCQ generation prompt, JSON parsing, model-based answer verification | `generate_questions()`, `verify_answer_with_models()` | Implemented — **requires Ollama + `llama2`** |
| PDF question paper (fpdf, DejaVuSans embedded) | `generate_pdf()` | Implemented — requires `fonts/DejaVuSans.ttf` |
| CSV export of the reviewed paper | `export_to_csv()` | Implemented |
| Prerequisite tree build + PDF export | `build_prerequisite_tree()`, `generate_prerequisite_pdf()` | Implemented — the *detection* step needs Ollama |
| Study material generation (12 content types) | `content_generate.generate_educational_content()` | Implemented — **requires Ollama** |
| Study material PDF | `generate_study_material_pdf()` | Implemented (falls back to Helvetica if the bold/italic fonts are missing) |
| Fill-in-the-blanks worksheet: student sheet with 9-box answer grid + answer key | `generate_fib_content()`, `generate_fib_pdf_v2()` | Implemented — **requires Ollama** |
| SVG diagram pipeline (Wikimedia Commons search → download → validate → enhance → AI explanation) | `fetch_topics()`, `process_topic()`, `enhance_svg()` | Implemented — the explanation step needs Ollama |
| OMR answer-sheet generator (standalone) | `omr_generator_app.py`, `omr_pdf.py` | Implemented, standalone app |
| Redesigned ExamForge UI with `.bak` backups of the originals | `templates/*.html`, `templates/*.html.bak` | Implemented |

### Not available / requires external setup

- **Ollama is not installed**, and the **`llama2` model is not pulled**. Every generation route
  (`/generate_questions`, `/generate_questions_from_direct`, `/run_fib_generation`,
  `/generate_study_material`, `/run_svg_generation*`, `/recursive_prereq`) depends on it.
- **`fonts/DejaVuSans-Bold.ttf` and `fonts/DejaVuSans-Oblique.ttf` are absent** (only
  `DejaVuSans.ttf` ships). `generate_study_material_pdf()` detects this and falls back to
  Helvetica; `generate_pdf()` requires the regular font and raises `FileNotFoundError` without it.
- **No `.env` file** and **no API key** — the textbook API is public and unauthenticated.
- **`requirements.txt` omits two imports the app makes:** `ollama` and `tenacity`. Both are
  installed in the bundled `.venv` (see [Installation](#installation)).
- The upstream README mentions **LLaMA 3**; the code calls **`llama2`** everywhere. The code wins.

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Web framework | Flask 3.1.3 | `app.py`, `app.run(debug=True)` → http://127.0.0.1:5000 |
| Templates | Jinja2 3.1.6 | `templates/*.html` (server-rendered) |
| PDF generation | fpdf 1.7.2 (question paper, study material) + reportlab 5.0.1 (prerequisite tree, FIB worksheets) | Fonts from `fonts/` |
| Images | Pillow 13.0.0 | Marker image for the OMR/FIB corners |
| HTTP client | requests 2.34.2 | Pragament API, GitHub API, Wikimedia API |
| LLM runtime | `ollama` 0.6.3 (Python client) + the `ollama` CLI via `subprocess` | Model: **`llama2`** |
| Retry/backoff | tenacity 9.2.1 | `@retry` on the GitHub/raw fetch helpers |
| Config | python-dotenv 1.2.4 | `.env` support (no `.env` shipped) |
| UI | Vanilla HTML/CSS/JS, no framework | `templates/` + `static/css/qp-style.css`, `static/js/qp-style.js` |
| Python | 3.12.1 | |

---

## Prerequisites

- **Windows 10/11** with PowerShell 5.1+ (Linux/macOS variants noted below).
- **Python 3.12.1** on `PATH`.
- **Internet access** for the Pragament textbook API, the GitHub topics API and Wikimedia Commons.
- **[Ollama](https://ollama.com/) with the `llama2` model — optional but required for every
  generation feature.** This is an external service the project does not bundle:
  `ollama pull llama2`, and the Ollama server must be running (`ollama serve`).
- No Node.js is required — Flask serves the templates and `static/`.

---

## Project Structure

```
question-paper-generator-from-syllabus/
├── app.py                    # MAIN APP — Flask, all routes, PDF writers, Ollama calls (2790 lines)
├── config.py                 # Path/API constants, all overridable via environment variables
├── content_generate.py       # Study-material generation: 12 content types via Ollama
├── generator.py              # Standalone FIB helpers: generate_fib_content / generate_fib_pdf / draw_markers
├── utils.py                  # Helper library: chapter structuring, PDF/DOCX writers, prereq tree
├── svg.py                    # Standalone SVG pipeline script (search → download → enhance → explain)
├── omr_pdf.py                # class OMRGenerator(FPDF) — bubble-sheet PDF builder
├── OMR_Template.py           # PDF→image→template.json pipeline for OMR scoring
├── fib_app.py                # Standalone minimal FIB Flask app (uses generator.py)
├── omr_generator_app.py      # Standalone OMR Flask app (inline HTML form, returns PDF)
├── app_fib.py                # Earlier standalone FIB Flask app snapshot
├── app_last.py               # Earlier snapshot of the main app (2079 lines)
├── app_test.py               # Earlier snapshot of the main app (2370 lines)
├── app-test.py               # Early minimal prototype (301 lines)
├── requirements.txt          # flask, fpdf, requests, python-dotenv, Pillow, reportlab
│                             #   ⚠ MISSING: ollama, tenacity
├── templates/                # Jinja templates (redesigned; originals kept as *.html.bak)
│   ├── index.html            # ExamForge home: mode cards + syllabus selection form
│   ├── select.html           # Chapter/topic tree for the chosen subjects
│   ├── show_selected_chapters.html, next_step.html, recursive_prereq.html
│   ├── review_questions.html # Review + select questions, then finalise
│   ├── result.html           # Final paper + PDF download
│   ├── select_fib_topics.html, fib_results.html
│   ├── study_material.html, svg_generator.html, svg_results.html, view_svg.html
│   ├── tree_checkbox.html, select_prereq.html
│   └── *.html.bak            # Backups of the original templates
├── static/
│   ├── css/qp-style.css      # ExamForge stylesheet
│   ├── js/qp-style.js        # ExamForge behaviour
│   ├── img1.jpg              # Corner marker image stamped on FIB worksheets
│   └── svgs/                 # Generated + placeholder SVGs and *_explanation.md files
├── fonts/
│   ├── DejaVuSans.ttf        # REQUIRED by generate_pdf() — present
│   ├── DejaVuSans.pkl, DejaVuSans.cw127.pkl
│   └── (DejaVuSans-Bold.ttf, DejaVuSans-Oblique.ttf are MISSING — optional, code falls back)
├── structured_data/          # Working state written by the app
│   ├── list_of_all_chapters_for_selected_class.json
│   └── textbook_cache.json
├── textbook_content/         # Generated PDFs + content_<timestamp>/ JSON folders
├── Sample/                   # omr_sheet.pdf, template.json, converted_omr.png, marker.png
├── flask_app_installer/      # PyInstaller/NSIS packaging: build_exe.py, installer_script.nsi, setup/
├── LICENSE                   # AGPL-3.0
├── project-metadata.json     # Upstream catalogue metadata (entry: app_fib.py)
└── .venv/                    # Pre-created virtualenv (Python 3.12.1, Flask + ollama + tenacity + …)
```

Runtime-generated paths the code expects (relative to the project root, so **always run Flask from
this folder**): `structured_data/`, `textbook_content/`, `static/svgs/`, `paper.json`, `Question.pdf`.

---

## Installation

A `.venv` with every dependency — including the two missing from `requirements.txt` — is already
present:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\question-paper-generator-from-syllabus"
.\.venv\Scripts\Activate.ps1
```

Verify:

```powershell
python -c "import sys, flask, ollama, tenacity, fpdf, reportlab, requests; print(sys.version); print('flask', flask.__version__); print('ollama', ollama.__version__ if hasattr(ollama,'__version__') else 'ok'); print('tenacity', tenacity.__version__)"
```

Expected: Python `3.12.1`, Flask `3.1.3`, tenacity `9.2.1`, and the `ollama` client importable.

If you need to rebuild it, install **`requirements.txt` plus the two missing packages**:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\question-paper-generator-from-syllabus"
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install ollama tenacity      # required by app.py, absent from requirements.txt
```

Optional — Ollama with the model the code expects:

```powershell
winget install Ollama.Ollama     # or download the installer from https://ollama.com/
ollama pull llama2               # the code calls model="llama2" everywhere
ollama serve                     # leave running in a separate terminal
```

Linux / macOS equivalent:

```bash
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\question-paper-generator-from-syllabus"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install ollama tenacity
ollama pull llama2
```

---

## Environment Configuration

`config.py` is the single place where paths and the API URL are defined, and every value is
overridable by an environment variable:

| Variable | Default (in `config.py`) | Used for |
|---|---|---|
| `TEXTBOOKS_API` | `https://staticapis.pragament.com/textbooks/allbooks.json` | The book catalogue |
| `DATA_DIR` | `structured_data` | Working JSON state folder |
| `TEXTBOOK_PAGES_DIR` | `textbook_pages` | Reserved; not read elsewhere in `app.py` |
| `FONTS_DIR` | `fonts` | Font folder constant |
| `CONTENT_DIR` | `textbook_content` | Where generated study material / FIB PDFs are written |
| `TEXT_LIMIT` | `3000` | Word limit passed to the Ollama study-material prompts |

> **Important nuance.** `app.py` imports `TEXTBOOKS_API` from `config.py` (line 22) but then
> **re-assigns it on line 54** to the hard-coded
> `https://staticapis.pragament.com/textbooks/allbooks.json`. The environment variable therefore has
> **no effect inside `app.py`** — only the other five variables are honoured. The other five are
> read at import time, so they must be set **before** the app starts.

Example (PowerShell):

```powershell
$env:CONTENT_DIR = "textbook_content"
$env:DATA_DIR    = "structured_data"
$env:TEXT_LIMIT  = "3000"
```

There is **no `.env` file** in the repository. `python-dotenv` is installed but `app.py` never calls
`load_dotenv()`, so a `.env` would not be picked up automatically — use real environment variables
or edit `config.py`.

No API key or token is required anywhere.

---

## How to Launch

The main entry point is **`app.py`**. It calls `app.run(debug=True)`, which serves on
**http://127.0.0.1:5000**.

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\question-paper-generator-from-syllabus"
.\.venv\Scripts\Activate.ps1
python app.py
```

Open **http://127.0.0.1:5000/**.

Verified behaviour:

| Request | Result |
|---|---|
| `GET /` | **200** — 35 KB ExamForge UI; the page fetches the external textbook catalogue from `staticapis.pragament.com` |
| `POST /select` with `board=CBSE`, `class=10`, `subject=Mathematics` | **200** — 11.6 KB page with the real chapter/topic/subtopic structure |

**The frontend and the backend are the same Flask process.** The templates are server-rendered and
`static/` is served by Flask itself, so there is no separate static server and no CORS setup.

Flask's reloader will restart on code changes (`debug=True`).

**To stop:** press `Ctrl+C` in the terminal running `app.py`.

### Standalone companion apps

Two smaller Flask apps live in the same folder. They are **alternatives**, not part of the main
flow, and each also uses port 5000 — run them one at a time.

```powershell
python omr_generator_app.py   # OMR sheet generator; POST / returns the PDF inline
python fib_app.py             # minimal FIB generator; needs templates/fib_index.html (not shipped)
```

`fib_app.py` renders `fib_index.html` / `ifib_index.html`, which are **not present** in
`templates/` — that script will fail with `TemplateNotFound` until those templates are added.
`omr_generator_app.py` needs no template at all (it uses an inline HTML string) and works.

Linux / macOS equivalent:

```bash
source .venv/bin/activate
python app.py
```

---

## Model and Dataset Setup

### What exists in the repository

- **No trained model ships with this project.** ExamForge uses a **general-purpose LLM served
  locally by Ollama**, not a project-specific fine-tuned model.
- `fonts/DejaVuSans.ttf` — the TrueType font `generate_pdf()` embeds (required for the question
  paper PDF; `pdf.add_font("DejaVu", "", font_path, uni=True)`).
- `static/img1.jpg` — the corner marker image stamped onto FIB worksheets via
  `generate_fib_pdf_v2(..., marker_path=...)`.
- `static/svgs/` — previously generated diagrams, their `_placeholder.svg` variants and the
  `_explanation.md` files produced by the LLM.
- `structured_data/textbook_cache.json` — cached copy of the catalogue response.
- `structured_data/list_of_all_chapters_for_selected_class.json` — the chapter tree for the last
  selection.
- `textbook_content/` — previously generated study-material PDFs and `content_<timestamp>/`
  folders holding `chaptersummaries1.json`, `definitionbank1.json`, `formulasheet1.json`,
  `importantpoints1.json`, `solvedexamples2.json`, …
- `Sample/omr_sheet.pdf`, `Sample/template.json`, `Sample/converted_omr.png`, `Sample/marker.png` —
  OMR samples.

### What is missing, and where the code expects it

| Missing item | Where the code expects it | Consequence |
|---|---|---|
| **Ollama service** | `subprocess.run(["ollama", "run", "llama2"], …)` and `ollama.chat(model="llama2", …)` | Every generation route fails with a handled error |
| **`llama2` model** | Same calls | Same as above |
| `fonts/DejaVuSans-Bold.ttf` | `generate_study_material_pdf()` → `bold_font_path` | Logged warning; regular font used for bold |
| `fonts/DejaVuSans-Oblique.ttf` | `generate_study_material_pdf()` → `italic_font_path` | Logged warning; regular font used for italic |
| `templates/fib_index.html`, `templates/ifib_index.html` | `fib_app.py` | `fib_app.py` raises `TemplateNotFound` |
| `.env` | — | Not used; `load_dotenv()` is never called |

### Bringing generation online

```powershell
ollama pull llama2
ollama serve          # keep running
```

Then re-run the generation flows. `content_generate.generate_educational_content()` first calls
`ollama.list()` and returns `([], "Ollama service unavailable: …")` if the daemon is not reachable,
so the failure is reported cleanly in the UI rather than as a stack trace.

---

## Usage

### A. Browse the syllabus (works today, no Ollama needed)

1. Start the app (`python app.py`) and open **http://127.0.0.1:5000/**.
2. The ExamForge home offers two modes: **Question Paper Generator** and
   **Fill-in-the-Blanks Worksheet**.
3. In **"Select Board, Class, Subject"**:
   - **Board:** choose e.g. `CBSE`.
   - **Class:** choose e.g. `10`.
   - **Subject:** the subject list narrows automatically to the books matching that board and class
     (the browser filters the catalogue fetched from the API).
4. Press **Start selection**.
5. `POST /select` runs on the server: it looks up the matching book, fetches
   `https://staticapis.pragament.com/textbooks/page_attributes/<book_id>.json`, splits the payload
   into `chapter` / `topic` / `subtopic` records by `type`, sorts them by `order`, attaches subtopics
   to topics by numeric prefix (`1.2` → parent `1`), attaches topics to chapters by prefix, and
   writes `structured_data/list_of_all_chapters_for_selected_class.json`.
6. You get the real chapter/topic/subtopic tree. Selecting a chapter that does not exist for the
   subject produces an inline error message.

### B. Generate a question paper (needs Ollama + `llama2`)

1. From the chapter tree, choose **"Generate directly"** (no prerequisites) or **"Include
   prerequisites"**.
2. **Direct path:** `/generate_questions_no_prereq` → `/generate_questions_directly` →
   `/generate_questions_from_direct`. The app builds a `system_prompt` that demands strict JSON with
   `question`, four `options`, `correct_option`, and the metadata, then calls
   `ollama run llama2` per class+subject group with a 300 s timeout.
3. **Prerequisite path:** `/generate` → `/recursive_prereq/<level>` (levels 1…3). For each selected
   chapter the app asks `llama2` which chapters of the previous class are prerequisites (with a
   `reason` and a `for` target), and you confirm them in the UI.
4. **Verification:** `verify_answer_with_models()` re-asks `llama2` for the option number only and
   sets `verified: True` only when at least two model answers agree (with a single model in the
   `models` list, the ≥2 rule means a question is marked *not* verified).
5. **Review & finalise:** `/finalize_questions` writes `paper.json`, regenerates `Question.pdf`, and
   renders `result.html`.
6. **Export:** `/download_pdf` sends `Question.pdf`; `/export_to_csv` sends `Questions.csv` with the
   columns Rank-less metadata: Class, Subject, Chapter, Topic, Subtopic, Question, Option 1–4,
   Correct Option, Verified, Model Responses.
7. **Prerequisite tree PDF:** `/download_prereqs` sends `Prerequisite_Tree.pdf`.
8. **Study material:** `/generate_study_material` produces 12 content types per chapter (Chapter
   Summaries, Important Points, Definition Bank, Formula Sheet, Concept Explanation, Solved
   Examples, Practice Questions, Quiz Creation, Fill in the Blanks, True/False, HOTS, Real Life
   Applications) into `textbook_content/content_<timestamp>/` and renders a combined PDF.
9. **SVG diagrams:** `/svg_generator` → `/run_svg_generation` (topic list from the Pragament GitHub
   repo) or `/run_svg_generation_from_chapters` (topics from your selection) → `/svg_results` →
   `/view_svg/<topic>`. Each SVG is searched on Wikimedia Commons, downloaded, validated to start
   with `<svg`, enhanced with a `<title>`, `data-map-type`/`data-zoom-level`/`data-topic` attributes
   and a Dublin Core `<metadata>` block, then explained by `llama2`.

### C. Fill-in-the-blanks worksheet (needs Ollama + `llama2`)

1. From the selection page choose the FIB mode → `/select_fib_topics` (posts your selected chapters,
   reads the saved chapter JSON).
2. Pick a topic/subtopic → `/run_fib_generation` calls `generate_fib_content()`, which asks
   `llama2` for a 100–150 word paragraph, 8 single-word concepts of **9 letters or fewer**, the
   matching word bank, 8 statement-style questions with `______` blanks, and the 8 answers — all as
   one JSON object. `sanitize_ollama_json()` repairs trailing commas and malformed `"answers"`
   blocks before `json.loads`.
3. Two PDFs are written to `textbook_content/`:
   - **Student sheet** — bordered instruction box, admission-number/name/class/section/date boxes,
     the paragraph, an uppercased answer bank, and one row per question with **9 letter boxes**
     (0.5 cm each) aligned to the right, plus corner markers from `static/img1.jpg`.
   - **Answer key** — the same paragraph and word bank, the questions, and a numbered answer list.
4. Download them via `/download_fib/`.

### D. OMR sheet (no Ollama needed)

```powershell
python omr_generator_app.py
```

Open http://127.0.0.1:5000/, enter question counts per subject (Mathematics-1, Mathematics-2,
Physics, Chemistry, MAT), press **Generate OMR Sheet**, and the response is a ready-to-print
bubble sheet PDF. `OMRGenerator(FPDF)` builds it.

---

## API Documentation

All routes are defined in `app.py` (plus the two standalone apps). Methods, paths, request fields
and responses are taken directly from the decorators and handlers.

### Main app (`app.py`)

| Method | Path | Function | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/` | `index` | — | `200` HTML — `templates/index.html` with `textbooks` (list) and `textbooks_json` | 200 with an empty list if the API is unreachable |
| POST | `/select` | `select` | form: `board`, `class`, `subject` (repeated) | `200` HTML — `templates/select.html` with `subject_chapter_map`, `errors` | Inline `errors` list for "no matching textbook" / "no valid chapters" |
| POST | `/generate_questions_no_prereq` | `generate_questions_no_prereq` | form: `chapters` (repeated, `name|class|subject`), `class`, `subject` | `200` HTML — `templates/show_selected_chapters.html` | Inline errors when the saved chapter JSON is missing |
| POST | `/generate_questions_directly` | `generate_questions_directly` | form: `selected_chapters`, `selected_topics`, `selected_subtopics`, `show_metadata` | `302` → `/generate_questions_from_direct` | Writes `structured_data/prepared_selected_data_direct.json` first |
| GET | `/generate_questions_from_direct` | `generate_questions_from_direct` | query: `show_metadata=on` | `200` HTML — `templates/review_questions.html` | `200` text `"Error: prepared_selected_data_direct.json not found."`; `"Error: No questions generated."` when Ollama is absent |
| POST | `/generate` | `generate` | form: `board`, `class`, `subject`, `chapters` | `302` → `/recursive_prereq/1` | — |
| GET/POST | `/recursive_prereq/<int:level>` | `recursive_prereq` | form: `selected_prereq_combined`, `selected_prereq_topic`, `selected_prereq_subtopic` | `200` HTML — `templates/recursive_prereq.html`; at level > 3 → `templates/next_step.html` | Levels above 3 render the final tree page; Ollama failures are logged and skipped |
| POST | `/prepare_selected_data` | `prepare_selected_data` | form: `selected_prereq_chapter`, `selected_topics`, `selected_subtopics`, `show_metadata` | `302` → `/generate_questions` | — |
| GET | `/download_prereqs` | `download_prereqs` | — | `200` `application/pdf` — `Prerequisite_Tree.pdf` | `404` `"Prerequisite tree not found"` |
| GET | `/generate_questions` | `generate_questions` | query: `show_metadata=on` | `200` HTML — `templates/review_questions.html`; writes `paper.json` + `Question.pdf` | `"Error: prepared_selected_data.json not found."`; `"Error: No questions generated."` |
| POST | `/finalize_questions` | `finalize_questions` | form: `selected_indexes` (repeated), `all_questions_json` | `200` HTML — `templates/result.html` | `"No questions selected."` when the list is empty |
| GET | `/download_pdf` | `download_pdf` | — | `200` `application/pdf` — `Question.pdf` | `"Error: No questions available."` / exception text |
| POST | `/finalize_prereq` | `finalize_prereq` | form: `selected_prereq_topic`, `selected_prereq_subtopic` | `302` → `/generate_questions` | `"Error: Please select at least one prerequisite topic or subtopic."` |
| GET | `/export_to_csv` | `export_to_csv` | — | `200` `text/csv` — `Questions.csv` | `400` `"Error: No questions available."`; `404` `"Error: Question data not found."`; `500` on other exceptions |
| POST | `/generate_study_material` | `generate_study_material` | form: `board`, `class`, `subject`, `chapters`, `content_types` | `200` HTML — `templates/study_material.html` with `pdf_code`, `pdf_filename`, `errors` | Inline errors; no PDF when Ollama is unavailable |
| GET | `/download_study_material/` | `download_study_material` | — | `200` `application/pdf` from `CONTENT_DIR` | Re-renders `study_material.html` with a "file not found" error |
| GET | `/svg_generator` | `svg_generator` | — | `200` HTML — `templates/svg_generator.html` | — |
| POST | `/run_svg_generation` | `run_svg_generation` | — | `302` → `/svg_results` | `500` `"An error occurred during SVG generation. Check the logs for details."` |
| POST | `/run_svg_generation_from_chapters` | `run_svg_generation_from_chapters` | form: `chapters` | `302` → `/svg_results` | `400` `"Error: No chapters selected."` / `"No topics found in the selected chapters."`; `500` when the chapter JSON is missing |
| GET | `/svg_results` | `svg_results` | — | `200` HTML — `templates/svg_results.html` with `items` from the session | — |
| GET | `/view_svg/<topic>` | `view_svg` | — | `200` HTML — `templates/view_svg.html` with `svg_content` and `explanation_content` | Renders a "SVG file not found." placeholder instead of failing |
| POST | `/select_fib_topics` | `select_fib_topics` | form: `chapters` | `200` HTML — `templates/select_fib_topics.html` | Flash message + redirect when no chapter is selected or the saved JSON is missing |
| POST | `/run_fib_generation` | `run_fib_generation` | form: `fib_selection` = `subject\|chapter\|topic\|subtopic` | `200` HTML — `templates/fib_results.html` with `success`, `student_pdf`, `answer_pdf` | Flash message for a malformed selection; `success=False` page when the model fails or the marker image is missing |
| GET | `/download_fib/<path:filename>` | `download_fib` | — | `200` `application/pdf` from `CONTENT_DIR` | 404 from `send_from_directory` |

### Standalone OMR app (`omr_generator_app.py`)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/` | — | `200` HTML form (inline `FORM_HTML`) | — |
| POST | `/` | form: `math1`, `math2`, `physics`, `chemistry`, `mat` (integers) | `200` `application/pdf` — the OMR sheet, `Content-Disposition: attachment;filename=omr_sheet.pdf` | `400` `"Please enter at least one question."` / `"Invalid input."` |

### Standalone FIB app (`fib_app.py`)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/` | — | `200` HTML — `templates/fib_index.html` | **`TemplateNotFound`** — that template is not shipped |
| POST | `/` | form: `subject`, `chapter`, `topic`, `subtopic` | `200` HTML — `templates/ifib_index.html` | Same template problem; PDFs land in `generated_pdfs/` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'ollama'` | `requirements.txt` omits `ollama` | `pip install ollama tenacity` |
| `ModuleNotFoundError: No module named 'tenacity'` | Same gap | `pip install tenacity` |
| "Ollama service unavailable" on study material | Ollama daemon not running | `ollama serve`, then `ollama pull llama2` |
| "Error: No questions generated." | `ollama run llama2` produced nothing (no model, or non-JSON output) | Check `ollama list`; the model must be named **`llama2`** |
| "The AI model returned a malformed JSON object that could not be repaired." | `sanitize_ollama_json()` could not fix the reply | Re-run; a smaller/simpler topic often parses cleanly |
| `FileNotFoundError: Font file not found at fonts/DejaVuSans.ttf` | Running from the wrong directory, or the font is missing | `cd` to the project root; `fonts/DejaVuSans.ttf` ships with the repo |
| `Port 5000 is already in use` | Another app (or the OMR/FIB companion) is running | Stop the other process, or run the main app with `flask --app app run --port 5001` |
| Every generated question shows "Not Verified" | `verify_answer_with_models()` requires ≥2 agreeing model answers but the list has one model | Expected behaviour of the current code; the `verified` flag stays `False` |
| `TemplateNotFound: fib_index.html` | Running `fib_app.py` | Use `app.py` (main app) or add the missing templates |
| The board/class dropdowns are empty | The Pragament API was unreachable | Check internet access; the catalogue is cached in `structured_data/textbook_cache.json` and falls back to `FALLBACK_TEXTBOOKS` |
| Study-material PDF uses the wrong typeface | Bold/italic DejaVu fonts are absent | Expected — the code logs a warning and falls back to Helvetica |
| `structured_data/` files look stale | State persists between runs | Delete `structured_data/*.json` and re-run the selection step |

---

## Limitations

- **No LLM available out of the box.** Generation features require a local Ollama with `llama2`.
- **Single-model verification.** `verify_answer_with_models()` declares a question verified only
  when two or more model answers agree, but `models = ["llama2"]` contains one model, so nothing is
  ever marked verified.
- **The `.env` mechanism is unused.** `python-dotenv` is installed but `load_dotenv()` is never
  called, and `TEXTBOOKS_API` is overwritten in `app.py` anyway.
- **Font coverage is partial.** Only `DejaVuSans.ttf` ships; bold and italic variants are missing.
- **Heavy duplication.** `app.py`, `app_last.py`, `app_test.py`, `app-test.py`, `app_fib.py` and
  `fib_app.py` are overlapping snapshots of the same application. Only `app.py` is the live entry
  point; the others are historical and can drift.
- **State lives on disk.** `structured_data/*.json`, `paper.json` and `Question.pdf` are shared
  global files — two concurrent users would overwrite each other.
- **No authentication, no multi-user isolation, no rate limiting.**
- **External API dependency.** The syllabus comes from a third-party public API; if it changes
  shape, chapter parsing breaks.
- **`app.secret_key = os.urandom(24)`** is regenerated on every start, so sessions (flash messages,
  `processed_svgs`) do not survive a restart.
- **No tests** are shipped.
- **AGPL-3.0** licensing has obligations if you modify and redistribute the application.

---

## License and Credits

**Upstream project:** GNU Affero General Public License v3.0 (`LICENSE`).
Upstream repository: `https://github.com/Gautam4620/python_flask_ai_question_paper_generator`
(`project-metadata.json` → `repository`). The original Flask application, the templates, the PDF
writers, the OMR generator and the `flask_app_installer/` packaging are covered by the AGPL-3.0.

**Added later:** the ExamForge UI redesign (`templates/index.html` and the other redesigned
templates), the `*.html.bak` backups preserving the original templates, and this
`README.md` / `PROJECT_OVERVIEW.md`. These are presentation and documentation layers on top of the
upstream code; **ownership of the original AGPL-licensed code is not claimed here**.

**Third-party services and assets:**

| Item | Role | Terms |
|---|---|---|
| `staticapis.pragament.com` | Public textbook catalogue and page attributes | Public, unauthenticated API |
| `api.github.com` / `raw.githubusercontent.com` (Pragament `json_data` repo) | Topic list for the SVG generator | Public API, rate-limited (the code handles 403/429 with `tenacity` backoff) |
| `commons.wikimedia.org` | SVG diagram search and download | Wikimedia Commons content is separately licensed per file |
| Ollama / `llama2` | Local LLM for generation | Downloaded separately; not redistributed here |
| `fonts/DejaVuSans.ttf` | PDF typography | DejaVu Fonts licence (Bitstream Vera / public-domain derived) |
