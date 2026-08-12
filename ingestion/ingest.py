"""Pipeline ESCALE : AeroDataBox FIDS -> Supabase (bronze/silver/gold)."""
import hashlib
import sys
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import psycopg
import requests
from psycopg.types.json import Json

from ingestion import config
from ingestion.aerodatabox_client import AeroDataBoxClient
from ingestion.risk_scoring import compute_risk


def parse_adb_time(t):
    """Objet {'utc': '2026-08-12 08:30Z', 'local': ...} -> datetime UTC."""
    if not t:
        return None
    s = t.get("utc") if isinstance(t, dict) else t
    if not s:
        return None
    s = s.strip().replace(" ", "T")
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(s).astimezone(timezone.utc)
    except ValueError:
        return None


def flight_key(number, scheduled, direction, airport) -> str:
    raw = f"{number}|{scheduled}|{direction}|{airport}"
    return hashlib.sha1(raw.encode()).hexdigest()


def parse_flight(item: dict, queried_icao: str, direction: str) -> dict:
    # Format FIDS : les temps sont dans les sous-objets 'departure' et 'arrival'.
    # On lit le segment correspondant a la direction interrogee.
    own = item.get(direction, {}) or {}           # 'departure' ou 'arrival'
    peer_key = "arrival" if direction == "departure" else "departure"
    peer = item.get(peer_key, {}) or {}
    peer_airport = (peer.get("airport") or {})
    peer_icao = peer_airport.get("icao") or peer_airport.get("iata")

    scheduled = parse_adb_time(own.get("scheduledTime"))
    revised = parse_adb_time(own.get("revisedTime"))
    status = item.get("status")
    cancelled = bool(status) and status.lower().startswith("cancel")

    if scheduled and revised:
        delay_min = round((revised - scheduled).total_seconds() / 60)
    elif scheduled and not cancelled:
        delay_min = 0  # pas de revision => suppose a l'heure
    else:
        delay_min = None

    number = (item.get("number") or "").replace(" ", "") or None
    if direction == "departure":
        route = f"{queried_icao}-{peer_icao}" if peer_icao else None
    else:
        route = f"{peer_icao}-{queried_icao}" if peer_icao else None

    return {
        "flight_key": flight_key(number, scheduled.isoformat() if scheduled else None,
                                 direction, queried_icao),
        "flight_number": number,
        "callsign": (item.get("callSign") or "").strip() or None,
        "airline": ((item.get("airline") or {}).get("name")),
        "airport": queried_icao,
        "direction": direction,
        "peer_airport": peer_icao,
        "route": route,
        "scheduled_utc": scheduled,
        "revised_utc": revised,
        "delay_min": delay_min,
        "status": status,
        "cancelled": cancelled,
        "hour_bucket": scheduled.hour if scheduled else None,
        "_raw": item,
    }


def notify(msg: str):
    if not config.NTFY_TOPIC:
        return
    try:
        requests.post(f"https://ntfy.sh/{config.NTFY_TOPIC}", data=msg.encode(), timeout=10)
    except requests.exceptions.RequestException:
        pass


