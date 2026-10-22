# 🚀 How to Run MoodTunes

Follow these steps to set up and run the **Emotion-Detection-and-Music-Recommendation-System** on your local machine.

---

## 🛠️ Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **npm** or **yarn**
- **Internet Connection** (to download the AI model on the first run)

---

## 📥 1. Backend Setup (FastAPI)

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Create a virtual environment (Recommended):**
    ```bash
    python -m venv venv
    ```
3.  **Activate the virtual environment:**
    - **Windows:** `venv\Scripts\activate`
    - **Mac/Linux:** `source venv/bin/activate`
4.  **Install dependencies:**
    ```bash
    pip install -r ../requirements.txt
    ```
5.  **Start the Backend Server:**
    ```bash
    uvicorn app:app --reload
    ```
    *Note: On the first run, the system will automatically download the ~200MB emotion model from HuggingFace.*

---

## 🎨 2. Frontend Setup (Next.js)

1.  **Open a new terminal and navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the Development Server:**
    ```bash
    npm run dev
    ```
4.  **Access the Application:**
    Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔍 3. Verification
- **Backend:** Check if [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) returns `{"status": "ok"}`.
- **Frontend:** You should see the "MoodTunes" UI with functional options for image upload and webcam.

---

## 💡 Troubleshooting
- **Model Download Failed:** Ensure you have enough disk space (~200MB) and a stable internet connection.
- **CORS Errors:** The backend is configured to allow `http://localhost:3000`. If your frontend runs elsewhere, update the CORS middleware in `backend/app.py`.
- **Camera Not Working:** Ensure your browser has permission to access the webcam and no other application is using it.
