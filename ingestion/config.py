"""Configuration centralisee (variables d'environnement)."""
import os
from dotenv import load_dotenv

load_dotenv()

RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")

# Aeroports suivis (CDG + Orly, meme fuseau -> une seule fenetre suffit)
AIRPORTS = [
    {"icao": "LFPG", "iata": "CDG", "name": "Paris CDG"},
    {"icao": "LFPO", "iata": "ORY", "name": "Paris Orly"},
]
TZ = "Europe/Paris"

# Fenetre d'ingestion (FIDS AeroDataBox : 12h max par appel)
WINDOW_HOURS = min(int(os.environ.get("WINDOW_HOURS", "12")), 12)

# Bornes de sanity check sur le retard (minutes)
DELAY_MIN_BOUND = -180
DELAY_MAX_BOUND = 1440

# Alerting optionnel
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "")
