# Punch Emelco v3.11 TEST — Mode hors connexion

Version de test basée sur la v3.10.6 stable.

Après une première ouverture en ligne, l'application met en cache l'interface, Firebase, le profil et les chantiers.

Hors connexion :
- Punch entrée
- Repas 30 min
- Changer chantier / tâche
- Punch sortie

Les actions gardent leur heure originale, sont mises en file locale et sont synchronisées automatiquement au retour du réseau. Chaque session hors ligne utilise un identifiant unique pour éviter les doublons.

Les fonctions administratives et les exports nécessitent encore Internet.
