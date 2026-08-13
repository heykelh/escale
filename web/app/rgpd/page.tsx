import Nav from "@/components/Nav";
import { getRgpdTraitements, getDpiaCriteres } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "ESCALE — Registre RGPD" };

const field = (label: string, value: string) => (
  <div className="reg-row"><span className="reg-label">{label}</span><span className="reg-value">{value}</span></div>
);

export default async function RgpdPage() {
  const [traitements, criteres] = await Promise.all([getRgpdTraitements(), getDpiaCriteres()]);
  const remplis = criteres.filter((c) => c.rempli).length;

  return (
    <main className="wrap">
      <Nav active="rgpd" />
      <article className="doc doc-wide">
        <h1>Registre des traitements (RGPD)</h1>
        <p className="lede">
          Ce registre recense les traitements de données opérés par ESCALE, leur finalité, leur base
          légale et les mesures qui les encadrent. Il inclut une analyse d'impact (AIPD) déterminant
          si une évaluation approfondie est requise.
        </p>

        <section className="doc-section">
          <h2>Registre des traitements</h2>
          {traitements.map((t) => (
            <div key={t.id} className="reg-card">
              <div className="reg-head">
                <span className="reg-name">{t.nom}</span>
                <span className="reg-badges">
                  <span className={t.donnees_personnelles ? "tag tag-yes" : "tag tag-no"}>
                    {t.donnees_personnelles ? "Données personnelles" : "Pas de données personnelles"}
                  </span>
                  <span className={t.statut === "actif" ? "tag tag-active" : "tag tag-proj"}>
                    {t.statut === "actif" ? "Actif" : "Projeté"}
                  </span>
                </span>
              </div>
              {field("Finalité", t.finalite)}
              {field("Catégories de données", t.categories_donnees)}
              {field("Personnes concernées", t.personnes_concernees)}
              {field("Base légale", t.base_legale)}
              {field("Destinataires", t.destinataires)}
              {field("Durée de conservation", t.duree_conservation)}
              {field("Mesures de sécurité", t.mesures_securite)}
              {field("Transfert hors UE", t.transfert_hors_ue)}
            </div>
          ))}
        </section>

        <section className="doc-section">
          <h2>Analyse d'impact (AIPD)</h2>
          <p className="chart-hint">
            La CNIL rend une AIPD obligatoire dès que 2 des 9 critères ci-dessous sont remplis.
          </p>
          <table className="flights compact">
            <thead><tr><th>Critère</th><th>Rempli</th><th>Justification</th></tr></thead>
            <tbody>
              {criteres.map((c) => (
                <tr key={c.id}>
                  <td>{c.critere}</td>
                  <td>{c.rempli ? <span className="tag tag-yes">Oui</span> : <span className="tag tag-no">Non</span>}</td>
                  <td className="reg-just">{c.justification}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="verdict">
            <strong>Conclusion :</strong> le traitement actif ne remplit que {remplis} critère sur 9
            (usage innovant) et ne porte sur aucune donnée personnelle. Une AIPD n'est donc pas
            requise en l'état. Elle deviendrait obligatoire si le traitement projeté (données
            d'équipage) était activé — réévaluation nécessaire avant toute mise en œuvre.
          </div>
        </section>

        <section className="doc-section note-honnete">
          <h2>Portée</h2>
          <p>
            Ce registre documente un système de démonstration construit sur des données publiques.
            Il illustre une méthode de cartographie et d'encadrement des traitements ; il n'engage
            aucun opérateur réel.
          </p>
        </section>
      </article>
    </main>
  );
}
