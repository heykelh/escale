"""Pipeline ESCALE : AeroDataBox FIDS -> Neon (bronze/silver/gold).

Double fenetre :
  - FUTUR (prochaines 12h) : vols a venir -> prediction figee dans gold.predictions
  - PASSE (dernieres 12h)  : vols arrives -> silver/gold + reconciliation des predictions
"""
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

PARIS_CITY = {"LFPG": "Paris CDG", "LFPO": "Paris Orly"}


def parse_adb_time(t):
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
    own = item.get(direction, {}) or {}
    peer_key = "arrival" if direction == "departure" else "departure"
    peer = item.get(peer_key, {}) or {}
    peer_airport = (peer.get("airport") or {})
    peer_icao = peer_airport.get("icao") or peer_airport.get("iata")
    peer_city = peer_airport.get("name") or peer_icao

    scheduled = parse_adb_time(own.get("scheduledTime"))
    revised = parse_adb_time(own.get("revisedTime"))
    status = item.get("status")
    cancelled = bool(status) and status.lower().startswith("cancel")

    if scheduled and revised:
        delay_min = round((revised - scheduled).total_seconds() / 60)
    elif scheduled and not cancelled:
        delay_min = 0
    else:
        delay_min = None

    number = (item.get("number") or "").replace(" ", "") or None
    queried_city = PARIS_CITY.get(queried_icao, queried_icao)
    if direction == "departure":
        route = f"{queried_icao}-{peer_icao}" if peer_icao else None
        origin_city, dest_city = queried_city, peer_city
    else:
        route = f"{peer_icao}-{queried_icao}" if peer_icao else None
        origin_city, dest_city = peer_city, queried_city

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
        "origin_city": origin_city,
        "dest_city": dest_city,
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


def fetch_window(client, tz, fmt, hours_from, hours_to):
    """Recupere les vols sur une fenetre [now+hours_from, now+hours_to] (heures, signees)."""
    now_local = datetime.now(tz)
    begin_local = now_local + timedelta(hours=hours_from)
    end_local = now_local + timedelta(hours=hours_to)
    flights = []
    for ap in config.AIRPORTS:
        data = client.fids(ap["icao"], begin_local.strftime(fmt), end_local.strftime(fmt))
        for rec in data.get("departures", []) or []:
            flights.append(parse_flight(rec, ap["icao"], "departure"))
        for rec in data.get("arrivals", []) or []:
            flights.append(parse_flight(rec, ap["icao"], "arrival"))
        time.sleep(2)
    flights = list({f["flight_key"]: f for f in flights}.values())
    return flights, begin_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def score_flights(flights):
    """Calcule congestion + score pour une liste de vols. Retourne un dict flight_key -> infos score."""
    buckets = {}
    for f in flights:
        k = (f["airport"], f["direction"], f["hour_bucket"])
        buckets[k] = buckets.get(k, 0) + 1
    # la propension historique est recalculee par l'appelant (acces base) ; ici on renvoie la congestion
    return buckets


