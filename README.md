# Punch Travail v2.4

Correctifs principaux :

- Suppression des requêtes Firestore composées inutiles qui déclenchaient
  **The query requires an index**.
- Tri des punchs effectué côté application lorsque possible.
- Interface iPhone remise en **pleine largeur**.
- Viewport mobile corrigé.
- Cache busting ajouté à `app.js` et `style.css`.
- Le punch actif existant dans Firestore est conservé.
- Compte propriétaire : `benoit2568@hotmail.com`
- Aucune gestion de pause.

## Installation

1. Remplacer les fichiers du dépôt GitHub par ceux de ce ZIP.
2. Faire **Commit changes**.
3. Attendre 1 à 2 minutes que GitHub Pages se mette à jour.
4. Sur iPhone, fermer complètement la page puis la rouvrir.
5. Si l'ancienne mise en page reste affichée, actualiser une seconde fois.

Aucun changement de règle Firestore n'est normalement requis pour ce correctif.
