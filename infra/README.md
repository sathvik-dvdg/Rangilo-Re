# GarbaConnect infrastructure

Terraform for running GarbaConnect on EC2 in `ap-south-1` (Mumbai), with two environments:

| Environment | Hostname | Instances | Deployed by | GitHub Environment |
|---|---|---|---|---|
| staging | `staging.garbaconnect.online` | 2–4 × t3.small | push to `preproduction` | `staging` |
| prod | `garbaconnect.online` | 2–4 × t3.medium | push to `main` | `production` (required reviewers) |

```
Internet ─► ALB (public subnets, 443; 80 → 301) ─► ASG of EC2 (private subnets, :3000, Docker)
                │  sticky lb_cookie, health check /api/health        │
                └─ WAF (optional, off by default)                    └─► NAT ─► Supabase, Clerk, ECR, SSM, push
```

The app's browsers talk to Supabase Realtime directly; EC2 serves pages and `/api/*` only.

## Layout

| Path | What it holds |
|---|---|
| `bootstrap/` | State bucket, GitHub OIDC provider, the Route 53 zone (shared by both environments), the Terraform CI roles. Applied by hand, once. Local state. |
| `modules/network` | VPC, 2 AZs, public and private subnets, 1 NAT gateway. |
| `modules/dns_cert` | ACM certificate for one hostname, validated in the shared zone. |
| `modules/alb` | Load balancer, HTTPS listener (TLS 1.2+), HTTP→HTTPS redirect, target group. |
| `modules/app` | Launch template (AL2023, IMDSv2 with hop limit 1, encrypted gp3), ASG, CPU target tracking, boot script. |
| `modules/ecr` | Image repository per environment, scan on push, immutable tags, keep 20. |
| `modules/config` | SSM parameters, created as placeholders. |
| `modules/iam` | Instance role and the GitHub deploy role. |
| `modules/observability` | Log group (30 days), SNS alert topic, alarms. |
| `modules/waf` | Managed rules + per-IP rate limit. `enable_waf = false` by default. |
| `envs/staging`, `envs/prod` | Identical `main.tf`; differences in `terraform.tfvars` and the state key. |

## Secrets never live in Terraform

`modules/config` creates every parameter with the placeholder `CHANGE_ME`. Secrets use the
write-only `value_wo` argument, so neither the placeholder nor any value you set later is
stored in the plan or the state. You set the real values with the AWS CLI. `BILLING_MODE`
and `RAZORPAY_*` are never created: production runs in Free Mode.

| Parameter (`/garbaconnect/<env>/env/…`) | Type | Read by |
|---|---|---|
| `CLERK_SECRET_KEY` | SecureString | container |
| `SUPABASE_SERVICE_ROLE_KEY` | SecureString | container |
| `VAPID_PRIVATE_KEY` | SecureString | container |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | String | deploy.yml (build) and container |
| `NEXT_PUBLIC_SUPABASE_URL` | String | deploy.yml (build) and container |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | String | deploy.yml (build) and container |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | String | container (push needs all three VAPID values) |

`/garbaconnect/<env>/image_tag` is the git SHA the instances run; deploy.yml sets it.

## First-time setup

Prerequisites: AWS CLI signed in to the target account with admin rights, Terraform ≥ 1.11,
and for each environment its own Clerk instance and Supabase project (DEP-001).

1. **Bootstrap**
   ```sh
   cd infra/bootstrap
   terraform init && terraform apply
   ```
   Keep `bootstrap/terraform.tfstate` safe (it holds no secrets). If the bucket name is
   taken, change `state_bucket_name` here and the `bucket` in both `envs/*/versions.tf`.

2. **Point the domain at Route 53.** In GoDaddy → Domain → DNS → Nameservers → *Use my own*,
   enter the four `route53_name_servers` from step 1. Wait until
   `dig NS garbaconnect.online +short` returns them (minutes to hours). Certificates cannot
   validate before this.

3. **GitHub settings** (repository → Settings):
   - Environments: create `staging`, `production` (add required reviewers), and
     `infrastructure` (add required reviewers).
   - Repository variables: `TF_PLAN_ROLE_ARN`, `TF_APPLY_ROLE_ARN` (bootstrap outputs),
     and optionally `ALERT_EMAIL`.

4. **Create staging up to, but not including, the instances**, so no instance boots before
   an image exists:
   ```sh
   cd infra/envs/staging
   export TF_VAR_alert_email=you@example.com
   terraform init
   terraform apply -target=module.config -target=module.ecr -target=module.iam -target=module.observability
   ```

5. **Fill in the parameters** (repeat per name in the table; `String` for the public ones):
   ```sh
   aws ssm put-parameter --overwrite --type SecureString \
     --name /garbaconnect/staging/env/CLERK_SECRET_KEY --value 'sk_live_…'
   ```
   Then confirm the alert subscription email AWS sends.

6. **Set the staging GitHub Environment variables** from `terraform output`:
   `AWS_DEPLOY_ROLE_ARN`, `ALERT_TOPIC_ARN`, `APP_URL`.

7. **Push the first image**, then create the rest:
   ```sh
   # build and push as deploy.yml does, then:
   aws ssm put-parameter --overwrite --type String --name /garbaconnect/staging/image_tag --value <git-sha>
   terraform apply
   ```
   Alternatively run `terraform apply` now and push to `preproduction`: until `image_tag` is
   set, instances boot, find nothing to run and fail their health check, and the group keeps
   replacing them until the first deploy succeeds.

8. **Apply migrations** to the environment's Supabase project (`supabase/migrations/`,
   including `0010_blocks_reports.sql`) before the first deploy that needs them (DEP-002).

9. Repeat 4–8 for `envs/prod` with `/garbaconnect/prod/…` and the `production` environment.

## Day to day

- **Deploy:** push to `preproduction` (staging) or merge to `main` (prod, after approval).
  deploy.yml tests, builds with the environment's public values, pushes `:<sha>`, sets
  `image_tag`, rolls the fleet (new instances healthy before old ones leave), runs
  `tests/smoke/deploy.spec.ts`, and on failure restores the previous tag and alerts.
- **Roll back by hand:** set `image_tag` to an earlier SHA (one of the last 20 images) and run
  `aws autoscaling start-instance-refresh --auto-scaling-group-name garbaconnect-<env>
  --preferences '{"MinHealthyPercentage":100,"MaxHealthyPercentage":200}'`.
- **Shell on an instance:** `aws ssm start-session --target <instance-id>` (no SSH).
- **Logs:** CloudWatch log group `/garbaconnect/<env>/app`, one stream per instance.
- **Infrastructure change:** open a PR touching `infra/`; terraform.yml posts the plan for both
  environments; after merge, approve the `infrastructure` environment to apply staging then prod.
- **Change a secret:** `aws ssm put-parameter --overwrite …`, then start an instance refresh
  (instances read parameters only at boot).

## Known limits

- One NAT gateway per environment: losing its zone cuts the instances' internet access.
- Rate limits are per instance; sticky sessions keep each browser on one instance, which is
  what makes the per-user limits hold (CHAT-007). Instance replacement resets them.
- `terraform-plan` reads with `ReadOnlyAccess`; `terraform-apply` has `AdministratorAccess`,
  limited by its trust policy to approved runs of this repository.
- `deploy.yml` builds one image per environment, since `NEXT_PUBLIC_*` values are baked in.
- Not built: browser smoke test (Part B), load test, migration automation, WAF tuning.
