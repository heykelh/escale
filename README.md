# ESCALE

Petit système qui suit les vols autour de Roissy et d'Orly et estime, pour chacun,
un risque de retard. Autour de ce calcul, je tiens aussi la partie "paperasse" qui
va avec tout traitement automatisé de données : registre des données personnelles
et registre des usages d'IA.

## Ce que ça fait, concrètement

**1. Estimer le risque de retard d'un vol**
Le système récupère en continu les vols qui arrivent et partent de Roissy et d'Orly.
Pour chaque vol, il calcule une note de risque de retard. Pas avec une IA opaque :
avec trois critères simples et lisibles — l'aéroport est-il saturé à ce moment-là,
est-on à une heure de pointe, et cette liaison a-t-elle l'habitude de traîner. Un vol
qui cumule les trois ressort en risque élevé.
Le système se surveille aussi lui-même : il vérifie que les données reçues sont
complètes et récentes, et consigne les anomalies dans un journal à traiter. C'est ce
qu'on attend d'un outil qu'on laisse tourner seul — qu'il sache signaler quand quelque
chose cloche plutôt que de sortir un chiffre faux sans prévenir.

**2. Tenir le registre des données personnelles**
Dès qu'un système manipule de la donnée, il faut documenter quelles données sont
utilisées, pourquoi, sur quelle base légale et combien de temps elles sont conservées.
Cette partie tient ce registre, avec une courte analyse d'impact sur le calcul de
retard : touche-t-il à des données permettant d'identifier des personnes, et si oui
comment c'est encadré.

**3. Tenir le registre des usages d'IA**
Le règlement européen sur l'IA demande aux organisations de classer leurs systèmes
automatisés par niveau de risque et de garder une trace de là où de l'IA est utilisée.
Cette partie fait ça pour le calcul de risque de retard : elle le classe et journalise
son usage, pour qu'un responsable puisse à tout moment savoir ce qui tourne et sous
quel régime.

## Comment le score est calculé (et ce qu'il vaut)

Les données viennent d'AeroDataBox : pour chaque vol, heure prévue et heure révisée,
donc un **retard réel** (révisé − prévu) et le statut (annulé, retardé...).

La note de risque est **prospective** : elle n'utilise pas le retard du vol lui-même
(ce serait tricher), mais trois facteurs connus à l'avance — la saturation de l'aéroport
sur le créneau, l'heure (pointe/creux), et la propension de la liaison à traîner
(son retard moyen historique). Note sur 0 à 100, entièrement déterministe.

Le retard réel est conservé à part : il sert à **vérifier** le score (les vols notés
"risque élevé" partent-ils vraiment plus en retard ?). C'est une démonstration de
méthode sur données publiques, pas la reproduction d'un système interne de compagnie.

## Architecture

    OpenSky (OAuth2)  ->  GitHub Actions (cron 30 min)  ->  Supabase Postgres
                          bronze (brut) -> silver (nettoye) -> gold (score + suivi)
                                                              -> Next.js (Vercel)

Un seul entrepôt (Postgres), organisé en couches bronze / silver / gold. Le front lit
directement la couche gold. Les seuils de qualité de données déclenchent une alerte
(ntfy.sh) quand la complétude chute.

## Lancer en local (Windows)

    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt

Puis :
1. Coller `sql/schema.sql` dans Supabase (SQL Editor).
2. Copier `.env.example` en `.env` et remplir OpenSky + Supabase.
3. `python -m ingestion.ingest`
4. `pytest`

## Stack

Python 3.12 (Marche en 3.14)· Supabase Postgres · GitHub Actions · Next.js 15 · Vercel · ntfy.sh
