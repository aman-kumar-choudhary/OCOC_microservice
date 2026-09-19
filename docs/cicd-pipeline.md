# CI/CD Pipeline

## Overview

The OCOC platform uses GitHub Actions for continuous integration and deployment. The pipeline builds Docker images, pushes them to GitHub Container Registry (GHCR), and renders Kubernetes manifests for deployment to k3s.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                            │
│                                                             │
│  Trigger: push to main, tags v*                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Job 1: build-and-push                                 │  │
│  │ • Checkout code                                       │  │
│  │ • Free disk space                                     │  │
│  │ • Set up QEMU + Buildx                                │  │
│  │ • Login to GHCR                                       │  │
│  │ • Build Docker image (linux/amd64)                    │  │
│  │ • Push to ghcr.io/innovions-antlix/freco:latest       │  │
│  │ • Output: sha_short                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Job 2: render-and-bundle (deploy-to-k3s.yml)          │  │
│  │ • Render K8s manifests with envsubst                  │  │
│  │ • Substitute: REGISTRY, IMAGE_NAME, IMAGE_TAG, GPU    │  │
│  │ • Write manifests to job summary                      │  │
│  │ • Upload as artifact: k8s-manifests-{tag}             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Deploy: kubectl apply -f rendered/                         │ └─────────────────────────────────────────────────────────────┘
```

---

## Workflow Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci-cd.yaml` | Main CI/CD workflow |
| `.github/workflows/deploy-to-k3s.yml` | Reusable workflow for K8s manifest rendering |

---

## Job 1: Build and Push

### Triggers

- Push to `main` branch
- Tags matching `v*` (e.g., `v1.0.0`)

### Steps

1. **Checkout repository** - Get the latest code
2. **Free disk space** - Remove unnecessary tools (dotnet, android, ghc)
3. **Get short SHA** - For tagging images with commit hash
4. **Set up QEMU** - For cross-platform builds
5. **Set up Docker Buildx** - For advanced build features
6. **Log in to GHCR** - Authenticate with GitHub Container Registry
7. **Extract Docker metadata** - Generate tags (latest, sha-short)
8. **Build and push Docker image** - Multi-platform build

### Outputs

- `sha_short` - Short commit SHA for downstream jobs

---

## Job 2: Render and Bundle

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `image_tag` | Image tag to deploy | `latest` |
| `enable_gpu` | Enable GPU resource requests | `true` |


---

## Deployment

### Manual Deployment

1. Download the `k8s-manifests-{tag}` artifact
2. Edit `ghcr-pull-secret.yml` with your GitHub credentials
3. Apply all manifests:

```bash
kubectl apply -f rendered/
```

### Automated Deployment

The rendered manifests can be applied automatically in a separate step or ArgoCD/Flux can watch the artifact repository.

---

## Kubernetes Resources

### Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: freco
  labels:
    name: freco
```

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: freco-config
  namespace: freco
data:
  INFERENCE_DEVICE: "auto"
  DETECTION_CTX_ID: "0"
  COSINE_SIMILARITY_THRESHOLD: "0.55"
  FACE_VISIBILITY_THRESHOLD: "0.80"
  LIVENESS_THRESHOLD: "0.85"
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: freco
  namespace: freco
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP
    name: http
  selector:
    app: freco
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: freco
  namespace: freco
spec:
  replicas: 1
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 0
      maxUnavailable: 1
  selector:
    matchLabels:
      app: freco
  template:
    metadata:
      labels:
        app: freco
    spec:
      imagePullSecrets:
      - name: ghcr-pull-secret
      containers:
      - name: freco
        image: ghcr.io/innovions-antlix/freco:latest
        ports:
        - containerPort: 8000
          name: http
        envFrom:
        - configMapRef:
            name: freco-config
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
            nvidia.com/gpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
            nvidia.com/gpu: "1"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 15
          periodSeconds: 20
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 15
          periodSeconds: 20
```

---

## Docker Configuration

### Freco Dockerfile (Multi-Stage)

**Stage 1: Builder (Ubuntu 22.04)**
- Install Python and build dependencies
- Create virtual environment
- Install requirements from `requirements.txt`
- Download liveness models (MiniFASNet)
- Download and extract Antelopev2 model pack
- Strip binaries for size optimization

**Stage 2: Runner (nvidia/cuda:12.4.1-base)**
- Install minimal CUDA/cuDNN runtime libraries
- Copy virtual environment and models from builder
- Copy application source code
- Expose port 8000
- Run: `uvicorn app.main:app`

### User Management Dockerfile

**Stage 1: Builder (golang:1.22-alpine)**
- Download dependencies
- Build static binary with `CGO_ENABLED=0`

**Stage 2: Runner (alpine:3.19)**
- Install ca-certificates
- Copy binary and migrations
- Expose port 8080
- Run: `./server`

---

## Environment Variables for CI/CD

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions |
| `REGISTRY` | Container registry (ghcr.io) |
| `IMAGE_NAME` | Image name (innovions-antlix/freco) |
| `IMAGE_TAG` | Tag from git ref or manual input |
| `ENABLE_GPU` | Whether to include GPU resources |

### Steps

1. **Checkout repository**
2. **Render manifests** - Substitute variables in K8s manifests
3. **Write manifests to job summary** - Display in GitHub UI
4. **Upload rendered manifests as artifact** - For download and deployment

### Rendered Manifests

| File | Purpose |
|------|---------|
| `namespace.yml` | Creates `freco` namespace |
| `configmap.yml` | Inference settings, thresholds |
| `service.yml` | ClusterIP service on port 80 → 8000 |
| `deployment.yml` | Single replica, GPU optional, health probes |
| `ghcr-pull-secret.yml` | Image pull secret for GHCR |
