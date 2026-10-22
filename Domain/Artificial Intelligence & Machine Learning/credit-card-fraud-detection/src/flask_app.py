from __future__ import unicode_literals
import json
import os
from flask import Flask, request

try:  # modern scikit-learn ships joblib as a standalone package
    import joblib
except ImportError:  # legacy: scikit-learn <= 0.20 bundled joblib
    from sklearn.externals import joblib

from settings import MODEL_FILENAME

app = Flask("Fraud Detection")

# load model at startup time when available; otherwise keep serving the
# API and return a structured 503 from /predict until the model exists
app.model = None
if os.path.exists(MODEL_FILENAME):
    app.model = joblib.load(MODEL_FILENAME)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@app.route(u"/predict", methods=[u"OPTIONS"])
def predict_preflight():
    return ("", 204)


@app.route(u"/predict", methods=[u"POST"])
def predict_fraud():
    input_data = request.get_json(silent=True) or {}
    if u"features" not in input_data:
        return json.dumps({u"error": u"No features found in input"}), 400
    if not input_data[u"features"] or not isinstance(input_data[u"features"], list):
        return json.dumps({u"error": u"No feature values available"}), 400
    if app.model is None:
        return json.dumps({
            u"error": u"Model not loaded",
            u"detail": u"models/model.pickle is missing. Train it first: place data/creditcard.csv then run python src/train.py",
        }), 503
    if isinstance(input_data[u"features"][0], list):
        results = app.model.predict_proba(input_data[u"features"]).tolist()
    else:
        results = app.model.predict_proba([input_data[u"features"]]).tolist()
    return json.dumps({u"scores": [result[1] for result in results]}), 200


if __name__ == u"__main__":
    # kept identical to the historical `flask run` behaviour (port 5000)
    app.run(host=u"127.0.0.1", port=5000, debug=False)
