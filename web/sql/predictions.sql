-- Table des predictions figees : une ligne = un vol predit quand il etait encore futur.
-- Jamais ecrasee. Le retard reel vient s'y rattacher une fois le vol arrive.
create table if not exists gold.predictions (
  flight_key           text primary key,
  flight_number        text,
  airline              text,
  airport              text,
  direction            text,
  route                text,
  origin_city          text,
  dest_city            text,
  scheduled_utc        timestamptz not null,   -- heure prevue du vol
  -- Prediction (figee au moment ou le vol etait futur)
  predicted_at         timestamptz not null,   -- quand on a fait la prediction
  congestion           integer,
  route_hist_delay_min numeric,
  risk_score           integer not null,
  risk_band            text not null,          -- faible | modere | eleve
  -- Constat (rempli plus tard, quand le vol est arrive)
  actual_delay_min     integer,                -- null tant que non observe
  reconciled_at        timestamptz,            -- quand on a constate le reel
  was_delayed          boolean                 -- retard reel > 15 min ?
);

create index if not exists idx_pred_scheduled on gold.predictions(scheduled_utc);
create index if not exists idx_pred_band on gold.predictions(risk_band);
create index if not exists idx_pred_reconciled on gold.predictions(reconciled_at);
