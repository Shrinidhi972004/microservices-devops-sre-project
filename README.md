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
    └── argocd namespace (GitOps controller)

Supporting services:
    ECR     — container registry (10 repos, one per service)
    S3      — Terraform remote state
    DynamoDB — Terraform state locking
    NAT GW  — private subnet egress
    IAM     — node roles + IRSA
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
│   └── templates/
│       ├── _helpers.tpl
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── hpa.yaml
│       └── poddisruptionbudget.yaml
├── argocd/
│   └── application.yaml          # ArgoCD Application manifest
├── terraform/
│   ├── modules/
│   │   ├── vpc/                  # VPC, subnets, IGW, NAT, route tables
│   │   ├── eks/                  # EKS cluster, node group, IAM, security groups
│   │   └── ecr/                  # ECR repos + lifecycle policies per service
│   └── envs/
│       └── prod/
│           ├── main.tf           # calls all three modules
│           ├── variables.tf
│           ├── outputs.tf
│           ├── backend.tf        # S3 remote state + DynamoDB lock
│           └── terraform.tfvars
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
- `selfHeal: true` — if someone manually changes the cluster, ArgoCD reverts it to what GitHub says
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

## Phase 3 — Terraform + AWS EKS

**Status: complete — infrastructure provisioned, app deployed, resources destroyed**

### Overview

The same Helm chart validated on kind is promoted to a real AWS EKS cluster provisioned entirely with Terraform. The infrastructure is modular — VPC, EKS, and ECR are independent modules called from a single root env config. Remote state is stored in S3 with DynamoDB locking.

### Prerequisites

```bash
terraform  >= 1.6.0
aws-cli    >= 2.x
# AWS credentials configured
aws sts get-caller-identity
```

### Step 1 — Create S3 backend and DynamoDB lock table

These must exist before Terraform can initialise. Create them manually once:

```bash
export AWS_REGION=ap-south-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create S3 bucket
aws s3api create-bucket \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --region ${AWS_REGION} \
  --create-bucket-configuration LocationConstraint=${AWS_REGION}

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB lock table
aws dynamodb create-table \
  --table-name boutique-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ${AWS_REGION}
```

### Step 2 — Configure backend

Edit `terraform/envs/prod/backend.tf` and replace `YOUR_ACCOUNT_ID` with your actual AWS account ID:

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

Get your account ID:
```bash
aws sts get-caller-identity --query Account --output text
```

### Step 3 — Initialise Terraform

```bash
cd terraform/envs/prod
terraform init
```

Expected output:
```
Terraform has been successfully initialized!
```

### Step 4 — Plan

```bash
terraform plan -out=tfplan
```

Review the plan — should show 48 resources to create:
- 1 VPC + 6 subnets + 1 IGW + 1 NAT GW + 1 EIP + 2 route tables + 6 associations
- 1 EKS cluster + 1 node group (3x t3.medium)
- 2 IAM roles + 4 policy attachments
- 2 security groups
- 10 ECR repositories + 10 lifecycle policies

### Step 5 — Apply

```bash
terraform apply "tfplan"
```

EKS cluster takes 12-15 minutes to provision. Node group takes another 3-5 minutes. Total: ~20 minutes.

Expected final output:
```
Apply complete! Resources: 48 added, 0 changed, 0 destroyed.

Outputs:
eks_cluster_name     = "boutique"
kubeconfig_command   = "aws eks update-kubeconfig --region ap-south-1 --name boutique"
vpc_id               = "vpc-xxxxxxxxxxxxxxxxx"
ecr_repository_urls  = { ... }
```

### Step 6 — Connect kubectl to EKS

```bash
aws eks update-kubeconfig --region ap-south-1 --name boutique

# Verify 3 nodes ready
kubectl get nodes -o wide
```

Expected:
```
NAME                                        STATUS   ROLES    AGE
ip-10-0-4-xxx.ap-south-1.compute.internal   Ready    <none>   5m
ip-10-0-5-xxx.ap-south-1.compute.internal   Ready    <none>   5m
ip-10-0-6-xxx.ap-south-1.compute.internal   Ready    <none>   5m
```

### Step 7 — Deploy Helm chart to EKS

```bash
# Go back to project root
cd ~/Desktop/microservices-demo

# Deploy
kubectl create namespace boutique

helm install boutique ./helm \
  --namespace boutique \
  --create-namespace \
  -f helm/values.yaml

# Watch pods
kubectl get pods -n boutique -w
```

All 11 pods should reach `Running` status. This is the exact same Helm chart that ran on kind — no changes needed.

### Step 8 — Access the frontend on AWS

Patch the frontend service to LoadBalancer so AWS provisions an ELB:

```bash
kubectl patch svc frontend -n boutique \
  -p '{"spec": {"type": "LoadBalancer"}}'

# Wait 2 minutes then get the ELB hostname
kubectl get svc frontend -n boutique
```

Open `http://<EXTERNAL-IP>:8080` in your browser.

### Terraform module design decisions

**Modular structure — one module per concern**

