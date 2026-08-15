# Punch Emelco v3.10 — Modifier un employé

Ajout d'un bouton **Modifier** dans la liste des employés.

L'admin peut modifier :
- le nom complet;
- le rôle : Employé / Contremaître / Admin;
- le statut actif/inactif.

Le courriel est affiché en lecture seule afin de ne pas désynchroniser
le profil Firestore et le compte Firebase Authentication.

Le compte propriétaire `benoit2568@hotmail.com` reste toujours Admin et actif.
