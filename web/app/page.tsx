import { getFlights, getLatestMonitoring } from "@/lib/queries";
import Nav from "@/components/Nav";
import MonitoringBanner from "@/components/MonitoringBanner";
import Filters from "@/components/Filters";
import SearchBar from "@/components/SearchBar";
import FlightsTable from "@/components/FlightsTable";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ airport?: string; direction?: string; band?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const [monitoring, flights] = await Promise.all([
    getLatestMonitoring(),
    getFlights(sp.airport, sp.direction, sp.band, sp.q),
  ]);

  return (
    <main className="wrap">
      <Nav active="vols" />
      <MonitoringBanner m={monitoring} />

      <section className="source-note">
        <h3>D'où viennent ces données ?</h3>
        <p>
          Les vols proviennent de l'API <strong>AeroDataBox</strong>, qui publie pour chaque aéroport
          les arrivées et départs avec l'heure <strong>prévue</strong> et l'heure <strong>réelle</strong>.
          Un programme automatisé interroge cette source deux fois par jour, nettoie les données et les
          enregistre. Le retard affiché est l'écart entre l'heure réelle et l'heure prévue ; le niveau
          de risque est calculé à partir de la congestion, du créneau horaire et de l'historique de la liaison.
        </p>
      </section>

      <Filters current={sp} />
      <SearchBar current={sp} />
      <FlightsTable flights={flights} />
      <footer className="foot">
        Vols classés par heure de départ/arrivée prévue · {flights.length} vols affichés (max 200) · source AeroDataBox
      </footer>
    </main>
  );
}
