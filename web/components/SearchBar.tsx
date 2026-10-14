import { redirect } from "next/navigation";

type Current = { airport?: string; direction?: string; band?: string; q?: string };

export default function SearchBar({ current }: { current: Current }) {
  async function search(formData: FormData) {
    "use server";
    const q = (formData.get("q") as string)?.trim() ?? "";
    const p = new URLSearchParams();
    if (current.airport) p.set("airport", current.airport);
    if (current.direction) p.set("direction", current.direction);
    if (current.band) p.set("band", current.band);
    if (q) p.set("q", q);
    redirect(p.toString() ? `/?${p.toString()}` : "/");
  }
  return (
    <form action={search} className="searchbar">
        <input type="text" name="q" defaultValue={current.q ?? ""}
            placeholder="Rechercher une ville (Amsterdam, Madrid…) ou un numéro de vol (AF1240)"
            className="search-input" autoComplete="off" />
      <button type="submit" className="search-btn">Rechercher</button>
      {current.q ? <a href={buildClearHref(current)} className="search-clear">Effacer</a> : null}
    </form>
  );
}

function buildClearHref(c: Current) {
  const p = new URLSearchParams();
  if (c.airport) p.set("airport", c.airport);
  if (c.direction) p.set("direction", c.direction);
  if (c.band) p.set("band", c.band);
  return p.toString() ? `/?${p.toString()}` : "/";
}
