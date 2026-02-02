# ONUW Production Deployment Guide

This guide covers deploying One Night Ultimate Werewolf to a production server with your own domain.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Server Setup](#server-setup)
4. [DNS Configuration](#dns-configuration)
5. [Environment Configuration](#environment-configuration)
6. [Docker Compose Production Setup](#docker-compose-production-setup)
7. [Nginx Reverse Proxy](#nginx-reverse-proxy)
8. [SSL/TLS with Let's Encrypt](#ssltls-with-lets-encrypt)
9. [Deployment Steps](#deployment-steps)
10. [Updating the Application](#updating-the-application)
11. [Backup and Restore](#backup-and-restore)
12. [Monitoring and Logs](#monitoring-and-logs)
13. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                                    ┌─────────────────────────────────────────┐
                                    │              Your Server                │
┌──────────┐                        │                                         │
│  Users   │ ───HTTPS/WSS──────────▶│  ┌─────────┐    ┌──────────────────┐   │
│(Browser) │                        │  │  Nginx  │───▶│ Frontend (3000)  │   │
└──────────┘                        │  │  (443)  │    │ Next.js          │   │
                                    │  │         │    └──────────────────┘   │
                                    │  │         │                           │
                                    │  │         │    ┌──────────────────┐   │
                                    │  │         │───▶│ Backend (8080)   │   │
                                    │  │         │    │ WebSocket Server │   │
                                    │  └─────────┘    └────────┬─────────┘   │
                                    │                          │             │
                                    │                 ┌────────▼─────────┐   │
                                    │                 │ PostgreSQL (5432)│   │
                                    │                 │ Database         │   │
                                    │                 └──────────────────┘   │
                                    └─────────────────────────────────────────┘
```

**Components:**
- **Nginx** - Reverse proxy, SSL termination, routes `/` to frontend, `/ws` to backend
- **Frontend** - Next.js app serving the game UI (port 3000)
- **Backend** - Node.js WebSocket server handling game logic (port 8080)
- **PostgreSQL** - Database for users, games, statistics (port 5432)

---

## Prerequisites

### Server Requirements
- **OS:** Ubuntu 22.04 LTS (recommended) or any Linux with Docker support
- **RAM:** Minimum 2GB, recommended 4GB
- **Storage:** Minimum 20GB SSD
- **CPU:** 2+ cores recommended

### Software Requirements
- Docker Engine 24.0+
- Docker Compose v2.20+
- Git
- Domain name with DNS access

### Accounts Needed (for OAuth - optional)
- Google Cloud Console (for Google OAuth)
- Discord Developer Portal (for Discord OAuth)
- GitHub Developer Settings (for GitHub OAuth)

---

## Server Setup

### 1. Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 2. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/onuw.git
sudo chown -R $USER:$USER /opt/onuw
cd /opt/onuw
```

---

## DNS Configuration

Point your domain to your server's IP address:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | game | YOUR_SERVER_IP | 300 |
| A | @ | YOUR_SERVER_IP | 300 |

**Example:** If your domain is `example.com` and you want the game at `game.example.com`:
- Create an A record: `game` → `YOUR_SERVER_IP`

Wait for DNS propagation (usually 5-30 minutes).

---

## Environment Configuration

### 1. Create Production Environment File

```bash
cp .env.example .env.production
nano .env.production
```

### 2. Required Environment Variables

```env
# =============================================================================
# ONUW Production Environment
# =============================================================================

# -----------------------------------------------------------------------------
# Domain Configuration
# -----------------------------------------------------------------------------
DOMAIN=game.example.com
FRONTEND_URL=https://game.example.com
BACKEND_URL=https://game.example.com
WS_URL=wss://game.example.com/ws

# -----------------------------------------------------------------------------
# Database (change password!)
# -----------------------------------------------------------------------------
POSTGRES_USER=onuw
POSTGRES_PASSWORD=CHANGE_THIS_TO_A_SECURE_PASSWORD
POSTGRES_DB=onuw
DATABASE_URL=postgresql://onuw:CHANGE_THIS_TO_A_SECURE_PASSWORD@postgres:5432/onuw
DATABASE_POOL_SIZE=20

# -----------------------------------------------------------------------------
# Authentication (generate secure secrets!)
# -----------------------------------------------------------------------------
# Generate with: openssl rand -base64 32
JWT_SECRET=CHANGE_THIS_GENERATE_WITH_openssl_rand_base64_32
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=CHANGE_THIS_GENERATE_WITH_openssl_rand_base64_32
NEXTAUTH_URL=https://game.example.com

# -----------------------------------------------------------------------------
# OAuth Providers (optional - remove if not using)
# -----------------------------------------------------------------------------
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# -----------------------------------------------------------------------------
# SSL Configuration
# -----------------------------------------------------------------------------
SSL_EMAIL=your-email@example.com

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
LOG_LEVEL=info
```

### 3. Generate Secure Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
```

---

## Docker Compose Production Setup

### Create `docker-compose.prod.yml`

This file overrides the base `docker-compose.yml` for production:

```yaml
# docker-compose.prod.yml
# Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

services:
  # PostgreSQL - production settings
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      # Remove init scripts mount in prod (use migrations instead)
    restart: always

  # Backend - production settings
  onuw-server:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRES_IN=${JWT_EXPIRES_IN}
      - BASE_URL=${BACKEND_URL}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
      - DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
    # Don't expose ports directly - nginx will proxy
    ports: []
    expose:
      - "8080"
    restart: always

  # Frontend - production settings
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_WS_URL=${WS_URL}
    environment:
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - BACKEND_URL=http://onuw-server:8080
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
      - DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
    # Don't expose ports directly - nginx will proxy
    ports: []
    expose:
      - "3000"
    restart: always

  # Nginx reverse proxy with SSL
  nginx:
    image: nginx:alpine
    container_name: onuw-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - frontend
      - onuw-server
    restart: always

  # Certbot for SSL certificates
  certbot:
    image: certbot/certbot
    container_name: onuw-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  postgres_data:
```

---

## Nginx Reverse Proxy

### 1. Create Nginx Directory Structure

```bash
mkdir -p nginx/conf.d
mkdir -p certbot/conf certbot/www
```

### 2. Create Main Nginx Config

**File:** `nginx/nginx.conf`

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml application/xml+rss text/javascript;

    # WebSocket upgrade map
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    include /etc/nginx/conf.d/*.conf;
}
```

### 3. Create Site Config

**File:** `nginx/conf.d/onuw.conf`

```nginx
# Upstream definitions
upstream frontend {
    server frontend:3000;
}

upstream backend {
    server onuw-server:8080;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name game.example.com;  # CHANGE THIS

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name game.example.com;  # CHANGE THIS

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/game.example.com/fullchain.pem;  # CHANGE THIS
    ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;  # CHANGE THIS

    # SSL settings
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # WebSocket endpoint
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # API endpoints (if any REST endpoints exist)
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (Next.js)
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## SSL/TLS with Let's Encrypt

### 1. Initial Certificate Setup

Before starting with SSL, you need to get initial certificates:

```bash
# Create temporary nginx config without SSL
cat > nginx/conf.d/onuw.conf << 'EOF'
server {
    listen 80;
    server_name game.example.com;  # CHANGE THIS

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'ONUW Setup';
        add_header Content-Type text/plain;
    }
}
EOF

# Start nginx only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx

# Get certificates
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    -d game.example.com  # CHANGE THIS

# Now update nginx config with full SSL settings (from section above)
# Then restart everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 2. Auto-Renewal

Certificates auto-renew via the certbot container. To manually renew:

```bash
docker compose run --rm certbot renew
docker compose exec nginx nginx -s reload
```

---

## Deployment Steps

### Quick Deploy (After Initial Setup)

```bash
cd /opt/onuw

# Pull latest code
git pull origin main

# Load environment
set -a; source .env.production; set +a

# Build and deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check status
docker compose ps
docker compose logs -f
```

### First-Time Deployment Checklist

1. [ ] Server provisioned with Docker installed
2. [ ] Repository cloned to `/opt/onuw`
3. [ ] DNS configured and propagated
4. [ ] `.env.production` created with secure secrets
5. [ ] `docker-compose.prod.yml` created
6. [ ] Nginx config files created
7. [ ] Initial SSL certificates obtained
8. [ ] Full nginx config with SSL enabled
9. [ ] All services started and healthy
10. [ ] Test game functionality

---

## Updating the Application

### Standard Update

```bash
cd /opt/onuw

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Verify
docker compose ps
docker compose logs --tail=50 frontend
docker compose logs --tail=50 onuw-server
```

### Database Migrations

If there are database schema changes:

```bash
# Backup first!
docker compose exec postgres pg_dump -U onuw onuw > backup_$(date +%Y%m%d).sql

# Run migrations (if migration system exists)
docker compose exec onuw-server npm run migrate

# Or manually apply SQL
docker compose exec -T postgres psql -U onuw onuw < migrations/XXX_new_migration.sql
```

---

## Backup and Restore

### Automated Backup Script

**File:** `scripts/backup.sh`

```bash
#!/bin/bash
BACKUP_DIR="/opt/onuw/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker compose exec -T postgres pg_dump -U onuw onuw > "$BACKUP_DIR/db_$DATE.sql"

# Compress
gzip "$BACKUP_DIR/db_$DATE.sql"

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
```

### Restore from Backup

```bash
# Stop services
docker compose stop onuw-server frontend

# Restore database
gunzip -c backups/db_YYYYMMDD_HHMMSS.sql.gz | \
    docker compose exec -T postgres psql -U onuw onuw

# Restart services
docker compose start onuw-server frontend
```

---

## Monitoring and Logs

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f onuw-server
docker compose logs -f frontend
docker compose logs -f nginx

# Last N lines
docker compose logs --tail=100 onuw-server
```

### Health Checks

```bash
# Check all container status
docker compose ps

# Check specific health
docker inspect onuw-server --format='{{.State.Health.Status}}'

# Test WebSocket connection
curl -i -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: test" \
    https://game.example.com/ws
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

---

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Failed
```
Error: WebSocket connection to 'wss://game.example.com/ws' failed
```

**Solutions:**
- Check nginx WebSocket config has proper upgrade headers
- Verify `NEXT_PUBLIC_WS_URL` is set to `wss://game.example.com/ws`
- Check backend logs: `docker compose logs onuw-server`

#### 2. SSL Certificate Errors
```
Error: certificate has expired
```

**Solutions:**
```bash
docker compose run --rm certbot renew --force-renewal
docker compose exec nginx nginx -s reload
```

#### 3. Database Connection Failed
```
Error: ECONNREFUSED postgres:5432
```

**Solutions:**
- Check postgres is healthy: `docker compose ps`
- Verify DATABASE_URL in environment
- Check postgres logs: `docker compose logs postgres`

#### 4. 502 Bad Gateway
```
Error: 502 Bad Gateway
```

**Solutions:**
- Check if backend/frontend containers are running
- Verify upstream names in nginx config match container names
- Check container logs for crashes

#### 5. Out of Memory
```
Error: JavaScript heap out of memory
```

**Solutions:**
- Add memory limits to docker-compose
- Increase server RAM
- Check for memory leaks in logs

### Debug Commands

```bash
# Enter container shell
docker compose exec onuw-server sh
docker compose exec frontend sh

# Check network connectivity
docker compose exec nginx ping onuw-server
docker compose exec nginx ping frontend

# Restart single service
docker compose restart onuw-server

# Force recreate
docker compose up -d --force-recreate onuw-server

# View detailed container info
docker inspect onuw-server
```

---

## Security Checklist

- [ ] All secrets are unique and securely generated
- [ ] `.env.production` is not committed to git
- [ ] Database password is strong (24+ characters)
- [ ] JWT secrets are unique (32+ characters)
- [ ] SSL/TLS is properly configured
- [ ] HTTP redirects to HTTPS
- [ ] Database port (5432) not exposed externally
- [ ] Regular backups configured
- [ ] Firewall rules: only 80, 443 open
- [ ] OAuth redirect URIs are exact matches

---

## Quick Reference

### Start/Stop Commands

```bash
# Start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop all services
docker compose down

# Restart all services
docker compose restart

# View status
docker compose ps

# View logs
docker compose logs -f
```

### File Locations

| File | Purpose |
|------|---------|
| `/opt/onuw/.env.production` | Production secrets |
| `/opt/onuw/docker-compose.prod.yml` | Production overrides |
| `/opt/onuw/nginx/` | Nginx configuration |
| `/opt/onuw/certbot/` | SSL certificates |
| `/opt/onuw/backups/` | Database backups |

### Ports

| Port | Service | External |
|------|---------|----------|
| 80 | Nginx HTTP | Yes |
| 443 | Nginx HTTPS | Yes |
| 3000 | Frontend | No (internal) |
| 8080 | Backend | No (internal) |
| 5432 | PostgreSQL | No (internal) |
