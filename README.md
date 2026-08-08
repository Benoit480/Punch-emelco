# Punch Travail — GitHub Pages + Firebase

Application PWA de punch et présence au travail.

## Fonctions incluses
- Connexion employé / administrateur
- Création de compte employé
- Punch entrée / sortie seulement (aucune pause)
- GPS enregistré à l'entrée et à la sortie
- Sélection du chantier
- Présence en temps réel
- Historique personnel
- Total quotidien et hebdomadaire
- Heures supplémentaires après 40 h/semaine
- Panneau administrateur
- Liste des employés présents
- Gestion de chantiers
- Feuilles de temps
- Export CSV
- Installation PWA iPhone / Android / ordinateur

## 1. Firebase déjà configuré
La configuration Web du projet **punch-emelco** est déjà intégrée dans `app.js`. Aucun `npm install` et aucun changement de clé ne sont requis.

Dans Firebase Console, il reste à vérifier :
1. Authentication > Sign-in method > activer **Email/Password**.
2. Firestore Database > créer la base si elle n’existe pas déjà.

## 2. Installer les règles Firestore
Dans Firebase > Firestore Database > Rules, remplacer les règles par le contenu de `firestore.rules`, puis publier.

## 3. Créer le premier administrateur
1. Créer ton compte dans l'app.
2. Dans Firestore, ouvrir la collection `users`.
3. Ouvrir ton document utilisateur.
4. Modifier le champ `role` de `employee` à `admin`.
5. Se déconnecter puis se reconnecter.

## 4. Publier sur GitHub Pages
1. Créer un dépôt GitHub, ex. `Punch-Presence`.
2. Envoyer tous les fichiers du dossier dans le dépôt.
3. GitHub > Settings > Pages.
4. Source : **Deploy from a branch**.
5. Branch : `main` et dossier `/ (root)`.
6. Enregistrer.

L'application sera ensuite disponible à l'adresse GitHub Pages du dépôt.

## Structure
- `index.html` : interface
- `style.css` : design
- `app.js` : Firebase, punch, GPS, historique et admin
- `manifest.webmanifest` : installation PWA
- `sw.js` : cache PWA
- `firestore.rules` : sécurité Firestore

## Important
Le GPS du navigateur fonctionne seulement sur HTTPS. GitHub Pages fournit HTTPS, donc il convient à cette application.
