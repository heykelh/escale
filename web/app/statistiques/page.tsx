import Link from "next/link";
import Nav from "@/components/Nav";
import {
  getKpis, getDelayByHour, getTopDelayedRoutes, getValidationByBand, getByAirport,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const WINDOWS = [
  { h: 6, label: "6 h" },
  { h: 24, label: "24 h" },
  { h: 168, label: "7 j" },
  { h: null, label: "Tout" },
];
const bandLabel: Record<string, string> = { eleve: "Élevé", modere: "Modéré", faible: "Faible" };
const bandOrder: Record<string, number> = { faible: 0, modere: 1, eleve: 2 };

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const sp = await searchParams;
  const hours = sp.h === undefined ? 24 : sp.h === "all" ? null : parseInt(sp.h, 10);

  const [kpis, recent6h, byHour, routes, bands, airports] = await Promise.all([
    getKpis(hours), getKpis(6), getDelayByHour(hours),
    getTopDelayedRoutes(hours), getValidationByBand(hours), getByAirport(hours),
  ]);

  const maxHourDelay = Math.max(1, ...byHour.map((r) => r.avg_delay ?? 0));
  const maxRouteDelay = Math.max(1, ...routes.map((r) => r.avg_delay ?? 0));
  const bandsSorted = [...bands].sort((a, b) => (bandOrder[a.risk_band] ?? 9) - (bandOrder[b.risk_band] ?? 9));

  return (
    <main className="wrap">
      <Nav active="stats" />

      <div className="stats-head">
        <h1>Statistiques de ponctualité</h1>
        <div className="filter-group">
          <span className="filter-label">Période</span>
          {WINDOWS.map((w) => {
            const key = w.h === null ? "all" : String(w.h);
            const active = (sp.h ?? "24") === key;
            return (
              <Link key={key} href={`/statistiques?h=${key}`} className={active ? "chip chip-active" : "chip"}>
                {w.label}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="recent-callout">
        <strong>6 dernières heures :</strong>{" "}
        {recent6h.total > 0 ? (
          <>
            {recent6h.total} vols, dont <strong>{recent6h.delayed_count}</strong> retardés
            (&gt; 15 min) · retard moyen {recent6h.mean_delay ?? "n/d"} min · {recent6h.cancelled_count} annulés.
          </>
        ) : (
          <>aucun vol sur cette fenêtre (données rafraîchies plusieurs fois par jour).</>
        )}
      </p>

      <section className="banner stat-kpis">
        <div className="card"><div className="card-label">Ponctualité (≤ 15 min)</div><div className="card-value">{kpis.on_time_pct ?? "n/d"}%</div></div>
        <div className="card"><div className="card-label">Retard moyen</div><div className="card-value">{kpis.mean_delay ?? "n/d"} min</div></div>
        <div className="card"><div className="card-label">Vols retardés</div><div className="card-value">{kpis.delayed_count}<span className="card-sub"> · {kpis.delayed_pct ?? "n/d"}%</span></div></div>
        <div className="card"><div className="card-label">Annulés</div><div className="card-value">{kpis.cancelled_count}</div></div>
        <div className="card"><div className="card-label">Vols analysés</div><div className="card-value">{kpis.total}</div></div>
      </section>

      <section className="chart">
        <h2>Retard moyen par heure de la journée</h2>
        <p className="chart-hint">Heure prévue (UTC), révèle les créneaux de pointe.</p>
        {byHour.length === 0 ? <p className="muted">Pas de données sur cette période.</p> : (
          <div className="vbars">
            {byHour.map((r) => (
              <div key={r.hour} className="vbar-col">
                <div className="vbar-track">
                  <div className="vbar-fill" style={{ height: `${((r.avg_delay ?? 0) / maxHourDelay) * 100}%` }} title={`${r.avg_delay ?? 0} min`} />
                </div>
                <div className="vbar-x">{String(r.hour).padStart(2, "0")}h</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="chart-two">
        <section className="chart">
          <h2>Liaisons les plus en retard</h2>
          <p className="chart-hint">Retard moyen, min. 3 vols sur la période.</p>
          {routes.length === 0 ? <p className="muted">Pas assez de données.</p> : (
            <div className="hbars">
              {routes.map((r, i) => (
                <div key={i} className="hbar-row">
                  <span className="hbar-label">{r.origin_city} → {r.dest_city}</span>
                  <span className="hbar-track"><span className="hbar-fill" style={{ width: `${((r.avg_delay ?? 0) / maxRouteDelay) * 100}%` }} /></span>
                  <span className="hbar-value">{r.avg_delay} min <span className="hbar-n">({r.n})</span></span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="chart">
          <h2>Fiabilité du score de risque</h2>
          <p className="chart-hint">Le retard réel augmente-t-il avec le niveau prédit ?</p>
          {bandsSorted.length === 0 ? <p className="muted">Pas de données.</p> : (
            <table className="flights compact">
              <thead><tr><th>Niveau prédit</th><th>Vols</th><th>Retard réel moyen</th><th>% retardés</th></tr></thead>
              <tbody>
                {bandsSorted.map((b) => (
                  <tr key={b.risk_band}>
                    <td><span className={`band band-${b.risk_band === "eleve" ? "high" : b.risk_band === "modere" ? "mid" : "low"}`}>{bandLabel[b.risk_band] ?? b.risk_band}</span></td>
                    <td>{b.n}</td><td>{b.avg_delay ?? "n/d"} min</td><td>{b.delayed_pct ?? "n/d"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="chart">
        <h2>Comparaison CDG / Orly</h2>
        <div className="airport-grid">
          {airports.map((a) => (
            <div key={a.airport} className="airport-card">
              <div className="airport-name">{a.airport === "LFPG" ? "Paris-CDG" : a.airport === "LFPO" ? "Paris-Orly" : a.airport}</div>
              <div className="airport-row"><span>Ponctualité</span><strong>{a.on_time_pct ?? "n/d"}%</strong></div>
              <div className="airport-row"><span>Retard moyen</span><strong>{a.avg_delay ?? "n/d"} min</strong></div>
              <div className="airport-row"><span>Vols analysés</span><strong>{a.known}</strong></div>
            </div>
          ))}
        </div>
      </section>

      <footer className="foot">Ponctualité = part des vols arrivés/partis dans les 15 min. Données AeroDataBox.</footer>
    </main>
  );
}
