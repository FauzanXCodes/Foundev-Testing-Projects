# Groove Observatory

Folder id: `music-recommender-from-audio-features`. Groove Observatory is a music recommender that answers one question — *"what sounds like this?"* — using nothing but a song's **acoustic DNA**. The upstream project is a 2023 Skyline College research study by **Eden Huang** that applies **cosine similarity**, a technique normally used on text, to ten numerical audio features. The added **web UI** (*Groove Observatory — Retro record-crate recommender*) and the **Flask API** (`src/api.py`) wrap the same algorithm in a browsable interface: pick an artist, pick a song, get ten ranked recommendations with a per-feature comparison chart.

| Surface | Role | Needs Python? |
|---|---|---|
| `index.html` + `css/style.css` + `js/app.js` | The Groove Observatory browser app — computes cosine similarity in vanilla JS over the bundled CSV | No |
| `src/api.py` | Flask backend exposing the same recommender over HTTP | Yes (`requirements-api.txt`) |
| `src/main_cosine_similarity.py` | The original notebook-style research script (unchanged) | Yes, plus Jupyter + matplotlib/seaborn/ipywidgets |
| `trials/`, `tests/` | Early experiments and component scratch scripts | Yes |

> **Two engines, one algorithm.** The browser app probes `GET /api/health` on load. If the backend answers, recommendations come from the server (`computedBy: "backend"`); if it does not, the page falls back to an identical in-browser cosine engine over the same CSV. The header badge always states which engine produced the numbers.

## Features

**Implemented and verified in the source**

- **Content-based recommender** — cosine similarity between the seed song's 10-feature vector and every other row, ranked descending.
- **Min-max normalisation** — every feature is scaled to `[0, 1]` over the whole dataset with `(x - min) / (max - min)` before any comparison.
- **Duplicate cleanup** — `drop_duplicates(subset=["title"], keep="first")`, then `title`/`artist` are lower-cased so lookups are case-insensitive.
- **Artist typeahead** — type to filter the artist list (up to 12 suggestions), click to load that artist's songs.
- **Song picker** — a dropdown of the artist's songs plus a free-text search box that filters the same list.
- **Per-track comparison panel** ("Audio DNA") — a 10-row bar chart placing the seed and the selected match side by side, plus a plain-language similarity sentence.
- **Toggles** — *Exclude self* (on by default) and *Sort ascending*; both re-run the recommendation instantly.
- **Crate explorer** — genre chips (the 18 most common genres plus *All*) and a year-range filter driving a top-20-artist bar chart.
- **Export** — *Copy list* to the clipboard, and *Download CSV* producing `groove_recommendations.csv` with the semicolon-separated header `seed_title;seed_artist;title;artist;year;top_genre;similarity`.
- **Featured match** — a one-click shortcut to the repository's own example pair (*Flowers* → *The Climb*, ≈ 0.996), shown only when both tracks are present in the data.
- **Honest status UI** — the header badge shows the song count, the feature count and the active engine; the load panel shows a *Retry* button and a `python -m http.server 8000` tip if the CSV cannot be fetched.
- **Flask API** — `/api/health`, `/api/artists`, `/api/songs`, `/api/recommend`, with CORS headers and an `OPTIONS` preflight.

**Not available / requires external setup**

- **The original script needs Jupyter.** `src/main_cosine_similarity.py` uses `input()` and an `ipywidgets.Dropdown`, so it must be run cell-by-cell in a notebook — it is not a CLI program.
- **The original script cannot find its own dataset.** It reads `'Best Songs on Spotify from 2000-2023.csv'` from the current working directory, but the bundled file is `data/best_songs_spotify_2000_2023.csv`. Run it from `data/`, or edit the path.
- **No trained model, no weights, no embeddings.** This is a closed-form geometric similarity, not a learned model. There is nothing to train and nothing to download.
- **No user behaviour, no collaborative filtering** — no listening history, no ratings, no implicit-feedback signals. Everything is derived from the acoustic features already in the CSV.
- **The API's `rows` count (2,261) differs from the browser's (2,385)** because the API de-duplicates on `title` and the browser does not. The two engines therefore compute slightly different similarity numbers for the same pair — see *Limitations*.
- **The `tests/` folder contains no tests.** The five files are print-only scratch scripts with no assertions, no fixtures and no test runner; they read the CSV from the working directory and would raise `FileNotFoundError` from the project root.
- **No `LICENSE` file.** `project-metadata.json` records the license as `Unknown`, so treat the upstream code as unlicensed until the author states otherwise.
- **No `Librosa`, no clustering.** The metadata's stack line (`Python; Librosa; sklearn`) and its goal line ("cluster songs") do not match the code — there is no `librosa` import and no clustering anywhere in the tree.

