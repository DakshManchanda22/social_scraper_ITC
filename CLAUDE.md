# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

**Backend** (FastAPI + scheduler, production entry point):
```bash
source venv/bin/activate
uvicorn api:app --reload --port 8000
```

**Frontend** (Next.js dashboard):
```bash
cd frontend
npm install
cp .env.local.example .env.local   # sets NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                         # http://localhost:3000
```

**Standalone CLI runner** (no API server, useful for one-off pipeline tests):
```bash
source venv/bin/activate
python main.py   # runs setup wizard if .env missing, then executes pipeline once
```

## Configuration: Two Sources

There are two separate config sources that must not be conflated:

| Source | What it holds | Who writes it |
|---|---|---|
| `.env` | Secret credentials: `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY`, `GMAIL_SENDER_EMAIL`, `GMAIL_APP_PASSWORD` | Developer / Fly.io secrets |
| `settings.json` | User config: `accounts`, `recipient_emails`, `schedule_days` | Frontend dashboard via `POST /api/settings` |

`config.py` handles `.env` via lazy callables (e.g. `config.APIFY_API_TOKEN()`). Each raises `EnvironmentError` loudly if missing — intentional. `settings.json` is read directly by `api.py`'s `load_settings()` / `save_settings()` helpers.

When `api.py` runs the pipeline, it reads `settings.json` first and injects accounts/emails into `os.environ` before calling scraper/emailer — this is how `config.py`'s env-var accessors pick up the dashboard values at runtime.

## Architecture

```
Browser (Vercel)          Fly.io service
frontend/app/page.tsx  →  api.py (FastAPI + APScheduler)
                                │
                    ┌───────────┼───────────┐
                 scraper.py  analyzer.py  emailer.py
```

`api.py` is the single Fly.io process. APScheduler runs in a background thread inside it (not a separate process). The scheduler reads `schedule_days` from `settings.json` at startup and is live-updated via `_reschedule()` whenever `POST /api/settings` is called.

`settings.json` is stored on a Fly.io persistent volume mounted at `/data`. `api.py` auto-detects `/data` at startup and uses `/data/settings.json` when present, falling back to the local path for local dev.

**Pipeline data flow:**

1. `scraper.scrape_accounts(accounts)` → `dict[username, list[post_dict]]`  
   Fixed post schema: `url`, `shortCode`, `caption`, `likesCount`, `commentsCount`, `type`, `musicInfo`, `displayUrl`, `timestamp`, `ownerUsername`, `videoViewCount`.

2. `analyzer.analyse(scraped_data)` → `report_dict`  
   Calls Claude (`claude-opus-4-7`, 8192 tokens). Prompt demands raw JSON matching an exact schema. Code fences are stripped before `json.loads()` because Claude occasionally wraps output anyway. A `_raw_posts` key is injected post-parse (top-5 per account by total engagement) for the emailer.

3. `emailer.send_report(report)` → sends via Gmail SMTP (STARTTLS, port 587)  
   `build_html()` prefers `_raw_posts` for accurate Apify thumbnails/URLs; falls back to Claude's synthesised `top_5_posts` if absent. All user-derived strings pass through `_esc()` before insertion into HTML.

## Key Behaviours to Preserve

- `scraper.py` uses `client.actor().call()` (blocking, `timeout_secs=600`). Do not switch to async without updating result-fetching.
- `config.py` accessors are lambdas so `load_dotenv(override=True)` in `_execute_pipeline()` picks up fresh env values on each run without a process restart.
- Apify actor input uses `directUrls` (full profile URL) not username — avoids Apify's username-resolution step.
- `CORS_ORIGINS` is set via the `FRONTEND_URL` env var on Fly.io. In local dev it defaults to `*`.
- `settings.json` is the source of truth for accounts/emails at pipeline runtime — Fly.io secrets for these are not needed.

## Deployment

### Backend — Fly.io

1. Install flyctl: `brew install flyctl` → `fly auth login`
2. From the repo root: `fly launch --no-deploy` (accept defaults, pick a unique app name)
3. Edit `fly.toml`: set `app` to your chosen name, set `primary_region` (e.g. `sin` for Singapore)
4. Create the persistent volume (free, 1 GB): `fly volumes create social_scraper_data --size 1 --region sin`
5. Set the 4 credential secrets:
   ```bash
   fly secrets set \
     APIFY_API_TOKEN=... \
     ANTHROPIC_API_KEY=... \
     GMAIL_SENDER_EMAIL=... \
     GMAIL_APP_PASSWORD=...
   ```
6. Set CORS origin (once you know your Vercel URL):
   ```bash
   fly secrets set FRONTEND_URL=https://<your-app>.vercel.app
   ```
7. Deploy: `fly deploy`
8. Your backend URL will be `https://<app-name>.fly.dev`

### Frontend — Vercel

- Root directory: `frontend/`
- Add env var `NEXT_PUBLIC_API_URL=https://<app-name>.fly.dev`
- Push to GitHub; Vercel auto-deploys on each push to `main`.
