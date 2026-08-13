import { getFlights, getLatestMonitoring } from "@/lib/queries";
import Nav from "@/components/Nav";
import MonitoringBanner from "@/components/MonitoringBanner";
import Filters from "@/components/Filters";
import FlightsTable from "@/components/FlightsTable";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ airport?: string; direction?: string; band?: string }>;
}) {
  const sp = await searchParams;
  const [monitoring, flights] = await Promise.all([
    getLatestMonitoring(),
    getFlights(sp.airport, sp.direction, sp.band),
  ]);

  return (
    <main className="wrap">
      <Nav active="vols" />
      <MonitoringBanner m={monitoring} />
      <Filters current={sp} />
      <FlightsTable flights={flights} />
      <footer className="foot">
        Données AeroDataBox · score de risque déterministe · {flights.length} vols affichés (max 200)
      </footer>
    </main>
  );
}
