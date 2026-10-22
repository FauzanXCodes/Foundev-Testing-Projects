# ExamForge — Project Overview

Folder id: `question-paper-generator-from-syllabus` · UI display name: **ExamForge**

---

## 1. Project Summary

ExamForge is a Flask web application that turns a school syllabus into ready-to-print teaching
material. A teacher picks board, class and subject; the app fetches the real textbook catalogue
from a public API, resolves the chapter / topic / subtopic tree, and then uses a **local Ollama
`llama2` model** to identify prerequisite chapters, draft one multiple-choice question per topic,
verify the answers, and export the result as a PDF question paper, a CSV sheet, a prerequisite-tree
PDF, a study-material PDF, a fill-in-the-blanks worksheet (student sheet + answer key) or an SVG
diagram set with AI explanations. A separate OMR sheet generator and a set of SVG/OMR helper scripts
round out the toolset.

The project is an evolution of the upstream Flask application
`Gautam4620/python_flask_ai_question_paper_generator` (AGPL-3.0). The upstream code — routes,
PDF writers, the OMR generator, the packaging folder — is retained; the visible change is the
**ExamForge UI redesign** across the templates plus a documentation layer.

**Current state:** the syllabus half of the product is live and verified (`GET /` and `POST /select`
both return 200 against the real external API). The generation half is implemented in code but
**cannot run on this machine** because Ollama and the `llama2` model are not installed.

---

## 2. Problem Statement

A teacher preparing a chapter test faces three recurring problems:

1. **Syllabus alignment.** The chapter/topic structure must match the specific board, class and
   subject book — generic AI output usually drifts away from the prescribed syllabus.
2. **Prerequisite depth.** Students often lack the concepts from earlier chapters that the current
   topic depends on, and identifying that chain by hand is slow.
3. **Assembly overhead.** Turning AI output into a printable paper, a student worksheet, an answer
   key, an OMR sheet and a diagram set means reformatting the same content five different ways.

ExamForge targets all three: the structure comes from the real textbook catalogue rather than from
the model, prerequisites are surfaced explicitly and can be confirmed by the teacher, and one
generation pass is rendered into every output format the class actually needs.

---

## 3. Proposed Solution

**Syllabus first, model second.** The chapter tree is never generated — it is *fetched* from
`https://staticapis.pragament.com/textbooks/allbooks.json` and then
`https://staticapis.pragament.com/textbooks/page_attributes/<book_id>.json`, and parsed by
`type` into chapters, topics and subtopics. The LLM is only asked to work *inside* that structure.

**A guided pipeline instead of a chat box.** The UI walks the teacher through: select → choose
chapters → optional prerequisite detection → generate → review and deselect → finalise → export.
Each step is a distinct Flask route with server-side state in `structured_data/*.json`.

**One prompt, many renderings.** A single generated question set is reused for the review screen,
the PDF paper, the CSV export and the prerequisite tree. The fill-in-the-blanks flow has its own
prompt that asks for a paragraph plus an answer bank, and the study-material flow asks for 12
content types in one JSON object.

**Graceful degradation.** When Ollama is unreachable the app does not crash — `content_generate`
returns `([], "Ollama service unavailable: …")`, the question routes render "Error: No questions
generated.", and the FIB route renders a `success=False` page. The syllabus half keeps working.

---

## 4. Features and Capabilities

**Syllabus browser**
- Board / class / subject selection driven by the live catalogue.
- Real chapter → topic → subtopic tree, cached to
  `structured_data/list_of_all_chapters_for_selected_class.json`.
- Subject and class normalisation (`maths` → `Mathematics`, `class 10` → `10`).
- Offline fallback list (`FALLBACK_TEXTBOOKS`) and a cached catalogue.

**Question generation**
- One MCQ per selected topic/subtopic, generated in class+subject groups.
- Strict-JSON prompt with `question`, four `options`, `correct_option` and metadata.
- `sanitize_ollama_json()` repairs trailing commas and malformed `answers` blocks.
- Model-based answer verification requiring agreement between at least two model answers.
- Teacher review screen: deselect individual questions, then finalise.

**Exports**
- `Question.pdf` (fpdf, DejaVuSans embedded).
- `Questions.csv` (class, subject, chapter, topic, subtopic, question, four options, correct
  option, verified flag, model responses).
