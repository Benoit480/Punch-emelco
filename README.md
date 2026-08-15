# Punch Emelco v3.10.6

Correctif renforcé du chargement des employés.

- Correction de l'erreur `userMap` dans Feuilles de temps.
- `loadAdmin()` est maintenant séparé en blocs : une erreur de feuilles de temps ne bloque plus Employés.
- La liste Employés admin se charge indépendamment.
- Le sélecteur d'équipe Contremaître se charge indépendamment.
- En cas d'erreur Firebase, un message précis s'affiche au lieu de rester sur « Chargement… ».
