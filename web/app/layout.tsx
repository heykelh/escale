import "./globals.css";

export const metadata = {
  title: "ESCALE",
  description: "Suivi des vols et risque de retard - CDG / Orly",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
