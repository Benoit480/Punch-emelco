# Punch Emelco v3.11.4 TEST — Contremaître par employés

Modification principale :
- retrait de « Chantier supervisé »;
- un contremaître supervise maintenant seulement les employés qui lui sont assignés;
- les employés supervisés restent visibles peu importe le chantier où ils travaillent;
- approbations, corrections, feuilles de temps et export paie du contremaître utilisent la liste d'employés supervisés;
- le contremaître conserve aussi ses propres heures dans l'export paie;
- GPS reste désactivé;
- mode hors connexion conservé.

Les anciennes données `foremanSiteId` éventuellement déjà présentes dans Firestore peuvent rester,
mais elles ne servent plus à limiter la supervision.
