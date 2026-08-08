# Punch Travail v2.3

Version GitHub Pages + Firebase pour Punch Travail.

## Important — correction v2.3

La v2.3 utilise maintenant **`punches`** comme collection unique pour les entrées, sorties et feuilles de temps.
Cela correspond aux règles Firestore fournies dans `firestore.rules`.

Compte propriétaire :
- `benoit2568@hotmail.com`
- reconnu automatiquement comme Administrateur

## Installation GitHub

1. Remplacer les fichiers du dépôt GitHub par ceux de ce ZIP.
2. Faire **Commit changes**.
3. Attendre la mise à jour de GitHub Pages.
4. Actualiser Punch Travail et se reconnecter.

## Règles Firestore

GitHub Pages ne peut pas modifier automatiquement les règles de sécurité Firebase.

Dans Firebase :
1. Cloud Firestore
2. Règles
3. Modifier les règles
4. Remplacer tout le contenu par le fichier `firestore.rules`
5. Publier

## Fonctions incluses

- Connexion employé / administrateur
- Propriétaire forcé administrateur
- Punch entrée
- Punch sortie
- GPS à l'entrée et à la sortie
- Chantiers
- Présence actuelle
- Heures du jour
- Heures de la semaine
- Heures supplémentaires après 40 h
- Historique personnel
- Gestion des employés
- Gestion des rôles
- Activation / désactivation des employés
- Modification des feuilles de temps par l'admin
- Demandes de correction
- Approbation / refus des corrections
- Export CSV
- Aucune gestion de pause

## Firebase

Projet configuré :
`punch-emelco`
