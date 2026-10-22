import os
import json
import requests
import h5py
import shutil

# Resolve paths relative to this file's parent directory (project root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "emotion_model.h5")
LABELS_PATH = os.path.join(BASE_DIR, "models", "emotion_labels.json")
MODEL_URL = "https://huggingface.co/sujon2005/Emotion_Detection_and_Music_Recommendation_System/resolve/main/emotion_model.h5"


def download_model():
    """Download the emotion model from HuggingFace if it doesn't exist locally."""
    if not os.path.exists(MODEL_PATH):
        print(f"Downloading emotion model from HuggingFace to {MODEL_PATH}...")
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        r = requests.get(MODEL_URL, stream=True)
        r.raise_for_status()
        with open(MODEL_PATH, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print("Model downloaded successfully.")
    else:
        print(f"Model already exists at {MODEL_PATH}. Skipping download.")


def patch_h5_file_permanently(h5_path: str):
    """
    Keras 3 removed `batch_shape` from InputLayer config.
    This permanently rewrites the .h5 file's config to use `shape` instead,
    allowing it to load natively in Keras 3 without runtime hacks.
    """
    import re
    with h5py.File(h5_path, "r+") as f:
        if "model_config" not in f.attrs:
            return

        raw_config = f.attrs["model_config"]
        if isinstance(raw_config, bytes):
            raw_config = raw_config.decode("utf-8")

        # Skip if already patched
        if '"batch_shape"' not in raw_config:
            return

        print(f"Patching {h5_path} for Keras 3 compatibility...")
        
        def replace_batch_shape(m):
            arr_str = m.group(1)
            try:
                arr = json.loads(arr_str)
                # arr[0] is the batch dim (None), remove it
                new_shape = arr[1:]
                return f'"shape": {json.dumps(new_shape)}'
            except Exception:
                return m.group(0)

        patched = re.sub(r'"batch_shape":\s*(\[[^\]]*\])', replace_batch_shape, raw_config)
        f.attrs["model_config"] = patched.encode("utf-8")
        print("Model file permanently patched.")


def load_emotion_model():
    """Download, ensure patched, and load the emotion detection model."""
    download_model()
    
    # Ensure the H5 file is Keras 3 compatible BEFORE loading
    try:
        patch_h5_file_permanently(MODEL_PATH)
    except Exception as e:
        print(f"Warning: Failed to ensure H5 patch ({e}).")

    try:
        from tf_keras.models import load_model
    except ImportError:
        from tensorflow.keras.models import load_model
    
    model = load_model(MODEL_PATH, compile=False)
    print(f"Emotion model loaded. Input: {model.input_shape}, Output: {model.output_shape}")
    return model


def load_emotion_labels():
    """Load emotion labels from JSON and return index→label mapping."""
    with open(LABELS_PATH, "r") as f:
        label_to_idx = json.load(f)
    idx_to_label = {int(v): k for k, v in label_to_idx.items()}
    print(f"Loaded {len(idx_to_label)} emotion labels: {list(idx_to_label.values())}")
    return idx_to_label
