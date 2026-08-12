create schema if not exists bronze;
create schema if not exists silver;
create schema if not exists gold;

drop table if exists gold.dq_backlog cascade;
drop table if exists gold.monitoring_metrics cascade;
drop table if exists gold.flight_risk cascade;
drop table if exists silver.flights cascade;
drop table if exists bronze.raw_flights cascade;

-- BRONZE : payloads bruts AeroDataBox
create table bronze.raw_flights (
  flight_key   text primary key,
  airport      text not null,
  direction    text not null,            -- 'arrival' | 'departure'
  payload      jsonb not null,
  ingested_at  timestamptz not null default now()
);

-- SILVER : faits typés et nettoyés
create table silver.flights (
  flight_key     text primary key,
  flight_number  text,
  callsign       text,
  airline        text,
  airport        text not null,          -- aeroport interroge (LFPG/LFPO)
  direction      text not null,
  peer_airport   text,                   -- origine (arrivee) ou destination (depart)
  route          text,
  scheduled_utc  timestamptz,
  revised_utc    timestamptz,
  delay_min      integer,                -- retard reel : revise - prevu
  status         text,
  cancelled      boolean default false,
  hour_bucket    integer,                -- heure UTC du scheduled
  updated_at     timestamptz not null default now()
);

-- GOLD : score de risque retard (deterministe, prospectif)
create table gold.flight_risk (
  flight_key           text primary key references silver.flights(flight_key) on delete cascade,
  route                text,
  hour_bucket          integer,
  congestion           integer,
  route_hist_delay_min numeric,          -- propension : retard moyen historique de la route
  actual_delay_min     integer,          -- retard reel, pour backtest
  risk_score           integer not null,
  risk_band            text not null,     -- 'faible' | 'modere' | 'eleve'
  scored_at            timestamptz not null default now()
);

-- GOLD : monitoring par run (role BA / MCO)
create table gold.monitoring_metrics (
  run_id           bigint generated always as identity primary key,
  run_at           timestamptz not null default now(),
  window_begin     timestamptz,
  window_end       timestamptz,
  flights_ingested integer,
  completeness_pct numeric,
  out_of_bounds    integer,
  high_risk_pct    numeric,
  cancelled_count  integer,
  mean_delay_min   numeric
);

-- GOLD : backlog qualite de donnees
create table gold.dq_backlog (
  id           bigint generated always as identity primary key,
  detected_at  timestamptz not null default now(),
  severity     text not null,
  rule         text not null,
  description  text not null,
  flight_key   text,
  status       text not null default 'open'
);

create index idx_flights_route on silver.flights(route);
create index idx_flights_delay on silver.flights(delay_min);
create index idx_risk_band on gold.flight_risk(risk_band);
