# Punch Emelco v3.12.0 — Modifier et fractionner les heures

Ajouts pour Admin / Contremaître :
- modifier entrée et sortie;
- changer le chantier;
- changer la tâche;
- fractionner un punch en 2 périodes;
- choisir chantier et tâche de la 2e période;
- aucun doublon d’heures : la 1re période se termine exactement où la 2e commence;
- le repas n’est jamais copié dans les deux périodes;
- les périodes créées restent modifiables/supprimables séparément.

Pour les contremaîtres, la création de la 2e période est limitée aux personnes supervisées.
IMPORTANT : publier aussi firestore.rules dans Firebase.