## Technology Stack

| Layer | Technology | Where it appears |
|---|---|---|
| Backend | Flask 3.x (`flask.Flask`, `jsonify`, `request`) | `src/api.py` |
| Data | pandas 2.x/3.x — `read_csv(sep=";")`, `drop_duplicates`, `to_numeric(errors="coerce")` | `src/api.py`, `src/main_cosine_similarity.py` |
| Similarity | scikit-learn — `sklearn.metrics.pairwise.cosine_similarity` | `src/api.py`, `src/main_cosine_similarity.py` |
| Original script extras | matplotlib, seaborn, ipywidgets | `src/main_cosine_similarity.py` (bar plot + interactive dropdown) |
| Frontend | Vanilla HTML5 / CSS / JavaScript — no framework, no bundler, no npm | `index.html`, `css/style.css`, `js/app.js` |
| UI fonts | Google Fonts — *Bricolage Grotesque*, *Space Grotesk*, *IBM Plex Mono* | `index.html` `<link>` |
| Dataset | Kaggle *Best Songs on Spotify 2000-2023* (bundled) | `data/best_songs_spotify_2000_2023.csv` |

No deep-learning framework, no GPU, no database, no API key, no external service at runtime.

## Prerequisites

- **For the browser app only (fastest path):** a modern browser and Python 3 (only to serve the folder over HTTP). No third-party packages.
- **For the Flask backend:** Python 3.10+ and the three packages in `requirements-api.txt`.
- **A project-local `.venv` already exists** in this checkout and contains **Flask 3.1.3, pandas 3.0.6, scikit-learn 1.9.1, NumPy 2.5.4** on **Python 3.12.1**. It does **not** contain matplotlib, seaborn or ipywidgets, so `src/main_cosine_similarity.py` will not run inside it.
- **For the original research script:** Jupyter (or any notebook front-end) plus `matplotlib`, `seaborn` and `ipywidgets`.
- **No dataset download needed** — the CSV is bundled in `data/`.

## Project Structure

```
music-recommender-from-audio-features/
├── index.html                       # Groove Observatory UI (load panel, app root, tabs)
├── css/style.css                    # UI stylesheet (~14 KB)
├── js/app.js                        # CSV parser, cosine engine, API client, all interactions
├── src/
│   ├── api.py                       # Flask API — the backend entry point
│   └── main_cosine_similarity.py    # Original research script (unchanged, notebook-style)
├── data/
│   └── best_songs_spotify_2000_2023.csv   # Bundled dataset, 2,385 rows, semicolon-separated
├── tests/                           # Five print-only scratch scripts (no assertions)
│   ├── test_clean_dataset.py
│   ├── test_artist_selection.py
│   ├── test_song_selection_dropdown.py
│   ├── test_cosine_similarity.py
│   └── test_visualization.py
├── trials/
│   ├── trial_1_spotify_recommendation.py    # Genre exploration
│   └── trial_2_acoustic_recommendation.py   # Exploratory acoustic-feature scratch work
├── requirements-api.txt             # flask>=2.3, pandas>=2.0, scikit-learn>=1.3
├── project-metadata.json             # Catalog metadata (stack/goal fields are inaccurate)
├── README.md                         # Upstream README (58 lines)
└── .venv/                           # Pre-built environment: flask, pandas, scikit-learn, numpy
```

**Paths the code actually depends on**

