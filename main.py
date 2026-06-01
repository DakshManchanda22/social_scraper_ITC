#!/usr/bin/env python3
import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

ENV_PATH = Path(".env")


# ── Interactive setup ─────────────────────────────────────────────────────────

def _prompt(label: str, secret: bool = False, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    try:
        if secret:
            import getpass
            value = getpass.getpass(f"  {label}{suffix}: ").strip()
        else:
            value = input(f"  {label}{suffix}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)
    return value or default


def setup_env() -> None:
    print("\n" + "=" * 60)
    print("  Instagram Trend Agent — First-Time Setup")
    print("=" * 60)
    print("\nNo .env file found. Please enter your credentials.\n")

    fields = {
        "APIFY_API_TOKEN": ("Apify API Token (apify.com → Settings → API)", True, ""),
        "ANTHROPIC_API_KEY": ("Anthropic API Key", True, ""),
        "GMAIL_SENDER_EMAIL": ("Gmail Sender Address", False, ""),
        "GMAIL_APP_PASSWORD": (
            "Gmail App Password (myaccount.google.com > Security > App Passwords)", True, ""
        ),
        "RECIPIENT_EMAILS": (
            "Recipient Emails (comma-separated)", False, ""
        ),
        "INSTAGRAM_ACCOUNTS": (
            "Instagram Accounts to Scrape (comma-separated, without @)", False, ""
        ),
        "SCHEDULE_DAYS": ("Run every N days", False, "7"),
    }

    values: dict[str, str] = {}
    for key, (label, secret, default) in fields.items():
        values[key] = _prompt(label, secret=secret, default=default)

    lines = [f'{k}="{v}"' for k, v in values.items()]
    ENV_PATH.write_text("\n".join(lines) + "\n")

    print(f"\n✓ .env saved to {ENV_PATH.resolve()}\n")


# ── Pipeline ──────────────────────────────────────────────────────────────────

def run_pipeline() -> None:
    from dotenv import load_dotenv
    load_dotenv(override=True)

    import config
    import scraper
    import analyzer
    import emailer

    start = datetime.now()
    logger.info("=" * 55)
    logger.info(f"Pipeline run started at {start.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 55)

    accounts = config.INSTAGRAM_ACCOUNTS()
    logger.info(f"Accounts to scrape: {accounts}")

    # Scrape
    scraped_data = scraper.scrape_accounts(accounts)
    total_posts = sum(len(p) for p in scraped_data.values())
    logger.info(f"Scraping complete. Total posts fetched: {total_posts}")

    # Analyse
    report = analyzer.analyse(scraped_data)

    # Email
    try:
        emailer.send_report(report)
    except Exception as exc:
        logger.error(f"Email failed ({exc}). Printing HTML report to console instead.")
        print("\n" + emailer.build_html(report))

    elapsed = (datetime.now() - start).total_seconds()
    logger.info(f"Pipeline complete in {elapsed:.1f}s")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    if not ENV_PATH.exists():
        setup_env()

    # Load env now that file exists
    from dotenv import load_dotenv
    load_dotenv()

    import config

    schedule_days = config.SCHEDULE_DAYS()
    logger.info(f"Scheduler configured: every {schedule_days} day(s)")

    # Immediate first run
    logger.info("Running pipeline immediately for first verification run...")
    run_pipeline()

    # Schedule subsequent runs
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
    except ImportError:
        logger.error("APScheduler not installed. Run: pip install apscheduler")
        sys.exit(1)

    scheduler = BlockingScheduler()
    scheduler.add_job(
        run_pipeline,
        trigger="interval",
        days=schedule_days,
        id="trend_report",
        name="Instagram Trend Report",
    )

    logger.info(
        f"Scheduler started. Next run in {schedule_days} day(s). Press Ctrl+C to stop."
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
