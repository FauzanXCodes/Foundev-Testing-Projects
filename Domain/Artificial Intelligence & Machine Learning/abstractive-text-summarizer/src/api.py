"""FactCheck Studio backend.

Exposes a consistency-check HTTP service for the browser UI.

IMPORTANT / HONEST SCOPE
------------------------
This service implements a DETERMINISTIC LEXICAL ENTAILMENT ENGINE over the
(source, claim) pair. It does NOT run the repository's neural FactCC /
FactCCX pointer-BERT checkpoints: those require `pytorch_transformers==1.0.0`,
`torch==1.3.1`, `apex`, `wandb` and external checkpoint downloads that are not
bundled with the repository, and cannot be installed on modern Python.

The response therefore labels the engine explicitly as "lexical-entailment
(heuristic)" and returns `model_checkpoint: false`. It maps the numeric
signal onto the FactCC label space (CORRECT / INCORRECT) used by
`modeling/utils.py`, and marks the supporting / inconsistent spans it found.

Run:  python src/api.py         (default http://127.0.0.1:5000)
"""
import os
import re

from flask import Flask, jsonify, request

app = Flask(__name__)

WORD_RE = re.compile(r"[a-z0-9]+")
NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")
NEGATIONS = {"not", "no", "never", "none", "without", "cannot", "isn't", "aren't", "wasn't", "weren't", "doesn't", "don't", "didn't"}
STOPWORDS = {
    "the", "a", "an", "of", "to", "in", "on", "at", "for", "and", "or", "with",
    "by", "as", "is", "are", "was", "were", "be", "been", "being", "that", "this",
    "it", "its", "from", "after", "before", "has", "have", "had", "will", "would",
    "said", "says", "say", "into", "up", "by", "an",
}


def tokens(text):
    return WORD_RE.findall((text or "").lower())


def content_tokens(text):
    return [t for t in tokens(text) if t not in STOPWORDS]


def numbers(text):
    return set(NUMBER_RE.findall(text or ""))


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    return [p.strip() for p in parts if p.strip()]


def sentence_best_overlap(claim_sentence, source_sentences):
    """Return (best_source_sentence, jaccard) for the claim sentence."""
    claim_terms = set(content_tokens(claim_sentence))
    if not claim_terms:
        return None, 0.0
    best, best_j = None, 0.0
    for s in source_sentences:
        s_terms = set(content_tokens(s))
        if not s_terms:
            continue
        inter = len(claim_terms & s_terms)
        union = len(claim_terms | s_terms)
        j = inter / union if union else 0.0
        if j > best_j:
            best, best_j = s, j
    return best, best_j


def span_of(text, needle):
    idx = text.find(needle)
    if idx == -1:
        return None
    return {"start": idx, "end": idx + len(needle), "text": needle}


def analyse(source, claim):
    source_sents = split_sentences(source)
    claim_sents = split_sentences(claim) or [claim]

    src_numbers = numbers(source)
    claim_numbers = numbers(claim)

    supporting_spans = []
    inconsistent_spans = []

    # numeric conflicts are the strongest objective signal
    numeric_conflicts = []
    for n in sorted(claim_numbers):
        if n not in src_numbers:
            numeric_conflicts.append(n)

    overlaps = []
    for cs in claim_sents:
        best, j = sentence_best_overlap(cs, source_sents)
        overlaps.append(j)
        if j >= 0.25 and best:
            span = span_of(source, best)
            if span and span not in supporting_spans:
                supporting_spans.append(span)
        if numeric_conflicts:
            for n in numeric_conflicts:
                needle = n
                sp = span_of(claim, needle)
                if sp and sp not in inconsistent_spans:
                    inconsistent_spans.append(sp)

    claim_terms = set(content_tokens(claim))
    source_terms = set(content_tokens(source))
    coverage = (len(claim_terms & source_terms) / len(claim_terms)) if claim_terms else 0.0
    mean_overlap = (sum(overlaps) / len(overlaps)) if overlaps else 0.0

    claim_neg = bool(NEGATIONS & set(tokens(claim)))
    source_neg = bool(NEGATIONS & set(tokens(source)))
    negation_flip = claim_neg != source_neg

    # confidence that the claim is INCONSISTENT, then map to label space
    inconsistency = 0.0
    inconsistency += min(0.55, 0.22 * len(numeric_conflicts))
    inconsistency += max(0.0, (1.0 - coverage)) * 0.45
    inconsistency += max(0.0, (0.6 - mean_overlap)) * 0.5
    if negation_flip:
        inconsistency += 0.2
    inconsistency = max(0.0, min(1.0, inconsistency))

    if inconsistency >= 0.5 or numeric_conflicts:
        label = "INCORRECT"
        confidence = round(0.5 + inconsistency * 0.5, 4)
    else:
        label = "CORRECT"
        confidence = round(1.0 - inconsistency * 0.6, 4)

    return {
        "label": label,
        "confidence": confidence,
        "supporting_spans": supporting_spans,
        "inconsistent_spans": inconsistent_spans,
        "diagnostics": {
            "claim_terms": len(claim_terms),
            "source_coverage": round(coverage, 4),
            "mean_sentence_overlap": round(mean_overlap, 4),
            "numeric_conflicts": numeric_conflicts,
            "negation_flip": negation_flip,
        },
    }


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "engine": "lexical-entailment (heuristic)",
        "model_checkpoint": False,
        "note": ("Deterministic lexical engine. The neural FactCC/FactCCX "
                 "checkpoints are not bundled and require the pinned 2020 "
                 "dependency stack; this service does not load them."),
    })


@app.route("/verify", methods=["OPTIONS"])
def verify_preflight():
    return ("", 204)


@app.route("/verify", methods=["POST"])
def verify():
    payload = request.get_json(silent=True) or {}
    source = payload.get("text")
    claim = payload.get("claim")
    if not isinstance(source, str) or not source.strip():
        return jsonify({"error": "'text' (source document) is required and must be a non-empty string"}), 400
    if not isinstance(claim, str) or not claim.strip():
        return jsonify({"error": "'claim' is required and must be a non-empty string"}), 400

    result = analyse(source, claim)
    result["engine"] = "lexical-entailment (heuristic)"
    result["model_checkpoint"] = False
    result["disclaimer"] = ("Heuristic lexical/entailment analysis — NOT a neural "
                            "FactCC checkpoint prediction.")
    return jsonify(result), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
