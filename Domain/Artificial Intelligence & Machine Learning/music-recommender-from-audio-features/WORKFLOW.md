# Groove Observatory (music-recommender-from-audio-features) — Setup & Test Workflow

### 1. Prerequisites

- **OS:** Windows (PowerShell)
- **Python:** 3.12.1
- **Node:** v22.15.0 (not required)
- **Data:** `data/best_songs_spotify_2000_2023.csv` present (2261 rows after dedup in practice)
- **Environment:** `.venv` already exists with dependencies installed (Flask, pandas, scikit-learn, etc.)
- **Ports:** Backend `5000` (Flask), UI `8000` (static server)

### 2. Installation and Setup

#### Step 1: Open the project directory
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
```

#### Step 2: Use the existing virtual environment (recommended)
The repo includes `.venv` with required packages. Activate it:
```powershell
.\.venv\Scripts\Activate.ps1
```

If needed, install API deps (reference):
```powershell
pip install -r requirements-api.txt
```
Contents: `flask>=2.3`, `pandas>=2.0`, `scikit-learn>=1.3`

#### Step 3: Verify files
- `src/api.py` — Flask backend (cosine similarity)
- `index.html`, `css/style.css`, `js/app.js` — static UI (API-first with browser fallback)
- `data/best_songs_spotify_2000_2023.csv` — dataset (semicolon-separated, columns include `danceability ` and `speechiness ` with trailing spaces)

### 3. Launch the Complete Project

**Run both terminals (backend + UI).** The UI probes `http://127.0.0.1:5000/api/health` on load (1.5s timeout); if online it uses the backend, else falls back to identical in-browser cosine engine.

#### Terminal 1: Start the Flask API
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
.\.venv\Scripts\python.exe src\api.py
```
Expected: Flask dev server on `http://127.0.0.1:5000` (debug=False)

#### Terminal 2: Start the static UI server
```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
python -m http.server 8000
```
Open: [http://localhost:8000/](http://localhost:8000/)

### 4. Test the Project

#### API tests (verified)
```powershell
# Health
curl http://127.0.0.1:5000/api/health
# Expected: {"status":"ok","engine":"cosine-similarity","rows":2261,"features":10}

# Artists
curl http://127.0.0.1:5000/api/artists

# Songs for artist
curl "http://127.0.0.1:5000/api/songs?artist=miley%20cyrus"

# Recommend (example)
curl -X POST http://127.0.0.1:5000/api/recommend -H "Content-Type: application/json" -d "{\"artist\":\"miley cyrus\",\"title\":\"flowers\",\"limit\":3}"
# Expected: recommendations with similarities ~0.9947, 0.9943, 0.9938 (as tested)

# Errors
curl -X POST http://127.0.0.1:5000/api/recommend -H "Content-Type: application/json" -d "{\"artist\":\"nope\",\"title\":\"nope\"}"  # 404
curl -X POST http://127.0.0.1:5000/api/recommend -H "Content-Type: application/json" -d "{\"artist\":\"miley cyrus\"}"  # 400
```

#### UI tests (manual)
1. Load UI — dataset badge shows count + "backend cosine API" if backend online.
2. Select artist/song (or use "Flowers → The Climb" featured match) — recommendations render with similarity bars.
3. Toggle "Exclude self", "Sort ascending" — recomputes.
4. Click "Why this match" / card — audio DNA comparison panel shows feature bars.
5. Crate explorer: filter by genre/year, view top artists bar chart.
6. With backend stopped, UI falls back to browser engine (same algorithm).

#### Notes on tests folder
`tests/` contains scratch scripts (`test_*.py`) — no assertions, pytest not installed. `src/main_cosine_similarity.py` is notebook-style (reads differently-named CSV, uses ipywidgets).

### 5. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| UI shows "browser cosine engine" | Backend not running or unreachable | Start `src/api.py` on 5000; check firewall/CORS. |
| CORS errors in browser | Missing headers | API adds CORS headers; ensure requests go to correct origin/port. |
| Song not found | Case/spacing or artist mismatch | API lowercases and matches; use exact values from dropdown. |
| CSV load fails (file://) | Browser blocks fetch | Use `python -m http.server 8000` from project root. |
| Trailing spaces in feature names | CSV headers have spaces | API and UI use exact names `danceability `, `speechiness ` as in repo. |

### 6. Verification Checklist

- [ ] Activated `.venv`
- [ ] Started API on 5000, verified `/api/health` returns 2261 rows
- [ ] Started UI server on 8000, opened http://localhost:8000/
- [ ] Confirmed UI uses backend when online
- [ ] Tested recommend for "flowers" and verified similarity values
- [ ] Tested 400/404 error cases
- [ ] Verified fallback works with backend stopped
- [ ] Confirmed dataset and features match implementation