def main():
    if not config.RAPIDAPI_KEY or config.RAPIDAPI_KEY == "xxxxx":
        sys.exit("ERREUR: RAPIDAPI_KEY manquant ou non rempli dans .env")
    if not config.DATABASE_URL or "xxxx" in config.DATABASE_URL:
        sys.exit("ERREUR: DATABASE_URL manquant ou non rempli dans .env")

    tz = ZoneInfo(config.TZ)
    fmt = "%Y-%m-%dT%H:%M"
    client = AeroDataBoxClient(config.RAPIDAPI_KEY)
    now_utc = datetime.now(timezone.utc)

    # ========== PASSE FUTURE : prochaines 12h -> predictions figees ==========
    future_flights, _, _ = fetch_window(client, tz, fmt, 0, config.WINDOW_HOURS)
    print(f"[FUTUR] vols a venir recuperes: {len(future_flights)}")

    # ========== PASSE PASSEE : dernieres 12h -> silver/gold + reconciliation ==========
    past_flights, win_begin, win_end = fetch_window(client, tz, fmt, -config.WINDOW_HOURS, 0)
    print(f"[PASSE] vols arrives recuperes: {len(past_flights)}")

    if not future_flights and not past_flights:
        print("Aucun vol sur les deux fenetres, run termine.")
        return

    future_buckets = score_flights(future_flights)
    past_buckets = score_flights(past_flights)

    with psycopg.connect(config.DATABASE_URL, autocommit=False) as conn:
        with conn.cursor() as cur:
            # --- propension historique par route (base complete) ---
            cur.execute(
                """select route, avg(delay_min) from silver.flights
                   where route is not null and delay_min is not null
                     and delay_min between %s and %s group by route""",
                (config.DELAY_MIN_BOUND, config.DELAY_MAX_BOUND),
            )
            route_delay = {r: float(d) for r, d in cur.fetchall() if d is not None}

            # ============ 1) PREDICTIONS (vols futurs) ============
            pred_rows = []
            for f in future_flights:
                if not f["scheduled_utc"]:
                    continue
                concurrent = future_buckets[(f["airport"], f["direction"], f["hour_bucket"])]
                hist = route_delay.get(f["route"])
                score, band = compute_risk(hour=f["hour_bucket"] or 0, concurrent=concurrent,
                                           route_hist_delay_min=hist)
                pred_rows.append((
                    f["flight_key"], f["flight_number"], f["airline"], f["airport"], f["direction"],
                    f["route"], f["origin_city"], f["dest_city"], f["scheduled_utc"], now_utc,
                    concurrent, round(hist, 1) if hist is not None else None, score, band,
                ))
            # on insere la prediction ; si le vol est deja connu, on NE reecrit PAS le score
            # (la prediction d'origine reste figee), on met juste a jour les infos descriptives.
            cur.executemany(
                """insert into gold.predictions
                   (flight_key, flight_number, airline, airport, direction, route,
                    origin_city, dest_city, scheduled_utc, predicted_at, congestion,
                    route_hist_delay_min, risk_score, risk_band)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   on conflict (flight_key) do update set
                     flight_number=excluded.flight_number, airline=excluded.airline,
                     origin_city=excluded.origin_city, dest_city=excluded.dest_city""",
                pred_rows,
            )

            # ============ 2) SILVER / GOLD classiques (vols passes) ============
            if past_flights:
                cur.executemany(
                    """insert into bronze.raw_flights (flight_key, airport, direction, payload)
                       values (%s,%s,%s,%s)
                       on conflict (flight_key) do update
                         set payload = excluded.payload, ingested_at = now()""",
                    [(f["flight_key"], f["airport"], f["direction"], Json(f["_raw"])) for f in past_flights],
                )
                cur.executemany(
                    """insert into silver.flights
                       (flight_key, flight_number, callsign, airline, airport, direction,
                        peer_airport, route, origin_city, dest_city, scheduled_utc, revised_utc,
                        delay_min, status, cancelled, hour_bucket)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       on conflict (flight_key) do update set
                         revised_utc=excluded.revised_utc, delay_min=excluded.delay_min,
                         status=excluded.status, cancelled=excluded.cancelled,
                         origin_city=excluded.origin_city, dest_city=excluded.dest_city,
                         updated_at=now()""",
                    [(f["flight_key"], f["flight_number"], f["callsign"], f["airline"],
                      f["airport"], f["direction"], f["peer_airport"], f["route"],
                      f["origin_city"], f["dest_city"], f["scheduled_utc"], f["revised_utc"],
                      f["delay_min"], f["status"], f["cancelled"], f["hour_bucket"]) for f in past_flights],
                )
                gold_rows = []
                for f in past_flights:
                    concurrent = past_buckets[(f["airport"], f["direction"], f["hour_bucket"])]
                    hist = route_delay.get(f["route"])
                    score, band = compute_risk(hour=f["hour_bucket"] or 0, concurrent=concurrent,
                                               route_hist_delay_min=hist)
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

            # ============ 3) RECONCILIATION : predictions passees vs reel observe ============
            # Pour chaque vol arrive (present en silver avec un retard connu), on remplit
            # le constat dans gold.predictions SANS toucher au score predit.
            cur.execute(
                """update gold.predictions p
                   set actual_delay_min = s.delay_min,
                       was_delayed = (s.delay_min > 15),
                       reconciled_at = now()
                   from silver.flights s
                   where s.flight_key = p.flight_key
                     and s.delay_min is not null
                     and p.reconciled_at is null
                     and p.scheduled_utc < now()""",
            )
            reconciled = cur.rowcount

            # ============ 4) MONITORING (sur les vols passes) ============
            if past_flights:
                total = len(past_flights)
                complete = sum(1 for f in past_flights if f["route"] and f["scheduled_utc"])
                oob = sum(1 for f in past_flights if f["delay_min"] is not None
                          and not (config.DELAY_MIN_BOUND <= f["delay_min"] <= config.DELAY_MAX_BOUND))
                high = sum(1 for r in gold_rows if r[7] == "eleve")
                cancelled_n = sum(1 for f in past_flights if f["cancelled"])
                delays = [f["delay_min"] for f in past_flights if f["delay_min"] is not None
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

                # ============ 5) BACKLOG DQ ============
                dq = []
                for f in past_flights:
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
            else:
                dq = []

            # ============ 6) PURGE bronze > 3 jours ============
            cur.execute("delete from bronze.raw_flights where ingested_at < now() - interval '3 days'")

        conn.commit()

    print(f"OK. Predictions ecrites: {len(pred_rows)} | vols passes: {len(past_flights)} | "
          f"reconciliations: {reconciled} | anomalies DQ: {len(dq)}")
    if past_flights and oob > 0:
        notify(f"ESCALE: {oob} retards hors-bornes detectes sur le dernier run.")


if __name__ == "__main__":
    main()
