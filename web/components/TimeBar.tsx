"use client";
import { useEffect, useState } from "react";

function parts(d: Date) {
  const paris = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
  const utc = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC", hour: "2-digit", minute: "2-digit",
  }).format(d);
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", weekday: "long", day: "2-digit", month: "long",
  }).format(d);
  return { paris, utc, date };
}

export default function TimeBar() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const p = now ? parts(now) : null;
  return (
    <div className="timebar">
      <div className="timebar-left">
        <span className="tb-dot" />
        <span className="tb-label">Heure de référence</span>
        <span className="tb-date">{p ? p.date : "n/d"}</span>
      </div>
      <div className="timebar-right">
        <span className="tb-clock">{p ? p.paris : "--:--:--"}</span>
        <span className="tb-tz">Paris</span>
        <span className="tb-sep">·</span>
        <span className="tb-utc">{p ? `${p.utc} UTC` : "--:-- UTC"}</span>
      </div>
    </div>
  );
}
