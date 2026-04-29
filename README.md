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
- [Phase 5 — CI/CD with GitHub Actions](#phase-5--cicd-with-github-actions)
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
| No alerting | Alertmanager → Slack real-time incident notifications |
| No CI pipeline | GitHub Actions — lint, validate, Trivy scan, GHCR push |
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
    └── monitoring namespace (Prometheus, Grafana, Jaeger, Alertmanager)

Supporting services:
    ECR      — container registry (10 repos, one per service)
    GHCR     — GitHub Container Registry (CI-built images)
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
│   │   ├── servicemonitor.yaml
│   │   └── rules/
│   │       └── slo-rules.yaml
│   ├── grafana/
│   │   └── dashboards/
│   │       └── sre-overview.json
│   └── alertmanager-config.yaml  # Slack config — DO NOT COMMIT real webhook URL
├── .github/
│   └── workflows/
│       ├── helm-lint.yaml         # Helm chart linting
│       ├── terraform-validate.yaml # Terraform fmt + validate
│       └── image-scan-push.yaml   # Trivy scan + GHCR push for all 10 services
├── chaos/                        # coming in Phase 6
├── runbooks/                     # coming in Phase 6
└── load-testing/                 # coming in Phase 6
```

### Everything deleted from upstream and why

| Deleted from upstream | Why deleted | Rebuilt as |
|---|---|---|
| `kubernetes-manifests/` | Raw YAML, no templating, no env management | `helm/templates/` |
| `helm-chart/` | GCP-specific, not portable to AWS | `helm/` — cloud-agnostic, AWS-ready |
| `terraform/` | Targets GCP, not AWS | `terraform/` — AWS EKS modules |
| `kustomize/` | Redundant — Helm handles env overlays | `values-dev.yaml`, `values-prod.yaml` |
| `istio-manifests/` | GCP service mesh, not used | NetworkPolicies in Helm instead |
| `.github/` | GCP Cloud Build workflows | `.github/workflows/` — GitHub Actions CI |
| `skaffold.yaml` | GCP-specific dev tool | Replaced by Helm + ArgoCD GitOps |
| `loadgenerator/` | Black box Locust container | `load-testing/` — custom k6 scenarios *(coming)* |
| `cloudbuild.yaml` | GCP Cloud Build | GitHub Actions CI pipeline |
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
helm install boutique ./helm --namespace boutique --create-namespace
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

**HPA on all 10 services** — 70% CPU utilisation target, disabled in `values-dev.yaml`.

**PodDisruptionBudget on all backend services** — `minAvailable: 1` prevents eviction of last running pod.

**Frontend as NodePort, all others as ClusterIP** — all external traffic enters through the frontend only.

### Debugging a real production issue

Frontend entered `CrashLoopBackOff` while all other 9 services started successfully.

```bash
kubectl logs frontend-xxx -n boutique
# panic: environment variable "SHOPPING_ASSISTANT_SERVICE_ADDR" not set
```

`v0.10.1` introduced a new required env variable. Kubernetes silently strips `value: ""` from the env spec. Fix:

```yaml
- name: SHOPPING_ASSISTANT_SERVICE_ADDR
  value: "shoppingassistantservice:80"
```

---

## Phase 2 — GitOps with ArgoCD

**Status: complete and validated on kind**

### How it works

```
Push to GitHub → ArgoCD detects drift → syncs Helm chart → cluster updated
```

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

```bash
kubectl apply -f argocd/application.yaml
kubectl get application -n argocd

# Access UI
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo
kubectl port-forward svc/argocd-server 8081:80 -n argocd
```

---

## Phase 3 — Terraform + AWS EKS

**Status: complete — infrastructure provisioned, app deployed, resources destroyed**

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

Replace `YOUR_ACCOUNT_ID` in `terraform/envs/prod/backend.tf`:

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

Creates 48 resources. EKS takes ~20 minutes total.

### Step 4 — Connect and deploy

```bash
aws eks update-kubeconfig --region ap-south-1 --name boutique
kubectl get nodes -o wide

kubectl create namespace boutique
helm install boutique ./helm --namespace boutique -f helm/values.yaml

kubectl patch svc frontend -n boutique \
  -p '{"spec": {"type": "LoadBalancer"}}'
kubectl get svc frontend -n boutique
```

Open `http://<EXTERNAL-IP>:8080`

### Teardown

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
Alertmanager    — routes alerts to Slack in real time
kube-state-metrics — cluster-level metrics (pod status, replica counts)
Node Exporter   — node-level metrics (CPU, memory per node)
Jaeger          — distributed tracing across gRPC service calls
ServiceMonitor  — tells Prometheus to scrape boutique namespace
PrometheusRules — SLO alerting rules + error budget burn rate
```

### Prerequisites

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo update
```

---

### IMPORTANT — After every system restart or power off

kind nodes lose their inotify limits on every restart. **Always run this first after any restart:**

```bash
# Step 1 — Fix inotify limits on all kind nodes
for node in $(kubectl get nodes -o name | sed 's/node\///'); do
  docker exec $node sysctl fs.inotify.max_user_instances=512
  docker exec $node sysctl fs.inotify.max_user_watches=524288
done

# Step 2 — Restart kube-state-metrics
kubectl rollout restart deployment/prometheus-kube-state-metrics -n monitoring

# Step 3 — Verify pods are stable
kubectl get pods -n monitoring

# Step 4 — Get kind node IP (may change after restart)
kubectl get nodes -o wide | grep worker | head -1 | awk '{print $6}'
```

Access services at the new node IP:
- Grafana → `http://<NODE-IP>:30030` (admin / boutique-grafana)
- Prometheus → `http://<NODE-IP>:<prometheus-nodeport>`
- Jaeger → `http://<NODE-IP>:<jaeger-nodeport>`

---

### Fresh install — Step 1: Fix inotify limits

```bash
for node in $(kubectl get nodes -o name | sed 's/node\///'); do
  docker exec $node sysctl fs.inotify.max_user_instances=512
  docker exec $node sysctl fs.inotify.max_user_watches=524288
done
```

### Fresh install — Step 2: Install kube-prometheus-stack

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

kubectl get pods -n monitoring -w
```

**Important notes:**
- Pin `kube-state-metrics.image.tag=v2.13.0` — v2.18.0 has a liveness probe port mismatch bug
- The prometheus-operator pod restarts 2-3 times during TLS initialisation — normal, settles in 2 minutes

### Fresh install — Step 3: Install Jaeger

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

### Fresh install — Step 4: Apply ServiceMonitor and SLO rules

```bash
kubectl apply -f monitoring/prometheus/servicemonitor.yaml
kubectl apply -f monitoring/prometheus/rules/slo-rules.yaml

kubectl get servicemonitor -n monitoring | grep boutique
kubectl get prometheusrule -n monitoring | grep boutique
```

### Fresh install — Step 5: Expose UIs via NodePort

```bash
kubectl get nodes -o wide | grep worker | head -1 | awk '{print $6}'

kubectl patch svc prometheus-kube-prometheus-prometheus -n monitoring \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/type", "value": "NodePort"}]'

kubectl patch svc jaeger -n monitoring \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/type", "value": "NodePort"}]'

kubectl get svc -n monitoring | grep NodePort
```

### Slack alerting integration

**Step 1 — Create Slack webhook:**

1. Go to `https://slack.com/get-started` → create free workspace
2. Create channel `#alerts`
3. Go to `https://api.slack.com/apps` → **Create New App** → **From scratch**
4. App name: `AlertManager` → select workspace → **Create App**
5. **Incoming Webhooks** → toggle ON → **Add New Webhook to Workspace** → select `#alerts` → **Allow**
6. Copy webhook URL: `https://hooks.slack.com/services/T.../B.../xxx`

**Step 2 — Apply config (never commit real webhook URL to git):**

```bash
# Edit monitoring/alertmanager-config.yaml
# Replace YOUR_SLACK_WEBHOOK_URL with your actual webhook URL
kubectl apply -f monitoring/alertmanager-config.yaml
kubectl rollout restart statefulset/alertmanager-prometheus-kube-prometheus-alertmanager -n monitoring
```

**Step 3 — Test alert:**

```bash
ALERTMANAGER_POD=$(kubectl get pod -n monitoring \
  -l app.kubernetes.io/name=alertmanager \
  -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n monitoring $ALERTMANAGER_POD -c alertmanager -- wget -qO- \
  --post-data='[{"labels":{"alertname":"TestAlert","severity":"critical","namespace":"boutique"},"annotations":{"summary":"Test alert from Alertmanager","description":"Slack integration verified"}}]' \
  --header='Content-Type: application/json' \
  http://localhost:9093/api/v2/alerts
```

Check `#alerts` in Slack — alert appears within 30 seconds.

### SRE Overview dashboard

Import `monitoring/grafana/dashboards/sre-overview.json`:
Dashboards → Import → Upload JSON file

| Panel | Metric source |
|---|---|
| CPU usage by pod | cAdvisor |
| Memory usage by pod | cAdvisor |
| Healthy pods | kube-state-metrics |
| Network receive rate | cAdvisor |
| Network transmit rate | cAdvisor |
| Node CPU usage | node-exporter |
| Node memory usage | node-exporter |
| Pod restart count | kube-state-metrics |

### Debugging encountered during Phase 4

**Issue 1 — Promtail `too many open files`:** kind nodes have low inotify limits. Fix: increase via `docker exec` before installing log collectors. Rerun after every restart.

**Issue 2 — kube-state-metrics CrashLoopBackOff:** v2.18.0 liveness probe port mismatch. Fix: pin to `v2.13.0`.

**Issue 3 — Grafana datasource conflict:** Loki ConfigMap provisioning failed — kube-prometheus-stack already marks Prometheus as default. Fix: add datasources via Grafana UI.

**Issue 4 — Prometheus x509 error:** After restart, Prometheus TLS verification failed scraping boutique namespace. Fix: `tlsConfig.insecureSkipVerify: true` in ServiceMonitor.

---

## Phase 5 — CI/CD with GitHub Actions

**Status: complete — all 3 pipelines passing**

### Pipeline overview

```
Push to main
      │
      ├── helm/** changed → Helm Lint workflow
      │     └── helm lint + helm template dry run
      │
      ├── terraform/** changed → Terraform Validate workflow
      │     └── terraform fmt check + validate all 3 modules
      │
      └── helm/** changed → Image Scan and Push workflow
            ├── Pull upstream image from Google registry
            ├── Trivy security scan (CRITICAL + HIGH CVEs)
            ├── Upload scan results as GitHub artifacts
            └── Tag + push to GHCR (ghcr.io/shrinidhi972004/boutique/)
```

Every commit that touches `helm/` or `terraform/` automatically triggers the relevant pipeline. No manual steps.

### Workflow 1 — Helm Lint (`.github/workflows/helm-lint.yaml`)

Triggers on any change to `helm/**`. Runs:
- `helm lint ./helm` — validates chart structure and values
- `helm template` dry run — ensures all 10 services render correctly
- Counts rendered resource types to verify nothing is missing

### Workflow 2 — Terraform Validate (`.github/workflows/terraform-validate.yaml`)

Triggers on any change to `terraform/**`. Runs:
- `terraform fmt -check -recursive` — enforces consistent formatting
- `terraform init -backend=false` + `terraform validate` on each of the 3 modules (vpc, eks, ecr) independently

**Important:** Use Terraform `>= 1.9.0` in CI. Older versions use an expired OpenPGP key for the AWS provider that causes `error checking signature: openpgp: key expired` in GitHub Actions runners.

### Workflow 3 — Image Scan and Push (`.github/workflows/image-scan-push.yaml`)

Triggers on any change to `helm/**` or manually via `workflow_dispatch`. Runs a matrix of 10 parallel jobs — one per service:

- Pulls upstream image from `gcr.io/google-samples/microservices-demo/`
- Scans with Trivy for CRITICAL and HIGH CVEs
- Uploads scan report as a downloadable GitHub artifact
- Tags and pushes to GHCR: `ghcr.io/shrinidhi972004/boutique/<service>:latest`

All 10 images are available at:
```
ghcr.io/shrinidhi972004/boutique/frontend:latest
ghcr.io/shrinidhi972004/boutique/cartservice:latest
ghcr.io/shrinidhi972004/boutique/checkoutservice:latest
... (10 total)
```

### Debugging encountered during Phase 5

**Issue 1 — Terraform OpenPGP key expired:** GitHub Actions runners had an expired HashiCorp signing key causing provider installation to fail. Fix: upgrade to `terraform_version: 1.9.0` in the workflow which ships with an updated key.

**Issue 2 — Terraform fmt check failure:** Our Terraform files weren't consistently formatted. Fix: run `terraform fmt -recursive terraform/` locally and commit the changes before the fmt check passes in CI.

**Issue 3 — GHCR image push failed with invalid reference:** GitHub's `${{ github.repository_owner }}` variable preserves original casing (`Shrinidhi972004`) but GHCR requires all lowercase. Fix: use a shell variable with hardcoded lowercase path instead of the GitHub context variable.

**Issue 4 — Slack webhook URL blocked by GitHub push protection:** Committed the real Slack webhook URL to `alertmanager-config.yaml` — GitHub's secret scanning blocked the push. Fix: use `git filter-branch` to rewrite history removing the file, then use a placeholder `YOUR_SLACK_WEBHOOK_URL` going forward. Add `monitoring/alertmanager-config.yaml` to `.gitignore`.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Helm chart | ✅ Complete | Single Helm chart for all 10 services, validated on kind |
| Phase 2 — GitOps with ArgoCD | ✅ Complete | ArgoCD watching GitHub, auto-sync with self-healing on every push |
| Phase 3 — Terraform + AWS EKS | ✅ Complete | Modular Terraform, EKS cluster, same Helm chart promoted to AWS |
| Phase 4 — Observability | ✅ Complete | Prometheus + Grafana + Jaeger + Alertmanager → Slack alerts |
| Phase 5 — CI/CD | ✅ Complete | GitHub Actions — Helm lint, Terraform validate, Trivy scan, GHCR push |
| Phase 6 — Chaos engineering | 🔄 In progress | LitmusChaos experiments on EKS, k6 load tests, postmortems, runbooks |

---

## Tech stack

| Category | Tool |
|---|---|
| Container orchestration | Kubernetes (kind locally, AWS EKS in cloud) |
| Package management | Helm 3 |
| GitOps | ArgoCD |
| Infrastructure as code | Terraform (AWS provider) |
| CI/CD | GitHub Actions |
| Image registry | GitHub Container Registry (GHCR) |
| Security scanning | Trivy |
| Metrics | Prometheus + Grafana |
| Alerting | Alertmanager + Slack |
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