| Consumer | Expected path | Status |
|---|---|---|
| `src/api.py` | `data/best_songs_spotify_2000_2023.csv` (resolved from `BASE_DIR`, so CWD-independent) | Present |
| `js/app.js` | `data/best_songs_spotify_2000_2023.csv` (fetched relative to the page) | Present |
| `src/main_cosine_similarity.py` | `Best Songs on Spotify from 2000-2023.csv` (CWD-relative) | **Mismatch** — run from `data/` or edit |
| `trials/trial_1_*.py` | `best_songs_spotify_2000_2023.csv` (CWD-relative) | **Mismatch** — same fix |
| `trials/trial_2_*.py` | `Best Songs on Spotify from 2000-2023.csv` (CWD-relative) | **Mismatch** — same fix |
| `tests/*.py` | `Best Songs on Spotify from 2000-2023.csv` (CWD-relative) | **Mismatch** — same fix |

## Installation

### A. Browser app only (no packages)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
python -m http.server 8000
```

The page is at <http://localhost:8000/>. Serving over HTTP matters: `js/app.js` fetches the CSV with `fetch('data/...')`, and browsers block that from a `file://` origin. The app detects the failure and shows the `python -m http.server 8000` tip.

### B. With the Flask backend (recommended for the full experience)

The project already contains a ready `.venv`. Use it:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
.\.venv\Scripts\Activate.ps1
python -c "import flask, pandas, sklearn; print(flask.__version__, pandas.__version__, sklearn.__version__)"
```

To rebuild it from scratch instead:

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-api.txt
```

`requirements-api.txt` contains exactly three lines of substance:

```
flask>=2.3
pandas>=2.0
scikit-learn>=1.3
```

### C. The original research script (optional)

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
.\.venv\Scripts\Activate.ps1
pip install matplotlib seaborn ipywidgets jupyter
```

Then open `src/main_cosine_similarity.py` in Jupyter **and** make the dataset resolvable — either copy `data\best_songs_spotify_2000_2023.csv` to the filename the script expects, or change `pd.read_csv('Best Songs on Spotify from 2000-2023.csv', sep=";")` to the `data/` path.

## Environment Configuration

**The code reads no environment variables, no `.env` file and no config file.** Everything is hard-coded or overridable from the browser:

| Setting | Value | Where |
|---|---|---|
| API host | `127.0.0.1` | `src/api.py` → `app.run(host="127.0.0.1", port=5000, debug=False)` |
| API port | `5000` | same |
| Debug mode | `False` | same |
| Browser → API base | `window.MUSIC_API_BASE`, default `http://127.0.0.1:5000` (trailing slashes stripped) | `js/app.js` → `const API_BASE = (window.MUSIC_API_BASE || 'http://127.0.0.1:5000').replace(/\/+$/, '')` |
| API health probe timeout | 1500 ms via `AbortSignal.timeout(1500)` | `js/app.js` → `probeApi()` |
| Static UI server port | `8000` (your choice — it is only a file server) | `python -m http.server 8000` |
| CSV path (backend) | `os.path.join(BASE_DIR, "data", "best_songs_spotify_2000_2023.csv")` | `src/api.py` → `CSV_PATH` |
| Feature set | `bpm, energy, "danceability ", dB, liveness, valence, duration, acousticness, "speechiness ", popularity` | `src/api.py` → `FEATURES`; identical list in `js/app.js` |
| CORS | `Access-Control-Allow-Origin: *`, `Allow-Headers: Content-Type`, `Allow-Methods: GET, POST, OPTIONS` | `src/api.py` → `add_cors_headers()` |
| Recommendation limit | default `10`, clamped to `1…50` | `src/api.py` → `recommend()` |
| Seed lookup | `artist` + `title`, both lower-cased | `src/api.py` → `find_seed()`; `js/app.js` → `findSeed()` |

**To point the UI at a different backend**, set the global before `js/app.js` loads:

```html
<script>window.MUSIC_API_BASE = 'http://192.168.1.20:5000';</script>
```

## How to Launch

**Terminal 1 — backend (optional but recommended)**

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
.\.venv\Scripts\Activate.ps1
python src\api.py
```

Expected startup output:

```
 * Serving Flask app 'api'
 * Debug mode: off
