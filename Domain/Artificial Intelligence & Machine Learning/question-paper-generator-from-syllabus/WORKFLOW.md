# ExamForge (question-paper-generator-from-syllabus) — Setup & Test Workflow

### 1. Prerequisites

- **OS:** Windows (PowerShell)
- **Python:** 3.12.1
- **Node:** v22.15.0 (not required)
- **Environment:** `.venv` present
- **Ports:** Flask `5000` (http://127.0.0.1:5000)
- **External deps for full generation:** Local **Ollama** service with `llama2` model (not installed). `winget install Ollama.Ollama`, `ollama pull llama2`, `ollama serve`.
- **Fonts:** `fonts/DejaVuSans.ttf` present (required for PDF generation)
- **Data:** `structured_data/textbook_cache.json` present; catalogue fetched from `https://staticapis.pragament.com/textbooks/allbooks.json`

### 2. Installation and Setup

#### Step 1: Open the project directory
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\question-paper-generator-from-syllabus"
```

#### Step 2: Activate virtual environment
```powershell
.\.venv\Scripts\Activate.ps1
```

#### Step 3: Install dependencies (note missing items in requirements.txt)
`requirements.txt` is **missing** `ollama` and `tenacity` (both imported by `app.py`). Install them:
```powershell
pip install ollama tenacity
```
Other deps present in `.venv`: flask, fpdf, requests, python-dotenv, Pillow, reportlab (and others). If recreating, ensure all needed packages are installed.

#### Step 4: Configure environment (optional)
`config.py` reads env vars `DATA_DIR`, `FONTS_DIR`, `CONTENT_DIR`, `TEXT_LIMIT`. Defaults work as-is.

### 3. Launch the Complete Project

**Run only one companion app at a time on port 5000.**

#### Main app (ExamForge)
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\question-paper-generator-from-syllabus"
.\.venv\Scripts\python.exe app.py
```
Expected: Flask dev server `http://127.0.0.1:5000` (debug=True). GET `/` returns 200.

#### Optional companion apps
- `omr_generator_app.py` — works (run separately on 5000)
- `fib_app.py` — needs missing templates → known broken

### 4. Test the Project

#### Verified tests
```powershell
# Home page
curl http://127.0.0.1:5000/
# 200 OK, ~35KB

# Select board/class/subject
curl -X POST http://127.0.0.1:5000/select -H "Content-Type: application/x-www-form-urlencoded" -d "board=CBSE&class=10&subject=Mathematics"
# 200 OK with real chapter structure
```

#### Manual UI tests
1. Load `/` — ExamForge UI
2. Select board/class/subject via `/select` flow
3. Generate questions/FIB — **requires Ollama `llama2` running**. Without it, generation endpoints return handled errors.
4. Download PDF/SVG — uses `fonts/DejaVuSans.ttf`, reportlab/fpdf

#### Known limitations
- Ollama not installed → AI generation will fail until setup
- `requirements.txt` incomplete (missing `ollama`, `tenacity`) — must install manually
- `fib_app.py` broken due to missing templates

### 5. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: ollama` / `tenacity` | Missing deps | `pip install ollama tenacity` |
| PDF generation errors | Missing font | Ensure `fonts/DejaVuSans.ttf` exists |
| Generation fails/timeouts | Ollama not running or model missing | Install Ollama, `ollama pull llama2`, `ollama serve` |
| Port 5000 in use | Another app running | Stop other Flask app or change port |
| Catalogue fetch issues | Network/API unavailable | Uses cached data where possible; check connectivity |

### 6. Verification Checklist

- [ ] Activated `.venv`
- [ ] Installed missing deps: `ollama`, `tenacity`
- [ ] Verified `fonts/DejaVuSans.ttf` exists
- [ ] Started app with `python app.py` on 5000
- [ ] Tested GET `/` returns 200
- [ ] Tested POST `/select` with CBSE/class 10/Mathematics
- [ ] (Optional) Set up Ollama + `llama2` for generation testing
- [ ] Confirmed only one app runs on 5000
- [ ] Reviewed known broken `fib_app.py`
