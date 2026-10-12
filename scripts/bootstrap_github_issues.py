#!/usr/bin/env python3
"""Create RailFlux GitHub labels, milestones, and issues. Safe to re-run (skips duplicates)."""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request

REPO = "mitra9917/RailFlux"

LABELS = [
    ("area:contracts", "0075ca", "API, schema, fixtures, ADRs"),
    ("area:database", "1d76db", "Migrations, seeds, reconciliation"),
    ("area:services-baseline", "5319e7", "Baseline monolith services"),
    ("area:services-optimized", "6f42c1", "Read/booking/worker services"),
    ("area:infrastructure", "fbca04", "Docker, CloudFormation, deploy"),
    ("area:experiment", "d4c5f9", "k6, controller, analysis"),
    ("area:observability", "0e8a16", "Logs, metrics, traces"),
    ("area:security", "b60205", "IAM, WAF, ingress"),
    ("area:frontend", "f9d0c4", "React simulator (M8)"),
    ("profile:baseline", "c5def5", "Baseline profile scope"),
    ("profile:optimized", "bfdadc", "Optimized profile scope"),
    ("profile:both", "ededed", "Both profiles"),
    ("type:feature", "a2eeef", "Feature implementation"),
    ("type:test", "008672", "Tests and load scenarios"),
    ("type:gate", "e99695", "Milestone acceptance gate"),
    ("type:chore", "fef2c0", "Tooling and CI"),
    ("priority:p0", "d73a4a", "Blocks milestone gate"),
    ("priority:p1", "ff9800", "Required for milestone"),
    ("priority:p2", "cccccc", "Secondary or exploratory"),
]

MILESTONES = [
    (
        "M1: Contracts & repository scaffold",
        "Freeze API v1, migrations, fixtures, repo layout, CI skeleton.",
        "2026-10-19T23:59:59Z",
    ),
    (
        "M2: Baseline read path (local)",
        "Monolith search/availability/health; Docker baseline profile; TC-001.",
        "2026-10-26T23:59:59Z",
    ),
    (
        "M3: Baseline booking correctness",
        "Atomic claim, idempotency, payment stub, sync side effects; TC-003–TC-009.",
        "2026-11-02T23:59:59Z",
    ),
    (
        "M4: Optimized local profile",
        "Service split, Redis, queue, worker, DLQ; parity; TC-002/TC-010.",
        "2026-11-09T23:59:59Z",
    ),
    (
        "M5: AWS infrastructure & observability",
        "CloudFormation, deploy/teardown, budgets, smoke; no orphan resources.",
        "2026-11-16T23:59:59Z",
    ),
    (
        "M6: Experiment engine & load tests",
        "k6 workloads, controller CLI, manifests, artifact export, preflight.",
        "2026-11-23T23:59:59Z",
    ),
    (
        "M7: Campaign, analysis & delivery",
        "Calibration, principal pairs, analysis, report, reproducibility audit.",
        "2026-11-30T23:59:59Z",
    ),
    (
        "M8: Frontend booking simulator (last)",
        "React/Vite UI after measurement path is complete.",
        "2026-12-07T23:59:59Z",
    ),
]


def gh_api(method: str, path: str, data: dict | None = None) -> dict | list:
    cmd = ["gh", "api", "-X", method, path]
    if data is not None:
        cmd.extend(["--input", "-"])
        proc = subprocess.run(
            cmd,
            input=json.dumps(data).encode(),
            capture_output=True,
            check=False,
        )
    else:
        proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode() or proc.stdout.decode())
    if not proc.stdout.strip():
        return {}
    return json.loads(proc.stdout)


def gh_run(args: list[str]) -> str:
    proc = subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    return proc.stdout.strip()


def ensure_labels() -> None:
    existing = {l["name"] for l in gh_api("GET", f"repos/{REPO}/labels?per_page=100")}
    for name, color, description in LABELS:
        if name in existing:
            continue
        gh_api(
            "POST",
            f"repos/{REPO}/labels",
            {"name": name, "color": color, "description": description},
        )
        print(f"label: {name}")


def ensure_milestones() -> dict[str, int]:
    ms = gh_api("GET", f"repos/{REPO}/milestones?state=all&per_page=100")
    by_title = {m["title"]: m["number"] for m in ms}
    for title, description, due_on in MILESTONES:
        if title in by_title:
            continue
        created = gh_api(
            "POST",
            f"repos/{REPO}/milestones",
            {"title": title, "description": description, "due_on": due_on},
        )
        by_title[title] = created["number"]
        print(f"milestone: {title}")
    return by_title