WARNING: This is a development server. For production, use a production WSGI server.
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
```

**Terminal 2 — static UI**

```powershell
cd "N:\Foundev-Projects\Domain\Artificial Intelligence & Machine Learning\music-recommender-from-audio-features"
python -m http.server 8000
```

Open <http://localhost:8000/>.

**How the frontend reaches the backend** — on load, `loadData()` calls `probeApi()`, which issues `GET http://127.0.0.1:5000/api/health` with a 1.5 s timeout. A JSON body with `status: "ok"` sets `apiMode = true`; anything else (timeout, connection refused, non-2xx) sets `apiMode = false` and the page uses the browser engine. In backend mode, recommendations are fetched with `POST /api/recommend` and the badge reads *"backend cosine API"*; in browser mode it reads *"browser cosine engine"*. If a backend request fails mid-session, the app drops back to the browser engine and rewrites the badge to *"browser cosine engine (backend unreachable)"*.

**Stopping** — `Ctrl+C` in each terminal.

**Original script** — open `src/main_cosine_similarity.py` in Jupyter and run the cells in order; it prompts for an artist on the console, then offers an interactive song dropdown.

## Model and Dataset Setup

**There is no model.** Groove Observatory is a deterministic geometric method, not a fitted estimator: min-max scale the features, then take cosine similarities. Nothing to train, nothing to serialise, no weights to download.

**The dataset is bundled and is the only data dependency**

| Property | Value |
|---|---|
| File | `data/best_songs_spotify_2000_2023.csv` (180,350 bytes) |
| Origin | Kaggle — *Best Songs on Spotify 2000-2023* |
| Format | semicolon-separated, header row, quoted fields, `\r\n` line endings |
| Columns | `title`, `artist`, `top genre`, `year`, `bpm`, `energy`, `danceability `, `dB`, `liveness`, `valence`, `duration`, `acousticness`, `speechiness `, `popularity` |
| Gotcha | **`danceability ` and `speechiness ` have a trailing space in the header.** Every feature list in the repo preserves that space. Changing it breaks the column lookups. |
| Raw rows | 2,385 |
| Rows after `drop_duplicates(subset=["title"], keep="first")` | 2,261 — this is the `rows` value reported by `GET /api/health` |
| Artists | 1,014 in the raw file; 997 distinct after de-duplication and lower-casing |
| Genres | 265 distinct `top genre` values |
| Year span | 1985–2023 (the title says 2000–2023; the data does not fully comply) |
| Missing feature values | none observed in the ten acoustic columns |

**What the upstream README claims and what the data supports**

- The upstream README says *"~2300 songs"*. The file actually holds 2,385 rows, 2,261 after de-duplication.
- The upstream README's headline example is *"Yellow by Coldplay and The Climb by Miley Cyrus scored 0.996"*. The UI's featured button is labelled *Flowers → The Climb (≈0.996)* and the lead engineer's integration test reproduced **0.9947 / 0.9943 / 0.9938** for the three top matches of *Flowers* — so the ≈0.996 figure is the right order of magnitude, but the two documents name different seed tracks. Treat 0.996 as an approximate, seed-dependent number.

**Where the code expects the data** — `src/api.py` resolves the CSV from `BASE_DIR` and therefore works from any working directory; the browser resolves it relative to the served page; the original script and the `trials/`/`tests/` scripts resolve it relative to the current directory, which is why they fail unless you run them from `data/`.

## Usage

### 1. Load the app

Open <http://localhost:8000/>. The load panel disappears once the CSV is parsed; the badge shows `2,385 songs · 10 audio features · backend cosine API` (or `browser cosine engine`).

### 2. Choose an artist

Type into the *Step 1 · Artist* box. The typeahead filters the 997 artists case-insensitively and shows up to 12 matches. Click one — for example `Miley Cyrus` — and the song dropdown fills with that artist's tracks.

### 3. Choose a song

Pick from the dropdown (each option shows the year) or type in the *Search songs* box to narrow it. Choosing *Flowers* immediately computes the recommendations.

