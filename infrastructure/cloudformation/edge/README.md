# Edge WAF stack (`us-east-1`)

CloudFront-associated **AWS WAF** web ACLs must be created in **`us-east-1`**, even when application VPC, ECS, RDS, and ALB live in **`ap-south-1`**.

## Why a separate stack

- WAF for CloudFront is always managed in N. Virginia.
- Application CloudFormation stacks stay in Mumbai to match the cost plan and [network-deployment.md](../../../docs/architecture/network-deployment.md).
- Teardown audits **both** regions; orphaned WAF ACLs in `us-east-1` still incur charges when associated with a distribution.

## Template

| File | Scope |
| --- | --- |
| `waf.yaml` | CloudFront-scoped WAF ACL + managed rules + rate limit (**M5 #47**) |

## Deploy

Only when the experiment manifest sets WAF mode to **on** for that cell:

```bash
export SESSION=your-session-name
npm run aws:deploy:edge-waf -- --session "$SESSION" --run-id "$RUN_ID" --owner "$OWNER" --expires-at "$EXPIRES_AT"
```

Stack name pattern: `railflux-edge-waf-${SessionName}` in **`us-east-1`**.

## Teardown

```bash
npm run aws:teardown -- --profile aws-edge-waf --session "$SESSION"
```

After deleting the CloudFront distribution (M5 P3), delete the WAF stack before leaving the account idle.

## Related docs

- [Security — WAF experiment](../../../docs/operations/security.md)
- [Teardown runbook — us-east-1 inspection](../../../docs/runbooks/teardown.md)
