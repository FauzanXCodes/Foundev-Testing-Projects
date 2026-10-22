# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies required for OpenCV and face detection
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from the root
COPY requirements.txt .

# Install Python dependencies
# We use --no-cache-dir to keep the image small
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code and models from the project structure
# Note: In docker-compose, we can adjust context, but here we assume relative to root
COPY backend/ ./backend/
COPY models/ ./models/

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the application
# We use the module path because model_loader.py handles relative resolution
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
