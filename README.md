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

## 1. Créer Firebase
Dans Firebase Console :
1. Créer un projet.
2. Authentication > Sign-in method > activer **Email/Password**.
3. Firestore Database > créer la base.
4. Project settings > Your apps > ajouter une application **Web**.
5. Copier le bloc `firebaseConfig`.

## 2. Mettre la configuration dans l'app
Ouvrir `app.js` et remplacer le bloc `firebaseConfig` au début du fichier.

## 3. Installer les règles Firestore
Dans Firebase > Firestore Database > Rules, remplacer les règles par le contenu de `firestore.rules`, puis publier.

## 4. Créer le premier administrateur
1. Créer ton compte dans l'app.
2. Dans Firestore, ouvrir la collection `users`.
3. Ouvrir ton document utilisateur.
4. Modifier le champ `role` de `employee` à `admin`.
5. Se déconnecter puis se reconnecter.

## 5. Publier sur GitHub Pages
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
