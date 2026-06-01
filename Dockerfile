FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api.py config.py scraper.py analyzer.py emailer.py ./

# settings.json is persisted via a Fly volume; seed a default if absent
COPY settings.json ./settings.json.default

CMD ["sh", "-c", "[ -f /data/settings.json ] || cp settings.json.default /data/settings.json && uvicorn api:app --host 0.0.0.0 --port 8080"]
