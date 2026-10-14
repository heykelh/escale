import Link from "next/link";
import Nav from "@/components/Nav";
import {
  getKpis, getDelayByHour, getTopDelayedRoutes, getValidationByBand, getByAirport,
  getPredictionAccuracy, getAccuracySummary,
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

  const [kpis, recent6h, byHour, routes, bands, airports, accuracy, accSummary] = await Promise.all([
    getKpis(hours), getKpis(6), getDelayByHour(hours),
    getTopDelayedRoutes(hours), getValidationByBand(hours), getByAirport(hours),
    getPredictionAccuracy(), getAccuracySummary(),
  ]);

  const maxHourDelay = Math.max(1, ...byHour.map((r) => r.avg_delay ?? 0));
  const maxRouteDelay = Math.max(1, ...routes.map((r) => r.avg_delay ?? 0));
  const bandsSorted = [...bands].sort((a, b) => (bandOrder[a.risk_band] ?? 9) - (bandOrder[b.risk_band] ?? 9));
  const accSorted = [...accuracy].sort((a, b) => (bandOrder[a.risk_band] ?? 9) - (bandOrder[b.risk_band] ?? 9));

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

      {/* ====== FIABILITÉ DES PRÉDICTIONS (le coeur) ====== */}
      <section className="chart pred-box">
        <h2>Fiabilité des prédictions</h2>
        <p className="chart-hint">
          Pour chaque vol, ESCALE prédit un risque <em>avant</em> le vol, puis compare au retard réel
          une fois le vol réalisé. Un bon modèle : plus le risque prédit est élevé, plus le taux de
          retard réel augmente.
        </p>
        {accSummary.total_reconciled === 0 ? (
          <p className="muted">
            {accSummary.pending} prédiction(s) en attente de vérification. Les résultats
            apparaîtront ici dès que ces vols seront réalisés (prochaine collecte).
          </p>
        ) : (
          <>
            <table className="flights compact">
              <thead><tr><th>Risque prédit</th><th>Vols vérifiés</th><th>Taux de retard réel (&gt; 15 min)</th><th>Retard réel moyen</th></tr></thead>
              <tbody>
                {accSorted.map((a) => (
                  <tr key={a.risk_band}>
                    <td><span className={`band band-${a.risk_band === "eleve" ? "high" : a.risk_band === "modere" ? "mid" : "low"}`}>{bandLabel[a.risk_band] ?? a.risk_band}</span></td>
                    <td>{a.n}</td>
                    <td><strong>{a.delayed_rate ?? "—"}%</strong></td>
                    <td>{a.avg_delay ?? "—"} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              {accSummary.total_reconciled} prédictions vérifiées · {accSummary.pending} en attente.
            </p>
          </>
        )}
      </section>

      <section className="banner stat-kpis">
        <div className="card"><div className="card-label">Ponctualité (≤ 15 min)</div><div className="card-value">{kpis.on_time_pct ?? "—"}%</div></div>
        <div className="card"><div className="card-label">Retard moyen</div><div className="card-value">{kpis.mean_delay ?? "—"} min</div></div>
        <div className="card"><div className="card-label">Vols retardés</div><div className="card-value">{kpis.delayed_count}<span className="card-sub"> · {kpis.delayed_pct ?? "—"}%</span></div></div>
        <div className="card"><div className="card-label">Annulés</div><div className="card-value">{kpis.cancelled_count}</div></div>
        <div className="card"><div className="card-label">Vols analysés</div><div className="card-value">{kpis.total}</div></div>
      </section>

      <section className="chart">
        <h2>Retard moyen par heure de la journée</h2>
        <p className="chart-hint">Heure prévue (UTC) — révèle les créneaux de pointe.</p>
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
          <h2>Cohérence du score (vols passés)</h2>
          <p className="chart-hint">Le retard réel augmente-t-il avec le niveau de risque ?</p>
          {bandsSorted.length === 0 ? <p className="muted">Pas de données.</p> : (
            <table className="flights compact">
              <thead><tr><th>Niveau</th><th>Vols</th><th>Retard réel moyen</th><th>% retardés</th></tr></thead>
              <tbody>
                {bandsSorted.map((b) => (
                  <tr key={b.risk_band}>
                    <td><span className={`band band-${b.risk_band === "eleve" ? "high" : b.risk_band === "modere" ? "mid" : "low"}`}>{bandLabel[b.risk_band] ?? b.risk_band}</span></td>
                    <td>{b.n}</td><td>{b.avg_delay ?? "—"} min</td><td>{b.delayed_pct ?? "—"}%</td>
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
              <div className="airport-row"><span>Ponctualité</span><strong>{a.on_time_pct ?? "—"}%</strong></div>
              <div className="airport-row"><span>Retard moyen</span><strong>{a.avg_delay ?? "—"} min</strong></div>
              <div className="airport-row"><span>Vols analysés</span><strong>{a.known}</strong></div>
            </div>
          ))}
        </div>
      </section>

      <footer className="foot">Ponctualité = part des vols arrivés/partis dans les 15 min. Données AeroDataBox.</footer>
    </main>
  );
}
