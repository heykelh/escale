create schema if not exists gouvernance;

drop table if exists gouvernance.rgpd_traitements cascade;
create table gouvernance.rgpd_traitements (
  id int primary key, ordre int, nom text, finalite text,
  donnees_personnelles boolean, categories_donnees text, personnes_concernees text,
  base_legale text, destinataires text, duree_conservation text,
  mesures_securite text, transfert_hors_ue text, statut text
);

insert into gouvernance.rgpd_traitements values
(1, 1, 'Collecte et analyse des données de vol',
 'Suivi de la ponctualité et estimation du risque de retard des vols au départ et à l''arrivée de CDG et Orly',
 false,
 'Numéro de vol, indicatif, compagnie, aéroports d''origine et de destination, horaires prévus et réels, statut, immatriculation et modèle d''aéronef',
 'Aucune — données opérationnelles relatives à des vols et des aéronefs, pas à des personnes physiques identifiées',
 'Sans objet (absence de données personnelles). Dans un cadre professionnel, relèverait de l''intérêt légitime (art. 6.1.f)',
 'Exploitant du système (accès interne). Aucune communication à des tiers',
 '12 mois glissants pour le détail, puis agrégation statistique',
 'Accès à la base restreint, lecture applicative côté serveur uniquement, secrets hors du code, chiffrement en transit (TLS)',
 'Non. Hébergement en Union européenne (région eu-west)',
 'actif'),
(2, 2, 'Notifications d''alerte qualité',
 'Alerter l''exploitant en cas de dégradation de la qualité des données (complétude, fraîcheur, valeurs aberrantes)',
 false,
 'Métriques techniques agrégées (compteurs, pourcentages). Aucune donnée individuelle',
 'Aucune',
 'Sans objet',
 'Exploitant, via un canal de notification (ntfy.sh)',
 'Non conservées au-delà de la remise (notification transitoire)',
 'Canal dédié, absence de donnée personnelle dans le message émis',
 'Service de notification pouvant être hors UE ; aucune donnée personnelle transmise',
 'actif'),
(3, 3, 'Modèle de risque enrichi par données d''exploitation (projeté)',
 'En contexte d''exploitation réel, l''estimation du risque intégrerait des données de rotations et d''équipages — traitement anticipé, non implémenté',
 true,
 'Identifiants d''agents, plannings et rotations d''équipage (hypothétique)',
 'Personnel navigant et d''exploitation',
 'Exécution du contrat de travail (art. 6.1.b) et/ou intérêt légitime, à confirmer avec le DPO',
 'Services d''exploitation habilités',
 'À définir selon la finalité opérationnelle et les durées RH applicables',
 'Pseudonymisation, habilitations strictes, journalisation des accès',
 'À proscrire sans encadrement contractuel (clauses types / règles d''entreprise contraignantes)',
 'projete');

drop table if exists gouvernance.rgpd_dpia cascade;
create table gouvernance.rgpd_dpia (
  id int primary key, ordre int, critere text, rempli boolean, justification text
);

insert into gouvernance.rgpd_dpia values
(1, 1, 'Évaluation ou notation (scoring)', false, 'Le système note des vols, pas des personnes physiques. Le scoring ne porte pas sur des individus'),
(2, 2, 'Décision automatisée avec effet juridique ou similaire', false, 'Aucune décision affectant une personne n''est prise automatiquement'),
(3, 3, 'Surveillance systématique', false, 'Pas de surveillance de personnes'),
(4, 4, 'Données sensibles ou hautement personnelles', false, 'Aucune donnée sensible traitée'),
(5, 5, 'Traitement à grande échelle', false, 'Volume de données de vol important, mais sans données personnelles'),
(6, 6, 'Croisement d''ensembles de données', false, 'Croisement limité à des données opérationnelles de vol'),
(7, 7, 'Personnes vulnérables', false, 'Non concerné'),
(8, 8, 'Usage innovant / nouvelle technologie', true, 'Recours à un scoring algorithmique et à une architecture data récente (point de vigilance, à lui seul non déclencheur)'),
(9, 9, 'Exclusion du bénéfice d''un droit ou d''un contrat', false, 'Aucun effet de ce type');

drop table if exists gouvernance.ai_systemes cascade;
create table gouvernance.ai_systemes (
  id int primary key, ordre int, nom text, description text,
  est_systeme_ia text, classification text, justification text,
  obligations text, declencheurs text, statut text
);

insert into gouvernance.ai_systemes values
(1, 1, 'Score de risque de retard',
 'Attribue à chaque vol une note de risque de retard (0 à 100) et un niveau (faible / modéré / élevé)',
 'Le score repose sur des règles déterministes explicites, pondérées, définies par un humain (congestion, créneau horaire, propension historique de la liaison). Selon l''article 3 du règlement (UE) 2024/1689 et les lignes directrices de la Commission, les systèmes exécutant des opérations selon des règles définies uniquement par des personnes physiques ne constituent pas des systèmes d''IA. Dans sa forme actuelle, ESCALE se situe donc en marge du champ d''application',
 'minimal',
 'Non listé à l''annexe III (haut risque). N''est pas un composant de sécurité de la gestion du trafic aérien : il s''agit d''un outil d''aide à la visualisation, sans effet automatisé sur des personnes',
 'Aucune obligation contraignante au niveau de risque minimal. Transparence volontaire appliquée : la méthode de calcul est documentée et publique',
 'Reclassification à réévaluer en cas d''introduction d''apprentissage automatique (versions futures), d''usage pour une décision affectant des personnes, ou d''intégration à un dispositif de sécurité du trafic',
 'actif');

drop table if exists gouvernance.ai_tracabilite cascade;
create table gouvernance.ai_tracabilite (
  id int primary key, ordre int, date_evenement date, systeme text,
  type_evenement text, description text, responsable text
);

insert into gouvernance.ai_tracabilite values
(1, 1, '2026-08-10', 'Registre', 'Ouverture du registre', 'Ouverture du registre des usages d''IA', 'Référent IA'),
(2, 2, '2026-08-12', 'Score de risque de retard', 'Mise en service', 'Déploiement initial du calcul déterministe (v1)', 'Exploitant'),
(3, 3, '2026-08-12', 'Score de risque de retard', 'Analyse de classification', 'Classification AI Act réalisée : risque minimal, hors champ probable', 'Référent IA'),
(4, 4, '2026-08-12', 'Score de risque de retard', 'Revue qualité', 'Backtest de fiabilité : retard réel moyen croissant selon le niveau prédit', 'Exploitant');
