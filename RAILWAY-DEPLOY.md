# Railway Deployment Guide

## Quick Start

1. **Create a new project** on [railway.app](https://railway.app)
2. **Deploy from GitHub**: Connect `aitwinworkforce-com/quote-automation-system`
3. **Add MySQL database**: New → Database → MySQL
4. **Set environment variables** (see below)
5. **Deploy** — Railway auto-detects Node.js and runs the build

## Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | Auto-provided by Railway MySQL plugin |
| `JWT_SECRET` | Session token signing key | Random 64-char string |
| `BUILT_IN_FORGE_API_URL` | OpenAI API base URL | `https://api.openai.com` |
| `BUILT_IN_FORGE_API_KEY` | OpenAI API key | `sk-...` |
| `S3_BUCKET` | S3 bucket name | `oestergaard-quotes` |
| `S3_REGION` | AWS region | `ap-southeast-2` |
| `S3_ACCESS_KEY` | AWS access key ID | `AKIA...` |
| `S3_SECRET_KEY` | AWS secret access key | `wJal...` |

## Optional Variables

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | Custom S3 endpoint (for R2, MinIO) |
| `NODE_ENV` | Set to `production` |

## Authentication

On Railway, the app uses **email/password authentication** (standalone mode).

- The **first user** to register automatically becomes admin
- Additional users can register at `/api/auth/register`
- Login at `/api/auth/login`

API endpoints:
- `POST /api/auth/register` — `{ email, password, name }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me` — current user

## Database Migration

After first deploy, the database tables are created automatically on first request.
If you need to run migrations manually:

```bash
# Connect to your Railway MySQL and run the SQL files in drizzle/ folder
# in order: 0000, 0001, 0002, ... 0011
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  Railway (self-hosted)                       │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Express  │  │  MySQL   │  │ AWS S3   │  │
│  │ + React  │──│ (plugin) │  │ (bucket) │  │
│  │ + tRPC   │  └──────────┘  └──────────┘  │
│  └──────────┘                               │
│       │                                      │
│       ├── OpenAI API (extraction)            │
│       └── ECB API (exchange rates)           │
└─────────────────────────────────────────────┘
```

## Differences from Manus Hosting

| Feature | Manus | Railway |
|---------|-------|---------|
| Auth | Manus OAuth (auto) | Email/password (standalone) |
| Storage | Manus S3 (auto) | Your own S3 bucket |
| LLM | Manus Forge (included) | Your OpenAI key |
| Database | TiDB (auto) | Railway MySQL plugin |
| Domain | `*.manus.space` | `*.up.railway.app` or custom |

## Costs (estimated)

- **Railway**: ~$5-20/month (depending on usage)
- **OpenAI**: ~$0.01-0.10 per quote extraction (GPT-4o)
- **AWS S3**: ~$0.023/GB storage + $0.09/GB transfer
- **Total**: ~$10-30/month for typical usage

