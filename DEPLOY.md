# Production deployment (AWS Free Tier)

Deploy the full stack on a **single EC2 instance** with Docker Compose: nginx, Next.js frontend, FastAPI backend, PostgreSQL, Redis, and OpenSandbox (Docker-in-Docker for VS Code sandboxes).

VS Code sessions use the **Claude extension in the browser** — no Claude CLI or `ANTHROPIC_AUTH_TOKEN` required.

---

## Architecture

```
Internet → EC2 (t3.micro)
  ├── nginx :80          → frontend :3000, backend :8000
  ├── backend            → postgres, redis, opensandbox:8080
  ├── opensandbox        → Docker socket → VS Code sandboxes
  └── session URLs       → http://<PUBLIC_IP>:<high-port>/proxy/8443/
```

---

## Prerequisites

- AWS account (Free Tier eligible)
- Domain name (optional; you can use the Elastic IP)
- SSH key pair
- Git clone of this repository on the instance

---

## Step 1 — Launch EC2

1. AWS Console → **EC2** → **Launch instance**
2. **Name:** `opensandbox-dashboard`
3. **AMI:** Amazon Linux 2023
4. **Instance type:** `t3.micro` (Free tier)
5. **Key pair:** create or select one
6. **Storage:** 30 GiB gp3 (free tier)
7. **Security group** — create with these inbound rules:

   | Type        | Port range    | Source        | Purpose                    |
   |-------------|---------------|---------------|----------------------------|
   | SSH         | 22            | Your IP       | Administration             |
   | HTTP        | 80            | 0.0.0.0/0     | Dashboard (nginx)          |
   | HTTPS       | 443           | 0.0.0.0/0     | TLS (optional)             |
   | Custom TCP  | 32768–61000   | 0.0.0.0/0     | VS Code session ports      |

8. Launch the instance.
9. **Elastic IP** → Allocate → Associate with the instance. Note the IP (e.g. `203.0.113.10`).

---

## Step 2 — Install Docker on EC2

SSH in:

```bash
ssh -i your-key.pem ec2-user@203.0.113.10
```

Install Docker:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Log out and back in so `docker` works without sudo (`docker ps` without `sudo`).

Install **Compose** and **Buildx** (not in default AL2023 repos):

```bash
# Compose v2 plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Buildx (required for `docker compose build` on recent Compose)
ARCH=amd64
[ "$(uname -m)" = "aarch64" ] && ARCH=arm64
BUILDX_VERSION=v0.20.1
sudo curl -SL "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${ARCH}" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

docker compose version
docker buildx version
```

If `docker ps` still says “permission denied”, run `newgrp docker` or log out and SSH in again.

If you see **`compose build requires buildx 0.17.0 or later`**, install plugins (use the same user/sudo you use for compose):

```bash
chmod +x deploy/install-docker-plugins.sh
./deploy/install-docker-plugins.sh
# or: sudo ./deploy/install-docker-plugins.sh

docker buildx version   # must show 0.17+
sudo docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --build
```

---

## Step 3 — Clone and configure environment files

```bash
git clone <your-repo-url> ~/sandbox
cd ~/sandbox
```

### 3a. Root compose env

```bash
cp .env.production.example .env.production
nano .env.production
```

Set (replace `203.0.113.10` with your Elastic IP or domain):

```env
OPENSANDBOX_SESSION_EIP=203.0.113.10
VSCODE_IMAGE=sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/vscode:latest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=opensandbox
NEXT_PUBLIC_API_URL=http://203.0.113.10
NEXT_PUBLIC_WS_URL=ws://203.0.113.10
HTTP_PORT=80
```

Use `https://` and `wss://` after you enable TLS (Step 6).

### 3b. Backend env

