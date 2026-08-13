import Link from "next/link";

type Current = { airport?: string; direction?: string; band?: string };

const AIRPORTS = [{ v: "", l: "Tous" }, { v: "LFPG", l: "CDG" }, { v: "LFPO", l: "Orly" }];
const DIRS = [{ v: "", l: "Tous" }, { v: "departure", l: "Départs" }, { v: "arrival", l: "Arrivées" }];
const BANDS = [{ v: "", l: "Tous" }, { v: "eleve", l: "Élevé" }, { v: "modere", l: "Modéré" }, { v: "faible", l: "Faible" }];

function buildHref(base: Current, key: string, val: string) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
  if (val) p.set(key, val);
  else p.delete(key);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export default function Filters({ current }: { current: Current }) {
  const group = (label: string, key: "airport" | "direction" | "band", opts: { v: string; l: string }[]) => (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      {opts.map((o) => {
        const active = (current[key] ?? "") === o.v;
        return (
          <Link key={o.v || "all"} href={buildHref(current, key, o.v)} className={active ? "chip chip-active" : "chip"}>
            {o.l}
          </Link>
        );
      })}
    </div>
  );
  return (
    <div className="filters">
      {group("Aéroport", "airport", AIRPORTS)}
      {group("Sens", "direction", DIRS)}
      {group("Risque", "band", BANDS)}
    </div>
  );
}
