# WAF cell hooks and run manifest (M5 #47)

Principal experiment cells use [run-manifest.template.yaml](../../../experiment/run-manifest.template.yaml) field **`experiment.waf_mode`**: `off` or `on`.

| Manifest `waf_mode` | Deploy |
| --- | --- |
| `off` | `alb-*` with `--waf-mode off`; skip `aws:deploy:edge-waf` |
| `on` | Deploy `aws:deploy:edge-waf` first (us-east-1), then `alb-*` with `--waf-mode on` and pass `CloudFrontWebAclArn` output into ALB stack metadata; associate ACL on CloudFront distribution when frontend stack exists |

## ALB origin verification (all cells)

CloudFront (or smoke tooling) must send header **`X-RailFlux-Origin-Verify`** (override via `--origin-header-name`) matching `--origin-header-value`. Requests without it receive **403** from the ALB HTTPS listener (ST-004).

## Security tests (when budget allows)

| ID | Hook |
| --- | --- |
| ST-001 | `AWSManagedRulesCommonRuleSet` on CloudFront WAF |
| ST-002 | `RateLimitPerIp` on CloudFront WAF |
| ST-003 | Compare legitimate cohort block rate vs manifest thresholds |
| ST-004 | Direct ALB HTTPS without origin header → 403 |
