import Nav from "@/components/Nav";
import { getAiSystemes, getAiTracabilite } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "ESCALE, Registre IA (AI Act)" };

const classLabel: Record<string, string> = {
  inacceptable: "Inacceptable", eleve: "Élevé", limite: "Limité", minimal: "Minimal",
};

export default async function AiActPage() {
  const [systemes, traces] = await Promise.all([getAiSystemes(), getAiTracabilite()]);

  return (
    <main className="wrap">
      <Nav active="aiact" />
      <article className="doc doc-wide">
        <h1>Registre des usages d'IA (AI Act)</h1>
        <p className="lede">
          Le règlement européen sur l'intelligence artificielle demande de recenser les systèmes
          automatisés, de les classer par niveau de risque et de tracer leurs usages. Ce registre
          applique cette démarche au calcul de risque de retard.
        </p>

        <section className="doc-section">
          <h2>Classification des systèmes</h2>
          {systemes.map((s) => (
            <div key={s.id} className="reg-card">
              <div className="reg-head">
                <span className="reg-name">{s.nom}</span>
                <span className="reg-badges">
                  <span className={`tag tag-class tag-${s.classification}`}>
                    Risque {classLabel[s.classification] ?? s.classification}
                  </span>
                  <span className={s.statut === "actif" ? "tag tag-active" : "tag tag-proj"}>
                    {s.statut === "actif" ? "Actif" : "Projeté"}
                  </span>
                </span>
              </div>
              <div className="reg-row"><span className="reg-label">Description</span><span className="reg-value">{s.description}</span></div>
              <div className="reg-row"><span className="reg-label">Est-ce un système d'IA ?</span><span className="reg-value">{s.est_systeme_ia}</span></div>
              <div className="reg-row"><span className="reg-label">Justification du niveau</span><span className="reg-value">{s.justification}</span></div>
              <div className="reg-row"><span className="reg-label">Obligations</span><span className="reg-value">{s.obligations}</span></div>
              <div className="reg-row"><span className="reg-label">Déclencheurs de réévaluation</span><span className="reg-value">{s.declencheurs}</span></div>
            </div>
          ))}
        </section>

        <section className="doc-section">
          <h2>Échelle de risque du règlement</h2>
          <div className="risk-scale">
            <div className="risk-item risk-min"><span>Minimal</span><small>Aucune obligation. Cas d'ESCALE.</small></div>
            <div className="risk-item risk-lim"><span>Limité</span><small>Obligation de transparence.</small></div>
            <div className="risk-item risk-hi"><span>Élevé</span><small>Contrôles stricts (annexe III).</small></div>
            <div className="risk-item risk-no"><span>Inacceptable</span><small>Interdit.</small></div>
          </div>
        </section>

        <section className="doc-section">
          <h2>Journal de traçabilité</h2>
          <p className="chart-hint">Trace des événements liés aux usages d'IA (mise en service, revues, classification).</p>
          <table className="flights compact">
            <thead><tr><th>Date</th><th>Système</th><th>Événement</th><th>Description</th><th>Responsable</th></tr></thead>
            <tbody>
              {traces.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.date_evenement}</td>
                  <td>{t.systeme}</td>
                  <td>{t.type_evenement}</td>
                  <td className="reg-just">{t.description}</td>
                  <td>{t.responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="doc-section note-honnete">
          <h2>Portée</h2>
          <p>
            Cette analyse porte sur un système de démonstration. Elle illustre une méthode de
            classification et de traçabilité conforme à l'esprit du règlement ; elle ne constitue pas
            un avis juridique et n'engage aucun opérateur réel.
          </p>
        </section>
      </article>
    </main>
  );
}
