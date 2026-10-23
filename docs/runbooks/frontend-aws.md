# Frontend on AWS

Two phases — **deploy the website first**, wire the API later.

## Phase 1 — Static demo (recommended now)

Hosts the React app on **S3 + CloudFront** (private bucket, OAC). Hero, navigation, and sign-in UI work; **Search/Book/Compare need a backend** unless you only demo the home page.

**Account gate:** new CloudFront distributions require an AWS-verified account. If deploy fails with `Your account must be verified before you can add new CloudFront resources`, open [AWS Support](https://console.aws.amazon.com/support/home#/) and include that error. Static and full-stack public URLs both need CloudFront until that is cleared.

**Full E2E on another laptop** is Phase 2, not Phase 1. It also needs: container images in ECR, an ACM certificate in `ap-south-1`, `SYNTHETIC_JWT_SECRET`, `ORIGIN_HEADER_VALUE`, and a 1–2 hour session deploy (VPC, RDS, ALB, ECS). Compare still needs **both** baseline and optimized stacks (or stay on local dual-stack).

**Prerequisites:** AWS CLI configured (`aws sts get-caller-identity`), Node 20+, `npm install` at repo root.

```bash
# One command: create stack + build + upload + invalidate
npm run aws:deploy:frontend-static -- \
  --session demo-mitra \
  --expires-at 2026-12-31T23:59:59Z \
  --owner mitra9917
```

Optional production env (JWT mint on hosted site):

```bash
cp frontend/.env.production.example frontend/.env.production
# edit VITE_SYNTHETIC_JWT_SECRET if needed
FRONTEND_BUILD_ENV_FILE=frontend/.env.production \
  npm run aws:deploy:frontend-static -- --session demo-mitra --expires-at 2026-12-31T23:59:59Z
```

Script prints **DistributionUrl** — share that link for submission/demo.

**Progress in the terminal:** step labels `[1/4]`–`[4/4]` plus a live CloudFormation bar (`[#-----]`, elapsed seconds, resource counts). In a **second terminal** while deploy runs:

```bash
npm run aws:watch:stack -- --stack railflux-frontend-static-demo-mitra
```

Set `RAILFLUX_NO_DEPLOY_PROGRESS=1` to disable the bar (plain AWS CLI output only).

**Teardown:** delete stack `railflux-frontend-static-<session>` in `ap-south-1` (empty bucket first if needed).

## Phase 2 — Full stack (API + same CloudFront URL)

Follow [deployment.md](./deployment.md): network → RDS → IAM → ALB → ECS → **cloudfront-baseline** (or optimized), then publish the built assets:

```bash
npm run aws:publish:frontend -- \
  --mode publish \
  --session lab1 \
  --expires-at 2026-12-31T23:59:59Z \
  --profile cloudfront-baseline
```

Production build uses **same-origin** `/v1/*` (CloudFront forwards `/v1/*` and `/health/*` to the ALB).

**Compare page** (`/compare`) still expects **local dual-stack** proxies — use **Home / Search / Book** on AWS; keep Compare for local or add a second origin later.

## Re-publish after UI changes

```bash
npm run aws:publish:frontend -- --session demo-mitra --expires-at …   # static stack
# or --mode publish --profile cloudfront-baseline for full stack
```

Use `--skip-build` only if `frontend/dist` is already fresh.
