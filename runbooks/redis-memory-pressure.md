# Runbook — Redis Memory Pressure

**Trigger:** Redis memory usage > 80% of limit
**Severity:** High — cart data at risk

---

## Diagnosis

**Check Redis memory:**
```bash
kubectl exec -n boutique -l app=redis-cart -- redis-cli INFO memory | grep used_memory_human
kubectl exec -n boutique -l app=redis-cart -- redis-cli DBSIZE
```

**Check cartservice errors:**
```bash
kubectl logs -n boutique -l app=cartservice --tail=50 | grep -i "error\|redis"
```

---

## Resolution

**Flush expired sessions (clears all cart data):**
```bash
kubectl exec -n boutique -l app=redis-cart -- redis-cli FLUSHDB
```

**Increase memory limit in `helm/values.yaml`:**
```yaml
redis:
  resources:
    limits:
      memory: 512Mi
```
```bash
helm upgrade boutique ./helm --namespace boutique
```

**Restart Redis (last resort):**
```bash
kubectl rollout restart deployment/redis-cart -n boutique
```