# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Agent

Always activate the virtualenv first:

```bash
source venv/bin/activate
python main.py
```

On first run with no `.env`, `main.py` launches an interactive setup wizard that writes credentials to `.env`, then immediately executes the full pipeline before starting the scheduler.

## Environment

All configuration is loaded lazily via callables in `config.py` (e.g. `config.APIFY_API_TOKEN()`). Every config accessor raises `EnvironmentError` on missing values — this is intentional so failures are loud at the call site, not silently swallowed. `SCHEDULE_DAYS` is the only optional var (defaults to `7`).

Required `.env` keys: `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY`, `GMAIL_SENDER_EMAIL`, `GMAIL_APP_PASSWORD`, `RECIPIENT_EMAILS`, `INSTAGRAM_ACCOUNTS`.

## Pipeline Architecture

The pipeline runs sequentially: **scraper → analyzer → emailer**. Each stage is isolated in its own module. `main.py` owns orchestration and error containment — scrape failures per account are caught and logged (empty list returned), email failure falls back to printing raw HTML to stdout.

**Data flow through the pipeline:**

1. `scraper.scrape_accounts(accounts)` → `dict[username, list[post_dict]]`  
   Each post dict has a fixed schema: `url`, `shortCode`, `caption`, `likesCount`, `commentsCount`, `type`, `musicInfo`, `displayUrl`, `timestamp`, `ownerUsername`, `videoViewCount`.

2. `analyzer.analyse(scraped_data)` → `report_dict`  
   Sends all post data to Claude (`claude-sonnet-4-20250514`, max 8192 tokens) with a prompt that demands raw JSON output matching an exact schema. The response is parsed and a `_raw_posts` key is injected (top-5 posts per account sorted by total engagement) for the emailer to use directly.

3. `emailer.send_report(report)` / `emailer.build_html(report)`  
   `build_html` prefers `report["_raw_posts"]` for post thumbnails and URLs (accurate Apify data) and falls back to Claude's synthesised `top_5_posts` if that key is absent. HTML is self-contained inline CSS, dark theme (`#0f0f0f` bg, `#e8c97e` gold accent).

## Key Behaviours to Preserve

- `scraper.py` uses `client.actor().call()` (blocking) with `timeout_secs=600`. Do not switch to async runs without updating the result-fetching logic.
- `analyzer.py` strips markdown code fences from Claude's response before JSON parsing — Claude sometimes wraps JSON in ` ```json ``` ` despite being told not to.
- `config.py` accessors are lambdas so they re-read from the environment on each call, allowing `load_dotenv(override=True)` in `run_pipeline()` to pick up fresh values without restarting.
- Apify actor input uses `directUrls` (profile URL), not username lookup — this is intentional to avoid Apify's username-resolution overhead.
