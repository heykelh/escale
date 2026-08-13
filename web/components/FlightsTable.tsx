import { Flight } from "@/lib/queries";

function fmtTime(v: string | null) {
  if (!v) return "n/d";
  return new Date(v).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
}
function fmtDelay(d: number | null) {
  if (d == null) return "n/d";
  if (d === 0) return "à l'heure";
  return d > 0 ? `+${d} min` : `${d} min`;
}
const bandClass: Record<string, string> = { eleve: "band band-high", modere: "band band-mid", faible: "band band-low" };
const bandLabel: Record<string, string> = { eleve: "Élevé", modere: "Modéré", faible: "Faible" };

export default function FlightsTable({ flights }: { flights: Flight[] }) {
  if (!flights.length) return <p className="muted">Aucun vol pour ces filtres.</p>;
  return (
    <div className="table-wrap">
      <table className="flights">
        <thead>
          <tr>
            <th>Vol</th><th>Compagnie</th><th>Sens</th>
            <th>Départ</th><th>Arrivée</th>
            <th>Prévu</th><th>Retard</th><th>Statut</th><th>Risque</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <tr key={f.flight_key}>
              <td className="mono">{f.flight_number ?? "n/d"}</td>
              <td>{f.airline ?? "n/d"}</td>
              <td>{f.direction === "departure" ? "Départ" : "Arrivée"}</td>
              <td>{f.origin_city ?? "n/d"}</td>
              <td>{f.dest_city ?? "n/d"}</td>
              <td>{fmtTime(f.scheduled_utc)}</td>
              <td className={f.delay_min && f.delay_min > 15 ? "delay-bad" : ""}>{fmtDelay(f.delay_min)}</td>
              <td>{f.cancelled ? <span className="band band-high">Annulé</span> : f.status ?? "n/d"}</td>
              <td><span className={bandClass[f.risk_band] ?? "band"}>{bandLabel[f.risk_band] ?? f.risk_band} · {f.risk_score}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
