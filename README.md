# Aventurier Blvck — v2 (Angular + FastAPI)

Nouvelle version du site de l'agence : site public (aventures, hôtels partenaires filtrables par ville,
galerie avec visionneuse, blog, formulaire de contact) + espace admin (tableau de bord, aventures, hôtels,
galerie, blog, messages, changement de mot de passe).

```
aventurier-blvck/
├── backend/            API FastAPI (Python)
│   ├── app/            code de l'API (modèles, routes publiques, routes admin, auth JWT, upload)
│   ├── uploads/        photos (hôtels, galerie…) reprises de l'ancien site
│   ├── seed.py         crée l'admin (+ données d'exemple avec --demo)
│   ├── migrate_from_mysql.py   importe les données de l'ancien site PHP/MySQL
│   └── tests/          tests automatiques de l'API (pytest)
└── frontend/           application Angular
    ├── src/app/public/ le site public
    ├── src/app/admin/  l'espace admin
    └── src/styles.css  couleurs et thème (variables CSS en haut du fichier)
```

## 1. Lancer en développement

**Backend** (Python 3.11+) :

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows : .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # puis mettez une vraie SECRET_KEY
python seed.py --admin guide --demo                    # demande le mot de passe (8 caractères min.)
uvicorn app.main:app --reload --port 8000
```

Documentation interactive de l'API : http://localhost:8000/docs

**Frontend** (Node 20+) :

```bash
cd frontend
npm install
npm start          # http://localhost:4200 (les appels /api et /uploads sont redirigés vers le port 8000)
```

Espace admin : http://localhost:4200/admin

## 2. Reprendre les données de l'ancien site

Les photos de l'ancien site sont déjà dans `backend/uploads/`. Pour récupérer les hôtels, aventures,
photos, messages et le compte admin depuis la base MySQL de l'ancien site :

```bash
cd backend
pip install pymysql
python migrate_from_mysql.py --host localhost --user root --password "" --db aventurier_blvck
```

L'ancien mot de passe admin continue de fonctionner (les hash PHP sont compatibles).
Dans ce cas, n'utilisez pas `--demo` (les données d'exemple sont marquées « (exemple) »).

## 3. À personnaliser

- `frontend/src/app/core/models.ts` → `AGENCE` : numéro WhatsApp (active le bouton WhatsApp), liens Facebook/YouTube.
- `frontend/src/app/core/models.ts` → `VILLES` : liste des villes proposées pour les hôtels.
- `frontend/src/styles.css` : les couleurs (turquoise `--teal`, orange `--orange`…).
- Textes de l'accueil et de « Qui sommes-nous » : `frontend/src/app/public/home.html`.

## 4. Mise en ligne sur Render (recommandé)

Tout est prêt : `Dockerfile` (construit le site Angular puis lance l'API) et `render.yaml` (configuration).

1. Mettre le dossier `aventurier-blvck/` sur un dépôt GitHub **privé**.
2. Sur https://dashboard.render.com : **New → Blueprint**, choisir le dépôt. Render lit `render.yaml`.
3. Render demande les valeurs secrètes :
   - `ADMIN_PASSWORD` : mot de passe de l'admin `guide` (8 caractères min.), utilisé au premier démarrage ;
   - `SITE_URL` : l'adresse du site, ex. `https://aventurier-blvck.onrender.com` (à corriger plus tard
     si vous prenez un nom de domaine) ;
   - `CALLMEBOT_APIKEY` : la clé des notifications WhatsApp (voir plus bas), peut rester vide au début.
4. Valider. Le premier déploiement prend quelques minutes. Au premier démarrage, le disque est
   préparé : photos copiées, admin créé, aventures/hôtels/articles d'exemple ajoutés.

**Important :** les données (base + photos/vidéos) vivent sur le **disque persistant** `/var/data`
(5 Go, plan Starter minimum). Sans disque, tout serait effacé à chaque mise à jour. Render fait une
copie automatique du disque chaque jour ; en plus, Admin → **Mon compte → Télécharger une sauvegarde**
donne un .zip complet à garder sur votre ordinateur.

