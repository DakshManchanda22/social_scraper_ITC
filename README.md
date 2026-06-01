# Instagram Trend Agent

A scheduled Python agent that scrapes Instagram competitor accounts, analyses the data with Claude AI, and emails a formatted HTML trend report.

## What It Does

1. **Scrapes** the last 15 posts from each configured Instagram account via [Apify](https://apify.com)
2. **Analyses** engagement patterns, hooks, trending audio, and content formats using Claude (Sonnet)
3. **Generates** a structured competitive analysis report covering landscape, trends, and recommendations
4. **Emails** a dark-themed HTML report with inline thumbnails and clickable post links to all recipients
5. **Schedules** itself to repeat every N days (default: 7) using APScheduler

---

## Prerequisites

- Python 3.11+
- An [Apify](https://apify.com) account (free tier works; the `apify/instagram-scraper` actor is pay-per-use)
- An [Anthropic](https://console.anthropic.com) account and API key
- A Gmail account with an App Password (not your real password)

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd instagram-trend-agent
pip install -r requirements.txt
```

### 2. Get your credentials

**Apify API Token**
- Sign up at [apify.com](https://apify.com)
- Go to Settings → Integrations → API Token

**Anthropic API Key**
- Go to [console.anthropic.com](https://console.anthropic.com)
- Create a new API key

**Gmail App Password**
- Go to [myaccount.google.com](https://myaccount.google.com) → Security → 2-Step Verification → App Passwords
- Create an app password for "Mail" on "Other (Custom name)"
- Copy the 16-character password — this is what you enter as `GMAIL_APP_PASSWORD`
- Note: 2-Step Verification must be enabled on your Google account first

### 3. Run

```bash
python main.py
```

On first launch, if no `.env` file exists, you will be prompted interactively for all credentials. They are saved to `.env` automatically.

After setup, the pipeline runs immediately so you can verify it works end to end, then schedules itself to repeat.

---

## Configuration

All configuration lives in `.env` (created on first run):

| Variable | Description |
|---|---|
| `APIFY_API_TOKEN` | Your Apify API token |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `GMAIL_SENDER_EMAIL` | Gmail address to send reports from |
| `GMAIL_APP_PASSWORD` | Gmail App Password (16-char, not your real password) |
| `RECIPIENT_EMAILS` | Comma-separated list of email recipients |
| `INSTAGRAM_ACCOUNTS` | Comma-separated Instagram handles to scrape (no @) |
| `SCHEDULE_DAYS` | How often to run in days (default: 7) |

Example `.env`:
```
APIFY_API_TOKEN="apify_api_xxxxxxxxxxxxx"
ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxx"
GMAIL_SENDER_EMAIL="you@gmail.com"
GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
RECIPIENT_EMAILS="you@gmail.com,colleague@company.com"
INSTAGRAM_ACCOUNTS="nike,adidas,newbalance"
SCHEDULE_DAYS="7"
```

---

## Deploy to Railway

Railway lets you run this 24/7 in the cloud for free (within usage limits).

### Steps

1. Push your code to a GitHub repository (do **not** commit `.env` — it's gitignored)

2. Go to [railway.app](https://railway.app) and create a new project from your GitHub repo

3. In the Railway dashboard → your service → **Variables**, add all the environment variables from the table above

4. Set the **Start Command** to:
   ```
   python main.py
   ```

5. Deploy — Railway will install `requirements.txt` automatically and run the agent

Since Railway sets environment variables natively, the interactive `.env` setup is skipped and the agent goes straight to the pipeline.

---

## Project Structure

```
instagram-trend-agent/
├── main.py          # Entry point, setup wizard, scheduler
├── scraper.py       # Apify Instagram scraper
├── analyzer.py      # Claude AI analysis
├── emailer.py       # HTML report builder and Gmail sender
├── config.py        # Environment variable loading
├── requirements.txt
└── README.md
```

---

## Notes

- Apify scrapes may take 2–5 minutes per account; the agent waits up to 10 minutes before timing out
- A 5-second delay is added between accounts to avoid Apify rate limiting
- If scraping fails for an account, it is skipped and logged rather than crashing the run
- If email sending fails, the HTML report is printed to stdout as a fallback
