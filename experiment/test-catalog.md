# Test Catalog

Scope tags: **[Both]**, **[Baseline]**, or **[Optimized]** identify applicable deployment profiles.

## Functional and correctness tests

- **[Both] TC-001 Search:** valid/invalid station and date combinations return contract-compliant results.
- **[Optimized] TC-002 Availability cache:** first read misses cache; later read hits; response includes freshness metadata.
- **[Both] TC-003 Booking success:** atomic claim, payment success, booking, outbox, and response reconcile.
- **[Both] TC-004 Sold out:** zero-row claim returns terminal `SOLD_OUT` without negative inventory.
- **[Both] TC-005 Duplicate retry:** same idempotency key/body returns the original logical result.
- **[Both] TC-006 Idempotency conflict:** same key/different body returns conflict without mutation.
- **[Both] TC-007 Concurrent last seat:** many contenders produce exactly the allowed confirmed count.
- **[Both] TC-008 Payment failure:** no confirmed booking or lost inventory remains.
- **[Both] TC-009 Timeout after commit:** status/retry resolves to the committed result.
- **[Optimized] TC-010 Side-effect duplicate:** repeated SQS delivery performs each handler once.

## Performance tests

- **[Both] PT-001 Smoke:** 1–5 RPS, validates scripts and telemetry. Command: `npm run load:pt001` ([runbook](../docs/runbooks/pt-001-smoke.md)).
- **[Baseline] PT-002 Calibration:** stepped open load finds baseline SLO capacity.
- **[Both] PT-003 Release burst:** instantaneous jump followed by 90-second peak.
- **[Both] PT-004 Progressive load:** 50%, 80%, and 110% of calibrated capacity.
- **[Both] PT-005 Mixed traffic:** 70/20/10 search/availability/booking.
- **[Both] PT-006 Contention:** oversubscribed common inventory.
- **[Both] PT-007 Non-contention:** sufficient distributed inventory.
- **[Optimized] PT-008 Cache cold/warm:** isolates cache effect from task startup.
- **[Both] PT-009 Legitimate + bot-like:** 80/20 principal and 50/50 exploratory mixes.
- **[Both] PT-010 Soak:** 15 minutes at 50% capacity.
- **[Optimized] PT-011 Elasticity:** burst with autoscaling enabled; measures time to stability.

## Failure tests

Each runs alone at approximately 80% calibrated load.

- **[Both] FT-001 Task loss:** stop one application task; measure errors and replacement recovery.
- **[Optimized] FT-002 Redis unavailable:** circuit opens, reads degrade to replica, bookings remain unaffected.
- **[Optimized] FT-003 Worker paused:** bookings commit, queue grows, recovery drains without duplicates.
- **[Optimized] FT-004 Poison event:** repeated failure reaches DLQ with no loss of unrelated messages.
- **[Both] FT-005 Database latency:** add 250 ms application-controlled query delay.
- **[Both] FT-006 Connection cap:** lower pool/DB connection ceiling and observe admission behavior.
- **[Both] FT-007 Payment delay/5xx:** rollback/release is exact and errors are clear.
- **[Both] FT-008 Client disconnect:** interrupt after commit but before response; idempotency reconciles.
- **[Optimized] FT-009 Cache stampede:** expire a hot key under read load; coalescing bounds DB amplification.

## Security and ingress tests

- **ST-001 Managed-rule payloads:** synthetic SQLi/XSS shapes are blocked before application.
- **ST-002 Rate concentration:** bot-like source exceeds rate rule.
- **ST-003 Legitimate false positives:** valid cohort remains within accepted block rate.
- **ST-004 Direct ALB origin:** request without CloudFront secret/header restriction is rejected.
- **ST-005 Authorization:** task roles cannot invoke unrelated queues/buckets/secrets.
- **ST-006 Sensitive logging:** logs contain no raw token, passenger, payment, or idempotency key.

## Run acceptance

A performance run is accepted only if its paired functional smoke checks, generator checks, reset checks, artifact export, and post-run correctness reconciliation all pass.
