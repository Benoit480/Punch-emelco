# Punch Emelco v3.10.2

Correctif du nom dans les feuilles de temps.

Lorsqu'un admin modifie le nom d'un employé, les sections de semaine/paie
utilisent maintenant le nom actuel dans la collection `users` plutôt que
le vieux `userName` enregistré dans les anciens punchs.

Les anciennes heures restent intactes; seul le nom affiché est synchronisé.
