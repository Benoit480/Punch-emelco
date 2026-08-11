# Punch Emelco v3.3 — Menu par rôle

Ajout du menu hamburger ☰ en haut à gauche.

- Employé : Mon espace
- Contremaître : Mon espace + onglet Contremaître
- Admin : Mon espace + Contremaître + Administration

Les entrées du menu sont automatiquement masquées selon le rôle.
Le reste de l'application et le repas 30 min sont conservés.

# Punch Emelco v3.2 — 3 rôles

Rôles ajoutés :

- Employé
- Contremaître
- Administrateur

## Permissions

Employé :
- Punch entrée/sortie
- Repas 30 min
- Voir ses propres heures et historique

Contremaître :
- Tout ce qu'un employé peut faire
- Voir/modifier les heures des employés
- Approuver les heures et corrections
- Ne peut pas modifier les rôles
- Ne peut pas donner le rôle administrateur

Administrateur :
- Contrôle total
- Gestion des utilisateurs
- Gestion des rôles
- Gestion des chantiers
- Gestion des heures
- Approbations
- Rapports, exports et paramètres

Compte propriétaire conservé : `benoit2568@hotmail.com`

## Important

Le fichier `firestore.rules` inclus a été mis à jour pour les trois rôles.
Publie ces règles dans Firebase > Cloud Firestore > Règles.
