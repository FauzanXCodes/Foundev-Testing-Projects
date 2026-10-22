# TalentMatch Lens (resume-screening-and-jd-matching) — Setup & Test Workflow

### 1. Prerequisites

- **OS:** Windows (PowerShell)
- **Python:** 3.12.1
- **Node:** v22.15.0 (not required)
- **Ports:** Streamlit `8501` (http://localhost:8501)
- **Critical:** `venv/` in repo is a **STUB** (only `venv\Scripts\activate`, no python.exe/pyvenv.cfg/site-packages). **Do NOT use it.** Create a real venv.
- **Models downloaded on first run:** spaCy `en_core_web_sm` and sentence-transformers `all-MiniLM-L6-v2` (~90MB)
- **Data:** `data/sample_job_description.txt` present (LLM/ML Engineer posting). Resumes uploaded via UI.

### 2. Installation and Setup

#### Step 1: Open the project directory
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\resume-screening-and-jd-matching"
```

#### Step 2: Create a REAL virtual environment (do not use stub venv/)
```powershell
py -3.12 -m venv .venv_real
.\.venv_real\Scripts\Activate.ps1
```

#### Step 3: Install dependencies
```powershell
pip install -r requirements.txt
```
Key deps: streamlit, sentence-transformers, torch, scikit-learn, spacy, pdfplumber, python-docx, pandas, numpy

#### Step 4: Download spaCy model (required)
```powershell
python -m spacy download en_core_web_sm
```
**Note:** `app.py` calls `spacy.load("en_core_web_sm")` at import time (`load_models()` cached) — missing model will crash startup.

#### Step 5: (Optional) Static preview UI
```powershell
python -m http.server 8000 --bind 127.0.0.1
```
Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) for the labeled browser demo (`index.html` fetches `data/sample_job_description.txt` only).

### 3. Launch the Complete Project

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\resume-screening-and-jd-matching"
.\.venv_real\Scripts\Activate.ps1
streamlit run app.py
```
Open: [http://localhost:8501](http://localhost:8501)

First run will download `all-MiniLM-L6-v2` (~90MB) and load models (cached after).

### 4. Test the Project

#### Manual tests
1. Load Streamlit app — models load (cached). If spaCy model missing, app crashes at startup.
2. **Job Description:** Paste text or upload file. Sample available at `data/sample_job_description.txt`.
3. **Resumes:** Upload multiple resumes (PDF/DOCX/TXT supported via `src/extractor.py`).
4. Run screening — pipeline: extract → clean → embed → score → rank → explain.
5. Review results dashboard (ranked candidates with explanations).
6. Check static preview UI at 8000 for demo-only behavior.

#### Notes
- No tests present, no .gitignore
- `resume_screening_ai.zip` is a source copy
- `venv/` is stub — ignore it

### 5. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| `OSError: [E050] Can't find model 'en_core_web_sm'` | Model not downloaded | `python -m spacy download en_core_web_sm` |
| App crashes on import/startup | spaCy load fails | Ensure model installed in correct env |
| Slow first run | Downloading sentence-transformers model | Wait for download (~90MB), cached thereafter |
| Using stub `venv/` | No python/site-packages | Create real venv as shown above |
| torch install issues on some systems | Heavy dependency | Use pip with appropriate index if needed; standard install usually works |

### 6. Verification Checklist

- [ ] Created real venv (not using stub `venv/`)
- [ ] Installed deps from `requirements.txt`
- [ ] Downloaded `en_core_web_sm`
- [ ] Launched with `streamlit run app.py` on 8501
- [ ] Models load successfully (cached)
- [ ] Tested with sample JD and uploaded resumes
- [ ] Verified ranking/explanations appear
- [ ] Confirmed static preview UI works separately if desired
- [ ] Ignored stub `venv/` directory