Mettre à jour le site = pousser le code sur GitHub : Render redéploie tout seul, les données restent.

### Notifications WhatsApp (nouveau message, nouvel avis)

Service gratuit CallMeBot : suivre https://www.callmebot.com/blog/free-api-whatsapp-messages/ depuis le
WhatsApp du +221 77 103 41 49, récupérer la clé (apikey), puis la mettre dans `CALLMEBOT_APIKEY` sur
Render (Environment). Sans clé, le site fonctionne normalement, simplement sans alerte.

## 5. Mise en production sur un autre serveur

```bash
cd frontend && npm run build          # produit frontend/dist/frontend/browser
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Quand le dossier `frontend/dist` existe, FastAPI sert aussi le site Angular : un seul service à
héberger (VPS, Render, Railway…). Pensez à :

- copier `backend/.env.example` en `backend/.env`, puis mettre `ENVIRONMENT=production` et une vraie
  `SECRET_KEY` (`python -c "import secrets; print(secrets.token_hex(32))"`). En production, le serveur
  refuse de démarrer sans cette clé, et la documentation `/docs` de l'API est désactivée ;
- mettre l'adresse du site dans `CORS_ORIGINS` (ex. `https://aventurierblvck.com`) ;
- derrière Nginx/Caddy, lancer `uvicorn ... --proxy-headers` pour que les limites anti-abus voient
  la vraie adresse IP des visiteurs (5 mots de passe faux en 15 min → blocage, 5 messages de contact
  en 10 min maximum) ;
- l'espace admin n'a plus de lien sur le site : on y accède en tapant directement `/admin` ;
- utiliser MySQL ou PostgreSQL via `DATABASE_URL` si besoin (SQLite suffit pour un site de cette taille) ;
- sauvegarder régulièrement `backend/aventurier.db` et `backend/uploads/` ;
- mettre le site derrière HTTPS (Nginx/Caddy ou l'hébergeur).

## Le blog

- Pages publiques : `/blog` (liste, filtre par catégorie, pagination) et `/blog/titre-de-l-article`.
  Les 3 derniers articles apparaissent aussi sur la page d'accueil.
- Admin → **Blog** : écrire, enregistrer en brouillon, publier, dépublier, supprimer.
- L'éditeur utilise le **Markdown** (avec une barre d'outils : intertitre, gras, italique, listes,
  encadré, lien, photo) et un onglet **Aperçu**. Exemple :

  ```markdown
  ## Un intertitre
  Du texte avec un mot en **gras** et un [lien](https://exemple.com).

  - un point
  - un autre point

  > Un encadré (conseil, citation…)
  ```
- L'adresse de l'article est créée automatiquement à partir du titre (modifiable dans « Réglages »).
- Chaque article a une image de couverture, un résumé (utilisé par Google et les partages), une
  catégorie, un temps de lecture calculé, des boutons de partage (WhatsApp, Facebook, copier le lien)
  et un appel à réserver en bas de page.
- Les 3 articles créés par `--demo` sont des exemples, à modifier ou supprimer.

## Tests

```bash
cd backend && pip install pytest httpx && pytest -q
```

## Ce qui a changé par rapport à la version PHP

- Design clair & turquoise, cohérent avec le logo (turquoise du palmier, orange du soleil).
- Bouton « Réserver » sur chaque aventure et chaque hôtel : il pré-remplit le formulaire de contact.
- Galerie avec visionneuse plein écran (flèches clavier, Échap).
- Admin : glisser-déposer des photos, envoi de plusieurs photos d'un coup, recherche/filtre des hôtels,
  réponse aux messages par email ou WhatsApp en un clic, changement de mot de passe.
- Sécurité : les identifiants de la base ne sont plus dans le code, les fichiers envoyés sont vérifiés
  (une vraie image, pas un script), les suppressions ne passent plus par de simples liens, anti-spam
  sur le formulaire, plus de fichier `hash.php` avec un mot de passe en clair.
