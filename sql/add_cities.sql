alter table silver.flights add column if not exists origin_city text;
alter table silver.flights add column if not exists dest_city text;

-- Backfill depuis les payloads bruts : cote Paris via le code aeroport,
-- cote pair via le nom d'aeroport present dans le JSON stocke.
update silver.flights s set
  origin_city = case
    when s.direction = 'departure'
      then case s.airport when 'LFPG' then 'Paris CDG' when 'LFPO' then 'Paris Orly' else s.airport end
    else coalesce(b.payload -> 'departure' -> 'airport' ->> 'name', s.peer_airport)
  end,
  dest_city = case
    when s.direction = 'departure'
      then coalesce(b.payload -> 'arrival' -> 'airport' ->> 'name', s.peer_airport)
    else case s.airport when 'LFPG' then 'Paris CDG' when 'LFPO' then 'Paris Orly' else s.airport end
  end
from bronze.raw_flights b
where b.flight_key = s.flight_key;
