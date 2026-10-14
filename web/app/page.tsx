import { getUpcoming, getLatestMonitoring } from "@/lib/queries";
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
    getUpcoming(sp.airport, sp.direction, sp.band, sp.q),
  ]);

  return (
    <main className="wrap">
      <Nav active="vols" />
      <MonitoringBanner m={monitoring} />

      <section className="source-note">
        <h3>Vols à venir et risque de retard prédit</h3>
        <p>
          Ce tableau liste les vols <strong>à venir</strong> de Roissy-CDG et d'Orly dans les
          prochaines heures, chacun avec un <strong>risque de retard prédit</strong> (faible, modéré,
          élevé). La prédiction est calculée à l'avance, à partir de la congestion de l'aéroport, du
          créneau horaire et de l'historique de la liaison. Une fois le vol réalisé, ESCALE compare la
          prédiction au retard réellement observé : cette vérification est consultable sur la page
          Statistiques. Données AeroDataBox, rafraîchies deux fois par jour.
        </p>
      </section>

      <Filters current={sp} />
      <SearchBar current={sp} />
      <FlightsTable flights={flights} upcoming />
      <footer className="foot">
        Vols à venir classés par heure prévue · {flights.length} vols affichés (max 200) · source AeroDataBox
      </footer>
    </main>
  );
}
