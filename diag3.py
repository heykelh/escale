"""Inspecte la vraie structure d'un payload FIDS stocke (avec withLeg=true)."""
import json
import psycopg
from ingestion.config import DATABASE_URL

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("select payload from bronze.raw_flights limit 1")
        payload = cur.fetchone()[0]

print("CLES RACINE:", list(payload.keys()))
print()
print(json.dumps(payload, indent=2, ensure_ascii=False)[:1500])
