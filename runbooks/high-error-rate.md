# Runbook — High Error Rate Alert

**Alert:** `FrontendAvailabilityBurnRateFast`
**Severity:** Critical
**SLO:** 99.5% of frontend requests must succeed

---

## When does this fire?

This alert fires when the frontend error rate is consuming the error budget at 14.4x the allowed rate over a 1-hour window. At this rate the entire monthly error budget would be exhausted in ~2 hours.

---

## Immediate actions (first 5 minutes)

**Step 1 — Check pod health:**
```bash
kubectl get pods -n boutique
kubectl get pods -n boutique | grep -v Running
```

**Step 2 — Check recent events:**
```bash
kubectl get events -n boutique --sort-by='.lastTimestamp' | tail -20
```

**Step 3 — Check frontend logs:**
```bash
kubectl logs -n boutique -l app=frontend --tail=100 | grep -i error
```

**Step 4 — Check downstream services:**
```bash
for svc in cartservice checkoutservice productcatalogservice; do
  echo "=== $svc ==="
  kubectl logs -n boutique -l app=$svc --tail=20 | grep -i "error\|panic"
done
```

---

## Resolution

**Restart unhealthy pods:**
```bash
kubectl rollout restart deployment/<service-name> -n boutique
kubectl rollout status deployment/<service-name> -n boutique
```

**Scale up if under load:**
```bash
kubectl scale deployment frontend --replicas=3 -n boutique
```

---

## Escalation

If not resolved within 15 minutes, escalate to on-call engineer. Check Grafana SRE Overview dashboard for full picture.