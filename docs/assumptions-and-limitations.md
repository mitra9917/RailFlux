# Assumptions and Limitations

## Assumptions

- Demand is a time-dependent burst concentrated around a release instant.
- The primary workload mix begins at 70% search, 20% availability, and 10% booking, then is calibrated from pilot runs.
- Bot-like clients are synthetic aggressive pollers/retriers, not CAPTCHA bypass tools.
- Payments are deterministic stubs with configurable delay and failure.
- The academic inventory unit is one seat within a train/date/class/quota bucket.
- MySQL transactions and atomic conditional updates are sufficient for the modeled allocation.
- One AWS region is sufficient for the research question.
- Local Docker substitutes preserve behavior but not managed-service performance.
- The AWS account’s actual credit eligibility is verified before deployment.

## Limitations

- RailFlux cannot reproduce IRCTC’s undisclosed architecture, scale, rules, data, or threat model.
- The simplified inventory omits journey segments, RAC, waitlists, berth preference, quotas beyond Tatkal, and chart preparation.
- Synthetic users do not capture every human behavior, network, device, or payment pattern.
- A small student AWS stack cannot extrapolate linearly to national scale.
- Single-AZ RDS trades availability realism for cost.
- WAF bot-like tests demonstrate rate and request-shape controls, not sophisticated bot detection.
- Sequential tests improve internal validity but do not model two systems sharing live dependencies.
- Five repetitions support practical uncertainty estimates but not universal claims.
- CloudWatch’s standard metric granularity may hide sub-minute burst dynamics; application and k6 metrics fill this gap.
- Service pricing and Free Tier rules change; cost figures are planning estimates.

## Threats to validity

### Internal

- incomplete reset between runs;
- cache or connection-pool carryover;
- changing AWS background conditions;
- load-generator saturation;
- architecture order effects;
- instrumentation overhead.

Mitigation: checksums, isolated run IDs, randomized pair order, health gates, generator telemetry, fixed versions, and invalidation rules.

### Construct

- HTTP response latency may not equal terminal booking latency;
- request throughput may reward failed or rejected work;
- cache hit ratio alone does not show correctness;
- bookings per minute may be confused with passengers or requests.

Mitigation: terminal-state measurements, offered/started/completed counts, reconciliation, cohort-specific outcomes, and precise units.

### External

The result applies to the implemented synthetic workload and resource envelope. It does not prove that the same effect size applies to IRCTC or another production reservation system.

## Ethical boundary

All load targets infrastructure owned by the team. No tests target `irctc.co.in`, real accounts, real trains, third-party payment services, or public endpoints without explicit authorization.
