import { Monitoring } from "@/lib/queries";

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      <div className="card-hint">{hint}</div>
    </div>
  );
}

export default function MonitoringBanner({ m }: { m: Monitoring | null }) {
  if (!m) return <p className="muted">Aucune donnée de supervision. Lance l'ingestion.</p>;
  const runAt = new Date(m.run_at).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
  return (
    <section>
      <div className="banner-intro">
        <h2>État de la dernière mise à jour</h2>
        <p>
          Ces indicateurs résument la dernière collecte de données, effectuée deux fois par jour
          sur une fenêtre de 12 heures. Ils permettent de savoir, d'un coup d'œil, combien de vols
          ont été analysés et si l'on peut faire confiance aux chiffres affichés plus bas.
        </p>
      </div>
      <div className="banner">
        <Card
          label="Vols suivis"
          value={String(m.flights_ingested)}
          hint="Vols analysés lors de la dernière collecte, sur une fenêtre de 12 h (arrivées et départs, CDG + Orly). Données rafraîchies deux fois par jour."
        />
        <Card
          label="Complétude"
          value={`${m.completeness_pct}%`}
          hint="Part des vols pour lesquels toutes les informations ont bien été reçues. Proche de 100 % = données fiables."
        />
        <Card
          label="Retard moyen"
          value={m.mean_delay_min != null ? `${m.mean_delay_min} min` : "—"}
          hint="Écart moyen entre l'heure prévue et l'heure réelle, tous vols confondus."
        />
        <Card
          label="Risque élevé"
          value={`${m.high_risk_pct}%`}
          hint="Part des vols que le site estime les plus susceptibles d'être en retard."
        />
        <Card
          label="Annulés"
          value={String(m.cancelled_count)}
          hint="Nombre de vols annulés sur la période collectée."
        />
      </div>
      <p className="muted">Dernière mise à jour : {runAt} (Paris)</p>
    </section>
  );
}
