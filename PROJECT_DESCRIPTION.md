# Project Description

## Title

**RailFlux: Cost-Conscious Peak-Load Optimization for a Tatkal-Like Railway Booking System on AWS**

## Abstract

Tatkal-like sales create a transitory “thundering herd”: many legitimate users and automated clients arrive at a known instant, read the same inventory, retry aggressively, and contend for a small number of seats. RailFlux implements a synthetic railway reservation system and evaluates two architectures under this workload.

The baseline is a fixed-capacity synchronous monolith backed by one relational database. The optimized system isolates reads from transactional bookings, caches non-authoritative queries, moves side effects to a queue, scales components independently, and applies bounded ingress controls. Both preserve identical API semantics and booking correctness.

The experiment uses seeded open-model k6 schedules, state restoration, randomized paired runs, correctness reconciliation, repeated measurements, and cost accounting. It evaluates latency, throughput, unmet demand, booking correctness, database pressure, resilience, fairness to legitimate users, and SLO-compliant capacity per dollar.

## Problem statement

Conventional average-load testing hides the failure modes of synchronized releases. Closed-loop clients reduce request generation when the server slows, stale availability can mislead users, retries can duplicate transactions, and read amplification can starve the authoritative booking path.

The project asks whether an explicitly separated, observable AWS design can provide better measurable behavior than a simple reference baseline without weakening transactional guarantees or exceeding a student credit budget.

## Scope

Included:

- synthetic users, trains, routes, quota inventory, and payments;
- search, availability, booking, confirmation, and booking history;
- high-contention and non-contention inventories;
- legitimate, retrying, abandoning, quick-booker, and bot-like clients;
- idempotent transactional booking with no oversell;
- baseline and optimized deployment profiles;
- controlled load and failure experiments;
- cost, security, observability, and reproducibility documentation.

Excluded:

- access to or claims about private IRCTC/CRIS architecture;
- real railway data, real PNRs, payment gateways, SMS, or email;
- bypassing CAPTCHA, authentication, WAF, or third-party protections;
- production-scale passenger reservation rules such as RAC, waitlist, or segment allocation;
- multi-region disaster recovery and production certification.

## Primary hypotheses

- H1: At cost parity, the optimized design increases SLO-compliant offered booking capacity by at least 25%.
- H2: At the common 80% load point, optimized p99 terminal booking latency is at most 75% of baseline.
- H3: Neither system oversells inventory or duplicates a charge.
- H4: Under bot-like pressure, the optimized system improves legitimate-user completion without materially harming legitimate-only traffic.
- H5: Warm caching reduces read pressure but never changes booking correctness.
- H6: The optimized design recovers SLO compliance faster after a single-component failure.

These are preregistered targets, not promised outcomes.

## Final architecture decision

The project uses:

```text
CloudFront → cell-controlled WAF → public ALB → ECS Fargate
```

API Gateway is intentionally omitted: an HTTP API would still require a private integration target or service discovery, adds a request hop and cost, does not support REST API usage plans, and is unnecessary for this experiment.

Development is local-first. AWS stacks are ephemeral and sequential:

1. deploy one profile;
2. restore the deterministic fixture;
3. run and export measurements;
4. preserve reconciliation evidence;
5. destroy the profile;
6. deploy the paired profile and repeat.

## Expected academic contribution

The result is not “an architecture better than IRCTC.” It is a reproducible demonstration of which cloud patterns improve a transparent synthetic baseline, under which load and cache conditions, at what cost, and with what trade-offs.