- `Prerequisite_Tree.pdf` (reportlab, hierarchical tree).
- Study-material PDF covering 12 content types per chapter.
- FIB worksheet PDF + answer key PDF with 9-box answer grids and corner markers.
- SVG diagram set with AI explanations, served from `static/svgs/`.

**Prerequisite detection**
- Levels 1–3 recursion asking `llama2` which earlier chapters are prerequisites, each with a
  reason and a target; teacher confirms before inclusion.

**OMR**
- Standalone `omr_generator_app.py` producing a printable bubble sheet for Mathematics-1,
  Mathematics-2, Physics, Chemistry and MAT.

**Supporting tooling**
- `OMR_Template.py` (PDF → image → `template.json` pipeline for OMR scoring).
- `svg.py` standalone diagram script.
- `flask_app_installer/` (PyInstaller + NSIS) for a Windows installer build.

---

## 5. System Architecture

```
                    ┌──────────────────────────────────────────────┐
   Teacher's        │            Flask process (app.py)            │
   browser  ◄─────►│  routes → prompts → model calls → renderers │
                    └───┬──────────────┬──────────────┬───────────┘
                        │              │              │
            ┌───────────▼───┐   ┌──────▼──────┐  ┌────▼─────────────┐
            │ Pragament API │   │  Ollama     │  │  Filesystem      │
            │ allbooks.json │   │  (llama2)   │  │  structured_data │
            │ page_attr.json│   │  CLI + SDK  │  │  textbook_content│
            └───────────────┘   └─────────────┘  │  static/svgs     │
                                                 │  paper.json      │
        ┌────────────────────────────────────────┴─────────────────┐
        │  renderers: fpdf (paper, study material)                 │
        │            reportlab (prereq tree, FIB)                  │
        │            Pillow (corner markers)                       │
        └──────────────────────────────────────────────────────────┘
```

**Layers**

| Layer | Modules | Responsibility |
|---|---|---|
| Presentation | `templates/*.html`, `static/css/qp-style.css`, `static/js/qp-style.js` | ExamForge UI, mode cards, selection form, chapter tree, review screen, results |
| Routing / orchestration | `app.py` (2790 lines) | 28 routes, prompt construction, model invocation, PDF assembly, session state |
| Configuration | `config.py` | Paths and the API base URL, each overridable by an environment variable |
| Content generation | `content_generate.py` | 12 study-material content types, one JSON object per chapter |
| Reusable generators | `generator.py`, `utils.py`, `omr_pdf.py`, `OMR_Template.py`, `svg.py` | FIB content + worksheet builder, PDF/DOCX writers, prerequisite tree, OMR sheet, SVG pipeline |
| External services | Pragament API, GitHub `json_data`, Wikimedia Commons, Ollama | Catalogue, topic lists, diagrams, LLM |
| Companion apps | `fib_app.py`, `omr_generator_app.py` | Standalone FIB and OMR Flask apps on the same port |
| History / packaging | `app_last.py`, `app_test.py`, `app-test.py`, `app_fib.py`, `flask_app_installer/` | Earlier snapshots and the Windows installer build |

---

## 6. Complete Project Workflow

**Step 1 — Home.** `GET /` renders `templates/index.html`. `load_cached_textbooks()` fetches
`allbooks.json` (with the cached copy in `structured_data/textbook_cache.json` and
`FALLBACK_TEXTBOOKS` as a last resort), then hands the catalogue to the template as `textbooks` and
`textbooks_json`.

**Step 2 — Select.** The browser posts `board`, `class`, `subject` to `/select`. The server
normalises the values, finds the matching book, fetches `page_attributes/<book_id>.json`, and splits
the payload by `type` into `chapter`, `topic` and `subtopic` records, sorting each by `order`.
Subtopics attach to topics by numeric prefix (`1.2` → parent `1`); topics attach to chapters by
prefix. The result is saved to
`structured_data/list_of_all_chapters_for_selected_class.json` and rendered by
`templates/select.html` as `subject_chapter_map`.

**Step 3 — Choose mode.** Direct generation (`/generate_questions_no_prereq`) or prerequisite-aware
generation (`/generate`).

**Step 4 — Prerequisites (optional).** `/recursive_prereq/<level>` for levels 1–3 asks `llama2`
which chapters of the previous class are prerequisites (with `reason` and `for`); the teacher
confirms them; `/prepare_selected_data` persists the selection.

