"""Diagnostic AeroDataBox : un seul appel FIDS, statut + corps brut."""
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from ingestion.config import RAPIDAPI_KEY

HOST = "aerodatabox.p.rapidapi.com"
tz = ZoneInfo("Europe/Paris")
now = datetime.now(tz)
frm = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M")
to = now.strftime("%Y-%m-%dT%H:%M")
url = f"https://{HOST}/flights/airports/icao/LFPG/{frm}/{to}"

r = requests.get(
    url,
    headers={"x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": HOST},
    params={"direction": "Both", "withLeg": "false"},
    timeout=30,
)
print("STATUS:", r.status_code)
print("BODY:", r.text[:600])