### 4. Read the recommendations

The hero panel shows the seed (title, artist · year, genre chip, and a vinyl disc tinted by the track's valence and energy) next to ten recommendation cards. Each card shows the similarity as a percentage with a bar, and the album sleeve is tinted by the same hue rule. Click a card — or its *Why this match* button — to open the **Audio DNA Comparison** panel: seed vs match, the sentence *"These tracks share 99.4 % cosine similarity across the 10 normalized audio features based on min-max scaling over the full dataset."*, and ten feature rows with paired bars.

### 5. Tweak the controls

- **Exclude self** (checked by default) — removes the seed from its own recommendations.
- **Sort ascending** — flips the ranking, which is a quick way to find the *least* similar tracks in the catalogue.
- **Reset** — clears the artist, the song and both panels.

### 6. Explore the catalogue

The **Crate explorer** tab has genre chips (the 18 most common genres plus *All*) and a year-range pair of dropdowns; both filter the **Top 20 artists** bar chart. The **How it works** tab restates the four-step method taken from `src/main_cosine_similarity.py`.

### 7. Export

- **Copy list** — `1. Flowers - Miley Cyrus (99.4%)`, one per line, to the clipboard.
- **Download CSV** — writes `groove_recommendations.csv` with the header `seed_title;seed_artist;title;artist;year;top_genre;similarity` and the similarity as a percentage with three decimals.

### 8. Call the API directly

```powershell
$body = @{ artist = "miley cyrus"; title = "flowers"; limit = 5; excludeSelf = $true } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/recommend" -Method Post -ContentType "application/json" -Body $body
```

## API Documentation

Base URL: `http://127.0.0.1:5000`. All routes are served by `src/api.py`. The dataset is loaded and normalised **once at import time**, so the first request is already fast.

CORS is applied to every response by the `@app.after_request` hook: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`.

### `GET /api/health`

Liveness plus dataset size.

**Request:** no parameters.

**Response `200`**

```json
{
  "status": "ok",
  "engine": "cosine-similarity",
  "rows": 2261,
  "features": 10
}
```

| Field | Type | Meaning |
|---|---|---|
| `status` | string | Always `"ok"` when the service is up |
| `engine` | string | Always `"cosine-similarity"` |
| `rows` | integer | Rows after de-duplication on `title` |
| `features` | integer | Number of acoustic features used (10) |

### `GET /api/artists`

Every distinct artist, lower-cased and sorted.

**Response `200`**

```json
{ "artists": ["abba", "ac/dc", "..."], "count": 997 }
```

### `GET /api/songs`

All tracks by one artist, with their features.

**Query parameter:** `artist` (required, case-insensitive).

**Response `200`**

```json
{
  "songs": [
    {
      "title": "flowers",
      "artist": "miley cyrus",
      "year": 2023,
      "top genre": "pop",
      "bpm": 0.42, "energy": 0.47, "danceability ": 0.51, "dB": 0.44,
      "liveness": 0.08, "valence": 0.43, "duration": 0.31,
      "acousticness": 0.04, "speechiness ": 0.05, "popularity": 0.98
    }
  ],
  "count": 10
}
```

*(shape of the payload; the ten numbers are the min-max-normalised values, not the raw Spotify figures)*

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error": "Query parameter 'artist' is required"}` | `artist` missing or empty |
| `404` | `{"error": "Artist not in database", "songs": []}` | No track by that artist |

Note: the ten feature values in the response are **min-max normalised**, not the raw Spotify numbers, and the two keys keep their trailing spaces.

### `POST /api/recommend`

Rank the catalogue against a seed track.

**Request body (JSON)**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `artist` | string | yes | — | Matched case-insensitively |
| `title` | string | yes | — | Matched case-insensitively |
| `limit` | integer | no | `10` | Clamped to `1…50` |
| `excludeSelf` | boolean | no | `true` | Drops the seed from the result list |

**Response `200`**

```json
{
  "seed": { "title": "flowers", "artist": "miley cyrus", "year": 2023, "top genre": "pop", "...": "..." },
  "recommendations": [
    { "title": "...", "artist": "...", "year": 2023, "top genre": "...", "similarity": 0.994712, "...": "..." }
  ],
  "engine": "cosine-similarity",
  "computedBy": "backend"
}
```

`similarity` is rounded to six decimals. The list is ordered by descending similarity.

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error": "'artist' and 'title' are required"}` | Missing `artist` or `title` |
| `404` | `{"error": "Song not found for that artist"}` | No row for that artist/title pair |

### `OPTIONS /api/recommend`

CORS preflight. Returns **`204` No Content** with an empty body, plus the CORS headers.

### Verified behaviour

The lead engineer's integration test (October 2026) against the running service confirmed: `GET /api/health` → `200` with `rows: 2261`; `GET /api/songs?artist=miley cyrus` → `200` with 10 songs; `POST /api/recommend` for *flowers* → `200` with the top three similarities **0.9947, 0.9943, 0.9938**; an unknown song → `404`; a body missing fields → `400`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Load panel shows *"Load failed: …"* and the tip panel appears | The page was opened over `file://`, so `fetch('data/…')` was blocked | Serve the folder: `python -m http.server 8000`, then open <http://localhost:8000/> |
| `ModuleNotFoundError: No module named 'flask'` | The backend was started with the system Python | Activate the venv first: `.\.venv\Scripts\Activate.ps1` |
| `Address already in use` / port 5000 busy on `python src\api.py` | Another Flask app already owns 5000 | Stop the other process, or edit `app.run(host="127.0.0.1", port=5000)` in `src/api.py` |
| The UI badge says *"browser cosine engine"* even though the backend is running | The health probe failed — wrong port, or the page was served from a different origin than `window.MUSIC_API_BASE` | Check `GET http://127.0.0.1:5000/api/health` in a browser or with `Invoke-RestMethod`; set `window.MUSIC_API_BASE` if the API is elsewhere |
| The UI badge says *"browser cosine engine (backend unreachable)"* after a click | A `POST /api/recommend` returned a non-2xx | Check the Flask console for the 404/400; verify the artist/title spelling matches the dataset |
| `404` "Song not found for that artist" | The pair is not in the dataset, or the title belongs to a different artist | Call `GET /api/songs?artist=<name>` to list the artist's exact titles |
| `400` "'artist' and 'title' are required" | `artist` or `title` missing from the JSON body | Send both keys; the values are case-insensitive |
| CORS error in the browser console | The response came from a non-`src/api.py` server | The API sets `Access-Control-Allow-Origin: *` on every response; if you see a CORS failure, the request is not reaching this Flask app |
| `FileNotFoundError: 'Best Songs on Spotify from 2000-2023.csv'` | Running `src/main_cosine_similarity.py`, `trials/` or `tests/` from the project root | Run from `data/`, or change the path to `data/best_songs_spotify_2000_2023.csv` |
| `ModuleNotFoundError: No module named 'ipywidgets'` | The original script needs notebook widgets that the bundled `.venv` does not contain | `pip install matplotlib seaborn ipywidgets jupyter` and use Jupyter |
| `NameError: name 'feature' is not defined` | `trials/trial_2_acoustic_recommendation.py` line 68 references `df[feature]` before `feature` is ever assigned | It is exploratory scratch code; work from `src/main_cosine_similarity.py` instead |
| Similarity percentages differ slightly between the two engines | The API de-duplicates on `title` (2,261 rows); the browser uses all 2,385 rows, so the min/max bounds differ | Expected — both are correct for their own dataset snapshot |
| The similarity column shows a value near 0 for everything | A feature is constant, so `(x - min) / (max - min)` divides by zero | Not possible with the bundled CSV, but `js/app.js` guards it (`maxv === minv → 0`) and `src/api.py` coerces bad values to `NaN` |
| The Audio DNA bars look tiny in backend mode | The API returns normalised features while the bar widths are scaled by the raw per-feature maximum | Cosmetic; the API and browser modes are not visually identical |
| `KeyError: 'danceability'` | Someone edited the CSV header or a feature list and dropped the trailing space | The header really is `danceability ` and `speechiness ` — keep the spaces |

## Limitations

- **Not a learned model.** Cosine similarity over ten hand-picked Spotify features is a baseline, not a recommender in the modern sense: there is no training, no validation split, no offline metric, and no way to measure whether the recommendations are any good.
- **Content-only.** The dataset carries no listening history, ratings or skips, so the system can never learn what an individual user likes.
- **Duplicate titles are dropped globally.** `drop_duplicates(subset=["title"], keep="first")` removes 124 rows, and because the key is the title alone, two different songs with the same name (or the same song by different artists) collapse into one. The API and the browser disagree on which snapshot to use.
- **The two engines are not bit-identical.** The API normalises over 2,261 de-duplicated rows; the browser normalises over all 2,385. The same seed can therefore produce slightly different percentages depending on which engine answered.
- **The API's seed lookup is stricter than the browser's.** `find_seed` requires an exact `(artist, title)` match after lower-casing; the browser matches the first row whose artist *and* title both match, and its artist filter is an equality check, so a title duplicated across artists resolves differently between the two.
- **`min-max` scaling is sensitive to outliers.** A single extreme `duration` or `dB` value compresses every other song into a narrow band of the scaled range, reducing the discriminative power of the other nine dimensions.
- **`duration` and `popularity` dominate the geometry.** Long, popular songs sit in a crowded corner of the feature space, so the "most similar" tracks tend to be other long, popular tracks rather than perceptually similar ones.
- **The original script is notebook-only.** `input()` and an `ipywidgets.Dropdown` mean it cannot run as a script, and it still points at a filename the repository does not contain.
- **The `tests/` directory contains no tests.** No assertions, no fixtures, no runner, no CI; the five files are print-only scratch scripts, and three of them reference the old CSV filename.
- **The `trials/` directory is unfinished.** `trial_2_acoustic_recommendation.py` contains duplicated blocks and an undefined-variable reference; `trial_1_*.py` reads a filename that does not exist in the repository root.
- **No pagination or search server-side.** `GET /api/artists` returns the entire artist list, and `GET /api/songs` returns every track for an artist with all ten features.
- **No caching, no rate limiting, no authentication, no request logging** — the Flask app is a development server bound to `127.0.0.1` with `debug=False`.
- **The dataset is small and static.** 2,385 tracks with 265 genre labels; it is a research snapshot, not a live catalogue, so it goes stale immediately.
- **Licensing is unresolved.** There is no `LICENSE` file and the metadata records `Unknown`; the dataset itself is a Kaggle download whose redistribution terms you should check before shipping it.

## License and Credits

- **Original project:** *Music Recommender System using Cosine Similarity* by **Eden Huang** — <https://github.com/edenmhuang/Music-Recommender>, a **Skyline College** research project from **2023**, with thanks to **Professor Bryan Swartout** for guidance and peer review. The upstream README links a write-up on Medium: [*Cosine Similarity for Recommender Systems*](https://medium.com/@edhuang392/recommender-system-using-cosine-similarity-an-honors-research-project-on-music-recommendation-120bfc8806ba).
- **License:** **no `LICENSE` file is present** in this repository, and `project-metadata.json` records the license as `Unknown`. Treat the upstream code as unlicensed until the author publishes a license; do not assume MIT/Apache/GPL.
- **Dataset:** *Best Songs on Spotify 2000-2023* from Kaggle, bundled in `data/`. It remains the property of its original publishers; check Kaggle's terms before redistributing.
- **Added later, not part of the upstream release:** the Groove Observatory UI (`index.html`, `css/style.css`, `js/app.js`), the Flask API (`src/api.py`), `requirements-api.txt`, the project-local `.venv`, and this documentation. These layers were written on top of the upstream project and do not claim ownership of it; the upstream research, the algorithm and the dataset are credited above.
- **Corrections made in the documentation above:** the metadata's `Librosa` stack entry and "cluster songs" goal are not implemented in the code, the `tests/` folder contains no assertions, and the CSV filename referenced by the original script does not match the bundled file. These are recorded so that the first-time reader is not misled.
