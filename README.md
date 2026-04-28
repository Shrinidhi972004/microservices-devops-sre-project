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
- [Phase 3 — Terraform + AWS EKS](#phase-3--terraform--aws-eks)
- [Phase 4 — Observability](#phase-4--observability)
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
| Infrastructure clicked in console | Terraform modules — reproducible, version-controlled |
| No observability | Prometheus + Grafana SLO dashboards + Jaeger tracing |
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

### AWS infrastructure architecture

```
Internet
    │
    ▼
Application Load Balancer (public subnets, spans 3 AZs)
    │
    ▼
EKS Worker Nodes (private subnets, 3x t3.medium)
    │
    ├── boutique namespace (all 10 services + Redis)
    ├── argocd namespace (GitOps controller)
    └── monitoring namespace (Prometheus, Grafana, Jaeger)

Supporting services:
    ECR      — container registry (10 repos, one per service)
    S3       — Terraform remote state
    DynamoDB — Terraform state locking
    NAT GW   — private subnet egress
    IAM      — node roles + IRSA
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
├── protos/                       # gRPC proto definitions
├── helm/                         # Helm chart — built from scratch
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-dev.yaml
│   └── templates/
│       ├── _helpers.tpl
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── hpa.yaml
│       └── poddisruptionbudget.yaml
├── argocd/
│   └── application.yaml
├── terraform/
│   ├── modules/
│   │   ├── vpc/
│   │   ├── eks/
│   │   └── ecr/
│   └── envs/prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── backend.tf
│       └── terraform.tfvars
├── monitoring/
│   ├── prometheus/
│   │   ├── servicemonitor.yaml   # tells Prometheus to scrape boutique services
│   │   └── rules/
│   │       └── slo-rules.yaml    # SLO alerting rules + error budget
│   └── grafana/
│       └── dashboards/
│           └── sre-overview.json # exported SRE dashboard
├── chaos/                        # coming in Phase 5
├── runbooks/                     # coming in Phase 5
└── load-testing/                 # coming in Phase 5
```

### Everything deleted from upstream and why

| Deleted from upstream | Why deleted | Rebuilt as |
|---|---|---|
| `kubernetes-manifests/` | Raw YAML, no templating, no env management | `helm/templates/` |
| `helm-chart/` | GCP-specific, not portable to AWS | `helm/` — cloud-agnostic, AWS-ready |
| `terraform/` | Targets GCP, not AWS | `terraform/` — AWS EKS modules |
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
- `automated` — ArgoCD polls GitHub every 3 minutes, no manual sync needed
- `selfHeal: true` — manual cluster changes are reverted to match GitHub
- `prune: true` — services removed from `values.yaml` are deleted from cluster
- `CreateNamespace=true` — namespace created automatically if missing

### Apply and access

```bash
kubectl apply -f argocd/application.yaml
kubectl get application -n argocd

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Port forward UI
kubectl port-forward svc/argocd-server 8081:80 -n argocd
```

### GitOps validation

```bash
# Edit helm/values-dev.yaml → frontend.replicas: 2
git add . && git commit -m "test: scale frontend to 2 replicas" && git push origin main

# Watch pods — second frontend appears automatically within 3 minutes
kubectl get pods -n boutique -w
```

---

## Phase 3 — Terraform + AWS EKS

**Status: complete — infrastructure provisioned, app deployed, resources destroyed**

### Overview

The same Helm chart validated on kind is promoted to a real AWS EKS cluster provisioned entirely with Terraform. Three independent modules — vpc, eks, ecr — are called from a single root env config. Remote state in S3 with DynamoDB locking.

### Prerequisites

```bash
terraform  >= 1.6.0
aws-cli    >= 2.x
aws sts get-caller-identity  # verify credentials
```

### Step 1 — Create S3 backend and DynamoDB lock table

```bash
export AWS_REGION=ap-south-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws s3api create-bucket \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --region ${AWS_REGION} \
  --create-bucket-configuration LocationConstraint=${AWS_REGION}

aws s3api put-bucket-versioning \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws dynamodb create-table \
  --table-name boutique-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ${AWS_REGION}
```

### Step 2 — Configure backend.tf

Edit `terraform/envs/prod/backend.tf` — replace `YOUR_ACCOUNT_ID`:

```hcl
terraform {
  backend "s3" {
    bucket         = "boutique-terraform-state-YOUR_ACCOUNT_ID"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "boutique-terraform-locks"
    encrypt        = true
  }
}
```

### Step 3 — Init, plan, apply

```bash
cd terraform/envs/prod
terraform init
terraform plan -out=tfplan
terraform apply "tfplan"
```

EKS takes 12-15 minutes. Total ~20 minutes. Creates 48 resources.

### Step 4 — Connect and deploy

```bash
aws eks update-kubeconfig --region ap-south-1 --name boutique
kubectl get nodes -o wide

kubectl create namespace boutique
helm install boutique ./helm --namespace boutique -f helm/values.yaml

# Expose frontend via AWS ELB
kubectl patch svc frontend -n boutique \
  -p '{"spec": {"type": "LoadBalancer"}}'
kubectl get svc frontend -n boutique
```

Open `http://<EXTERNAL-IP>:8080`

### Teardown — complete cleanup

```bash
helm uninstall boutique -n boutique
cd terraform/envs/prod && terraform destroy -auto-approve

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws s3api delete-objects \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --delete "$(aws s3api list-object-versions \
    --bucket boutique-terraform-state-${ACCOUNT_ID} \
    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
    --output json)" --region ap-south-1

aws s3api delete-bucket \
  --bucket boutique-terraform-state-${ACCOUNT_ID} --region ap-south-1

aws dynamodb delete-table \
  --table-name boutique-terraform-locks --region ap-south-1
```

---

## Phase 4 — Observability

**Status: complete and validated on kind**

### Stack overview

```
Prometheus      — scrapes metrics from all pods + Kubernetes internals
Grafana         — dashboards + SLO visualisation (NodePort: 30030)
Alertmanager    — receives and routes SLO breach alerts
kube-state-metrics — cluster-level metrics (pod status, replica counts)
Node Exporter   — node-level metrics (CPU, memory per node)
Jaeger          — distributed tracing across gRPC service calls
ServiceMonitor  — tells Prometheus to scrape boutique namespace
PrometheusRules — SLO alerting rules + error budget burn rate
```

All installed via Helm into the `monitoring` namespace.

### Prerequisites

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo update
```

### Step 1 — Fix inotify limits on kind nodes

This is required before installing any log collectors. kind nodes have low default inotify limits which cause `too many open files` errors:

```bash
for node in $(kubectl get nodes -o name | sed 's/node\///'); do
  docker exec $node sysctl fs.inotify.max_user_instances=512
  docker exec $node sysctl fs.inotify.max_user_watches=524288
done
```

**Note:** This must be run again after every system reboot or kind cluster restart — the limits reset on restart.

### Step 2 — Install kube-prometheus-stack

```bash
kubectl create namespace monitoring

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --timeout 10m \
  --wait=false \
  --set prometheus.prometheusSpec.retention=7d \
  --set prometheus.prometheusSpec.scrapeInterval=15s \
  --set grafana.adminPassword=boutique-grafana \
  --set grafana.service.type=NodePort \
  --set grafana.service.nodePort=30030 \
  --set alertmanager.enabled=true \
  --set nodeExporter.enabled=true \
  --set kubeStateMetrics.enabled=true \
  --set kube-state-metrics.image.tag=v2.13.0
```

Wait for all pods:

```bash
kubectl get pods -n monitoring -w
```

Expected pods — all `Running`:
```
alertmanager-prometheus-kube-prometheus-alertmanager-0   2/2   Running
prometheus-grafana-xxx                                   3/3   Running
prometheus-kube-prometheus-operator-xxx                  1/1   Running
prometheus-kube-state-metrics-xxx                        1/1   Running
prometheus-prometheus-kube-prometheus-prometheus-0       2/2   Running
prometheus-prometheus-node-exporter-xxx (x4)             1/1   Running
```

**Note on operator restarts:** The prometheus-operator pod restarts 2-3 times on fresh install due to TLS certificate initialisation. This is normal — it stabilises within 2 minutes.

**Note on kube-state-metrics:** Pin to `v2.13.0` explicitly. v2.18.0 has a liveness probe port mismatch bug where the probe checks port 8081 but the container listens on 8080, causing permanent CrashLoopBackOff.

### Step 3 — Install Jaeger

```bash
helm install jaeger jaegertracing/jaeger \
  --namespace monitoring \
  --set allInOne.enabled=true \
  --set provisionDataStore.cassandra=false \
  --set provisionDataStore.elasticsearch=false \
  --set storage.type=memory \
  --set agent.enabled=false \
  --set collector.enabled=false \
  --set query.enabled=false \
  --timeout 5m \
  --wait=false
```

### Step 4 — Apply ServiceMonitor and SLO rules

```bash
kubectl apply -f monitoring/prometheus/servicemonitor.yaml
kubectl apply -f monitoring/prometheus/rules/slo-rules.yaml

# Verify
kubectl get servicemonitor -n monitoring | grep boutique
kubectl get prometheusrule -n monitoring | grep boutique
```

The ServiceMonitor tells Prometheus to scrape all services in the `boutique` namespace. The PrometheusRules define:
- Availability SLO — 99.5% of frontend requests must succeed
- Error budget burn rate alert — fires when budget exhausts faster than allowed
- p99 latency alert — fires when 99th percentile exceeds 500ms

### Step 5 — Expose UIs via NodePort

```bash
# Grafana — already NodePort 30030 from install
# Get kind node IP
kubectl get nodes -o wide | grep worker | head -1 | awk '{print $6}'

# Prometheus
kubectl patch svc prometheus-kube-prometheus-prometheus -n monitoring \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/type", "value": "NodePort"}]'

# Jaeger
kubectl patch svc jaeger -n monitoring \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/type", "value": "NodePort"}]'

# Get assigned ports
kubectl get svc -n monitoring | grep NodePort
```

Access via browser (replace NODE-IP with your kind worker node IP):
- Grafana → `http://NODE-IP:30030` (admin / boutique-grafana)
- Prometheus → `http://NODE-IP:<prometheus-nodeport>`
- Jaeger → `http://NODE-IP:<jaeger-nodeport>`

### Step 6 — SRE Overview dashboard

The dashboard `monitoring/grafana/dashboards/sre-overview.json` is committed to the repo and contains 8 panels:

| Panel | Query | Type |
|---|---|---|
| CPU usage by pod | `sum(rate(container_cpu_usage_seconds_total{namespace="boutique"}[5m])) by (pod)` | Time series |
| Memory usage by pod | `sum(container_memory_working_set_bytes{namespace="boutique", container!=""}) by (pod)` | Time series |
| Healthy pods | `count(kube_pod_status_ready{namespace="boutique", condition="true"})` | Stat |
| Network receive rate | `sum(rate(container_network_receive_bytes_total{namespace="boutique"}[5m])) by (pod)` | Time series |
| Network transmit rate | `sum(rate(container_network_transmit_bytes_total{namespace="boutique"}[5m])) by (pod)` | Time series |
| Node CPU usage | `sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) by (instance)` | Time series |
| Node memory usage | `sum(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) by (instance)` | Time series |
| Pod restart count | `sum(kube_pod_container_status_restarts_total{namespace="boutique"}) by (pod)` | Time series |

To import the dashboard in Grafana: Dashboards → Import → Upload JSON file → select `monitoring/grafana/dashboards/sre-overview.json`.

### Observability design decisions

**kube-prometheus-stack over individual installs**

Installing Prometheus, Grafana, and Alertmanager separately requires manual wiring. The `kube-prometheus-stack` Helm chart bundles all three with pre-configured scrape configs, recording rules, and dashboards. This is the production standard — it's what most companies run.

**ServiceMonitor over static scrape configs**

Rather than hardcoding scrape targets in `prometheus.yaml`, a `ServiceMonitor` CRD dynamically tells Prometheus which services to scrape using label selectors. Adding a new service to the boutique namespace automatically gets scraped — no Prometheus config changes needed.

**Error budget burn rate alerting**

Two alerts are configured — a fast burn rate (14.4x over 1 hour) that fires immediately for critical incidents, and a slow burn rate (6x over 6 hours) for gradual degradation. This is the Google SRE book's recommended alerting model for SLOs.

**Jaeger all-in-one with in-memory storage**

For local development, Jaeger runs in all-in-one mode with in-memory storage — no Cassandra or Elasticsearch needed. Traces are lost on pod restart which is acceptable locally. Production would use persistent storage.

**NodePort over port-forward for local access**

Port-forwarding breaks on system sleep/restart. NodePort assignments persist as long as the kind cluster runs — Grafana, Prometheus, and Jaeger are always accessible at fixed addresses without any manual commands.

### Debugging encountered during Phase 4

**Issue 1 — Promtail `too many open files`**

Promtail crashed on all nodes with `failed to make file target manager: too many open files`. Root cause: kind nodes default to very low inotify limits (128 instances, 8192 watches). Promtail watches log files for every pod which exhausts these limits quickly.

Fix: increase inotify limits on all kind nodes via `docker exec` before installing any log collectors.

**Issue 2 — kube-state-metrics liveness probe port mismatch**

kube-state-metrics v2.18.0 changed its health check port but the kube-prometheus-stack Helm chart's probe was still pointing to the old port. Result: permanent CrashLoopBackOff with `connection refused` on the readiness probe.

Fix: pin `kube-state-metrics.image.tag=v2.13.0` which uses the port the chart's probe expects.

**Issue 3 — Grafana datasource conflict**

Attempting to provision Loki as a datasource via ConfigMap failed with `Only one datasource per organization can be marked as default` because kube-prometheus-stack already provisions Prometheus as the default. Fix: add additional datasources through the Grafana UI directly rather than via ConfigMap provisioning.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Helm chart | ✅ Complete | Single Helm chart for all 10 services, validated on kind |
| Phase 2 — GitOps with ArgoCD | ✅ Complete | ArgoCD watching GitHub, auto-sync with self-healing on every push |
| Phase 3 — Terraform + AWS EKS | ✅ Complete | Modular Terraform, EKS cluster, same Helm chart promoted to AWS |
| Phase 4 — Observability | ✅ Complete | Prometheus + Grafana SRE dashboard + Jaeger + SLO alerting rules |
| Phase 5 — Chaos engineering | 🔄 In progress | LitmusChaos experiments, k6 load tests, postmortems, runbooks |

---

## Tech stack

| Category | Tool |
|---|---|
| Container orchestration | Kubernetes (kind locally, AWS EKS in cloud) |
| Package management | Helm 3 |
| GitOps | ArgoCD |
| Infrastructure as code | Terraform (AWS provider) |
| CI/CD | GitHub Actions *(coming)* |
| Metrics | Prometheus + Grafana |
| Alerting | Alertmanager + PrometheusRules |
| Tracing | Jaeger |
| Chaos engineering | LitmusChaos *(coming)* |
| Load testing | k6 *(coming)* |
| Container registry | AWS ECR |
| Cloud | AWS (EKS, ECR, S3, VPC, DynamoDB, IAM) |

---

## Author

**Shrinidhi Upadhyaya**
- GitHub: [@Shrinidhi972004](https://github.com/Shrinidhi972004)
- Email: shrinidhiupadhyaya00@gmail.com