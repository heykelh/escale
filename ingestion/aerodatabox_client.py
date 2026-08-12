"""Client AeroDataBox (RapidAPI) : FIDS arrivees + departs par aeroport."""
import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

API_HOST = "aerodatabox.p.rapidapi.com"


class AeroDataBoxClient:
    def __init__(self, rapidapi_key: str):
        self.headers = {
            "x-rapidapi-key": rapidapi_key,
            "x-rapidapi-host": API_HOST,
        }

    @retry(
        retry=retry_if_exception_type(requests.exceptions.RequestException),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        stop=stop_after_attempt(4),
        reraise=True,
    )
    def fids(self, icao: str, from_local: str, to_local: str) -> dict:
        """Arrivees + departs pour un aeroport sur une fenetre <= 12h.
        Dates en heure LOCALE de l'aeroport, format 'YYYY-MM-DDTHH:MM'."""
        url = f"https://{API_HOST}/flights/airports/icao/{icao}/{from_local}/{to_local}"
        params = {
            "direction": "Both",
            "withLeg": "true",
            "withCancelled": "true",
            "withCodeshared": "false",
            "withCargo": "true",
            "withPrivate": "false",
            "withLocation": "false",
        }
        resp = requests.get(url, headers=self.headers, params=params, timeout=30)
        if resp.status_code == 429:
            # limite de debit -> on laisse tenacity retenter avec backoff
            raise requests.exceptions.RequestException("429 rate limit AeroDataBox")
        if resp.status_code in (401, 403):
            raise RuntimeError(
                f"AeroDataBox {resp.status_code} (cle / abonnement / tier). "
                f"Reponse RapidAPI : {resp.text[:400]}"
            )
        resp.raise_for_status()
        return resp.json() or {}
