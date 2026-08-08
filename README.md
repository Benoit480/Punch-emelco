## Version v2.2
Compte propriétaire forcé en administrateur : benoit2568@hotmail.com

# Punch Travail — GitHub Pages + Firebase

Version complète prête à déposer dans le dépôt GitHub Pages.

## Inclus
- Connexion / création de compte employé
- Punch entrée / sortie seulement (aucune pause)
- GPS au punch
- Choix du chantier
- Présence en temps réel
- Heures du jour, de la semaine et heures supplémentaires après 40 h
- Historique personnel
- Demande de correction par l'employé
- Panneau administrateur
- Gestion des chantiers : ajouter, renommer, activer/désactiver
- Gestion des employés : rôle et activation
- Présents maintenant
- Modification directe d'une feuille de temps par l'admin
- Approbation/refus des demandes de correction
- Export CSV

## Administrateur initial
Le compte `Benoit2568@hotmail.com` est configuré comme propriétaire et sera promu administrateur à sa prochaine connexion avec les règles actuellement utilisées pendant la mise en place.

## Important — règles Firestore
Le fichier `firestore.rules` contient les règles finales recommandées. GitHub Pages ne déploie PAS ce fichier automatiquement dans Firebase.
Après avoir confirmé que le compte propriétaire affiche bien « Administrateur », copier le contenu de `firestore.rules` dans Firebase > Firestore > Règles > Modifier les règles > Publier.

## Installation GitHub
Remplacer les fichiers du dépôt par le contenu de ce dossier, puis Commit changes. GitHub Pages doit être configuré sur la branche principale et le dossier racine.
