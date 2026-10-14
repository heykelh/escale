import Link from "next/link";
import Nav from "@/components/Nav";

export const metadata = {
  title: "ESCALE — À propos",
  description: "Ce que fait ESCALE, comment il fonctionne, et sur quoi il repose.",
};

export default function AProposPage() {
  return (
    <main className="wrap">
      <Nav active="apropos" />

      <article className="doc">
        <h1>À propos d'ESCALE</h1>
        <p className="lede">
          ESCALE prédit en continu le risque de retard des vols à venir au départ et à l'arrivée de
          Paris-Charles de Gaulle et de Paris-Orly, vérifie ses prédictions contre la réalité, et tient
          à jour la documentation réglementaire qui accompagne tout traitement automatisé de données.
        </p>

        <section className="doc-section">
          <h2>Ce que fait le site, simplement</h2>

          <div className="feature"><span className="feature-num">1</span><div>
            <h3>Prédire le risque de retard des vols à venir</h3>
            <p>Le site récupère plusieurs fois par jour les vols <strong>à venir</strong> de Roissy
            et d'Orly, et calcule pour chacun, <strong>à l'avance</strong>, une note de risque de
            retard en trois niveaux (faible, modéré, élevé) à partir de trois critères lisibles :
            saturation de l'aéroport sur le créneau, heure de pointe, et tendance de la liaison à
            être en retard. Une fois le vol réalisé, ESCALE compare sa prédiction au retard
            réellement observé — c'est ainsi qu'on mesure si le modèle fonctionne.</p>
          </div></div>

          <div className="feature"><span className="feature-num">2</span><div>
            <h3>Se surveiller lui-même</h3>
            <p>À chaque mise à jour, ESCALE mesure la <strong>complétude</strong> des données reçues
            (part des vols avec toutes leurs informations), repère les <strong>valeurs aberrantes</strong>
            (retards impossibles), et calcule le retard moyen et la part de vols à risque. Les anomalies
            sont consignées dans un <strong>journal qualité</strong> classé par gravité. Si des valeurs
            aberrantes apparaissent, une <strong>alerte</strong> est envoyée automatiquement. C'est ce
            qu'on attend d'un outil qu'on laisse tourner seul : qu'il signale lui-même quand quelque
            chose cloche, plutôt que d'afficher un chiffre faux sans prévenir.</p>
          </div></div>

          <div className="feature"><span className="feature-num">3</span><div>
            <h3>Tenir le registre des données personnelles</h3>
            <p>La loi impose de documenter quelles données sont utilisées, pourquoi, sur quelle base
            légale et combien de temps. ESCALE tient ce registre et précise si le calcul touche à des
            données permettant d'identifier une personne.</p>
          </div></div>

          <div className="feature"><span className="feature-num">4</span><div>
            <h3>Tenir le registre des usages d'intelligence artificielle</h3>
            <p>La réglementation européenne demande de classer les systèmes automatisés par niveau de
            risque et de tracer les usages d'IA. ESCALE le fait pour son propre calcul de retard.</p>
          </div></div>
        </section>

        <section className="doc-section">
          <h2>D'où viennent les données</h2>
          <p>Les informations de vol proviennent de l'API <strong>AeroDataBox</strong> (fournisseur
          public de données aériennes, accessible via RapidAPI). Pour chaque aéroport, elle renvoie le
          panneau des arrivées et des départs sur une fenêtre donnée : numéro de vol, compagnie,
          aéroport pair, <strong>heure prévue</strong> et <strong>heure révisée</strong>. C'est l'écart
          entre ces deux heures qui donne le retard réel — la donnée centrale de tout le site.</p>
        </section>

        <section className="doc-section">
          <h2>Quelles données entrent, et comment elles sont transformées</h2>
          <p>Le traitement suit une <strong>architecture en médaillon</strong> (bronze → argent → or),
          un standard des plateformes data où la donnée est raffinée par étapes :</p>
          <div className="pipeline">
            <div className="pipe-step"><span className="pipe-tag">Bronze</span><p>Réponses brutes de l'API, stockées telles quelles en JSON. Rien n'est jeté : on garde la source d'origine.</p></div>
            <div className="pipe-arrow">→</div>
            <div className="pipe-step"><span className="pipe-tag">Argent</span><p>Données nettoyées et typées : un vol = une ligne, avec villes, horaires en UTC, retard calculé, statut.</p></div>
            <div className="pipe-arrow">→</div>
            <div className="pipe-step"><span className="pipe-tag">Or</span><p>Données prêtes à l'usage : score de risque par vol, prédictions figées, métriques de supervision, journal qualité.</p></div>
          </div>
          <p>Le <strong>score de risque</strong> est calculé à cette dernière étape, de façon
          entièrement déterministe et relisible, par une formule pondérée :</p>
          <p className="formula">
            risque = 0,40 × congestion + 0,25 × créneau horaire + 0,35 × propension de la liaison
          </p>
          <p>Chaque facteur est ramené entre 0 et 1 : la <strong>congestion</strong> (nombre de vols
          sur le même créneau et le même aéroport), le <strong>créneau horaire</strong> (plus élevé
          aux heures de pointe), et la <strong>propension</strong> de la liaison (son retard moyen
          constaté par le passé). Le résultat, sur 0 à 100, donne trois niveaux : faible (≤ 33),
          modéré (34 à 66), élevé (&gt; 66). Aucun modèle opaque : le calcul se relit ligne à ligne.</p>
          <p>Le score est <strong>prédictif</strong> : il est calculé avant le vol, à partir de
          facteurs connus à l'avance, sans jamais utiliser le retard réel (inconnu à ce stade).
          Chaque prédiction est <strong>figée et horodatée</strong>, puis confrontée au retard
          observé une fois le vol réalisé. La page Statistiques montre le résultat de cette
          confrontation : plus le risque prédit est élevé, plus le taux de retard réel augmente.</p>
        </section>

        <section className="doc-section">
          <h2>Comment le site fonctionne</h2>
          <p>Un programme planifié (via GitHub Actions) interroge l'API deux fois par jour, sur deux
          fenêtres : les vols à venir (pour prédire) et les vols déjà réalisés (pour vérifier). Il
          transforme les données et les écrit dans une base PostgreSQL hébergée sur <strong>Neon</strong>.
          Le site web lit ensuite directement cette base, <strong>côté serveur</strong> : aucune donnée ni
          identifiant ne transite par le navigateur du visiteur. Ce choix est volontaire — c'est une
          application concrète du principe de <em>privacy by design</em>.</p>
        </section>

        <section className="doc-section">
          <h2>Pile technique</h2>
          <div className="stack">
            <div className="stack-block"><h4>Collecte & traitement</h4><p>Python · API AeroDataBox · GitHub Actions (planification)</p></div>
            <div className="stack-block"><h4>Stockage</h4><p>PostgreSQL (Neon) · schémas bronze / argent / or</p></div>
            <div className="stack-block"><h4>Site web</h4><p>Next.js 15 (React, rendu serveur) · TypeScript · déployé sur Vercel</p></div>
            <div className="stack-block"><h4>Qualité & alertes</h4><p>Contrôles automatiques · journal d'anomalies · notifications ntfy.sh</p></div>
          </div>
        </section>

        <section className="doc-section">
          <h2>De quoi cela s'inspire</h2>
          <p>ESCALE reprend des pratiques éprouvées de plusieurs mondes : les <strong>tableaux
          d'affichage aéroportuaires</strong> (FIDS) pour la vue temps réel des vols ; le suivi de la
          <strong> ponctualité opérationnelle</strong> (On-Time Performance) tel qu'il se pratique dans
          le transport ; l'<strong>architecture lakehouse</strong> (médaillon) pour le raffinage des
          données ; et les cadres de <strong>gouvernance</strong> — registre des traitements (RGPD),
          classification des usages d'IA (règlement européen sur l'IA) — pour la partie conformité.</p>
        </section>

        <section className="doc-section note-honnete">
          <h2>Ce que le site est, et n'est pas</h2>
          <p>ESCALE est une démonstration de méthode construite sur des données publiques. Il illustre
          comment prédire un indicateur opérationnel, en vérifier la fiabilité, en garantir la qualité
          et l'encadrer sur le plan réglementaire. Ce n'est pas la reproduction d'un système interne de
          compagnie aérienne, et les estimations n'engagent aucun opérateur réel.</p>
        </section>

        <p className="back"><Link href="/" className="nav-link">← Retour au suivi des vols</Link></p>
      </article>
    </main>
  );
}
