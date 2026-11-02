# Mise en ligne sur Netlify

Ce dossier est un site complet : la page (`public/`) et un petit serveur (`netlify/functions/api.mjs`) qui garde les données dans Netlify Blobs. Aucun compte claude.ai n'est nécessaire.

Le glisser-déposer « Netlify Drop » ne suffit pas : il ne publie pas le serveur. Utilisez l'une de ces deux méthodes.

## Méthode 1 : depuis l'ordinateur (Node.js installé)
1. Ouvrez un terminal dans ce dossier.
2. `npm install`
3. `npx netlify-cli login` (ouvre le navigateur pour vous connecter à Netlify)
4. `npx netlify-cli deploy --prod` puis choisissez « Create & configure a new project ».

## Méthode 2 : via GitHub
1. Mettez ce dossier dans un dépôt GitHub.
2. Sur Netlify : Add new project → Import an existing project → choisissez le dépôt.
3. Laissez les réglages proposés (ils sont lus dans `netlify.toml`) et déployez.

## Premier lancement
- Ouvrez l'adresse du site juste après la mise en ligne : l'écran « Première configuration » affiche déjà toute la famille (Paul, Laurence, Vincent, Jade, Ethen, Zoé, Chiara) avec un code proposé pour chacun.
- Gardez les codes proposés ou tapez les vôtres. Un code laissé vide pourra être donné plus tard. La première ligne (Paul) est l'organisateur, et son code est obligatoire.
- Cliquez sur « Créer les accès », puis transmettez à chacun son code en privé.
- Chacun entre ensuite avec son prénom et son code, et peut le changer dans « Mon code ».
- Changer le code de quelqu'un : dans « Gérer la famille », l'organisateur clique sur « Changer le code » (ou « Donner un code »), tape le code voulu ou garde celui proposé, puis « Enregistrer ». L'ancien code ne marche plus et la personne est déconnectée de ses appareils.
- Les codes sont uniquement des chiffres (4 à 12) : sur téléphone, le pavé numérique s'ouvre directement.
- Après 5 codes faux, le prénom est bloqué 10 minutes.