def existing_issue_titles() -> set[str]:
    titles: set[str] = set()
    page = 1
    while True:
        batch = gh_api(
            "GET",
            f"repos/{REPO}/issues?state=all&per_page=100&page={page}",
        )
        if not batch:
            break
        for issue in batch:
            if "pull_request" not in issue:
                titles.add(issue["title"])
        page += 1
    return titles


def create_issue(title: str, body: str, labels: list[str], milestone_title: str, ms_map: dict[str, int]) -> None:
    payload = {
        "title": title,
        "body": body,
        "labels": labels,
        "milestone": ms_map[milestone_title],
    }
    gh_api("POST", f"repos/{REPO}/issues", payload)
    print(f"issue: {title}")


# Each entry: title, milestone_title, labels, body
ISSUES: list[tuple[str, str, list[str], str]] = [
    (
        "[M1-P1] Freeze OpenAPI v1.0.0 for implementation",
        "M1: Contracts & repository scaffold",
        ["enhancement", "area:contracts", "profile:both", "type:feature", "priority:p0"],
        "Promote `docs/design/api-spec.yaml` from planning to implementable v1.\n\n"
        "**Acceptance**\n- Version bumped; breaking changes documented in ADR if any\n- Paths match baseline/optimized service boundaries\n\n"
        "**Refs:** DoD Product; `docs/design/api-spec.yaml`",
    ),
    (
        "[M1-P1] Update requirements traceability for API v1",
        "M1: Contracts & repository scaffold",
        ["documentation", "area:contracts", "type:chore", "priority:p1"],
        "Map OpenAPI operations and invariants to roadmap gates in `docs/requirements-traceability.md`.\n\n"
        "**Acceptance:** Every v1 endpoint linked to at least one test catalog ID.",
    ),
    (
        "[M1-P2] Scaffold monorepo directory layout",
        "M1: Contracts & repository scaffold",
        ["enhancement", "area:contracts", "type:chore", "priority:p0"],
        "Create planned roots: `services/`, `database/`, `infrastructure/`, `load-tests/`, `experiment/` runtime code.\n\n"
        "**Acceptance:** README planned layout matches disk; root scripts documented.",
    ),
    (
        "[M1-P2] Add shared TypeScript package for API types",
        "M1: Contracts & repository scaffold",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p1"],
        "Shared DTOs/errors generated or hand-maintained from OpenAPI for services and later frontend.\n\n"
        "**Acceptance:** Baseline service imports shared types without duplication.",
    ),
    (
        "[M1-P3] Initial MySQL migrations for core entities",
        "M1: Contracts & repository scaffold",
        ["enhancement", "area:database", "type:feature", "priority:p0"],
        "Implement schema from `docs/design/data-consistency.md` (users, trains, inventory, bookings, idempotency, outbox).\n\n"
        "**Acceptance:** `migrate up` on empty DB succeeds; indexes support claim path.",
    ),
    (
        "[M1-P3] Database seed and experiment reset scripts",
        "M1: Contracts & repository scaffold",
        ["enhancement", "area:database", "area:experiment", "type:feature", "priority:p0"],
        "Seed from fixture manifest; reset clears idempotency, bookings, queue state for next run.\n\n"
        "**Acceptance:** Reset + reseed is idempotent; documented in experiment runbook.",
    ),
    (
        "[M1-P4] Fixture loader with manifest checksum verification",
        "M1: Contracts & repository scaffold",
        ["enhancement", "area:database", "area:experiment", "type:feature", "priority:p0"],
        "Load `experiment/fixtures/manifest.yaml`; verify checksum before run.\n\n"
        "**Acceptance:** Invalid checksum fails closed; logged in run manifest.",
    ),
    (
        "[M1-P5] CI workflow for lint, test, and OpenAPI validation",
        "M1: Contracts & repository scaffold",
        ["enhancement", "type:chore", "priority:p1"],
        "GitHub Actions (or equivalent) runs on PR: lint, unit tests placeholder, OpenAPI validate.\n\n"
        "**Acceptance:** Required check on main; fails on invalid spec.",
    ),
    (
        "[M1-P6] GATE: M1 contracts and scaffold acceptance",
        "M1: Contracts & repository scaffold",
        ["type:gate", "priority:p0"],
        "**Gate criteria**\n- OpenAPI v1 frozen and validates\n- Migrations apply on empty MySQL\n- Fixture checksum verified on load\n- CI green on main\n\n"
        "Close when all M1 feature issues are done.",
    ),
    (
        "[M2-P1] Scaffold baseline monolith Express service",
        "M2: Baseline read path (local)",
        ["enhancement", "area:services-baseline", "profile:baseline", "type:feature", "priority:p0"],
        "Node.js + TypeScript + Express baseline app with config profiles.\n\n"
        "**Acceptance:** Service boots; connects to MySQL from Compose.",
    ),
    (
        "[M2-P1] Synthetic JWT auth middleware",
        "M2: Baseline read path (local)",
        ["enhancement", "area:services-baseline", "area:security", "type:feature", "priority:p1"],
        "Implement `syntheticJwt` security from OpenAPI for local/dev.\n\n"
        "**Acceptance:** Protected routes reject missing/invalid token; no real PII.",
    ),
    (
        "[M2-P2] Implement GET /v1/search",
        "M2: Baseline read path (local)",
        ["enhancement", "area:services-baseline", "profile:baseline", "type:feature", "priority:p0"],
        "Contract-compliant search by from/to/date.\n\n"
        "**Acceptance:** TC-001 search cases; freshness metadata present.",
    ),
    (
        "[M2-P2] Implement GET /v1/availability (baseline DB path)",
        "M2: Baseline read path (local)",
        ["enhancement", "area:services-baseline", "profile:baseline", "type:feature", "priority:p0"],
        "Advisory availability from authoritative DB (no cache in baseline).\n\n"
        "**Acceptance:** Response matches OpenAPI `Availability` schema.",
    ),
    (
        "[M2-P2] Implement /health/live and /health/ready",
        "M2: Baseline read path (local)",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p1"],
        "Readiness fails when MySQL unavailable.\n\n"
        "**Acceptance:** Used by Compose and future ALB checks.",
    ),
    (
        "[M2-P3] Structured logging and run_id correlation",
        "M2: Baseline read path (local)",
        ["enhancement", "area:observability", "profile:both", "type:feature", "priority:p1"],
        "JSON logs with request_id, run_id when provided.\n\n"
        "**Acceptance:** Log fields documented in observability doc.",
    ),
    (
        "[M2-P4] TC-001 integration tests for search and availability",
        "M2: Baseline read path (local)",
        ["test", "area:services-baseline", "type:test", "priority:p0"],
        "Automate catalog TC-001 against local baseline.\n\n"
        "**Acceptance:** Runs in CI against Compose MySQL.",
    ),
    (
        "[M2-P5] Docker Compose baseline profile",
        "M2: Baseline read path (local)",
        ["enhancement", "area:infrastructure", "profile:baseline", "type:feature", "priority:p0"],
        "MySQL 8 + baseline monolith; documented env vars.\n\n"
        "**Acceptance:** `docker compose up` enables local read flow.",
    ),
    (
        "[M2-P6] GATE: M2 baseline read path acceptance",
        "M2: Baseline read path (local)",
        ["type:gate", "priority:p0"],
        "**Gate:** deterministic seed; TC-001 pass; search/availability match OpenAPI on Compose baseline.",
    ),
    (
        "[M3-P1] Implement booking state machine",
        "M3: Baseline booking correctness",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p0"],
        "States and transitions per `docs/design/data-consistency.md` and request flows.\n\n"
        "**Acceptance:** Illegal transitions rejected; terminal states immutable.",
    ),
    (
        "[M3-P1] Atomic inventory claim with optimistic versioning",
        "M3: Baseline booking correctness",
        ["enhancement", "area:database", "area:services-baseline", "type:feature", "priority:p0"],
        "Single-row update claim; sold-out when zero rows updated.\n\n"
        "**Acceptance:** TC-004; no negative inventory.",
    ),
    (
        "[M3-P2] Idempotency store and replay semantics",
        "M3: Baseline booking correctness",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p0"],
        "POST /v1/bookings with Idempotency-Key; 200 replay of terminal result.\n\n"
        "**Acceptance:** TC-005 passes.",
    ),
    (
        "[M3-P2] Idempotency conflict and in-flight 425 handling",
        "M3: Baseline booking correctness",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p0"],
        "Same key different body → 409; in-flight duplicate → 425.\n\n"
        "**Acceptance:** TC-006 passes.",
    ),
    (
        "[M3-P3] Deterministic payment stub integration",
        "M3: Baseline booking correctness",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p0"],
        "Stub sequence from fixture/manifest; no external PSP.\n\n"
        "**Acceptance:** Repeatable payment outcomes per run seed.",
    ),
    (
        "[M3-P3] Payment failure inventory release",
        "M3: Baseline booking correctness",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p0"],
        "Failed payment releases claim exactly once.\n\n"
        "**Acceptance:** TC-008 passes.",
    ),
    (
        "[M3-P4] Baseline synchronous outbox side effects",
        "M3: Baseline booking correctness",
        ["enhancement", "area:services-baseline", "profile:baseline", "type:feature", "priority:p1"],
        "Side effects on booking commit path (no queue in baseline).\n\n"
        "**Acceptance:** Confirmed booking durable with outbox row.",
    ),
    (
        "[M3-P5] GET /v1/bookings/{id} and timeout-after-commit",
        "M3: Baseline booking correctness",
        ["enhancement", "area:services-baseline", "type:feature", "priority:p0"],
        "Client disconnect after commit resolves via status/retry.\n\n"
        "**Acceptance:** TC-009; FT-008 prep.",
    ),
    (
        "[M3-P6] Wire post-run correctness SQL runner",
        "M3: Baseline booking correctness",
        ["enhancement", "area:database", "area:experiment", "type:feature", "priority:p0"],
        "Execute `experiment/correctness.sql` with run_id/fixture bindings.\n\n"
        "**Acceptance:** Non-zero invariant queries fail the run.",
    ),
    (
        "[M3-P7] Automated tests TC-003 through TC-009 (baseline)",
        "M3: Baseline booking correctness",
        ["test", "area:services-baseline", "type:test", "priority:p0"],
        "Cover booking success, sold out, idempotency, payment failure, timeout.\n\n"
        "**Acceptance:** CI green; mapped in traceability matrix.",
    ),
    (
        "[M3-P7] Concurrent last-seat contention test (TC-007)",
        "M3: Baseline booking correctness",
        ["test", "area:services-baseline", "type:test", "priority:p0"],
        "Many parallel contenders for last seats.\n\n"
        "**Acceptance:** Exactly allowed confirmations; reconciliation passes.",
    ),
    (
        "[M3-P8] GATE: M3 baseline booking correctness acceptance",
        "M3: Baseline booking correctness",
        ["type:gate", "priority:p0"],
        "**Gate:** no oversell or duplicate payment in local contention; all M3 tests green.",
    ),
    (
        "[M4-P1] Extract read service from baseline monolith",
        "M4: Optimized local profile",
        ["enhancement", "area:services-optimized", "profile:optimized", "type:feature", "priority:p0"],
        "Search + availability on read service; booking unchanged semantically.\n\n"
        "**Acceptance:** Read paths routable independently.",
    ),
    (
        "[M4-P1] Extract booking service and local edge routing",
        "M4: Optimized local profile",
        ["enhancement", "area:services-optimized", "profile:optimized", "type:feature", "priority:p0"],
        "Booking API on dedicated service; router sends /v1/bookings to booking.\n\n"
        "**Acceptance:** Same OpenAPI surface at edge.",
    ),
    (
        "[M4-P2] Redis cache-aside for availability (TC-002)",
        "M4: Optimized local profile",
        ["enhancement", "area:services-optimized", "type:feature", "priority:p0"],
        "Miss then hit; freshness metadata in response.\n\n"
        "**Acceptance:** TC-002; cache never authoritative for booking.",
    ),
    (
        "[M4-P2] Cache stampede coalescing",
        "M4: Optimized local profile",
        ["enhancement", "area:services-optimized", "type:feature", "priority:p1"],
        "Hot key expiry under read load bounded.\n\n"
        "**Acceptance:** FT-009 local prep passes.",
    ),
    (
        "[M4-P3] Transactional outbox publish to ElasticMQ",
        "M4: Optimized local profile",
        ["enhancement", "area:services-optimized", "type:feature", "priority:p0"],
        "Outbox → SQS-compatible queue per cache-and-queue design.\n\n"
        "**Acceptance:** Message emitted atomically with booking commit.",
    ),
    (
        "[M4-P3] Worker with processed_events deduplication",
        "M4: Optimized local profile",
        ["enhancement", "area:services-optimized", "type:feature", "priority:p0"],
        "At-least-once delivery; handlers idempotent.\n\n"
        "**Acceptance:** TC-010 passes.",
    ),
    (
        "[M4-P3] DLQ path for poison messages",
        "M4: Optimized local profile",
        ["enhancement", "area:services-optimized", "type:feature", "priority:p1"],
        "Repeated handler failure routes to DLQ without blocking unrelated messages.\n\n"
        "**Acceptance:** FT-004 local prep.",
    ),
    (
        "[M4-P4] Docker Compose optimized multi-service profile",
        "M4: Optimized local profile",
        ["enhancement", "area:infrastructure", "profile:optimized", "type:feature", "priority:p0"],
        "MySQL, Redis, ElasticMQ, read, booking, worker.\n\n"
        "**Acceptance:** Documented commands for baseline vs optimized profiles.",
    ),
    (
        "[M4-P5] Baseline vs optimized API parity contract tests",
        "M4: Optimized local profile",
        ["test", "profile:both", "type:test", "priority:p0"],
        "Same requests produce equivalent booking outcomes (modulo cache freshness fields).\n\n"
        "**Acceptance:** DoD architecture parity item satisfied locally.",
    ),
    (
        "[M4-P6] GATE: M4 optimized local profile acceptance",
        "M4: Optimized local profile",
        ["type:gate", "priority:p0"],
        "**Gate:** M3 tests pass on optimized profile; TC-002/TC-010 pass; Compose optimized stable.",
    ),
    (
        "[M5-P1] CloudFormation layout and deploy wrapper scripts",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "type:feature", "priority:p0"],
        "Profiles `aws-baseline` and `aws-optimized` per system overview.\n\n"
        "**Acceptance:** Region ap-south-1; WAF edge resources documented for us-east-1.",
    ),
    (
        "[M5-P1] IAM roles and security groups",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "area:security", "type:feature", "priority:p0"],
        "Task roles least-privilege; SG matrix from network-deployment doc.\n\n"
        "**Acceptance:** ST-005 prep — no cross-service queue access.",
    ),
    (
        "[M5-P2] RDS MySQL primary stack module",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "profile:both", "type:feature", "priority:p0"],
        "Single-AZ per cost plan; migrations runnable on deploy.\n\n"
        "**Acceptance:** Baseline smoke connects and migrates.",
    ),
    (
        "[M5-P2] RDS read replica module (optimized profile)",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "profile:optimized", "type:feature", "priority:p1"],
        "Non-authoritative reads only.\n\n"
        "**Acceptance:** Booking still hits primary.",
    ),
    (
        "[M5-P2] ElastiCache Redis module (test-window)",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "profile:optimized", "type:feature", "priority:p1"],
        "Deploy only during measurement sessions; teardown included.\n\n"
        "**Acceptance:** Cost plan alignment documented in run manifest.",
    ),
    (
        "[M5-P3] ECS Fargate services for baseline and optimized",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "type:feature", "priority:p0"],
        "Task sizes recorded for resource parity reporting.\n\n"
        "**Acceptance:** Health checks pass behind ALB.",
    ),
    (
        "[M5-P3] ALB, target groups, and WAF cell hooks",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "area:security", "type:feature", "priority:p0"],
        "Support principal cells with WAF on/off per manifest.\n\n"
        "**Acceptance:** ST-001–ST-003 runnable when budget allows.",
    ),
    (
        "[M5-P3] S3 private bucket and CloudFront OAC",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "type:feature", "priority:p1"],
        "Static assets if needed; direct S3 access denied.\n\n"
        "**Acceptance:** DoD S3/OAC item.",
    ),
    (
        "[M5-P3] SQS and DLQ for worker path",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "profile:optimized", "type:feature", "priority:p0"],
        "Wire optimized worker; baseline profile has no consumer requirement.\n\n"
        "**Acceptance:** End-to-end async path in AWS optimized smoke.",
    ),
    (
        "[M5-P4] CloudWatch logs, metrics, and OpenTelemetry",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:observability", "type:feature", "priority:p1"],
        "Per run_id namespace; SLO metrics exportable.\n\n"
        "**Acceptance:** Observability doc checklist satisfied for AWS.",
    ),
    (
        "[M5-P4] AWS budget alerts at $10/$25/$50/$75",
        "M5: AWS infrastructure & observability",
        ["enhancement", "area:infrastructure", "type:chore", "priority:p0"],
        "Enable before first paid deploy.\n\n"
        "**Acceptance:** DoD cost item; owner notified on threshold.",
    ),
    (
        "[M5-P5] Automate deployment runbook",
        "M5: AWS infrastructure & observability",
        ["documentation", "area:infrastructure", "type:chore", "priority:p0"],
        "Scripts match `docs/runbooks/deployment.md` with manifest preflight.\n\n"
        "**Acceptance:** Second person can deploy from clean checkout.",
    ),
    (
        "[M5-P5] Automate teardown and orphan resource audit",
        "M5: AWS infrastructure & observability",
        ["documentation", "area:infrastructure", "type:chore", "priority:p0"],
        "Match `docs/runbooks/teardown.md`; fail if paid orphans remain.\n\n"
        "**Acceptance:** Post-smoke account audit clean.",
    ),
    (
        "[M5-P6] Security smoke ST-004 and ST-005",
        "M5: AWS infrastructure & observability",
        ["test", "area:security", "type:test", "priority:p1"],
        "ALB origin restriction; IAM negative tests.\n\n"
        "**Acceptance:** Documented evidence attached to smoke run.",
    ),
    (
        "[M5-P7] GATE: M5 AWS smoke and teardown acceptance",
        "M5: AWS infrastructure & observability",
        ["type:gate", "priority:p0"],
        "**Gate:** minimal AWS smoke within estimate; baseline then optimized deploy sequentially; teardown leaves no paid orphan.",
    ),
    (
        "[M6-P1] k6 PT-001 smoke workload",
        "M6: Experiment engine & load tests",
        ["test", "area:experiment", "type:test", "priority:p0"],
        "1–5 RPS; validates scripts and telemetry hooks.\n\n"
        "**Acceptance:** PT-001 documented command; artifacts exported.",
    ),
    (
        "[M6-P1] k6 mixed traffic and contention scenarios",
        "M6: Experiment engine & load tests",
        ["test", "area:experiment", "type:test", "priority:p1"],
        "PT-005, PT-006 scripts with open-model arrivals.\n\n"
        "**Acceptance:** Configurable from run manifest.",
    ),
    (
        "[M6-P2] Experiment controller CLI",
        "M6: Experiment engine & load tests",
        ["enhancement", "area:experiment", "type:feature", "priority:p0"],
        "Reset, seed, run_id, invoke k6, export artifacts per protocol steps 1–14.\n\n"
        "**Acceptance:** Single entrypoint documented in experiment runbook.",
    ),
    (
        "[M6-P3] Run manifest generator with pair randomization",
        "M6: Experiment engine & load tests",
        ["enhancement", "area:experiment", "type:feature", "priority:p0"],
        "AB/BA order from recorded seed; WAF and cache condition fields.\n\n"
        "**Acceptance:** Matches `run-manifest.template.yaml`.",
    ),
    (
        "[M6-P4] Artifact export to result.schema.json",
        "M6: Experiment engine & load tests",
        ["enhancement", "area:experiment", "type:feature", "priority:p0"],
        "k6, app, AWS cost, reconciliation linked per run.\n\n"
        "**Acceptance:** Valid JSON against `experiment/result.schema.json`.",
    ),
    (
        "[M6-P4] Load generator preflight gates",
        "M6: Experiment engine & load tests",
        ["enhancement", "area:experiment", "type:feature", "priority:p0"],
        "CPU <70%, network adequate, start delay within limits.\n\n"
        "**Acceptance:** Invalid if generator-saturated per protocol.",
    ),
    (
        "[M6-P5] GATE: M6 experiment engine acceptance",
        "M6: Experiment engine & load tests",
        ["type:gate", "priority:p0"],
        "**Gate:** PT-001 smoke + preflight + manifest export reproducible from clean reset.",
    ),
    (
        "[M7-P1] Calibration pilot and freeze hypotheses.yaml",
        "M7: Campaign, analysis & delivery",
        ["enhancement", "area:experiment", "type:feature", "priority:p0"],
        "Stepped open load finds baseline SLO capacity; record frozen rates.\n\n"
        "**Acceptance:** PT-002 complete before confirmatory pairs.",
    ),
    (
        "[M7-P2] Execute principal paired runs per protocol",
        "M7: Campaign, analysis & delivery",
        ["enhancement", "area:experiment", "profile:both", "type:feature", "priority:p0"],
        "Four principal cells; five AB/BA reps each or documented budget reduction.\n\n"
        "**Acceptance:** Sequential isolated runs; invalid runs archived with reason.",
    ),
    (
        "[M7-P3] Selected failure tests at ~80% load",
        "M7: Campaign, analysis & delivery",
        ["test", "area:experiment", "type:test", "priority:p1"],
        "One fault at a time: FT-001, FT-002, FT-003, FT-005, FT-007 as budget allows.\n\n"
        "**Acceptance:** Recovery metrics captured in result schema.",
    ),
    (
        "[M7-P4] Paired bootstrap analysis pipeline",
        "M7: Campaign, analysis & delivery",
        ["enhancement", "area:experiment", "type:feature", "priority:p0"],
        "log(optimized/baseline) ratios with 95% CI; Holm for secondaries.\n\n"
        "**Acceptance:** Statistics match protocol section.",
    ),
    (
        "[M7-P5] Results dashboard and cost parity tables",
        "M7: Campaign, analysis & delivery",
        ["enhancement", "area:observability", "area:experiment", "type:feature", "priority:p1"],
        "Charts for latency, success, cache, queue, cost per dollar metrics.\n\n"
        "**Acceptance:** Linked from final report; no unmeasured claims.",
    ),
    (
        "[M7-P6] Complete experiment report from template",
        "M7: Campaign, analysis & delivery",
        ["documentation", "area:experiment", "type:chore", "priority:p0"],
        "Fill `experiment/report-template.md` with measured evidence only.\n\n"
        "**Acceptance:** DoD evidence section satisfied.",
    ),
    (
        "[M7-P6] Second-contributor reproducibility walkthrough",
        "M7: Campaign, analysis & delivery",
        ["documentation", "type:gate", "priority:p0"],
        "Another person follows runbook from clean state to one valid pair.\n\n"
        "**Acceptance:** DoD documentation item; notes filed in repo.",
    ),
    (
        "[M7-P7] GATE: M7 campaign and delivery acceptance",
        "M7: Campaign, analysis & delivery",
        ["type:gate", "priority:p0"],
        "**Gate:** principal campaign complete or budget amendment documented; report + DoD checklist signed off.",
    ),
    (
        "[M8-P1] Scaffold React + Vite frontend",
        "M8: Frontend booking simulator (last)",
        ["enhancement", "area:frontend", "type:feature", "priority:p0"],
        "Project under `frontend/`; synthetic auth; env for API base URL.\n\n"
        "**Acceptance:** Builds locally; no real PII/payment data.",
    ),
    (
        "[M8-P2] Search and availability UI flows",
        "M8: Frontend booking simulator (last)",
        ["enhancement", "area:frontend", "type:feature", "priority:p0"],
        "Wire to live API; handle validation errors.\n\n"
        "**Acceptance:** Manual E2E against local optimized profile.",
    ),
    (
        "[M8-P2] Booking and status UI with idempotency headers",
        "M8: Frontend booking simulator (last)",
        ["enhancement", "area:frontend", "type:feature", "priority:p0"],
        "Generate Idempotency-Key; poll status on slow path.\n\n"
        "**Acceptance:** Matches OpenAPI client semantics.",
    ),
    (
        "[M8-P3] Advisory freshness labels in UI",
        "M8: Frontend booking simulator (last)",
        ["enhancement", "area:frontend", "type:feature", "priority:p1"],
        "Display availability as advisory per DoD.\n\n"
        "**Acceptance:** Copy reviewed against assumptions doc.",
    ),
    (
        "[M8-P4] GATE: M8 frontend acceptance",
        "M8: Frontend booking simulator (last)",
        ["type:gate", "priority:p0"],
        "**Gate:** full simulator flow against API; DoD frontend items checked.",
    ),
]


def main() -> int:
    try:
        ensure_labels()
        ms_map = ensure_milestones()
        titles = existing_issue_titles()
        created = 0
        for title, milestone, labels, body in ISSUES:
            if title in titles:
                continue
            create_issue(title, body, labels, milestone, ms_map)
            created += 1
        print(f"Done. Created {created} issues ({len(ISSUES) - created} already existed).")
        return 0
    except (RuntimeError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
