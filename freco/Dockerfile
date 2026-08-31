# ==========================================
# STAGE 1: Builder
# ==========================================
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install build dependencies and native python3 from official Ubuntu repos
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    python3-dev \
    curl \
    build-essential \
    ca-certificates \
    binutils \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment to isolate installed packages
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -U pip wheel setuptools && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir insightface==0.7.3 --no-deps

# Pre-download and cache liveness models
RUN mkdir -p models/liveness && \
    curl -L --retry 3 -o models/liveness/MiniFASNetV2.onnx https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx && \
    curl -L --retry 3 -o models/liveness/MiniFASNetV1SE.onnx https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV1SE.onnx

# Pre-download and cache Antelopev2 InsightFace model pack, removing unused files
RUN python3 -c "import urllib.request, zipfile, os, shutil; from pathlib import Path; os.makedirs('models', exist_ok=True); zip_path = 'models/antelopev2.zip'; print('Downloading antelopev2.zip...'); urllib.request.urlretrieve('https://github.com/deepinsight/insightface/releases/download/v0.7/antelopev2.zip', zip_path); print('Extracting...'); zip_ref = zipfile.ZipFile(zip_path, 'r'); zip_ref.extractall('models'); zip_ref.close(); os.remove(zip_path); nested_dir = Path('models/antelopev2/antelopev2'); target_dir = Path('models/antelopev2'); [shutil.move(str(f), str(target_dir)) for f in nested_dir.glob('*.onnx')] if nested_dir.exists() else None; shutil.rmtree(str(nested_dir)) if nested_dir.exists() else None; [(target_dir / unused_model).unlink(missing_ok=True) for unused_model in ['1k3d68.onnx', '2d106det.onnx', 'genderage.onnx']]; print('InsightFace antelopev2 models cleaned and structured.')"

# Optimize virtualenv: strip unneeded symbols from binaries and remove build/dev tools
RUN find /opt/venv -name "*.so*" -exec strip --strip-unneeded {} + 2>/dev/null || true && \
    rm -rf /opt/venv/lib/python*/site-packages/pip \
           /opt/venv/lib/python*/site-packages/setuptools \
           /opt/venv/lib/python*/site-packages/wheel \
           /opt/venv/lib/python*/site-packages/pkg_resources \
           /opt/venv/share \
           /opt/venv/bin/pip* \
           /opt/venv/bin/wheel

# ==========================================
# STAGE 2: Minimal GPU Runner
# ==========================================
FROM nvidia/cuda:12.4.1-base-ubuntu22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    INSIGHTFACE_MODEL_ROOT=. \
    PATH="/opt/venv/bin:$PATH" \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

WORKDIR /app

# Install ONLY runtime dependencies and minimal CUDA/cuDNN libraries required for ONNX Runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    libgl1 \
    libglib2.0-0 \
    ca-certificates \
    cuda-cudart-12-4 \
    libcublas-12-4 \
    libcufft-12-4 \
    libcurand-12-4 \
    libcudnn9-cuda-12 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment and models from builder stage
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /build/models ./models

# Copy the application source code
COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
