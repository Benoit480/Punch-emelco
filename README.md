# Punch Emelco v3.6.4 — Correctif permissions propriétaire

Le compte `benoit2568@hotmail.com` est maintenant reconnu directement
comme propriétaire dans les règles Firestore.

Cela permet notamment :
- supprimer un chantier;
- créer/modifier/supprimer des chantiers;
- gérer les utilisateurs;
- conserver les permissions Admin même si l'ancien document utilisateur
  contient encore le rôle `employee`.

IMPORTANT :
Le fichier `firestore.rules` doit être copié dans
Firebase > Cloud Firestore > Règles puis publié.
Mettre seulement le ZIP sur GitHub ne change pas les règles Firebase.