**Step 5 — Generate.** For each class+subject group, `generate_questions()` composes a
`system_prompt` demanding strict JSON, runs `ollama run llama2` with a 300 s timeout, parses the
reply, and appends the question plus metadata to the set.
`verify_answer_with_models()` then re-asks the model for the option number and sets
`verified: True` only when at least two model answers agree.

**Step 6 — Review.** `/generate_questions_from_direct` or `/generate_questions` renders
`templates/review_questions.html` with every question, its options, the correct option and the
verified flag. The teacher deselects weak items and posts `selected_indexes` plus
`all_questions_json` to `/finalize_questions`.

**Step 7 — Finalise.** `/finalize_questions` writes `paper.json`, regenerates `Question.pdf` via
`generate_pdf()` (embedding `fonts/DejaVuSans.ttf`), and renders `templates/result.html`.

**Step 8 — Export.** `/download_pdf`, `/export_to_csv`, `/download_prereqs`.

**Step 9 — Study material.** `/generate_study_material` asks `llama2` for 12 content types per
chapter in one JSON object, writes `textbook_content/content_<timestamp>/*.json`, and renders the
combined PDF; `/download_study_material/` serves it.

**Step 10 — FIB worksheet.** `/select_fib_topics` → `/run_fib_generation` asks `llama2` for a
100–150 word paragraph, 8 concepts of ≤9 letters, a word bank, 8 `______` statement questions and
the answers; `generate_fib_pdf_v2()` renders the student sheet (with the 9-box grid and
`static/img1.jpg` corner markers) and the answer key into `textbook_content/`.

**Step 11 — SVG diagrams.** `/svg_generator` → `/run_svg_generation` (topics from the Pragament
GitHub repo) or `/run_svg_generation_from_chapters` → `/svg_results` → `/view_svg/<topic>`. Each
diagram is searched on Wikimedia Commons, downloaded, validated to start with `<svg`, enriched with
`<title>`, `data-map-type`, `data-zoom-level`, `data-topic` and a Dublin Core `<metadata>` block,
then explained by `llama2` into `<topic>_explanation.md`.

---

## 7. Machine Learning or Algorithm Explanation

ExamForge contains **no trained model and no classical ML algorithm**. The "intelligence" is a
general-purpose LLM used in a constrained, verifiable way.

**Prompting contract.** Each generation route builds a `system_prompt` that pins the output shape:

- *MCQ*: one object per topic with `question`, `options` (exactly four), `correct_option`,
  `class`, `subject`, `chapter`, `topic`, `subtopic`.
- *Study material*: a single JSON object keyed by content type — `chaptersummaries1`,
  `definitionbank1`, `formulasheet1`, `importantpoints1`, `solvedexamples2`, plus quiz, FIB,
  true/false, HOTS and real-life-application sections.
- *FIB*: `paragraph`, `concepts` (8, ≤9 letters), `word_bank`, `questions` (8, each containing
  `______`), `answers` (8).

**Output sanitising.** `sanitize_ollama_json()` strips Markdown fences, removes trailing commas and
repairs a malformed `"answers"` block before `json.loads()`. If the result still fails to parse, the
UI shows "The AI model returned a malformed JSON object that could not be repaired."

**Answer verification by agreement.** `verify_answer_with_models()` re-queries the model with a
reduced prompt asking only for the option number, collects the answers, and marks the question
`verified: True` only when at least two of them agree. This is a self-consistency / majority-vote
check rather than a ground-truth check.

**Prerequisite inference by prompt.** For each selected chapter the model is asked to name chapters
of the previous class that the current one depends on, returning `prerequisite_chapters`, a
`reason` for each and a `for` target. The output is advisory — the teacher confirms every entry
before it enters the paper.

**Diagram selection.** For the SVG pipeline the pipeline uses Wikimedia Commons' search API
(`action=query&list=search&srsearch=…`) to find candidate diagrams for a topic, downloads the
original file, and applies a structural validation (`<svg` prefix) before enhancing and explaining
it. That is retrieval, not generation.

**Textbook parsing (deterministic).** Chapter structuring is pure parsing: records are grouped by
their `type` field, sorted by `order`, and linked by dotted-numeric prefixes (`1.2` belongs to `1`).
The deterministic layer is what makes the syllabus output trustworthy.

---

## 8. File-by-File Code Guide

