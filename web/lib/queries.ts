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
  band?: string,
  q?: string
): Promise<Flight[]> {
  const term = q ? `%${q.trim()}%` : null;
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
      ${term ? sql`and (f.origin_city ilike ${term} or f.dest_city ilike ${term}
                        or f.flight_number ilike ${term})` : sql``}
    order by f.scheduled_utc asc
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

/* ---------- Prédictions (vols à venir) & justesse ---------- */

export type Prediction = {
  flight_key: string;
  flight_number: string | null;
  airline: string | null;
  airport: string;
  direction: string;
  origin_city: string | null;
  dest_city: string | null;
  scheduled_utc: string;
  risk_score: number;
  risk_band: string;
};

export async function getUpcoming(
  airport?: string,
  direction?: string,
  band?: string,
  q?: string
): Promise<Prediction[]> {
  const term = q ? `%${q.trim()}%` : null;
  return sql<Prediction[]>`
    select flight_key, flight_number, airline, airport, direction,
           origin_city, dest_city, scheduled_utc, risk_score, risk_band
    from gold.predictions
    where scheduled_utc >= now()
      ${airport ? sql`and airport = ${airport}` : sql``}
      ${direction ? sql`and direction = ${direction}` : sql``}
      ${band ? sql`and risk_band = ${band}` : sql``}
      ${term ? sql`and (origin_city ilike ${term} or dest_city ilike ${term}
                        or flight_number ilike ${term})` : sql``}
    order by scheduled_utc asc
    limit 200`;
}

// Justesse : sur les prédictions déjà confrontées au réel, le retard observé
// augmente-t-il avec le niveau prédit ? (le backtest honnête du modèle)
export type Accuracy = {
  risk_band: string;
  n: number;
  delayed_rate: number | null;   // % réellement en retard (> 15 min)
  avg_delay: number | null;      // retard réel moyen
};

export async function getPredictionAccuracy(): Promise<Accuracy[]> {
  return sql<Accuracy[]>`
    select risk_band,
           count(*)::int as n,
           round(100.0 * count(*) filter (where was_delayed) / nullif(count(*),0), 1) as delayed_rate,
           round(avg(actual_delay_min))::int as avg_delay
    from gold.predictions
    where reconciled_at is not null
    group by risk_band`;
}

export type AccuracySummary = {
  total_reconciled: number;
  pending: number;
};

export async function getAccuracySummary(): Promise<AccuracySummary> {
  const rows = await sql<any[]>`
    select
      count(*) filter (where reconciled_at is not null)::int as total_reconciled,
      count(*) filter (where reconciled_at is null and scheduled_utc >= now())::int as pending
    from gold.predictions`;
  return rows[0] ?? { total_reconciled: 0, pending: 0 };
}

/* ---------- Page Fiabilité : analyse détaillée des prédictions ---------- */

// Matrice de confusion sur le seuil "risque élevé" => "sera en retard"
export type ConfusionStats = {
  total: number;
  tp: number; fp: number; tn: number; fn: number;
  precision: number | null;   // parmi les prédits "élevé", % vraiment en retard
  recall: number | null;      // parmi les vraiment en retard, % prédits "élevé"
  accuracy: number | null;    // % de prédictions correctes au global
};

export async function getConfusion(): Promise<ConfusionStats> {
  const rows = await sql<any[]>`
    select
      count(*)::int as total,
      count(*) filter (where risk_band = 'eleve' and was_delayed)::int as tp,
      count(*) filter (where risk_band = 'eleve' and not was_delayed)::int as fp,
      count(*) filter (where risk_band <> 'eleve' and not was_delayed)::int as tn,
      count(*) filter (where risk_band <> 'eleve' and was_delayed)::int as fn
    from gold.predictions
    where reconciled_at is not null`;
  const r = rows[0] ?? { total: 0, tp: 0, fp: 0, tn: 0, fn: 0 };
  const precision = r.tp + r.fp > 0 ? Math.round((r.tp / (r.tp + r.fp)) * 1000) / 10 : null;
  const recall = r.tp + r.fn > 0 ? Math.round((r.tp / (r.tp + r.fn)) * 1000) / 10 : null;
  const accuracy = r.total > 0 ? Math.round(((r.tp + r.tn) / r.total) * 1000) / 10 : null;
  return { ...r, precision, recall, accuracy };
}

// Échantillon de prédictions vérifiées, les plus parlantes (risque élevé d'abord)
export type VerifiedPrediction = {
  flight_number: string | null;
  airline: string | null;
  origin_city: string | null;
  dest_city: string | null;
  scheduled_utc: string;
  risk_score: number;
  risk_band: string;
  congestion: number | null;
  route_hist_delay_min: number | null;
  actual_delay_min: number | null;
  was_delayed: boolean;
};

export async function getVerifiedSample(limit = 30): Promise<VerifiedPrediction[]> {
  return sql<VerifiedPrediction[]>`
    select flight_number, airline, origin_city, dest_city, scheduled_utc,
           risk_score, risk_band, congestion, route_hist_delay_min,
           actual_delay_min, was_delayed
    from gold.predictions
    where reconciled_at is not null
    order by scheduled_utc desc
    limit ${limit}`;
}
