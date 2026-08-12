"""Verifie ce que parse_adb_time fait sur un vrai payload en base."""
import psycopg
from ingestion.config import DATABASE_URL
from ingestion.ingest import parse_adb_time

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("select payload from bronze.raw_flights limit 1")
        row = cur.fetchone()

payload = row[0]
mv = payload.get("movement", {})
print("movement keys:", list(mv.keys()))
print("scheduledTime brut:", mv.get("scheduledTime"))
print("revisedTime brut:", mv.get("revisedTime"))
print("-> parse scheduled:", parse_adb_time(mv.get("scheduledTime")))
print("-> parse revised:", parse_adb_time(mv.get("revisedTime")))
print("number:", payload.get("number"), "| status:", payload.get("status"))