| File | Role | Key elements |
|---|---|---|
| `app.py` | Main Flask app — routes, prompts, model calls, PDF writers | 28 routes; `generate_questions()`, `verify_answer_with_models()`, `generate_pdf()`, `build_prerequisite_tree()`, `generate_prerequisite_pdf()`, `generate_fib_content()`, `generate_fib_pdf_v2()`, `enhance_svg()`, `load_cached_textbooks()`, `normalize_subject()`, `normalize_class()`; `app.run(debug=True)` |
| `config.py` | Paths and API base URL | `TEXTBOOKS_API`, `DATA_DIR`, `TEXTBOOK_PAGES_DIR`, `FONTS_DIR`, `CONTENT_DIR`, `TEXT_LIMIT` — all env-overridable |
| `content_generate.py` | Study-material engine | `generate_educational_content()`, `prepare_chapter_for_generation()`, 12 content-type prompts, `ollama.list()` availability probe |
| `generator.py` | FIB helpers | `generate_fib_content()`, `generate_fib_pdf()`, `draw_markers()` |
| `utils.py` | Shared helpers | Chapter structuring, PDF/DOCX writers, prerequisite-tree rendering |
| `svg.py` | Standalone SVG pipeline | `fetch_topics()`, `process_topic()`, `enhance_svg()` — search → download → validate → enhance → explain |
| `omr_pdf.py` | OMR sheet writer | `class OMRGenerator(FPDF)` — bubble grid, option layout, marker placement |
| `OMR_Template.py` | OMR scoring template builder | PDF → image → `template.json` pipeline |
| `fib_app.py` | Standalone FIB Flask app | Minimal `/` GET + POST; needs `fib_index.html` / `ifib_index.html` (**absent**) |
| `omr_generator_app.py` | Standalone OMR Flask app | Inline `FORM_HTML`, subject count inputs, returns the PDF |
| `app_fib.py` | Earlier standalone FIB app | Historical snapshot |
| `app_last.py`, `app_test.py`, `app-test.py` | Earlier snapshots of the main app | 2079 / 2370 / 301 lines — historical, not the live entry point |
| `requirements.txt` | Declared dependencies | `flask`, `fpdf`, `requests`, `python-dotenv`, `Pillow`, `reportlab` — **omits `ollama` and `tenacity`** |
| `templates/` | Jinja templates | `index.html` (ExamForge home), `select.html` (chapter tree), `review_questions.html`, `result.html`, `recursive_prereq.html`, `select_fib_topics.html`, `fib_results.html`, `study_material.html`, `svg_generator.html`, `svg_results.html`, `view_svg.html`, plus `*.html.bak` backups of the originals |
| `static/css/qp-style.css`, `static/js/qp-style.js` | ExamForge styling and behaviour | Shared stylesheet/script for the redesign |
| `static/img1.jpg` | FIB corner marker | Stamped on the student worksheet |
| `static/svgs/` | Generated diagrams | SVG + `_placeholder.svg` + `_explanation.md` |
| `fonts/DejaVuSans.ttf` | PDF font | **Required** by `generate_pdf()`; Bold/Oblique variants **absent** |
| `structured_data/` | Runtime state | `textbook_cache.json`, `list_of_all_chapters_for_selected_class.json`, `prepared_selected_data*.json` |
| `textbook_content/` | Generated outputs | Study-material PDFs, `content_<timestamp>/*.json`, FIB PDFs |
| `Sample/` | OMR samples | `omr_sheet.pdf`, `template.json`, `converted_omr.png`, `marker.png` |
| `flask_app_installer/` | Windows installer build | `build_exe.py`, `installer_script.nsi`, `setup/` |
| `project-metadata.json` | Upstream catalogue entry | Points at `app_fib.py` as the entry, upstream repo URL |
| `LICENSE` | AGPL-3.0 | Upstream terms |

---

## 9. Data Flow

```
Pragament allbooks.json ──▶ load_cached_textbooks() ──▶ structured_data/textbook_cache.json
                                                        └──▶ index.html (board/class/subject)

board + class + subject
        │
        ▼  /select
page_attributes/<book_id>.json ──▶ split by type ──▶ sort by order
        │                            └──▶ prefix-link topics/subtopics
        ▼
structured_data/list_of_all_chapters_for_selected_class.json
        │
        ├──▶ templates/select.html  (subject_chapter_map)
        │
        ├──▶ /generate_questions_no_prereq ──▶ prompts ──▶ ollama run llama2
        │                                               │  (JSON + sanitiser)
        │                                               ▼
        │                       paper.json + Question.pdf ◀── review_questions.html
        │                                               │      (selected_indexes)
        ├──▶ /recursive_prereq/1..3 ──▶ prerequisite tree ──▶ Prerequisite_Tree.pdf
        ├──▶ /generate_study_material ──▶ content_<ts>/*.json ──▶ study material PDF
        ├──▶ /run_fib_generation ──▶ paragraph + word bank ──▶ student PDF + answer key PDF
        └──▶ /run_svg_generation ──▶ Wikimedia ──▶ static/svgs/*.svg + *_explanation.md
```