Three independent modules: `vpc`, `eks`, `ecr`. Each has its own `variables.tf`, `main.tf`, and `outputs.tf`. The root `envs/prod/main.tf` calls all three, passing outputs between them (e.g. VPC subnet IDs flow into the EKS module). This mirrors how real infrastructure teams structure Terraform — each module is independently testable and reusable.

**Private subnets for worker nodes**

EKS worker nodes live in private subnets — they have no public IP and are not directly internet-accessible. The NAT Gateway in the public subnet provides outbound access for pulling images. This is the correct security posture — nodes should never be exposed to the internet.

**3 AZs for high availability**

Subnets and node groups span `ap-south-1a`, `ap-south-1b`, and `ap-south-1c`. If one AZ has an outage, pods are rescheduled on nodes in the remaining AZs automatically.

**ECR with immutable tags and scan on push**

Every ECR repository has:
- `image_tag_mutability = "IMMUTABLE"` — once an image is pushed with a tag, it cannot be overwritten. Prevents accidental overwrites in production.
- `scan_on_push = true` — every image is automatically scanned for CVEs when pushed.
- Lifecycle policy keeping the last 10 images — prevents unbounded storage growth.

**Remote state with locking**

Terraform state is stored in S3 with versioning enabled — every state change is versioned and recoverable. DynamoDB provides a lock so concurrent `terraform apply` runs are prevented, avoiding state corruption.

**IAM roles — least privilege**

The EKS cluster role has only `AmazonEKSClusterPolicy`. Worker nodes have only three policies — `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, and `AmazonEC2ContainerRegistryReadOnly`. No broad admin permissions anywhere.

### Teardown — complete cleanup

Run this in order to leave zero AWS resources:

```bash
# Step 1 — uninstall Helm release
helm uninstall boutique -n boutique

# Step 2 — destroy all Terraform-managed infrastructure
cd terraform/envs/prod
terraform destroy -auto-approve

# Step 3 — delete S3 state bucket (versioning requires extra steps)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws s3api delete-objects \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --delete "$(aws s3api list-object-versions \
    --bucket boutique-terraform-state-${ACCOUNT_ID} \
    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
    --output json)" \
  --region ap-south-1

aws s3api delete-objects \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --delete "$(aws s3api list-object-versions \
    --bucket boutique-terraform-state-${ACCOUNT_ID} \
    --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
    --output json)" \
  --region ap-south-1 2>/dev/null || true

aws s3api delete-bucket \
  --bucket boutique-terraform-state-${ACCOUNT_ID} \
  --region ap-south-1

# Step 4 — delete DynamoDB lock table
aws dynamodb delete-table \
  --table-name boutique-terraform-locks \
  --region ap-south-1

# Step 5 — verify everything is gone
echo "--- S3 ---" && aws s3 ls | grep boutique || echo "none"
echo "--- DynamoDB ---" && aws dynamodb list-tables --region ap-south-1
echo "--- EKS ---" && aws eks list-clusters --region ap-south-1
echo "--- ECR ---" && aws ecr describe-repositories --region ap-south-1 \
  --query 'repositories[*].repositoryName' --output table 2>/dev/null || echo "none"
```

### Important .gitignore rules for Terraform

Never commit `.terraform/` or `tfplan` — the provider binary alone is 674MB and will be rejected by GitHub. The `.gitignore` in this repo excludes:

```
**/.terraform/
*.tfplan
tfplan
*.tfstate*
*.tfvars
.terraform.lock.hcl
```

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Helm chart | ✅ Complete | Single Helm chart for all 10 services, validated on kind |
| Phase 2 — GitOps with ArgoCD | ✅ Complete | ArgoCD watching GitHub, auto-sync with self-healing on every push |
| Phase 3 — Terraform + AWS EKS | ✅ Complete | Modular Terraform, EKS cluster, same Helm chart promoted to AWS |
| Phase 4 — Observability | 🔄 In progress | Prometheus + Grafana SLO dashboards, Loki, Jaeger tracing |
| Phase 5 — Chaos engineering | ⏳ Planned | LitmusChaos experiments, k6 load tests, postmortems, runbooks |

---

## Tech stack

| Category | Tool |
|---|---|
| Container orchestration | Kubernetes (kind locally, AWS EKS in cloud) |
| Package management | Helm 3 |
| GitOps | ArgoCD |
| Infrastructure as code | Terraform (AWS provider) |
| CI/CD | GitHub Actions *(coming)* |
| Metrics | Prometheus + Grafana *(coming)* |
| Logging | Loki + Promtail *(coming)* |
| Tracing | Jaeger *(coming)* |
| Chaos engineering | LitmusChaos *(coming)* |
| Load testing | k6 *(coming)* |
| Container registry | AWS ECR |
| Cloud | AWS (EKS, ECR, S3, VPC, DynamoDB, IAM) |

---

## Author

**Shrinidhi Upadhyaya**
- GitHub: [@Shrinidhi972004](https://github.com/Shrinidhi972004)
- Email: shrinidhiupadhyaya00@gmail.com