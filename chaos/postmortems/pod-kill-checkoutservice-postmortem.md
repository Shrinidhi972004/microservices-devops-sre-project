# Postmortem — Checkoutservice Pod Kill Experiment

**Date:** [DATE]
**Duration:** 30 seconds chaos + recovery time
**Severity:** P2 — Partial checkout degradation
**Author:** Shrinidhi Upadhyaya

---

## Summary

A controlled chaos experiment was run against the checkoutservice deployment using LitmusChaos pod-delete. The experiment validated Kubernetes self-healing behaviour and measured time to recovery under sustained k6 load.

---

## Timeline

| Time | Event |
|---|---|
| T+0s | LitmusChaos pod-delete experiment started |
| T+5s | checkoutservice pod terminated |
| T+8s | Kubernetes detected pod failure, started replacement |
| T+12s | Alertmanager fired `FrontendAvailabilityBurnRateFast` to Slack |
| T+18s | New checkoutservice pod scheduled on worker node |
| T+28s | New pod passed readiness probe, traffic resumed |
| T+35s | Error budget burn rate alert resolved in Slack |

---

## Impact

- Checkout flow unavailable for ~23 seconds
- Cart browsing and product catalog unaffected
- Error budget consumed: ~0.04% of monthly budget

---

## Root cause

Controlled experiment — pod killed intentionally by LitmusChaos to validate self-healing.

---

## What went well

- Kubernetes self-healed within 28 seconds
- Alertmanager fired within 12 seconds of failure
- Alert auto-resolved when service recovered
- Other 9 services continued operating throughout

---

## What could be improved

- Pod restart time could be reduced with pre-pulled images on all nodes
- Readiness probe delay adds unnecessary recovery time — tune from 20s to 10s
- checkoutservice runs as single replica — add `replicas: 2` + PDB for zero-downtime

---

## Action items

| Action | Owner | Due |
|---|---|---|
| Set `replicas: 2` for checkoutservice in prod values | Shrinidhi | Next sprint |
| Tune readiness probe `initialDelaySeconds` from 20s to 10s | Shrinidhi | Next sprint |
| Add checkoutservice PDB with `minAvailable: 1` | Shrinidhi | Next sprint |

---

## Lessons learned

A single-replica critical service with no PDB is a reliability risk. The 28-second recovery time is acceptable for a non-HA setup but unacceptable in production where checkout revenue is at stake.