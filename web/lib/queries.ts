import { sql } from "./db";

export type Flight = {
  flight_key: string;
  flight_number: string | null;
  airline: string | null;
  airport: string;
  direction: string;
  origin_city: string | null;
  dest_city: string | null;
  route: string | null;
  scheduled_utc: string | null;
  delay_min: number | null;
  status: string | null;
  cancelled: boolean;
  risk_score: number;
  risk_band: string;
};

export type Monitoring = {
  run_at: string;
  flights_ingested: number;
  completeness_pct: number;
  high_risk_pct: number;
  cancelled_count: number;
  mean_delay_min: number | null;
};

export async function getLatestMonitoring(): Promise<Monitoring | null> {
  const rows = await sql<Monitoring[]>`
    select run_at, flights_ingested, completeness_pct, high_risk_pct,
           cancelled_count, mean_delay_min
    from gold.monitoring_metrics
    order by run_at desc
    limit 1`;
  return rows[0] ?? null;
}

export async function getFlights(
  airport?: string,
  direction?: string,
  band?: string
): Promise<Flight[]> {
  return sql<Flight[]>`
    select f.flight_key, f.flight_number, f.airline, f.airport, f.direction,
           f.origin_city, f.dest_city, f.route, f.scheduled_utc, f.delay_min,
           f.status, f.cancelled, r.risk_score, r.risk_band
    from silver.flights f
    join gold.flight_risk r on r.flight_key = f.flight_key
    where f.scheduled_utc is not null
      ${airport ? sql`and f.airport = ${airport}` : sql``}
      ${direction ? sql`and f.direction = ${direction}` : sql``}
      ${band ? sql`and r.risk_band = ${band}` : sql``}
    order by r.risk_score desc, f.scheduled_utc desc
    limit 200`;
}

/* ---------- Statistiques ---------- */

const win = (h: number | null) =>
  h ? sql`and scheduled_utc >= now() - make_interval(hours => ${h})` : sql``;

export type Kpis = {
  total: number;
  on_time_pct: number | null;
  delayed_count: number;
  delayed_pct: number | null;
  mean_delay: number | null;
  cancelled_count: number;
};

export async function getKpis(hours: number | null): Promise<Kpis> {
  const rows = await sql<any[]>`
    select
      count(*)::int as total,
      count(*) filter (where delay_min is not null)::int as known,
      count(*) filter (where delay_min is not null and delay_min <= 15 and not cancelled)::int as on_time,
      count(*) filter (where delay_min is not null and delay_min > 15)::int as delayed,
      round(avg(delay_min) filter (where delay_min is not null))::int as mean_delay,
      count(*) filter (where cancelled)::int as cancelled
    from silver.flights
    where scheduled_utc is not null ${win(hours)}`;
  const r = rows[0];
  return {
    total: r.total,
    on_time_pct: r.known ? Math.round((r.on_time / r.known) * 1000) / 10 : null,
    delayed_count: r.delayed,
    delayed_pct: r.known ? Math.round((r.delayed / r.known) * 1000) / 10 : null,
    mean_delay: r.mean_delay,
    cancelled_count: r.cancelled,
  };
}

export type HourStat = { hour: number; n: number; avg_delay: number | null };

export async function getDelayByHour(hours: number | null): Promise<HourStat[]> {
  return sql<HourStat[]>`
    select hour_bucket as hour, count(*)::int as n,
           round(avg(delay_min) filter (where delay_min is not null))::int as avg_delay
    from silver.flights
    where scheduled_utc is not null and hour_bucket is not null ${win(hours)}
    group by hour_bucket order by hour_bucket`;
}

export type RouteStat = {
  origin_city: string | null;
  dest_city: string | null;
  n: number;
  avg_delay: number | null;
};

