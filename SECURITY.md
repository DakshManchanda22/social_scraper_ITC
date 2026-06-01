
# Security Guidelines

## Credentials Management

### ✅ What's Protected

- All sensitive credentials (API keys, passwords, tokens) are stored in `.env` only
- `.env` is in `.gitignore` and never committed to version control
- Credentials are loaded at runtime via `config.py` using lazy callable functions
- Each credential access raises `EnvironmentError` if the env var is missing — failures are loud

### ⚠️ Critical Actions if Compromised

**If any credential leaks:**

1. **Gmail App Password** (highest priority)
   - Regenerate immediately at: myaccount.google.com → Security → App Passwords
   - Delete the old one
   - Update `.env` locally

2. **Anthropic API Key**
   - Revoke at: console.anthropic.com → Settings → API Keys
   - Create a new one
   - Update `.env`

3. **Apify API Token**
   - Revoke at: apify.com → Settings → API
   - Create a new one
   - Update `.env`

4. **Git History Cleanup**
   - If credentials were committed, rewrite history immediately:
     ```bash
     git filter-repo --force --replace-text <(echo 'EXPOSED_VALUE==>REDACTED')
     git push --force -u origin main
     ```

### ✅ Code Review Checklist

Before committing, verify:

- [ ] No hardcoded API keys, passwords, or tokens in `.py` files
- [ ] No credentials in string literals (e.g., `api_key="sk-..."`)
- [ ] All sensitive values come from `config.py` (which reads from `.env`)
- [ ] No `print(config.ANTHROPIC_API_KEY())` or similar debug statements
- [ ] `.env` stays in `.gitignore`

### ✅ Deployment (Railway)

- Set all 7 environment variables in Railway dashboard (never commit them)
- Railway doesn't need a `.env` file — it uses the dashboard settings
- Secrets in Railway are encrypted and rotated

## Email Security

- Gmail SMTP uses STARTTLS (port 587) — connection is encrypted
- App Password (not real password) is used, which is revocable
- Reports contain account names and engagement metrics only — no PII

## Data Handling

- Apify scrape results are processed in-memory only
- No user DMs, comments, or follower lists are scraped (only public post metadata)
- HTML reports are sent via encrypted email (STARTTLS)
- No data is logged to files or external services (only stdout)
