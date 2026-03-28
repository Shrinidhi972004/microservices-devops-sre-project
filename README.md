# Online Boutique — DevOps & SRE Portfolio Project

> Google's [Online Boutique](https://github.com/GoogleCloudPlatform/microservices-demo) provides the application source code only. **Every single DevOps and SRE file in this repository — Helm chart, Terraform, CI/CD pipelines, ArgoCD GitOps config, observability stack, chaos experiments, and runbooks — was deleted from the upstream repo and rebuilt completely from scratch.** This is not a deployment of someone else's infrastructure. This is an independently engineered production-grade platform built on top of a real polyglot microservices application.

---

## Why built from scratch

The upstream Online Boutique repo ships with GCP-specific deployment files — Cloud Build configs, Skaffold, GCP Terraform, and a GCP-optimised Helm chart. All of that was deliberately deleted.

The intent of this project is to demonstrate the ability to **design and build DevOps/SRE infrastructure independently** — not to follow a tutorial or deploy pre-written configs. Every architectural decision, every Helm template, every Terraform module, every alert rule, and every runbook in this repo was written by hand with a clear understanding of why it exists.

This is the difference between knowing how to use a tool and knowing how to engineer with one.

---

## Table of contents

- [Project overview](#project-overview)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Phase 1 — Helm chart](#phase-1--helm-chart)
- [Phase 2 — GitOps with ArgoCD](#phase-2--gitops-with-argocd)
- [Roadmap](#roadmap)
- [Tech stack](#tech-stack)

---

## Project overview

This project demonstrates end-to-end DevOps and SRE engineering on a real polyglot microservices application — 10 services written in Go, Python, Java, C#, and Node.js, communicating over gRPC.

The goal is not just to deploy the app, but to **operate it like a production SRE team would** — with Helm-packaged deployments, GitOps-driven delivery, full observability, and chaos engineering to validate resilience.

### What makes this different from a tutorial project

| Typical "deployed on K8s" project | This project |
|---|---|
| Raw YAML manifests copy-pasted | Single Helm chart parameterising all 10 services |
| One namespace, no isolation | Dedicated namespace per environment |
| No resource limits | CPU/memory requests and limits on every pod |
| No pod disruption budgets | PDBs on all stateful services |
| No autoscaling | HPA configured on all 10 services |
| Manual kubectl apply to deploy | ArgoCD auto-syncs on every GitHub push |
| No observability | Prometheus + Grafana SLO dashboards *(coming)* |
| No chaos testing | LitmusChaos experiments + postmortems *(coming)* |

---

## Architecture

The application is Google's Online Boutique — an e-commerce storefront with 10 backend microservices and a Redis cart store.

```
User → frontend (Go, HTTP)
         │
         ├── productcatalogservice (Go, gRPC)
         ├── currencyservice (Node.js, gRPC)
         ├── cartservice (C#, gRPC) ← Redis
         ├── recommendationservice (Python, gRPC)
         ├── adservice (Java, gRPC)
         └── checkoutservice (Go, gRPC)
                  │
                  ├── paymentservice (Node.js, gRPC)
                  ├── shippingservice (Go, gRPC)
                  └── emailservice (Python, gRPC)
```

### Service inventory

| Service | Language | Port | Role |
|---|---|---|---|
| frontend | Go | 8080 | HTTP entry point, calls all services |
| cartservice | C# | 7070 | Manages user cart, backed by Redis |
| productcatalogservice | Go | 3550 | Serves product list from JSON |
| currencyservice | Node.js | 7000 | Currency conversion |
| paymentservice | Node.js | 50051 | Mock payment charge |
| shippingservice | Go | 50051 | Mock shipping quote and order |
| emailservice | Python | 8080 | Mock order confirmation email |
| recommendationservice | Python | 8080 | Cart-based product recommendations |
| adservice | Java | 9555 | Context-aware advertisement service |
| checkoutservice | Go | 5050 | Orchestrates the full checkout flow |
| redis-cart | Redis | 6379 | Cart session storage |

---

## Repository structure

```
.
├── src/                          # App source — only thing kept from upstream
│   ├── frontend/
│   ├── cartservice/
│   ├── checkoutservice/
│   ├── currencyservice/
│   ├── emailservice/
│   ├── paymentservice/
│   ├── productcatalogservice/
│   ├── recommendationservice/
│   ├── adservice/
│   └── shippingservice/
├── protos/                       # gRPC proto definitions
├── helm/                         # Helm chart — built from scratch
│   ├── Chart.yaml
│   ├── values.yaml               # Single source of truth for all 10 services
│   ├── values-dev.yaml           # kind overrides
│   ├── values-prod.yaml          # EKS overrides (coming)
│   └── templates/
│       ├── _helpers.tpl
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── hpa.yaml
│       └── poddisruptionbudget.yaml
├── argocd/
│   └── application.yaml          # ArgoCD Application manifest
├── terraform/                    # IaC for AWS EKS — coming in Phase 3
├── monitoring/                   # Observability stack — coming in Phase 4
├── chaos/                        # Chaos experiments — coming in Phase 5
├── runbooks/                     # Operational runbooks — coming in Phase 5
└── load-testing/                 # k6 load test scenarios — coming in Phase 5
```

### Everything deleted from upstream and why

| Deleted from upstream | Why deleted | Rebuilt as |
|---|---|---|
| `kubernetes-manifests/` | Raw YAML, no templating, no env management | `helm/templates/` |
| `helm-chart/` | GCP-specific, not portable to AWS | `helm/` — cloud-agnostic, AWS-ready |
| `terraform/` | Targets GCP, not AWS | `terraform/` — AWS EKS modules *(coming)* |
| `kustomize/` | Redundant — Helm handles env overlays | `values-dev.yaml`, `values-prod.yaml` |
| `istio-manifests/` | GCP service mesh, not used | NetworkPolicies in Helm instead |
| `.github/` | GCP Cloud Build workflows | `.github/workflows/` — GitHub Actions *(coming)* |
| `skaffold.yaml` | GCP-specific dev tool | Replaced by Helm + ArgoCD GitOps |
| `loadgenerator/` | Black box Locust container | `load-testing/` — custom k6 scenarios *(coming)* |
| `cloudbuild.yaml` | GCP Cloud Build | GitHub Actions CI pipeline *(coming)* |
| `docs/` | GCP deployment guides | This README |
| `.deploystack/` | GCP-specific tooling | Not needed |

The git history from the upstream repo was also wiped (`rm -rf .git`) and a fresh repository was initialised — so every commit in this repo represents work done on this project, not inherited history from Google.

---

## Phase 1 — Helm chart

**Status: complete and validated on kind**

### Prerequisites

```bash
docker     >= 24.x
kubectl    >= 1.28
helm       >= 3.14
kind       >= 0.22
```

### Local deployment with kind

**1. Create the kind cluster**

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
  - role: worker
```

```bash
kind create cluster --name boutique --config kind-config.yaml
kubectl get nodes
```

**2. Deploy with Helm**

```bash
kubectl create namespace boutique

helm install boutique ./helm \
  --namespace boutique \
  --create-namespace

kubectl get pods -n boutique
```

**3. Access the frontend**

```bash
kubectl port-forward svc/frontend 8080:8080 -n boutique
```

Open `http://localhost:8080` in your browser.

**4. Upgrade after values changes**

```bash
helm upgrade boutique ./helm --namespace boutique
```

**5. Tear down**

```bash
helm uninstall boutique --namespace boutique
kind delete cluster --name boutique
```

### Helm chart design decisions

**One template per resource type, not per service**

A single `deployment.yaml` iterates over all services using `{{- range $name, $svc := .Values.services }}`. Adding a new service requires only one block in `values.yaml` — zero new template files.

**Security context on every pod**

Every deployment enforces:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

No container runs as root. No container can escalate privileges.

**HPA on all 10 services**

Horizontal Pod Autoscaler configured for every service with 70% CPU utilisation target. Disabled in `values-dev.yaml` to conserve local resources.

**PodDisruptionBudget on all backend services**

All services except frontend have `minAvailable: 1` — Kubernetes will not evict the last running pod during node drain or rolling updates.

**Frontend as NodePort, all others as ClusterIP**

Only the frontend is exposed externally. All backend services are reachable only within the cluster.

### Debugging a real production issue

During initial deployment the frontend entered `CrashLoopBackOff` while all other 9 services started successfully.

**Diagnosis:**
```bash
kubectl logs frontend-xxx -n boutique
# panic: environment variable "SHOPPING_ASSISTANT_SERVICE_ADDR" not set
```

**Root cause:** `v0.10.1` introduced a new required env variable. The app's `mustMapEnv` function panics if any required env var is empty or unset. Setting `value: ""` in `values.yaml` did not work — Kubernetes silently strips empty string values from the env spec entirely.

**Fix:**
```yaml
- name: SHOPPING_ASSISTANT_SERVICE_ADDR
  value: "shoppingassistantservice:80"
```

**Lesson:** Kubernetes silently drops `value: ""` env entries. Always use a non-empty placeholder when a required env var points to an optional or non-existent service.

---

## Phase 2 — GitOps with ArgoCD

**Status: complete and validated on kind**

### How it works

```
Push to GitHub (helm/values.yaml)
        │
        ▼
ArgoCD detects drift (polls every 3 min)
        │
        ▼
ArgoCD syncs Helm chart to cluster
        │
        ▼
Cluster reflects GitHub state exactly
```

GitHub is the single source of truth. Nobody runs `kubectl apply` or `helm upgrade` manually — every change goes through Git.

### ArgoCD installation

ArgoCD is installed via Helm — not raw `kubectl apply` — so it is versioned, reproducible, and upgradeable:

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

kubectl create namespace argocd

helm install argocd argo/argo-cd \
  --namespace argocd \
  --set configs.params."server\.insecure"=true

kubectl get pods -n argocd
```

### ArgoCD Application manifest

The `argocd/application.yaml` defines what ArgoCD watches and where it deploys:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: online-boutique
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Shrinidhi972004/microservices-devops-sre-project.git
    targetRevision: main
    path: helm
    helm:
      valueFiles:
        - values.yaml
        - values-dev.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: boutique
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

Key flags:
- `automated` — no manual sync needed, ArgoCD polls GitHub every 3 minutes
- `selfHeal: true` — if someone manually changes the cluster, ArgoCD reverts it back to what GitHub says
- `prune: true` — if a service is removed from `values.yaml`, ArgoCD deletes it from the cluster
- `CreateNamespace=true` — ArgoCD creates the `boutique` namespace if it doesn't exist

### Apply the Application

```bash
kubectl apply -f argocd/application.yaml

# Check sync status
kubectl get application -n argocd
```

### Access the ArgoCD UI

```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Port forward
kubectl port-forward svc/argocd-server 8081:80 -n argocd
```

Open `http://localhost:8081` — login with username `admin`.

### GitOps validation

To prove the loop works — change a value in `values-dev.yaml`, push to GitHub, and watch ArgoCD sync it without touching the cluster:

```bash
# Example: scale frontend to 2 replicas
# Edit helm/values-dev.yaml → frontend.replicas: 2
git add .
git commit -m "test: scale frontend to 2 replicas"
git push origin main

# Watch pods — second frontend appears automatically
kubectl get pods -n boutique -w
```

ArgoCD syncs within ~3 minutes. The cluster never needs to be touched directly.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Helm chart | ✅ Complete | Single Helm chart for all 10 services, validated on kind |
| Phase 2 — GitOps with ArgoCD | ✅ Complete | ArgoCD watching GitHub, auto-sync with self-healing on every push |
| Phase 3 — Terraform + AWS EKS | 🔄 In progress | Terraform modules for EKS, same Helm chart promoted to AWS |
| Phase 4 — Observability | ⏳ Planned | Prometheus + Grafana SLO dashboards, Loki, Jaeger tracing |
| Phase 5 — Chaos engineering | ⏳ Planned | LitmusChaos experiments, k6 load tests, postmortems, runbooks |

---

## Tech stack

| Category | Tool |
|---|---|
| Container orchestration | Kubernetes (kind locally, AWS EKS in cloud) |
| Package management | Helm 3 |
| GitOps | ArgoCD |
| Infrastructure as code | Terraform (AWS provider) |
| CI/CD | GitHub Actions |
| Metrics | Prometheus + Grafana |
| Logging | Loki + Promtail |
| Tracing | Jaeger |
| Chaos engineering | LitmusChaos |
| Load testing | k6 |
| Container registry | GitHub Container Registry (GHCR) |
| Cloud | AWS (EKS, ECR, S3, VPC) |

---

## Author

**Shrinidhi Upadhyaya**
- GitHub: [@Shrinidhi972004](https://github.com/Shrinidhi972004)
- Email: shrinidhiupadhyaya00@gmail.com