def main():
    if not config.RAPIDAPI_KEY or config.RAPIDAPI_KEY == "xxxxx":
        sys.exit("ERREUR: RAPIDAPI_KEY manquant ou non rempli dans .env")
    if not config.DATABASE_URL or "xxxx" in config.DATABASE_URL:
        sys.exit("ERREUR: DATABASE_URL manquant ou non rempli dans .env")

    tz = ZoneInfo(config.TZ)
    now_local = datetime.now(tz)
    from_local = now_local - timedelta(hours=config.WINDOW_HOURS)
    fmt = "%Y-%m-%dT%H:%M"
    win_begin = from_local.astimezone(timezone.utc)
    win_end = now_local.astimezone(timezone.utc)

    client = AeroDataBoxClient(config.RAPIDAPI_KEY)

    # --- FETCH ---
    flights = []
    for ap in config.AIRPORTS:
        data = client.fids(ap["icao"], from_local.strftime(fmt), now_local.strftime(fmt))
        for rec in data.get("departures", []) or []:
            flights.append(parse_flight(rec, ap["icao"], "departure"))
        for rec in data.get("arrivals", []) or []:
            flights.append(parse_flight(rec, ap["icao"], "arrival"))
        time.sleep(2)   # respecte la limite req/s du plan Basic

    flights = list({f["flight_key"]: f for f in flights}.values())
    print(f"Vols recuperes: {len(flights)}")

    if not flights:
        print("Aucun vol sur la fenetre. Si tu t'attendais a des vols, "
              "inspecte un enregistrement dans bronze.raw_flights (noms de champs).")
        return

    # --- CONGESTION (par aeroport + direction + creneau, dans le batch) ---
    buckets = {}
    for f in flights:
        k = (f["airport"], f["direction"], f["hour_bucket"])
        buckets[k] = buckets.get(k, 0) + 1

    with psycopg.connect(config.DATABASE_URL, autocommit=False) as conn:
        with conn.cursor() as cur:
            # BRONZE
            cur.executemany(
                """insert into bronze.raw_flights (flight_key, airport, direction, payload)
                   values (%s,%s,%s,%s)
                   on conflict (flight_key) do update
                     set payload = excluded.payload, ingested_at = now()""",
                [(f["flight_key"], f["airport"], f["direction"], Json(f["_raw"])) for f in flights],
            )
            # SILVER
            cur.executemany(
                """insert into silver.flights
                   (flight_key, flight_number, callsign, airline, airport, direction,
                    peer_airport, route, scheduled_utc, revised_utc, delay_min, status,
                    cancelled, hour_bucket)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   on conflict (flight_key) do update set
                     revised_utc=excluded.revised_utc, delay_min=excluded.delay_min,
                     status=excluded.status, cancelled=excluded.cancelled, updated_at=now()""",
                [(f["flight_key"], f["flight_number"], f["callsign"], f["airline"],
                  f["airport"], f["direction"], f["peer_airport"], f["route"],
                  f["scheduled_utc"], f["revised_utc"], f["delay_min"], f["status"],
                  f["cancelled"], f["hour_bucket"]) for f in flights],
            )
            # PROPENSION : retard moyen historique par route (silver complet)
            cur.execute(
                """select route, avg(delay_min)
                   from silver.flights
                   where route is not null and delay_min is not null
                     and delay_min between %s and %s
                   group by route""",
                (config.DELAY_MIN_BOUND, config.DELAY_MAX_BOUND),
            )
            route_delay = {r: float(d) for r, d in cur.fetchall() if d is not None}

            # GOLD : scoring
            gold_rows = []
            for f in flights:
                concurrent = buckets[(f["airport"], f["direction"], f["hour_bucket"])]
                hist = route_delay.get(f["route"])
                score, band = compute_risk(
                    hour=f["hour_bucket"] or 0,
                    concurrent=concurrent,
                    route_hist_delay_min=hist,
                )
                gold_rows.append((f["flight_key"], f["route"], f["hour_bucket"], concurrent,
                                  round(hist, 1) if hist is not None else None,
                                  f["delay_min"], score, band))
            cur.executemany(
                """insert into gold.flight_risk
                   (flight_key, route, hour_bucket, congestion, route_hist_delay_min,
                    actual_delay_min, risk_score, risk_band)
                   values (%s,%s,%s,%s,%s,%s,%s,%s)
                   on conflict (flight_key) do update set
                     congestion=excluded.congestion,
                     route_hist_delay_min=excluded.route_hist_delay_min,
                     actual_delay_min=excluded.actual_delay_min,
                     risk_score=excluded.risk_score, risk_band=excluded.risk_band,
                     scored_at=now()""",
                gold_rows,
            )

            # MONITORING
            total = len(flights)
            complete = sum(1 for f in flights if f["route"] and f["scheduled_utc"])
            oob = sum(1 for f in flights if f["delay_min"] is not None
                      and not (config.DELAY_MIN_BOUND <= f["delay_min"] <= config.DELAY_MAX_BOUND))
            high = sum(1 for r in gold_rows if r[7] == "eleve")
            cancelled_n = sum(1 for f in flights if f["cancelled"])
            delays = [f["delay_min"] for f in flights if f["delay_min"] is not None
                      and config.DELAY_MIN_BOUND <= f["delay_min"] <= config.DELAY_MAX_BOUND]
            mean_delay = round(sum(delays) / len(delays), 1) if delays else None
            cur.execute(
                """insert into gold.monitoring_metrics
                   (window_begin, window_end, flights_ingested, completeness_pct,
                    out_of_bounds, high_risk_pct, cancelled_count, mean_delay_min)
                   values (%s,%s,%s,%s,%s,%s,%s,%s)""",
                (win_begin, win_end, total, round(100 * complete / total, 1),
                 oob, round(100 * high / total, 1), cancelled_n, mean_delay),
            )

            # BACKLOG DQ (rules deterministes, insert idempotent)
            dq = []
            for f in flights:
                if not f["route"]:
                    dq.append(("medium", "route_missing", "Aeroport pair non identifie", f["flight_key"]))
                if not f["scheduled_utc"]:
                    dq.append(("high", "scheduled_missing", "Heure prevue absente", f["flight_key"]))
                if f["delay_min"] is not None and not (
                        config.DELAY_MIN_BOUND <= f["delay_min"] <= config.DELAY_MAX_BOUND):
                    dq.append(("high", "delay_out_of_bounds",
                               f"Retard aberrant: {f['delay_min']} min", f["flight_key"]))
                if not f["flight_number"]:
                    dq.append(("low", "flight_number_missing", "Numero de vol absent", f["flight_key"]))
            for sev, rule, desc, fk in dq:
                cur.execute(
                    """insert into gold.dq_backlog (severity, rule, description, flight_key)
                       select %s,%s,%s,%s
                       where not exists (
                         select 1 from gold.dq_backlog
                         where rule=%s and coalesce(flight_key,'')=coalesce(%s,'') and status<>'resolved')""",
                    (sev, rule, desc, fk, rule, fk),
                )
        conn.commit()

    print(f"OK. {total} vols | completude {round(100*complete/total,1)}% | "
          f"risque eleve {high} | annules {cancelled_n} | "
          f"retard moyen {mean_delay} min | anomalies DQ {len(dq)}")
    if oob > 0:
        notify(f"ESCALE: {oob} retards hors-bornes detectes sur le dernier run.")


if __name__ == "__main__":
    main()