```bash
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

Set:

```env
OPENSANDBOX_URL=http://opensandbox:8080
OPENSANDBOX_SESSION_HOST=203.0.113.10
DATABASE_URL=postgresql+asyncpg://postgres:<same-password>@postgres:5432/opensandbox
REDIS_URL=redis://redis:6379
CORS_ORIGINS=http://203.0.113.10
VSCODE_IMAGE=sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/vscode:latest
```

`OPENSANDBOX_SESSION_HOST` must match `OPENSANDBOX_SESSION_EIP`.

### 3c. Frontend env (optional local builds)

```bash
cp frontend/.env.production.example frontend/.env.production
```

Docker Compose build uses root `.env.production` build args; this file is for reference.

---

## Step 4 — Pull VS Code image and start the stack

```bash
cd ~/sandbox
docker pull sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/vscode:latest
docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --build
```

First start takes several minutes (OpenSandbox installs via `uv`, images pull).

Check status:

```bash
docker compose -f docker-compose.prod.yaml ps
docker compose -f docker-compose.prod.yaml logs -f opensandbox
```

Wait until OpenSandbox logs show the server listening on `0.0.0.0:8080`.

---

## Step 5 — Verify

1. **Health:** `curl http://203.0.113.10/healthz` → `{"status":"ok"}`
2. **Dashboard:** open `http://203.0.113.10` in a browser
3. **Spawn:** click **Spawn VS Code Session** — a new tab should open `http://203.0.113.10:<port>/proxy/8443/`
4. **Claude:** install/sign in to the Claude extension inside VS Code in the browser

If spawn fails, check:

```bash
docker compose -f docker-compose.prod.yaml logs backend
docker compose -f docker-compose.prod.yaml logs opensandbox
```

---

## Step 6 — HTTPS (recommended)

On the EC2 host:

```bash
sudo dnf install -y certbot python3-certbot-nginx
```

Point a DNS A record at your Elastic IP, then:

```bash
# Stop nginx container temporarily if certbot needs port 80
sudo certbot certonly --standalone -d your-domain.com
```

Mount certificates into nginx or terminate TLS on the host — update `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `CORS_ORIGINS`, and `OPENSANDBOX_SESSION_HOST` / `OPENSANDBOX_SESSION_EIP` to `https://your-domain.com`, then rebuild frontend:

```bash
docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --build frontend nginx
```

---

## Step 7 — Operations

| Task | Command |
|------|---------|
| View logs | `docker compose -f docker-compose.prod.yaml logs -f` |
| Restart | `docker compose -f docker-compose.prod.yaml restart` |
| Update app | `git pull && docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --build` |
| Stop | `docker compose -f docker-compose.prod.yaml down` |

**Disk:** prune unused images periodically: `docker system prune -af`

**Memory:** `t3.micro` (1 GiB) supports only a few concurrent VS Code sandboxes. Upgrade to `t3.small` if needed.

---

## Local development (unchanged workflow)

```bash
docker compose up -d          # postgres, redis, opensandbox
cd backend && uvicorn main:app --reload --port 8000
cd frontend && npm run dev
```

Use `backend/.env` and `frontend/.env.local` (see `backend/.env.example`).

---

## File reference

| File | Purpose |
|------|---------|
| `.env.production.example` | Root compose variables (copy → `.env.production`) |
| `backend/.env.production.example` | Backend (copy → `backend/.env.production`) |
| `frontend/.env.production.example` | Frontend build URLs |
| `docker-compose.prod.yaml` | Production stack |
| `deploy/nginx.conf` | Reverse proxy |
| `deploy/opensandbox-entrypoint.sh` | OpenSandbox server bootstrap |

---

## Security checklist

- [ ] Do not commit `.env.production` or `backend/.env.production`
- [ ] Restrict SSH (port 22) to your IP
- [ ] Use strong `POSTGRES_PASSWORD`
- [ ] Enable HTTPS for production
- [ ] OpenSandbox port 8080 is **not** exposed publicly (only internal Docker network)
- [ ] Review security group high-port range; restrict source IPs if possible
