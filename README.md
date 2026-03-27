# Online Boutique — DevOps & SRE Portfolio Project

> A production-grade DevOps/SRE platform built from scratch on top of Google's [Online Boutique](https://github.com/GoogleCloudPlatform/microservices-demo) microservices demo. All infrastructure, packaging, GitOps, observability, and chaos engineering is authored independently — the app source is the only thing taken from the upstream repo.

---

## Table of contents

- [Project overview](#project-overview)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Phase 1 — Helm chart](#phase-1--helm-chart)
  - [Prerequisites](#prerequisites)
  - [Local deployment with kind](#local-deployment-with-kind)
  - [Helm chart design decisions](#helm-chart-design-decisions)
  - [Debugging a real production issue](#debugging-a-real-production-issue)
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
| No GitOps | ArgoCD watching GitHub, auto-syncing on push *(coming)* |
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
| currencyservice | Node.js | 7000 | Currency conversion using ECB rates |
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
├── src/                          # App source — kept from upstream, not modified
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
├── helm/                         # Helm chart — authored from scratch
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
├── terraform/                    # IaC — coming in Phase 3
├── argocd/                       # GitOps config — coming in Phase 3
├── monitoring/                   # Observability stack — coming in Phase 4
├── chaos/                        # Chaos experiments — coming in Phase 5
├── runbooks/                     # Operational runbooks — coming in Phase 5
└── load-testing/                 # k6 load test scenarios — coming in Phase 5
```

### What was deleted from the upstream repo

The following were deliberately removed to build equivalents from scratch:

| Deleted | Reason |
|---|---|
| `kubernetes-manifests/` | Replaced by Helm chart |
| `helm-chart/` | Rebuilt from scratch — upstream chart is GCP-specific |
| `terraform/` | Rebuilt from scratch — upstream targets GCP |
| `kustomize/` | Not used — Helm handles environment overlays |
| `istio-manifests/` | Out of scope for this project |
| `.github/` | Rebuilt with our own CI/CD workflows |
| `skaffold.yaml` | GCP-specific dev tool, not used |
| `loadgenerator/` | Replaced by custom k6 scenarios in Phase 5 |
| `cloudbuild.yaml` | GCP Cloud Build — replaced by GitHub Actions |

---

## Phase 1 — Helm chart

**Status: complete and validated on kind**

### Prerequisites

```bash
# Required tools
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

Expected output — 4 nodes all `Ready`:
```
NAME                     STATUS   ROLES           AGE
boutique-control-plane   Ready    control-plane
boutique-worker          Ready    <none>
boutique-worker2         Ready    <none>
boutique-worker3         Ready    <none>
```

**2. Deploy with Helm**

```bash
# Create namespace
kubectl create namespace boutique

# Install
helm install boutique ./helm \
  --namespace boutique \
  --create-namespace

# Verify all pods running
kubectl get pods -n boutique
```

Expected output — all 11 pods `Running`:
```
NAME                                     READY   STATUS    RESTARTS
adservice-cd4444c5b-xxx                  1/1     Running   0
cartservice-544955dfb6-xxx               1/1     Running   0
checkoutservice-78bb685488-xxx           1/1     Running   0
currencyservice-6cd66d76d6-xxx           1/1     Running   0
emailservice-6989bd766f-xxx              1/1     Running   0
frontend-884d9d88-xxx                    1/1     Running   0
paymentservice-b5d8b86d5-xxx             1/1     Running   0
productcatalogservice-798485b46f-xxx     1/1     Running   0
recommendationservice-645857b966-xxx     1/1     Running   0
redis-cart-747cb77488-xxx                1/1     Running   0
shippingservice-54bd9696d9-xxx           1/1     Running   0
```

**3. Access the frontend**

```bash
# Port forward to localhost
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

---

### Helm chart design decisions

**One template per resource type, not per service**

Most beginners write 10 separate deployment YAML files — one per service. This chart uses a single `deployment.yaml` that loops over all services defined in `values.yaml` using `{{- range $name, $svc := .Values.services }}`. This means:

- Adding a new service = adding one block to `values.yaml`, zero new template files
- Resource limits, security contexts, and pod specs are consistent across all services
- Environment-specific overrides are handled via `values-dev.yaml` and `values-prod.yaml`

**Security context on every pod**

Every deployment runs with:

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

This follows the principle of least privilege — no container runs as root, no container can escalate privileges.

**HPA on all 10 services**

Horizontal Pod Autoscaler is configured for every service with a default CPU utilisation target of 70%. In dev (`values-dev.yaml`) HPA is disabled to save local resources. In prod it is active and validated with k6 load tests in Phase 5.

**PodDisruptionBudget on all stateful services**

All services except frontend have a PDB with `minAvailable: 1`. This ensures Kubernetes will not evict the last running pod of a service during node maintenance or rolling updates — preserving availability across the 3-worker kind cluster.

**Frontend as NodePort, all others as ClusterIP**

Only the frontend is exposed externally via `NodePort: 30080`. All backend services are `ClusterIP` — reachable only within the cluster, enforcing that all external traffic enters through the frontend.

---

### Debugging a real production issue

During deployment, the frontend entered `CrashLoopBackOff` while all other 9 services started successfully.

**Diagnosis:**

```bash
kubectl logs frontend-xxx -n boutique
```

```
panic: environment variable "SHOPPING_ASSISTANT_SERVICE_ADDR" not set
```

**Root cause:**

`v0.10.1` of the frontend introduced a new required environment variable `SHOPPING_ASSISTANT_SERVICE_ADDR`. The app uses a `mustMapEnv` function in Go that panics if any required env var is empty or unset:

```go
func mustMapEnv(target *string, envKey string) {
    v := os.Getenv(envKey)
    if v == "" {
        panic(fmt.Sprintf("environment variable %q not set", envKey))
    }
    *target = v
}
```

Setting `value: ""` in `values.yaml` did not work — Kubernetes strips empty string values from the env spec entirely, so the variable was never injected into the container.

**Fix:**

Set a non-empty placeholder address. The shopping assistant feature only attempts to connect when explicitly triggered by a user action, so pointing to a non-existent service causes no runtime errors:

```yaml
- name: SHOPPING_ASSISTANT_SERVICE_ADDR
  value: "shoppingassistantservice:80"
```

**Lesson:** Always check `mustMapEnv` / required env var patterns when upgrading image versions of services you don't control. Kubernetes silently drops empty string env values.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Helm chart | ✅ Complete | Single Helm chart for all 10 services, validated on kind |
| Phase 2 — GitOps with ArgoCD | 🔄 In progress | ArgoCD watching GitHub, auto-sync on push |
| Phase 3 — Terraform IaC + EKS | ⏳ Planned | Terraform modules for EKS cluster, same Helm chart promoted to cloud |
| Phase 4 — Observability | ⏳ Planned | Prometheus + Grafana SLO dashboards + Loki + Jaeger |
| Phase 5 — Chaos engineering | ⏳ Planned | LitmusChaos experiments, k6 load testing, postmortems, runbooks |

---

## Tech stack

| Category | Tool |
|---|---|
| Container orchestration | Kubernetes (kind locally, EKS in cloud) |
| Package management | Helm 3 |
| GitOps | ArgoCD |
| Infrastructure as code | Terraform |
| CI/CD | GitHub Actions |
| Metrics | Prometheus + Grafana |
| Logging | Loki + Promtail |
| Tracing | Jaeger |
| Chaos engineering | LitmusChaos |
| Load testing | k6 |
| Container registry | GitHub Container Registry (GHCR) |

---

## Author

**Shrinidhi Upadhyaya**
- GitHub: [@Shrinidhi972004](https://github.com/Shrinidhi972004)
- Email: shrinidhiupadhyaya00@gmail.com