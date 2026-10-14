# ESCALE

Système qui prédit le risque de retard des vols à venir de Roissy-CDG et Orly,
vérifie ses prédictions contre la réalité, et tient à jour la documentation
réglementaire qui accompagne tout traitement automatisé de données.

**Démo en ligne : https://escale-ops.vercel.app**

## Ce que fait ESCALE

1. **Prédire** — plusieurs fois par jour, le système récupère les vols à venir de
   CDG et Orly et calcule pour chacun, à l'avance, un risque de retard (faible,
   modéré, élevé).
2. **Vérifier** — une fois le vol réalisé, il compare sa prédiction au retard
   réellement observé, et mesure sa justesse (précision, rappel, taux de retard
   par niveau).
3. **Superviser** — il contrôle en continu la qualité des données reçues
   (complétude, fraîcheur, valeurs aberrantes), journalise les anomalies et alerte
   en cas de dégradation.
4. **Encadrer** — il maintient un registre RGPD (traitements, analyse d'impact) et
   un registre AI Act (classification, traçabilité des usages).

## Comment le score est calculé

Score déterministe, relisible ligne à ligne, sans modèle opaque :

risque = 0,40 × congestion + 0,25 × créneau horaire + 0,35 × propension de la liaison


Chaque facteur est normalisé entre 0 et 1 : congestion (mouvements concurrents sur
le créneau), créneau horaire (plus élevé aux heures de pointe), propension (retard
moyen historique de la liaison). Résultat sur 0 à 100 → faible (≤ 33), modéré
(34 à 66), élevé (> 66).

Le score est **prédictif** : il n'utilise jamais le retard réel du vol qu'il
évalue. Chaque prédiction est figée et horodatée, puis confrontée au réel une fois
le vol passé.

## Architecture

AeroDataBox (API) → GitHub Actions (cron 2×/jour, double fenêtre) → PostgreSQL (Neon)
fenêtre future → prédictions figées
fenêtre passée → retard réel + réconciliation
bronze (brut) → argent (nettoyé) → or (score, prédictions, monitoring)
→ Next.js (Vercel), lecture côté serveur


Architecture en médaillon (bronze / argent / or) sur un seul entrepôt Postgres. Le
front lit directement la couche or, **côté serveur** : aucune donnée ni secret ne
transite par le navigateur du visiteur (privacy by design).

## Pile technique

| Domaine | Outils |
|---|---|
| Collecte & traitement | Python 3.12, API AeroDataBox (RapidAPI), GitHub Actions |
| Stockage | PostgreSQL (Neon), schémas bronze / argent / or |
| Site web | Next.js 15 (React, rendu serveur), TypeScript, Vercel |
| Qualité & alertes | Contrôles automatiques, journal d'anomalies, ntfy.sh |
| Tests | pytest (scoring déterministe) |

## Les pages

- **Suivi des vols** — vols à venir avec leur risque prédit, filtres et recherche.
- **Statistiques** — ponctualité, retards par heure, liaisons les plus en retard,
  comparaison CDG / Orly.
- **Fiabilité** — confrontation prédictions vs réel : précision, rappel, taux par
  niveau, et justification vol par vol.
- **Registre RGPD** — registre des traitements et analyse d'impact (AIPD).
- **Registre IA** — classification AI Act et journal de traçabilité.
- **À propos** — fonctionnement détaillé et choix techniques.

## Lancer en local (Windows)

Prérequis : Python 3.12, Node.js, pnpm, un projet Neon, une clé RapidAPI
(AeroDataBox).

**Pipeline d'ingestion :**

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# Copier .env.example en .env et remplir RAPIDAPI_KEY + DATABASE_URL (Neon)
# Exécuter dans Neon, dans l'ordre : sql/schema.sql, sql/add_cities.sql,
#                                    sql/gouvernance.sql, sql/predictions.sql
python -m ingestion.ingest
pytest
```

**Site web :**

```powershell
cd web
pnpm install
# Copier .env.local.example en .env.local et remplir DATABASE_URL (Neon)
pnpm dev
```

## Automatisation

Un workflow GitHub Actions (`.github/workflows/ingest.yml`) lance l'ingestion deux
fois par jour. Chaque exécution interroge l'API sur deux fenêtres (vols futurs pour
prédire, vols passés pour vérifier), transforme les données et les écrit dans Neon.
Les secrets `RAPIDAPI_KEY` et `DATABASE_URL` sont configurés côté GitHub.

## Portée

ESCALE est une démonstration de méthode construite sur des **données publiques**.
Il illustre comment prédire un indicateur opérationnel, en vérifier la fiabilité,
en garantir la qualité et l'encadrer sur le plan réglementaire. Ce n'est pas la
reproduction d'un système interne de compagnie aérienne, et les estimations
n'engagent aucun opérateur réel.