**State on disk (all global, single-user):** `structured_data/textbook_cache.json`,
`structured_data/list_of_all_chapters_for_selected_class.json`,
`structured_data/prepared_selected_data.json`, `structured_data/prepared_selected_data_direct.json`,
`paper.json`, `Question.pdf`, `textbook_content/`, `static/svgs/`, and the Flask session for
`processed_svgs`.

**Notable data-flow detail.** `app.py` imports `TEXTBOOKS_API` from `config.py` and then
overwrites it on line 54 with the same hard-coded URL, so that constant ignores the environment
variable; the other five `config.py` constants are honoured because they are read at import time.

---

## 10. Example Execution

**10.1 — Browse the syllabus (verified on this machine)**

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\question-paper-generator-from-syllabus"
.\.venv\Scripts\Activate.ps1
python app.py
```

```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

`GET http://127.0.0.1:5000/` → **200**, 35 KB of ExamForge UI; the page loads the catalogue from
`staticapis.pragament.com`.

`POST http://127.0.0.1:5000/select` with `board=CBSE`, `class=10`, `subject=Mathematics` →
**200**, 11.6 KB, containing the real chapter → topic → subtopic tree for CBSE class 10
Mathematics.

**10.2 — Generation without Ollama (current state)**

Starting the app and opening any generation route gives the handled failure, for example:

```
Error: No questions generated.
```

and on the study-material page:

```
Ollama service unavailable: ...
```

`content_generate.generate_educational_content()` first calls `ollama.list()`; with no daemon
reachable it returns `([], "Ollama service unavailable: …")` instead of raising.

**10.3 — Generation with Ollama (required setup)**

```powershell
ollama pull llama2
ollama serve
```

then re-run step 10.1 and pick a chapter → *Generate directly*. The flow becomes:

```
/generate_questions_no_prereq → /generate_questions_directly → /generate_questions_from_direct
   → review_questions.html → /finalize_questions → result.html
   → /download_pdf (Question.pdf)  |  /export_to_csv (Questions.csv)
```

**10.4 — FIB worksheet**

```
/select_fib_topics → /run_fib_generation → fib_results.html
   → textbook_content/<name>_students.pdf  |  <name>_answers.pdf
```

**10.5 — OMR sheet (no Ollama required)**

```powershell
python omr_generator_app.py
```

POST to `/` with the per-subject question counts returns the OMR PDF inline with
`Content-Disposition: attachment; filename=omr_sheet.pdf`.

---

## 11. Dependencies and External Services

**Python packages** (as declared in `requirements.txt`): `flask`, `fpdf`, `requests`,
`python-dotenv`, `Pillow`, `reportlab`.

**Imported but not declared** (present in the bundled `.venv`, missing from `requirements.txt`):
`ollama` 0.6.3 and `tenacity` 9.2.1.

**Resolved versions in `.venv`:** Python 3.12.1, Flask 3.1.3, Jinja2 3.1.6, fpdf 1.7.2,
reportlab 5.0.1, Pillow 13.0.0, requests 2.34.2, python-dotenv 1.2.4, tenacity 9.2.1,
ollama 0.6.3.

**External services**

| Service | Endpoint | Used for | Key required | Status |
|---|---|---|---|---|
| Pragament textbook catalogue | `staticapis.pragament.com/textbooks/allbooks.json` | Book list | No | Live, verified |
| Pragament page attributes | `staticapis.pragament.com/textbooks/page_attributes/<book_id>.json` | Chapters/topics/subtopics | No | Live, verified |
| Pragament topic repo (GitHub) | `api.github.com`, `raw.githubusercontent.com` | Topic list for the SVG generator | No | Rate-limited; retried with `tenacity` backoff |
| Wikimedia Commons | `commons.wikimedia.org` | SVG search and download | No | Live |
| Ollama (local) | `localhost:11434` via CLI and Python client | All generation | No | **Not installed / not running** |
| Ollama model | `llama2` | Prompt execution | No | **Not pulled** |

