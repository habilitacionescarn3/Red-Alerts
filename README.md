# Red Alerts

A live rocket / hostile-aircraft alert dashboard for Israel, modeled on the
Israel Home Front Command (Pikud HaOref / Oref) public alert feed. The backend
polls Oref every second, stores each distinct alert, and pushes it to every open
browser in real time over AWS IoT - so the map lights up the instant an alert
fires.

> **Disclaimer:** This is a **voluntary, open-source** project. It is **not
> affiliated with, endorsed by, or operated by Pikud HaOref (the Israel Home
> Front Command)** or any government body. It mirrors a public data feed and
> must not be relied on as an official source. In a real emergency, follow the
> official Home Front Command channels.

---

## Frontend

A React (Vite + TypeScript) single-page app:

- **Map** - an interactive map of Israel via **MapLibre GL** that highlights
  affected cities/areas as alerts arrive, plus a live feed and a timeline.
- **Data** - **TanStack Query** for server state (the 24h feed refetches hourly +
  on focus/mount), with realtime IoT pushes layered on top via **Zustand**.
- **UI** - **shadcn/ui** (Radix primitives) + **Tailwind CSS**, **i18n**
  (Hebrew/English, RTL-aware), **Recharts** analytics, and toast notifications.
- **Realtime** - subscribes to AWS IoT Core over MQTT-over-WSS using temporary
  Cognito credentials (SigV4-signed). Falls back to polling if IoT is unset.

Built statically and served from S3 behind CloudFront.

## Backend (one codebase, two compute sides, one private MySQL)

- **Worker** (always-on ECS-on-EC2) - the only writer. Polls Oref once per
  second, groups raw alerts into logical events, persists them, and publishes
  **once** to the IoT broadcast topic when something new happens.
- **API Lambda** (FastAPI via Mangum, behind API Gateway) - read-only. Serves the
  stored events to the client (`/api/alerts`, `/api/alerts/last-24h`, health).
- **IoT Core** - the realtime fan-out. The worker publishes to one broadcast
  topic; every subscribed browser receives the alert simultaneously (push, not
  poll). Cognito gives anonymous browsers temporary, subscribe-only credentials.

Infrastructure is **AWS CDK (TypeScript)** - this project no longer uses
Terraform. Each environment (`dev` / `qa` / `prod`) is its own independent
CloudFormation stack (`RedAlerts-<env>`), and resources are name-prefixed
(`red-alerts-<env>-...`) so they never collide.

---

## AWS resources (provisioned by the CDK stack)

| Service | Resource | Purpose |
| --- | --- | --- |
| ECS | Cluster + EC2 capacity (`t4g.nano`, ARM, 1 instance) | Hosts the always-on worker |
| ECS | Ec2 task definition + service | Runs the Oref poller container |
| ECR | Worker image repository (referenced) | Holds the worker image (pushed by `make push-docker`) |
| Lambda | API function (Python 3.11, ARM) | Read-only FastAPI app |
| Lambda | Layers: `common-layer` (deps) + `backend-code-layer` | Shared deps + business code |
| API Gateway | HTTP API (`$default` -> Lambda) | Public entry to the API |
| CloudFront | Distribution (+ Origin Access Control) | Serves client (`/*`) and proxies `/api/*` |
| S3 | Private client bucket | Stores the React build (CloudFront-only via OAC) |
| ACM | Certificate (us-east-1, imported) | TLS for the CloudFront domain |
| ACM | Certificate (il-central-1, DNS-validated) | TLS for the custom IoT domain |
| IoT Core | Broadcast topic (logical) | Single channel the worker publishes to |
| IoT Core | Domain configuration (`DATA`) | Custom endpoint `iot.<domain>` |
| Cognito | Unauthenticated identity pool + role | Temp, subscribe-only creds for browsers |
| Route 53 | A-alias (`<domain>` -> CloudFront) | App domain DNS |
| Route 53 | CNAME (`iot.<domain>` -> IoT endpoint) | Custom IoT domain DNS |
| IAM | Lambda role, worker task + execution roles | Least-privilege per workload |
| EC2 | VPC (imported) + shared security group | Private DB reachability + NAT egress |
| CloudWatch | Log groups (worker + Lambda) | Runtime logs |

> The MySQL database is **not** created by this stack - it's an existing private
> instance in the imported VPC.

---

## Useful commands

Run from `Server/` (see `make help` for the full list):

| Command | What it does |
| --- | --- |
| `make setup` | Build the Python venv + install deps |
| `make serve prod local` | Run worker + API locally against the local (tunnel) DB |
| `make serve prod local ONLY=api` | Run only the API (`ONLY=worker` for just the poller) |
| `make publish-test prod CITY="תל אביב - מרכז העיר"` | Fire a synthetic alert to IoT (test the live browser push) |
| `make push-docker prod` | Build + push the ARM worker image to ECR |
| `make deploy prod` | `cdk deploy` the stack (rolls the worker forward) |
| `make release prod` | `push-docker` then `deploy` in one step |
| `make sync prod local` | Sync the models to the DB schema (manual, via SSM tunnel) |
| `make bootstrap prod` | One-time CDK bootstrap per account/region |

Frontend (from `Client/`):

| Command | What it does |
| --- | --- |
| `npm install` | Install client dependencies |
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run build` | Production build to `Client/dist` |

Deploys are also wired into GitHub Actions (`main` -> prod, `qa` -> qa, `dev` ->
dev) for both the backend stack and the frontend (S3 sync + CloudFront
invalidation).
