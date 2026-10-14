import Link from "next/link";
import TimeBar from "./TimeBar";

const LINKS = [
  { href: "/", key: "vols", label: "Suivi des vols" },
  { href: "/statistiques", key: "stats", label: "Statistiques" },
  { href: "/fiabilite", key: "fiabilite", label: "Fiabilité" },
  { href: "/rgpd", key: "rgpd", label: "Registre RGPD" },
  { href: "/ai-act", key: "aiact", label: "Registre IA" },
  { href: "/a-propos", key: "apropos", label: "À propos" },
];

export default function Nav({ active }: { active: string }) {
  return (
    <>
      <header className="head">
        <Link href="/" className="brand">
          <span className="brand-mark" />
          <span className="brand-text">
            <span className="brand-name">ESCALE</span>
            <span className="brand-tagline">Suivi des vols &amp; retards, CDG / Orly</span>
          </span>
        </Link>
        <nav className="nav">
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href}
              className={active === l.key ? "nav-link nav-active" : "nav-link"}>
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <TimeBar />
    </>
  );
}
