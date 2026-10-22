"""Groove Observatory backend API.

Exposes the repository's existing cosine-similarity recommender
(src/main_cosine_similarity.py) over HTTP so the web UI can consume
genuine backend responses instead of computing solely in the browser.

Run:  python src/api.py        (default http://127.0.0.1:5000)
"""
import os

import pandas as pd
from flask import Flask, jsonify, request
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "data", "best_songs_spotify_2000_2023.csv")

# Same acoustic feature set as src/main_cosine_similarity.py
# (note the trailing spaces in two column names — they exist in the CSV header)
FEATURES = [
    "bpm", "energy", "danceability ", "dB", "liveness",
    "valence", "duration", "acousticness", "speechiness ", "popularity",
]

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/recommend", methods=["OPTIONS"])
def recommend_preflight():
    return ("", 204)


def load_dataset():
    """Load and prepare the dataset exactly like the reference script."""
    df = pd.read_csv(CSV_PATH, sep=";")
    df = df.drop_duplicates(subset=["title"], keep="first").copy()
    df["title"] = df["title"].astype(str).str.lower()
    df["artist"] = df["artist"].astype(str).str.lower()
    for feature in FEATURES:
        col = pd.to_numeric(df[feature], errors="coerce")
        df[feature] = (col - col.min()) / (col.max() - col.min())
    return df


# prepared once at startup
DATA = load_dataset()
MATRIX = DATA[FEATURES].values


def find_seed(artist, title):
    mask = (DATA["artist"] == artist.lower()) & (DATA["title"] == title.lower())
    matches = DATA[mask]
    if matches.empty:
        return None
    return matches.iloc[0]


def row_payload(row, similarity=None):
    payload = {
        "title": row["title"],
        "artist": row["artist"],
        "year": int(row["year"]) if pd.notna(row["year"]) else None,
        "top genre": str(row["top genre"]),
    }
    for feature in FEATURES:
        value = row[feature]
        payload[feature] = float(value) if pd.notna(value) else 0.0
    if similarity is not None:
        payload["similarity"] = round(float(similarity), 6)
    return payload


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "engine": "cosine-similarity",
        "rows": int(len(DATA)),
        "features": len(FEATURES),
    })


@app.route("/api/artists", methods=["GET"])
def artists():
    unique = sorted(DATA["artist"].unique().tolist())
    return jsonify({"artists": unique, "count": len(unique)})


@app.route("/api/songs", methods=["GET"])
def songs():
    artist = (request.args.get("artist") or "").lower()
    if not artist:
        return jsonify({"error": "Query parameter 'artist' is required"}), 400
    subset = DATA[DATA["artist"] == artist]
    if subset.empty:
        return jsonify({"error": "Artist not in database", "songs": []}), 404
    return jsonify({
        "songs": [row_payload(row) for _, row in subset.iterrows()],
        "count": int(len(subset)),
    })


@app.route("/api/recommend", methods=["POST"])
def recommend():
    payload = request.get_json(silent=True) or {}
    artist = payload.get("artist")
    title = payload.get("title")
    if not artist or not title:
        return jsonify({"error": "'artist' and 'title' are required"}), 400
    limit = int(payload.get("limit", 10))
    limit = max(1, min(limit, 50))
    exclude_self = bool(payload.get("excludeSelf", True))

    seed = find_seed(str(artist), str(title))
    if seed is None:
        return jsonify({"error": "Song not found for that artist"}), 404

    seed_idx = DATA.index.get_loc(seed.name)
    sims = cosine_similarity(MATRIX[seed_idx:seed_idx + 1], MATRIX)[0]
    order = sims.argsort()[::-1]

    recommendations = []
    for idx in order:
        if exclude_self and idx == seed_idx:
            continue
        recommendations.append(row_payload(DATA.iloc[idx], sims[idx]))
        if len(recommendations) >= limit:
            break

    return jsonify({
        "seed": row_payload(seed),
        "recommendations": recommendations,
        "engine": "cosine-similarity",
        "computedBy": "backend",
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
