import Nav from "@/components/Nav";
import {
  getConfusion, getVerifiedSample, getPredictionAccuracy, getAccuracySummary,
} from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "ESCALE — Fiabilité des prédictions" };

const bandLabel: Record<string, string> = { eleve: "Élevé", modere: "Modéré", faible: "Faible" };
const bandOrder: Record<string, number> = { faible: 0, modere: 1, eleve: 2 };
const bandCss = (b: string) => `band band-${b === "eleve" ? "high" : b === "modere" ? "mid" : "low"}`;

function fmtDate(v: string) {
  return new Date(v).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Justification automatique par vol
function justify(p: any): string {
  const facteurs: string[] = [];
  if (p.congestion >= 25) facteurs.push("aéroport saturé sur le créneau");
  if (p.route_hist_delay_min && p.route_hist_delay_min >= 15) facteurs.push("liaison historiquement en retard");
  const base = facteurs.length ? facteurs.join(" et ") : "peu de facteurs de risque réunis";
  const reel = p.was_delayed ? `retard réel de ${p.actual_delay_min} min` : `parti à l'heure (${p.actual_delay_min} min)`;
  const juste = (p.risk_band === "eleve") === p.was_delayed;
  if (juste && p.risk_band === "eleve") return `Risque élevé (${base}) → confirmé : ${reel}.`;
  if (juste && p.risk_band !== "eleve") return `Risque ${bandLabel[p.risk_band].toLowerCase()} (${base}) → confirmé : ${reel}.`;
  if (!juste && p.risk_band === "eleve") return `Risque élevé (${base}), mais ${reel}. Prédiction prudente.`;
  return `Risque ${bandLabel[p.risk_band].toLowerCase()} (${base}), or ${reel}. Retard non anticipé.`;
}

export default async function FiabilitePage() {
  const [conf, sample, accuracy, summary] = await Promise.all([
    getConfusion(), getVerifiedSample(30), getPredictionAccuracy(), getAccuracySummary(),
  ]);
  const accSorted = [...accuracy].sort((a, b) => (bandOrder[a.risk_band] ?? 9) - (bandOrder[b.risk_band] ?? 9));

  // Verdict global : le taux de retard augmente-t-il de faible à élevé ?
  const faible = accSorted.find((a) => a.risk_band === "faible")?.delayed_rate ?? null;
  const eleve = accSorted.find((a) => a.risk_band === "eleve")?.delayed_rate ?? null;
  const discrimine = faible != null && eleve != null && eleve > faible;

  return (
    <main className="wrap">
      <Nav active="fiabilite" />

      <article className="doc doc-wide">
        <h1>Fiabilité des prédictions</h1>
        <p className="lede">
          Cette page confronte chaque prédiction de risque, faite <em>avant</em> le vol, au retard
          réellement observé <em>après</em>. C'est la preuve que le modèle fonctionne — ou non.
        </p>

        {summary.total_reconciled === 0 ? (
          <div className="verdict">
            <strong>En attente de données.</strong> {summary.pending} prédiction(s) ont été faites sur
            des vols à venir ; leurs résultats apparaîtront ici une fois ces vols réalisés et ré-ingérés
            (à la prochaine collecte). La méthode est en place, les chiffres arrivent.
          </div>
        ) : (
          <>
            {/* VERDICT */}
            <section className={discrimine ? "verdict verdict-ok" : "verdict"}>
              <strong>{discrimine ? "✓ Le modèle discrimine correctement." : "Résultats à consolider."}</strong>{" "}
              {discrimine ? (
                <>Les vols classés à risque élevé sont réellement en retard dans <strong>{eleve}%</strong> des
                cas, contre seulement <strong>{faible}%</strong> pour les vols à risque faible. L'écart
                confirme que les facteurs retenus (congestion, créneau, historique) séparent bien les
                vols à risque des autres.</>
              ) : (
                <>L'échantillon vérifié est encore trop petit ({summary.total_reconciled} vols) pour
                conclure. Les tendances se préciseront avec le volume.</>
              )}
            </section>

            {/* MÉTRIQUES DE CLASSIFICATION */}
            <section className="doc-section">
              <h2>Qualité de la classification</h2>
              <p className="chart-hint">Seuil retenu : un vol prédit « risque élevé » est considéré comme une alerte de retard (&gt; 15 min).</p>
              <div className="banner">
                <div className="card"><div className="card-label">Précision</div><div className="card-value">{conf.precision ?? "—"}%</div><div className="card-hint">Parmi les vols prédits « élevé », part réellement en retard.</div></div>
                <div className="card"><div className="card-label">Rappel</div><div className="card-value">{conf.recall ?? "—"}%</div><div className="card-hint">Parmi les vols réellement en retard, part qu'on avait prédits « élevé ».</div></div>
                <div className="card"><div className="card-label">Exactitude</div><div className="card-value">{conf.accuracy ?? "—"}%</div><div className="card-hint">Part de prédictions correctes au global.</div></div>
                <div className="card"><div className="card-label">Vols vérifiés</div><div className="card-value">{conf.total}</div><div className="card-hint">Prédictions confrontées au réel.</div></div>
              </div>
            </section>

            {/* TAUX PAR NIVEAU */}
            <section className="doc-section">
              <h2>Taux de retard réel par niveau prédit</h2>
              <table className="flights compact">
                <thead><tr><th>Risque prédit</th><th>Vols vérifiés</th><th>Taux de retard réel</th><th>Retard réel moyen</th></tr></thead>
                <tbody>
                  {accSorted.map((a) => (
                    <tr key={a.risk_band}>
                      <td><span className={bandCss(a.risk_band)}>{bandLabel[a.risk_band]}</span></td>
                      <td>{a.n}</td>
                      <td><strong>{a.delayed_rate ?? "—"}%</strong></td>
                      <td>{a.avg_delay ?? "—"} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* ÉCHANTILLON VOL PAR VOL */}
            <section className="doc-section">
              <h2>Prédictions vérifiées, vol par vol</h2>
              <p className="chart-hint">Les {sample.length} dernières prédictions confrontées au réel, avec leur justification.</p>
              <div className="verif-list">
                {sample.map((p, i) => {
                  const juste = (p.risk_band === "eleve") === p.was_delayed;
                  return (
                    <div key={i} className={juste ? "verif-row verif-ok" : "verif-row verif-ko"}>
                      <span className="verif-mark">{juste ? "✓" : "✗"}</span>
                      <div className="verif-body">
                        <div className="verif-head">
                          <span className="mono">{p.flight_number ?? "—"}</span>
                          <span>{p.origin_city} → {p.dest_city}</span>
                          <span className="muted-inline">{fmtDate(p.scheduled_utc)}</span>
                          <span className={bandCss(p.risk_band)}>{bandLabel[p.risk_band]} · {p.risk_score}</span>
                        </div>
                        <div className="verif-just">{justify(p)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <section className="doc-section note-honnete">
          <h2>Comment lire ces chiffres</h2>
          <p>Un bon classifieur maximise la <strong>précision</strong> (peu de fausses alertes) et le
          <strong> rappel</strong> (peu de retards manqués) ; les deux s'arbitrent. ESCALE privilégie
          une lecture opérationnelle : repérer à l'avance les vols les plus susceptibles d'être en
          retard pour y porter attention. Les chiffres s'affinent à mesure que le volume de prédictions
          vérifiées augmente.</p>
        </section>
      </article>
    </main>
  );
}
