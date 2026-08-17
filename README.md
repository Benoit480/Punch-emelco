# Punch Emelco v3.11.9 — Supprimer un punch

Ajout dans « Modifier les heures » :
- bouton « Supprimer ce punch »;
- double confirmation avant suppression;
- suppression complète de l'entrée;
- recalcul automatique des totaux après suppression;
- un contremaître peut supprimer seulement les punchs des personnes qu'il supervise;
- un administrateur peut supprimer les punchs;
- un employé normal ne voit pas le bouton.

Important : publier aussi `firestore.rules` dans Firebase afin d'autoriser la suppression par contremaître.
