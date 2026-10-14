import { Flight } from "@/lib/queries";

function fmtDateTime(v: string | null) {
  if (!v) return { date: "—", time: "" };
  const d = new Date(v);
  return {
    date: d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
  };
}
function fmtDelay(d: number | null) {
  if (d == null) return "—";
  if (d === 0) return "à l'heure";
  return d > 0 ? `+${d} min` : `${d} min`;
}
const bandClass: Record<string, string> = { eleve: "band band-high", modere: "band band-mid", faible: "band band-low" };
const bandLabel: Record<string, string> = { eleve: "Élevé", modere: "Modéré", faible: "Faible" };

export default function FlightsTable({ flights }: { flights: Flight[] }) {
  if (!flights.length) return <p className="muted">Aucun vol pour ces critères.</p>;
  return (
    <div className="table-wrap">
      <table className="flights">
        <thead>
          <tr>
            <th>Date / Heure prévue</th><th>Vol</th><th>Compagnie</th><th>Sens</th>
            <th>Départ</th><th>Arrivée</th><th>Retard</th><th>Statut</th><th>Risque</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => {
            const dt = fmtDateTime(f.scheduled_utc);
            return (
              <tr key={f.flight_key}>
                <td className="nowrap"><strong>{dt.date}</strong> <span className="muted-inline">{dt.time}</span></td>
                <td className="mono">{f.flight_number ?? "—"}</td>
                <td>{f.airline ?? "—"}</td>
                <td>{f.direction === "departure" ? "Départ" : "Arrivée"}</td>
                <td>{f.origin_city ?? "—"}</td>
                <td>{f.dest_city ?? "—"}</td>
                <td className={f.delay_min && f.delay_min > 15 ? "delay-bad" : ""}>{fmtDelay(f.delay_min)}</td>
                <td>{f.cancelled ? <span className="band band-high">Annulé</span> : f.status ?? "—"}</td>
                <td><span className={bandClass[f.risk_band] ?? "band"}>{bandLabel[f.risk_band] ?? f.risk_band} · {f.risk_score}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
