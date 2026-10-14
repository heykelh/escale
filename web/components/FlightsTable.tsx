import { Flight, Prediction } from "@/lib/queries";

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

type Row = Flight | Prediction;

export default function FlightsTable({ flights, upcoming = false }: { flights: Row[]; upcoming?: boolean }) {
  if (!flights.length) return <p className="muted">Aucun vol pour ces critères.</p>;
  return (
    <div className="table-wrap">
      <table className="flights">
        <thead>
          <tr>
            <th>Date / Heure prévue</th><th>Vol</th><th>Compagnie</th><th>Sens</th>
            <th>Départ</th><th>Arrivée</th>
            {!upcoming && <th>Retard</th>}
            {!upcoming && <th>Statut</th>}
            <th>{upcoming ? "Risque prédit" : "Risque"}</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => {
            const dt = fmtDateTime(f.scheduled_utc);
            const anyF = f as any;
            return (
              <tr key={f.flight_key}>
                <td className="nowrap"><strong>{dt.date}</strong> <span className="muted-inline">{dt.time}</span></td>
                <td className="mono">{f.flight_number ?? "—"}</td>
                <td>{f.airline ?? "—"}</td>
                <td>{f.direction === "departure" ? "Départ" : "Arrivée"}</td>
                <td>{f.origin_city ?? "—"}</td>
                <td>{f.dest_city ?? "—"}</td>
                {!upcoming && <td className={anyF.delay_min && anyF.delay_min > 15 ? "delay-bad" : ""}>{fmtDelay(anyF.delay_min)}</td>}
                {!upcoming && <td>{anyF.cancelled ? <span className="band band-high">Annulé</span> : anyF.status ?? "—"}</td>}
                <td><span className={bandClass[f.risk_band] ?? "band"}>{bandLabel[f.risk_band] ?? f.risk_band} · {f.risk_score}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
