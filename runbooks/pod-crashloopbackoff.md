# Runbook — Pod CrashLoopBackOff

**Trigger:** Pod in CrashLoopBackOff state
**Severity:** High

---

## Diagnosis steps

**Step 1 — Identify the crashing pod:**
```bash
kubectl get pods -n boutique | grep -v Running
```

**Step 2 — Check logs from crashed container:**
```bash
kubectl logs -n boutique <pod-name> --previous
```

**Step 3 — Check pod events:**
```bash
kubectl describe pod -n boutique <pod-name> | grep -A 20 "Events:"
```

---

## Common causes and fixes

**Missing environment variable (exit code 2):**
```bash
kubectl exec -n boutique <pod-name> -- env | sort
```

**OOMKilled (exit code 137):**
Increase memory limit in `helm/values.yaml` then:
```bash
helm upgrade boutique ./helm --namespace boutique
```

**Liveness probe failing:**
```bash
kubectl describe pod -n boutique <pod-name> | grep -A 10 "Liveness"
```

---

## Resolution

```bash
kubectl rollout restart deployment/<service-name> -n boutique
kubectl rollout status deployment/<service-name> -n boutique
```