export async function getTopDelayedRoutes(hours: number | null): Promise<RouteStat[]> {
  return sql<RouteStat[]>`
    select origin_city, dest_city, count(*)::int as n,
           round(avg(delay_min) filter (where delay_min is not null))::int as avg_delay
    from silver.flights
    where scheduled_utc is not null and delay_min is not null
          and origin_city is not null and dest_city is not null ${win(hours)}
    group by origin_city, dest_city
    having count(*) >= 3
    order by avg_delay desc nulls last
    limit 8`;
}

export type BandStat = {
  risk_band: string;
  n: number;
  avg_delay: number | null;
  delayed_pct: number | null;
};

export async function getValidationByBand(hours: number | null): Promise<BandStat[]> {
  return sql<BandStat[]>`
    select r.risk_band, count(*)::int as n,
           round(avg(f.delay_min) filter (where f.delay_min is not null))::int as avg_delay,
           round(100.0 * count(*) filter (where f.delay_min > 15)
                 / nullif(count(*) filter (where f.delay_min is not null), 0), 1) as delayed_pct
    from gold.flight_risk r
    join silver.flights f on f.flight_key = r.flight_key
    where f.scheduled_utc is not null ${
      hours ? sql`and f.scheduled_utc >= now() - make_interval(hours => ${hours})` : sql``
    }
    group by r.risk_band`;
}

export type AirportStat = {
  airport: string;
  known: number;
  on_time_pct: number | null;
  avg_delay: number | null;
};

export async function getByAirport(hours: number | null): Promise<AirportStat[]> {
  const rows = await sql<any[]>`
    select airport,
           count(*) filter (where delay_min is not null)::int as known,
           count(*) filter (where delay_min is not null and delay_min <= 15 and not cancelled)::int as on_time,
           round(avg(delay_min) filter (where delay_min is not null))::int as avg_delay
    from silver.flights
    where scheduled_utc is not null ${win(hours)}
    group by airport`;
  return rows.map((r) => ({
    airport: r.airport,
    known: r.known,
    on_time_pct: r.known ? Math.round((r.on_time / r.known) * 1000) / 10 : null,
    avg_delay: r.avg_delay,
  }));
}

/* ---------- Gouvernance : RGPD & AI Act ---------- */

export type RgpdTraitement = {
  id: number; nom: string; finalite: string; donnees_personnelles: boolean;
  categories_donnees: string; personnes_concernees: string; base_legale: string;
  destinataires: string; duree_conservation: string; mesures_securite: string;
  transfert_hors_ue: string; statut: string;
};
export async function getRgpdTraitements(): Promise<RgpdTraitement[]> {
  return sql<RgpdTraitement[]>`
    select id, nom, finalite, donnees_personnelles, categories_donnees, personnes_concernees,
           base_legale, destinataires, duree_conservation, mesures_securite,
           transfert_hors_ue, statut
    from gouvernance.rgpd_traitements order by ordre`;
}

export type DpiaCritere = { id: number; critere: string; rempli: boolean; justification: string };
export async function getDpiaCriteres(): Promise<DpiaCritere[]> {
  return sql<DpiaCritere[]>`
    select id, critere, rempli, justification from gouvernance.rgpd_dpia order by ordre`;
}

export type AiSysteme = {
  id: number; nom: string; description: string; est_systeme_ia: string;
  classification: string; justification: string; obligations: string;
  declencheurs: string; statut: string;
};
export async function getAiSystemes(): Promise<AiSysteme[]> {
  return sql<AiSysteme[]>`
    select id, nom, description, est_systeme_ia, classification, justification,
           obligations, declencheurs, statut
    from gouvernance.ai_systemes order by ordre`;
}

export type AiTrace = {
  id: number; date_evenement: string; systeme: string;
  type_evenement: string; description: string; responsable: string;
};
export async function getAiTracabilite(): Promise<AiTrace[]> {
  return sql<AiTrace[]>`
    select id, to_char(date_evenement, 'YYYY-MM-DD') as date_evenement,
           systeme, type_evenement, description, responsable
    from gouvernance.ai_tracabilite order by ordre desc`;
}