**Fonts and assets:** `fonts/DejaVuSans.ttf` (bundled, required), `fonts/DejaVuSans.pkl` and
`DejaVuSans.cw127.pkl` (bundled), `static/img1.jpg` (bundled). Bold and oblique DejaVu variants are
**not bundled** — `generate_study_material_pdf()` logs a warning and falls back to Helvetica.

**Environment variables honoured:** `DATA_DIR`, `TEXTBOOK_PAGES_DIR`, `FONTS_DIR`, `CONTENT_DIR`,
`TEXT_LIMIT`. `TEXTBOOKS_API` is present in `config.py` but overridden inside `app.py`.

---

## 12. Current Limitations and Future Improvements

**Current limitations**

- **No LLM locally** — Ollama and `llama2` are missing, so every generation feature is
  unreachable out of the box.
- **Verification can never succeed** — `models = ["llama2"]` contains one model while
  `verify_answer_with_models()` demands at least two agreeing answers, so `verified` is always
  `False`.
- **`.env` support is nominal** — `python-dotenv` is installed but `load_dotenv()` is never called,
  and `TEXTBOOKS_API` is hard-coded in `app.py` anyway.
- **Font coverage is partial** — bold/italic DejaVu faces are missing.
- **Single-user, file-based state** — `paper.json`, `structured_data/*.json` and `Question.pdf` are
  shared globals; two concurrent teachers would corrupt each other's work.
- **No auth, no rate limiting, no audit trail.**
- **Heavy code duplication** — six overlapping app snapshots in one folder.
- **Secret key regenerated each start** (`os.urandom(24)`) — sessions do not survive a restart.
- **A third-party public API is a hard dependency** for the syllabus; a shape change breaks parsing.
- **`fib_app.py` cannot run** — its templates are missing.
- **No automated tests.**

**Future improvements**

1. Install Ollama and pull `llama2`; consider `llama3`/`llama3.1` and update the `models` list so
   verification can actually reach two agreeing answers.
2. Add `ollama` and `tenacity` to `requirements.txt`.
3. Call `load_dotenv()` in `app.py` and stop overwriting `TEXTBOOKS_API`.
4. Ship the bold/italic DejaVu fonts (or resolve them at install time) to remove the fallback.
5. Move per-session state out of global files into the Flask session or a database.
6. Collapse the six app snapshots into one module with a versioned entry point.
7. Add a `templates/`-driven OMR scoring page on top of `OMR_Template.py`.
8. Add pytest coverage for the parsers (`sanitize_ollama_json()`, chapter prefix-linking) and the
   PDF writers.
9. Add a teacher login, and a "paper history" list per teacher.
10. Support parallel models with a weighted vote instead of a single-model majority rule.

---

## 13. Learning Outcomes

Working through this codebase teaches:

- **Flask request/response design at scale** — 28 routes, form and query parsing, flash messages,
  sessions, `send_file` / `send_from_directory` downloads, `abort()`-style error paths and file
  uploads of user-selected structures.
- **Integrating a real public API as a data source** — pagination-free JSON catalogues, `type`
  fields as a schema, prefix-based hierarchy reconstruction, and caching to survive outages.
- **Structuring LLM output for machine use** — strict-JSON prompt contracts, defensive parsing,
  trailing-comma repair, and refusing to proceed on unparseable output.
- **Self-consistency verification and its limits** — majority voting across model answers, and
  recognising that a two-model rule cannot be satisfied by a one-model list.
- **PDF generation without a browser** — fpdf for text documents, reportlab for trees and
  worksheets, TrueType embedding with `uni=True` for non-ASCII glyphs, and 9-box answer grids
   aligned with `x`/`y` math.
- **Hybrid human/AI workflow design** — generating with a model but keeping the teacher as the
  decision-maker at the prerequisite and review gates.
- **Prompt-driven content diversification** — one JSON object carrying 12 different content types
  for a chapter, and the engineering needed to persist and re-render each of them.
- **RAG-free grounded generation** — passing the actual chapter structure into the prompt instead of
  hoping the model recalls the syllabus.
- **Deployment realities** — Windows-first PowerShell workflow, `debug=True` reloader behaviour,
  port conflicts between companion apps, PyInstaller/NSIS packaging, and why `requirements.txt`
  drifting from the real imports is a recurring source of breakage.
